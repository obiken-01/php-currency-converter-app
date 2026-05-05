import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL
  ?? "https://ralph-portfolio-production.up.railway.app/api";

const TK_ACCESS_TOKEN_KEY  = "tk_access_token";
const TK_REFRESH_TOKEN_KEY = "tk_refresh_token";

// ── Axios instance ───────────────────────────────────────────────
const tkApi = axios.create({
  baseURL: `${BASE_URL}/timekeeping`,
});

// ── Request interceptor — attach access token ────────────────────
tkApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(TK_ACCESS_TOKEN_KEY);
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

tkApi.interceptors.response.use(
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
            return tkApi(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem(TK_REFRESH_TOKEN_KEY);

      if (!refreshToken) {
        clearTokens();
        window.location.href = "/timekeeping/login";
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(
          `${BASE_URL}/timekeeping/auth/refresh`,
          { refreshToken }
        );

        const { accessToken, refreshToken: newRefreshToken } =
          res.data.data;

        localStorage.setItem(TK_ACCESS_TOKEN_KEY,  accessToken);
        localStorage.setItem(TK_REFRESH_TOKEN_KEY, newRefreshToken);

        tkApi.defaults.headers.common.Authorization =
          `Bearer ${accessToken}`;

        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return tkApi(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearTokens();
        window.location.href = "/timekeeping/login";
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
  localStorage.setItem(TK_ACCESS_TOKEN_KEY,  accessToken);
  localStorage.setItem(TK_REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(TK_ACCESS_TOKEN_KEY);
  localStorage.removeItem(TK_REFRESH_TOKEN_KEY);
}

export function getAccessToken() {
  return localStorage.getItem(TK_ACCESS_TOKEN_KEY);
}

export default tkApi;