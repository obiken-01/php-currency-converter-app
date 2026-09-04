import axios from "axios";

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
        clearTokens();
        window.location.href = "/work/login";
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
export const unwrap = (res) => res.data.data;

export default workApi;
