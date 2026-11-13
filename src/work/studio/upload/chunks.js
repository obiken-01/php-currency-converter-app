import { studioApi } from "../studioApi";

// Chunked, resumable upload logic for Studio. No React here: it runs in node.

export const CONCURRENCY = 3;
export const RETRIES = 3;
export const BACKOFF_MS = [1000, 3000, 8000];
export const STORAGE_KEY = "studio_uploads";
export const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const EXTENSIONS = {
  video: ["mp4", "mov"],
  photo: ["jpg", "jpeg", "png", "heic", "heif"],
  audio: ["mp3", "m4a", "wav"],
};

/** "video" | "photo" | "audio" by file extension (any case), else null. */
export function kindOf(file) {
  const name = typeof file?.name === "string" ? file.name : "";
  const dot = name.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = name.slice(dot + 1).toLowerCase();
  for (const [kind, list] of Object.entries(EXTENSIONS)) {
    if (list.includes(ext)) return kind;
  }
  return null;
}

/** Contiguous chunks covering [0, size); every one is chunkSize long but the last. */
export function planChunks(size, chunkSize) {
  if (!(chunkSize > 0)) throw new RangeError("chunkSize must be positive");
  const chunks = [];
  for (let start = 0, n = 0; start < size; start += chunkSize, n += 1) {
    chunks.push({ n, start, end: Math.min(start + chunkSize, size) });
  }
  return chunks;
}

/** The upload stopped after its retries; the server still holds what arrived. */
export class UploadPausedError extends Error {
  constructor(uploadId, cause) {
    super("Upload paused");
    this.name = "UploadPausedError";
    this.uploadId = uploadId;
    this.cause = cause;
  }
}

function abortError() {
  const error = new Error("Upload aborted");
  error.name = "AbortError";
  return error;
}

const statusOf = (error) => error?.response?.status ?? null;
const isUnknownUpload = (error) => statusOf(error) === 404;

/** Network errors and 5xx may be retried; any 4xx may not. */
function isRetryable(error) {
  const status = statusOf(error);
  return status === null || status >= 500;
}

/** A timer wait that rejects at once when the signal aborts. */
function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

// ---- remembered uploads (survive a page reload) ---------------------------

const keyOf = (file) => `${file.name}|${file.size}|${file.lastModified}`;

function readMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage unavailable or full: resuming after a reload is then lost, nothing else.
  }
}

export function rememberUpload(file, uploadId) {
  const map = readMap();
  map[keyOf(file)] = { uploadId, savedAt: Date.now() };
  writeMap(map);
}

export function forgetUpload(file) {
  const map = readMap();
  const key = keyOf(file);
  if (key in map) {
    delete map[key];
    writeMap(map);
  }
}

/** Drops everything remembered (the page's "Clear files"). */
export function forgetAllUploads() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to clear
  }
}

export function findInterrupted(file) {
  const map = readMap();
  const now = Date.now();
  let pruned = false;
  for (const [key, entry] of Object.entries(map)) {
    const valid =
      entry && typeof entry.uploadId === "string" && Number.isFinite(entry.savedAt) && now - entry.savedAt <= MAX_AGE_MS;
    if (!valid) {
      delete map[key];
      pruned = true;
    }
  }
  if (pruned) writeMap(map);
  return map[keyOf(file)]?.uploadId ?? null;
}

// ---- the upload -----------------------------------------------------------

/**
 * Opens the upload to send: a resumed one when the server still has it (and
 * we can tell its chunk size), otherwise a fresh one.
 */
async function openUpload(file, api, resumeUploadId) {
  if (resumeUploadId) {
    let status = null;
    try {
      status = await api.uploadStatus(resumeUploadId);
    } catch (error) {
      if (!isUnknownUpload(error)) throw error;
    }
    if (status) {
      // The status call does not say how big a chunk is. Take it from the
      // reply when present; a single chunk is the whole file.
      const chunkSize = status.chunkSize ?? (status.totalChunks === 1 ? file.size : null);
      if (chunkSize > 0 && Math.ceil(file.size / chunkSize) === status.totalChunks) {
        return {
          uploadId: resumeUploadId,
          chunkSize,
          totalChunks: status.totalChunks,
          received: new Set(status.received ?? []),
        };
      }
      // Cannot map chunks safely: free the old one and start over.
      await api.cancelUpload(resumeUploadId).catch(() => {});
    }
  }
  const created = await api.createUpload({ filename: file.name, size: file.size, kind: kindOf(file) });
  return { ...created, received: new Set() };
}

export async function uploadFile(file, { api = studioApi, onProgress, signal, resumeUploadId } = {}) {
  if (signal?.aborted) throw abortError();

  // One internal controller: an outside abort or a permanent failure stops
  // every in-flight PUT and backoff wait, so nothing runs after we settle.
  const stop = new AbortController();
  const onOuterAbort = () => stop.abort();
  signal?.addEventListener("abort", onOuterAbort, { once: true });

  try {
    const upload = await openUpload(file, api, resumeUploadId);
    if (stop.signal.aborted) throw abortError();
    const { uploadId, chunkSize, totalChunks } = upload;

    const chunks = planChunks(file.size, chunkSize);
    if (chunks.length !== totalChunks) {
      throw new Error("The service's chunk plan does not match the file size.");
    }
    rememberUpload(file, uploadId);

    let doneBytes = 0;
    let lastReported = 0;
    // Chunks alone never reach 1: completing (probing the file) is still ahead.
    const report = (fraction) => {
      const capped = Math.min(fraction, 0.99);
      if (capped > lastReported) lastReported = capped;
      onProgress?.(lastReported);
    };
    const pending = [];
    for (const chunk of chunks) {
      if (upload.received.has(chunk.n)) doneBytes += chunk.end - chunk.start;
      else pending.push(chunk);
    }
    if (doneBytes > 0 && file.size > 0) report(doneBytes / file.size);

    let failure = null;

    async function sendChunk(chunk) {
      for (let attempt = 0; ; attempt += 1) {
        try {
          // Sliced per attempt and dropped after: at most CONCURRENCY slices live.
          await api.putChunk(uploadId, chunk.n, file.slice(chunk.start, chunk.end), { signal: stop.signal });
          return;
        } catch (error) {
          if (stop.signal.aborted) throw abortError();
          if (!isRetryable(error)) throw error;
          if (attempt >= RETRIES) throw new UploadPausedError(uploadId, error);
          await wait(BACKOFF_MS[attempt], stop.signal);
        }
      }
    }

    async function worker() {
      while (!failure && pending.length > 0) {
        const chunk = pending.shift();
        try {
          await sendChunk(chunk);
        } catch (error) {
          if (!failure) {
            failure = error;
            stop.abort();
          }
          return;
        }
        doneBytes += chunk.end - chunk.start;
        report(doneBytes / file.size);
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));

    if (signal?.aborted) throw abortError();
    if (failure) {
      if (isUnknownUpload(failure)) forgetUpload(file);
      throw failure;
    }

    let meta;
    try {
      meta = await api.completeUpload(uploadId);
    } catch (error) {
      if (isUnknownUpload(error)) forgetUpload(file);
      throw error;
    }
    forgetUpload(file);
    onProgress?.(1);
    return meta;
  } finally {
    signal?.removeEventListener("abort", onOuterAbort);
  }
}
