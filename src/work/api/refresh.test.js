import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";

/**
 * workApi reads localStorage at import time (legacy token migration), so the
 * stub has to exist before the module is loaded.
 */
const store = new Map();
vi.stubGlobal("localStorage", {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
});
const fakeWindow = { location: { href: "" } };
vi.stubGlobal("window", fakeWindow);

const { default: workApi, refreshAccessToken } = await import("./workApi");

const refreshed = (accessToken, refreshToken) => ({
  data: { data: { accessToken, refreshToken } },
});

const httpError = (status, config) =>
  new axios.AxiosError("failed", "ERR_BAD_REQUEST", config, {}, {
    status,
    data: {},
    config,
    headers: {},
  });

let postSpy;

beforeEach(() => {
  store.clear();
  fakeWindow.location.href = "";
  postSpy = vi.spyOn(axios, "post");
  delete workApi.defaults.headers.common.Authorization;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("refreshAccessToken", () => {
  it("stores and returns the new tokens", async () => {
    store.set("work_refresh_token", "r1");
    postSpy.mockResolvedValue(refreshed("a2", "r2"));

    expect(await refreshAccessToken()).toBe("a2");
    expect(localStorage.getItem("work_access_token")).toBe("a2");
    expect(localStorage.getItem("work_refresh_token")).toBe("r2");
    expect(postSpy.mock.calls[0][0]).toMatch(/\/work\/auth\/refresh$/);
    expect(postSpy.mock.calls[0][1]).toEqual({ refreshToken: "r1" });
  });

  it("shares one request between concurrent callers", async () => {
    store.set("work_refresh_token", "r1");
    postSpy.mockResolvedValue(refreshed("a2", "r2"));

    const [a, b] = await Promise.all([refreshAccessToken(), refreshAccessToken()]);
    expect(a).toBe("a2");
    expect(a).toBe(b);
    expect(postSpy).toHaveBeenCalledTimes(1);
  });

  it("starts a new refresh once the previous one has settled", async () => {
    store.set("work_refresh_token", "r1");
    postSpy
      .mockResolvedValueOnce(refreshed("a2", "r2"))
      .mockResolvedValueOnce(refreshed("a3", "r3"));

    expect(await refreshAccessToken()).toBe("a2");
    expect(await refreshAccessToken()).toBe("a3");
    expect(postSpy).toHaveBeenCalledTimes(2);
  });

  it("starts a new refresh after a failed one", async () => {
    store.set("work_refresh_token", "r1");
    postSpy.mockRejectedValueOnce({ message: "Network Error" });
    await expect(refreshAccessToken()).rejects.toBeTruthy();

    postSpy.mockResolvedValueOnce(refreshed("a2", "r2"));
    expect(await refreshAccessToken()).toBe("a2");
    expect(postSpy).toHaveBeenCalledTimes(2);
  });

  it("clears tokens and redirects when the server refuses", async () => {
    store.set("work_access_token", "a1");
    store.set("work_refresh_token", "r1");
    const refusal = { response: { status: 401 } };
    postSpy.mockRejectedValue(refusal);

    await expect(refreshAccessToken()).rejects.toBe(refusal);
    expect(localStorage.getItem("work_access_token")).toBeNull();
    expect(localStorage.getItem("work_refresh_token")).toBeNull();
    expect(fakeWindow.location.href).toBe("/work/login");
  });

  it("keeps tokens when the network is down", async () => {
    store.set("work_access_token", "a1");
    store.set("work_refresh_token", "r1");
    const offline = { message: "Network Error", request: {} };
    postSpy.mockRejectedValue(offline);

    await expect(refreshAccessToken()).rejects.toBe(offline);
    expect(localStorage.getItem("work_access_token")).toBe("a1");
    expect(localStorage.getItem("work_refresh_token")).toBe("r1");
    expect(fakeWindow.location.href).toBe("");
  });

  it("rejects and redirects when there is no refresh token", async () => {
    store.set("work_access_token", "a1");

    await expect(refreshAccessToken()).rejects.toBeTruthy();
    expect(postSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem("work_access_token")).toBeNull();
    expect(fakeWindow.location.href).toBe("/work/login");
  });
});

describe("workApi 401 handling", () => {
  // Answers 401 to the first `rejections` calls that carry the old token, 200
  // to everything else, and records the Authorization header of every call.
  const installAdapter = (isRejected) => {
    const seen = [];
    workApi.defaults.adapter = async (config) => {
      const auth = config.headers.Authorization ?? config.headers.get?.("Authorization");
      seen.push({ url: config.url, auth });
      if (isRejected(auth, seen.length)) throw httpError(401, config);
      return { data: { data: config.url }, status: 200, statusText: "OK", headers: {}, config };
    };
    return seen;
  };

  it("replays a 401 with the new token after one refresh", async () => {
    store.set("work_access_token", "old");
    store.set("work_refresh_token", "r1");
    postSpy.mockResolvedValue(refreshed("new", "r2"));
    const seen = installAdapter((auth) => auth === "Bearer old");

    const res = await workApi.get("/tasks");

    expect(res.data.data).toBe("/tasks");
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(seen.map((s) => s.auth)).toEqual(["Bearer old", "Bearer new"]);
  });

  it("makes exactly one refresh call for two concurrent 401s", async () => {
    store.set("work_access_token", "old");
    store.set("work_refresh_token", "r1");
    postSpy.mockResolvedValue(refreshed("new", "r2"));
    const seen = installAdapter((auth) => auth === "Bearer old");

    const [a, b] = await Promise.all([workApi.get("/a"), workApi.get("/b")]);

    expect(a.data.data).toBe("/a");
    expect(b.data.data).toBe("/b");
    expect(postSpy).toHaveBeenCalledTimes(1);
    const replays = seen.filter((s) => s.auth === "Bearer new");
    expect(replays.map((s) => s.url).sort()).toEqual(["/a", "/b"]);
  });

  it("does not retry a replayed request that is rejected again", async () => {
    store.set("work_access_token", "old");
    store.set("work_refresh_token", "r1");
    postSpy.mockResolvedValue(refreshed("new", "r2"));
    const seen = installAdapter(() => true);

    await expect(workApi.get("/tasks")).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(2);
  });

  it("rejects every waiting request with the same error when the shared refresh fails", async () => {
    store.set("work_access_token", "old");
    store.set("work_refresh_token", "r1");
    const failure = { response: { status: 502 } };
    postSpy.mockRejectedValue(failure);
    installAdapter((auth) => auth === "Bearer old");

    const results = await Promise.allSettled([workApi.get("/a"), workApi.get("/b"), workApi.get("/c")]);

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(results.map((r) => r.status)).toEqual(["rejected", "rejected", "rejected"]);
    expect(results.every((r) => r.reason === failure)).toBe(true);
    // A 502 is not a refusal: the session survives.
    expect(localStorage.getItem("work_refresh_token")).toBe("r1");
  });

  it("gives the caller the original 401 when there is no refresh token", async () => {
    store.set("work_access_token", "old");
    installAdapter(() => true);

    const error = await workApi.get("/tasks").catch((e) => e);

    expect(error.response.status).toBe(401);
    expect(error.code).not.toBe("NO_REFRESH_TOKEN");
    expect(postSpy).not.toHaveBeenCalled();
    expect(fakeWindow.location.href).toBe("/work/login");
  });
});
