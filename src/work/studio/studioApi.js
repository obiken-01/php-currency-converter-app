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
// One 8 MB chunk on a slow phone link. Without a limit a stalled connection
// never errors; with one, the uploader sees a network error and retries.
const CHUNK = 180_000;

const NO_CONNECTION = "Can't reach Studio. Check your connection.";

// Studio is a separate service with its own envelope. Its requests never go
// through the Work outbox: a queued render or chunk would replay out of order.
const studioHttp = axios.create({ baseURL: STUDIO_URL, timeout: FAST });

studioHttp.interceptors.request.use((config) => {
  // With no service URL a request would go to the app's own origin. Refuse it
  // here so nothing is sent, whoever calls.
  if (!isStudioConfigured()) {
    const error = new Error("Studio is not configured.");
    error.code = "studio_not_configured";
    return Promise.reject(error);
  }
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

studioHttp.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
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

export const studioApi = {
  session: () => studioHttp.get("/session", { timeout: FAST }).then(data),
  project: () => studioHttp.get("/projects/current", { timeout: FAST }).then(data),
  createUpload: ({ filename, size, kind }) =>
    studioHttp.post("/uploads", { filename, size, kind }, { timeout: FAST }).then(data),
  putChunk: (uploadId, n, blob, { signal } = {}) =>
    studioHttp
      .put(`/uploads/${uploadId}/chunks/${n}`, blob, {
        headers: { "Content-Type": "application/octet-stream" },
        timeout: CHUNK,
        signal,
      })
      .then(data),
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
