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

/**
 * Network errors (a stalled chunk included) and 5xx may be retried. So may a
 * 401 that survived the refresh: the refresh failed for a passing reason (a
 * refusal already sends the user to the login page). Any other 4xx may not.
 */
function isRetryable(error) {
  const status = statusOf(error);
  return status === null || status === 401 || status >= 500;
}

/**
 * The finished file whose id is this upload's id (fileId equals uploadId), or
 * null when the project does not hold it. Throws when the project cannot be read.
 */
async function findFinished(api, uploadId) {
  const project = await api.project();
  return (project?.files ?? []).find((f) => f.fileId === uploadId) ?? null;
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

export function rememberUpload(file, uploadId, chunkSize) {
  const map = readMap();
  map[keyOf(file)] = { uploadId, chunkSize, savedAt: Date.now() };
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
      entry && typeof entry.uploadId === "string" && entry.chunkSize > 0 && Number.isFinite(entry.savedAt) && now - entry.savedAt <= MAX_AGE_MS;
    if (!valid) {
      delete map[key];
      pruned = true;
    }
  }
  if (pruned) writeMap(map);
  const hit = map[keyOf(file)];
  return hit ? { uploadId: hit.uploadId, chunkSize: hit.chunkSize } : null;
}

// ---- the upload -----------------------------------------------------------

/**
 * Opens the upload to send: the resumed one when the server still has it,
 * otherwise a fresh one.
 */
async function openUpload(file, api, resume) {
  if (resume?.uploadId) {
    let status = null;
    try {
      status = await api.uploadStatus(resume.uploadId);
    } catch (error) {
      if (!isUnknownUpload(error)) throw error;
      // Gone: maybe because it was completed and only the answer was lost.
      // If the project cannot be read, fail rather than risk a second copy.
      const finished = await findFinished(api, resume.uploadId);
      if (finished) return { finished };
    }
    if (status) {
      const chunkSize = resume.chunkSize;
      const matches =
        file.size === 0 ? true : chunkSize > 0 && Math.ceil(file.size / chunkSize) === status.totalChunks;
      if (!matches) {
        const error = new Error("This is not the same file as the interrupted upload.");
        error.code = "resume_mismatch";
        throw error;
      }
      return {
        uploadId: resume.uploadId,
        chunkSize,
        totalChunks: status.totalChunks,
        received: new Set(status.received ?? []),
      };
    }
  }
  const created = await api.createUpload({ filename: file.name, size: file.size, kind: kindOf(file) });
  return { ...created, received: new Set() };
}

/**
 * resume is { uploadId, chunkSize } from findInterrupted or the service's project listing.
 * When complete gets no answer or a 404, or a resume finds its upload gone, the
 * project is checked for a finished file with the upload's id, which is then
 * returned instead of failing or uploading the file a second time.
 */
export async function uploadFile(file, { api = studioApi, onProgress, onOpened, signal, resume } = {}) {
  if (signal?.aborted) throw abortError();

  // One internal controller: an outside abort or a permanent failure stops
  // every in-flight PUT and backoff wait, so nothing runs after we settle.
  const stop = new AbortController();
  const onOuterAbort = () => stop.abort();
  signal?.addEventListener("abort", onOuterAbort, { once: true });

  try {
    const upload = await openUpload(file, api, resume);
    if (stop.signal.aborted) throw abortError();
    if (upload.finished) {
      forgetUpload(file);
      onProgress?.(1);
      return upload.finished;
    }
    const { uploadId, chunkSize, totalChunks } = upload;
    onOpened?.(uploadId, chunkSize);

    const chunks = planChunks(file.size, chunkSize);
    if (chunks.length !== totalChunks) {
      throw new Error("The service's chunk plan does not match the file size.");
    }
    rememberUpload(file, uploadId, chunkSize);

    let doneBytes = 0;
    const inFlight = new Map(); // chunk n -> bytes of it sent so far, this attempt
    let lastReported = 0;
    let lastEmitted = -1;
    // Finished chunks plus the bytes in flight. Never backwards (a retried
    // chunk starts again from 0), and below 1 until complete has answered:
    // completing (probing the file) is still ahead. Progress events come
    // many times a second, so only steps of 0.1% are passed on.
    const report = (force) => {
      if (!(file.size > 0)) return;
      let bytes = doneBytes;
      for (const b of inFlight.values()) bytes += b;
      const capped = Math.min(bytes / file.size, 0.99);
      if (capped > lastReported) lastReported = capped;
      if (force || lastReported - lastEmitted >= 0.001) {
        lastEmitted = lastReported;
        onProgress?.(lastReported);
      }
    };
    const pending = [];
    for (const chunk of chunks) {
      if (upload.received.has(chunk.n)) doneBytes += chunk.end - chunk.start;
      else pending.push(chunk);
    }
    if (doneBytes > 0) report(true);

    let failure = null;

    async function sendChunk(chunk) {
      const length = chunk.end - chunk.start;
      for (let attempt = 0; ; attempt += 1) {
        let live = true;
        inFlight.set(chunk.n, 0);
        const onChunkProgress = (loaded) => {
          if (!live || stop.signal.aborted) return;
          inFlight.set(chunk.n, Math.min(Math.max(0, Number(loaded) || 0), length));
          report(false);
        };
        try {
          // Sliced per attempt and dropped after: at most CONCURRENCY slices live.
          await api.putChunk(uploadId, chunk.n, file.slice(chunk.start, chunk.end), {
            signal: stop.signal,
            onProgress: onChunkProgress,
          });
          return;
        } catch (error) {
          if (stop.signal.aborted) throw abortError();
          if (!isRetryable(error)) throw error;
          if (attempt >= RETRIES) throw new UploadPausedError(uploadId, error);
          await wait(BACKOFF_MS[attempt], stop.signal);
        } finally {
          live = false;
          inFlight.delete(chunk.n);
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
        report(true);
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
      // No answer, or the id is already consumed: the file may be finished
      // and only the answer lost. Then it is in the project under this id.
      if (!error?.response || isUnknownUpload(error)) {
        const finished = await findFinished(api, uploadId).catch(() => null);
        if (finished) meta = finished;
      }
      if (!meta) {
        if (isUnknownUpload(error)) forgetUpload(file);
        throw error;
      }
    }
    forgetUpload(file);
    onProgress?.(1);
    return meta;
  } finally {
    signal?.removeEventListener("abort", onOuterAbort);
  }
}
