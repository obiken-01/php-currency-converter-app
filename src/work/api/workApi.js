import axios from "axios";
import { enqueue } from "../offline/outbox";
import { isAuthRejection, isNetworkError, isQueueable } from "../offline/policy";

const BASE_URL = import.meta.env.VITE_API_URL
  ?? "https://ralph-portfolio-production.up.railway.app/api";

const ACCESS_TOKEN_KEY  = "work_access_token";
const REFRESH_TOKEN_KEY = "work_refresh_token";

// ── One-time migration from the tk_* keys ────────────────────────
// Renaming the storage keys would otherwise log you out on next load.
// Remove this after one release.
const migrateLegacyTokens = () => {
  const legacyAccess  = localStorage.getItem("tk_access_token");
  const legacyRefresh = localStorage.getItem("tk_refresh_token");
  if (legacyAccess && !localStorage.getItem(ACCESS_TOKEN_KEY)) {
    localStorage.setItem(ACCESS_TOKEN_KEY, legacyAccess);
    if (legacyRefresh) localStorage.setItem(REFRESH_TOKEN_KEY, legacyRefresh);
  }
  localStorage.removeItem("tk_access_token");
  localStorage.removeItem("tk_refresh_token");
};
migrateLegacyTokens();

// ── Axios instance ───────────────────────────────────────────────
// The module prefix lives here, so every call site uses bare paths
// ("/logs", "/tasks") — never "/work/tasks".
const workApi = axios.create({
  baseURL: `${BASE_URL}/work`,
});

// ── Request interceptor — attach access token ────────────────────
workApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor — handle token refresh ──────────────────
let isRefreshing = false;
let failedQueue  = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

workApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Nothing left the device. A write is parked for later; a read falls
    // through to whatever the service worker cached. Either way the session
    // survives -- losing signal is not the same as being signed out.
    if (isNetworkError(error) && isQueueable(originalRequest)) {
      const entry = await enqueue({
        method: originalRequest.method,
        url: originalRequest.url,
        data: parseBody(originalRequest.data),
        label: describe(originalRequest),
      });

      // Shaped like a real response so callers keep working: unwrap() reads
      // .data.data, and `queued` lets a mutation skip the refetch that would
      // otherwise wipe its own optimistic update.
      return {
        data: { data: parseBody(originalRequest.data), queued: true, entry },
        status: 202,
        queued: true,
      };
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return workApi(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

      if (!refreshToken) {
        clearTokens();
        window.location.href = "/work/login";
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(
          `${BASE_URL}/work/auth/refresh`,
          { refreshToken }
        );

        const { accessToken, refreshToken: newRefreshToken } =
          res.data.data;

        localStorage.setItem(ACCESS_TOKEN_KEY,  accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);

        workApi.defaults.headers.common.Authorization =
          `Bearer ${accessToken}`;

        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return workApi(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);

        // Only a refusal ends the session. A refresh that never reached the
        // server means the network is down, and throwing the tokens away
        // there is what forced a fresh login every time signal dropped.
        if (isAuthRejection(refreshError)) {
          clearTokens();
          window.location.href = "/work/login";
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ── Token helpers ────────────────────────────────────────────────
export function saveTokens(accessToken, refreshToken) {
  localStorage.setItem(ACCESS_TOKEN_KEY,  accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

// Every endpoint returns the ApiResponse<T> envelope — res.data.data.
export const unwrap = (res) => markQueued(res.data.data, res?.data?.queued);

/**
 * A queued write comes back looking like a successful one, so the flag rides
 * along on the value itself -- hidden from JSON and from anything that copies
 * the object, visible to the mutation that needs to know not to refetch over
 * its own optimistic update.
 */
function markQueued(value, queued) {
  if (queued && value && typeof value === "object") {
    Object.defineProperty(value, "__queued", { value: true, enumerable: false });
  }
  return value;
}

/** True when this result was parked in the outbox rather than sent. */
export const wasQueued = (value) => Boolean(value?.__queued);

/** Axios keeps the request body as a JSON string; the queue wants the object. */
function parseBody(data) {
  if (data == null || typeof data === "object") return data ?? null;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

/** A line a person can read in a "waiting to sync" list. */
function describe(config) {
  const method = String(config?.method ?? "").toUpperCase();
  return `${method} ${config?.url ?? ""}`.trim();
}

export default workApi;
