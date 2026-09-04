import workApi, { unwrap, getRefreshToken } from "./workApi";

export const authApi = {
  login:  (credentials) => workApi.post("/auth/login", credentials).then(unwrap),
  me:     ()            => workApi.get("/auth/me").then(unwrap),
  revoke: ()            => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return Promise.resolve(null);
    return workApi.post("/auth/revoke", { refreshToken }).then(unwrap);
  },
};

export default authApi;
