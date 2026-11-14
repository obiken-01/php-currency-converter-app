import axios from "axios";
import { getAccessToken, refreshAccessToken } from "../api/workApi";

/**
 * The localhost fallback is for dev only. A production build with no URL
 * must not guess one: it would send the Work token to whatever listens on
 * that port (and an http call from an https page is blocked anyway).
 * An empty value counts as unset. A trailing slash is trimmed.
 */
export function resolveStudioUrl(env) {
  const set = typeof env.VITE_STUDIO_URL === "string" ? env.VITE_STUDIO_URL.trim() : "";
  if (set) return set.replace(/\/+$/, "");
  return env.DEV ? "http://localhost:8000" : "";
}

export const STUDIO_URL = resolveStudioUrl(import.meta.env);

/** False when no service URL is configured: Studio is then simply off. */
export function isStudioConfigured() {
  return STUDIO_URL !== "";
}

const FAST = 30_000;
// The first beat analysis after a deploy is slow, and a big upload's
// completion probes the whole file.
const SLOW = 120_000;
// A chunk has no total time limit: six 8 MB PUTs can share a slow uplink.
// Instead a chunk that sends nothing for this long is aborted, and the
// uploader sees a network-style error and retries it.
export const STALL_MS = 60_000;
// The access token is refreshed before a request when it has less than this left.
const REFRESH_AHEAD_SEC = 60;

const NO_CONNECTION = "Can't reach Studio. Check your connection.";

// Studio is a separate service with its own envelope. Its requests never go
// through the Work outbox: a queued render or chunk would replay out of order.
const studioHttp = axios.create({ baseURL: STUDIO_URL, timeout: FAST });

/** The token's `exp` (epoch seconds), or null when it cannot be read. Not verified. */
export function tokenExpiry(token) {
  try {
    const part = String(token).split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    const exp = JSON.parse(atob(base64))?.exp;
    return typeof exp === "number" && Number.isFinite(exp) ? exp : null;
  } catch {
    return null;
  }
}

/** True when the token is past or within a minute of its expiry. Unreadable: false. */
export function expiresSoon(token, nowMs = Date.now()) {
  const exp = tokenExpiry(token);
  return exp !== null && exp - nowMs / 1000 < REFRESH_AHEAD_SEC;
}

studioHttp.interceptors.request.use(async (config) => {
  // With no service URL a request would go to the app's own origin. Refuse it
  // here so nothing is sent, whoever calls.
  if (!isStudioConfigured()) {
    const error = new Error("Studio is not configured.");
    error.code = "studio_not_configured";
    throw error;
  }
  let token = getAccessToken();
  // The service answers 401 before reading an 8 MB body, and a browser often
  // reports that as a reset connection with no response. So a token about to
  // expire is renewed first. The session check, which every Work user makes,
  // never does this: it must not cost them a refresh.
  if (token && config.refreshAhead !== false && expiresSoon(token)) {
    try {
      await refreshAccessToken();
    } catch {
      // Send with what we have; the 401 path below handles the rest.
    }
    token = getAccessToken();
  }
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const sentToken = (config) => config.headers?.Authorization ?? config.headers?.get?.("Authorization") ?? null;

studioHttp.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      // Another request refreshed while this one was on the wire: the stored
      // token is already new, so replay with it instead of refreshing again.
      const stored = getAccessToken();
      if (stored && sentToken(original) !== `Bearer ${stored}`) {
        original.headers.Authorization = `Bearer ${stored}`;
        return studioHttp(original);
      }
      let accessToken;
      try {
        accessToken = await refreshAccessToken();
      } catch {
        // The caller gets the 401 that started this, with the service's message.
        return Promise.reject(error);
      }
      original.headers.Authorization = `Bearer ${accessToken}`;
      return studioHttp(original);
    }
    return Promise.reject(error);
  },
);

const data = (res) => res.data.data;

/** What a chunk that stopped moving rejects with: no response, so it is retried like a dropped connection. */
function stallError(cause) {
  const error = new Error("The upload stalled.");
  error.code = "ERR_STALLED";
  error.cause = cause;
  return error;
}

/**
 * One chunk. No total timeout; a watchdog aborts it after STALL_MS without
 * upload progress. `signal` is the caller's abort (rejects as axios cancels);
 * `onProgress(loadedBytes)` reports bytes sent within this chunk.
 */
function putChunk(uploadId, n, blob, { signal, onProgress } = {}) {
  const inner = new AbortController();
  let stalled = false;
  let timer = null;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      stalled = true;
      inner.abort();
    }, STALL_MS);
  };
  const onOuterAbort = () => inner.abort();
  if (signal?.aborted) inner.abort();
  else signal?.addEventListener("abort", onOuterAbort, { once: true });
  arm();

  return studioHttp
    .put(`/uploads/${uploadId}/chunks/${n}`, blob, {
      headers: { "Content-Type": "application/octet-stream" },
      timeout: 0,
      signal: inner.signal,
      onUploadProgress: (event) => {
        arm();
        onProgress?.(event?.loaded ?? 0);
      },
    })
    .then(data, (error) => {
      if (stalled && !signal?.aborted) throw stallError(error);
      throw error;
    })
    .finally(() => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onOuterAbort);
    });
}

export const studioApi = {
  session: () => studioHttp.get("/session", { timeout: FAST, refreshAhead: false }).then(data),
  project: () => studioHttp.get("/projects/current", { timeout: FAST }).then(data),
  createUpload: ({ filename, size, kind }) =>
    studioHttp.post("/uploads", { filename, size, kind }, { timeout: FAST }).then(data),
  putChunk,
  uploadStatus: (uploadId) => studioHttp.get(`/uploads/${uploadId}`, { timeout: FAST }).then(data),
  completeUpload: (uploadId) =>
    studioHttp.post(`/uploads/${uploadId}/complete`, undefined, { timeout: SLOW }).then(data),
  cancelUpload: (uploadId) => studioHttp.delete(`/uploads/${uploadId}`, { timeout: FAST }).then(data),
  deleteFile: (fileId) => studioHttp.delete(`/files/${fileId}`, { timeout: FAST }).then(data),
  clearProject: () => studioHttp.delete("/projects/current", { timeout: FAST }).then(data),
  analyze: (musicFileId) =>
    studioHttp.post("/projects/analyze", { musicFileId }, { timeout: SLOW }).then(data),
  draft: (request) => studioHttp.post("/projects/draft", request, { timeout: SLOW }).then(data),
  createRender: (editList) => studioHttp.post("/renders", editList, { timeout: FAST }).then(data),
  renderStatus: (jobId) => studioHttp.get(`/renders/${jobId}`, { timeout: FAST }).then(data),
  downloadLink: (jobId) =>
    studioHttp
      .post(`/renders/${jobId}/download-link`, undefined, { timeout: FAST })
      .then(data)
      .then((link) => STUDIO_URL + link.url),
  deleteRender: (jobId) => studioHttp.delete(`/renders/${jobId}`, { timeout: FAST }).then(data),
};

/** The service's own sentence when it sent one, else a connection hint. */
export function errorMessage(error) {
  return error?.response?.data?.message || NO_CONNECTION;
}

/** The service's machine code (e.g. "unknown_render"), or null. */
export function errorCode(error) {
  return error?.response?.data?.code ?? null;
}

export default studioHttp;
