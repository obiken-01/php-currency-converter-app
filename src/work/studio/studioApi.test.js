import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError } from "axios";

// Like the real module: a refresh stores the new token, which the request
// interceptor then reads on the replay.
const store = vi.hoisted(() => ({ token: "old-token" }));
vi.mock("../api/workApi", () => ({
  getAccessToken: vi.fn(() => store.token),
  refreshAccessToken: vi.fn(() => {
    store.token = "new-token";
    return Promise.resolve("new-token");
  }),
}));

const { refreshAccessToken } = await import("../api/workApi");
const {
  default: studioHttp, studioApi, errorMessage, errorCode, STUDIO_URL, resolveStudioUrl, isStudioConfigured, tokenExpiry, expiresSoon,
} = await import("./studioApi");

const ok = (data = null) => Promise.resolve({ data: { data, message: null } });
const spies = {};
const last = (m) => spies[m].mock.calls.at(-1)[0];
const lastCall = (m) => spies[m].mock.calls.at(-1);

beforeEach(() => {
  for (const m of ["get", "post", "put", "delete"]) {
    spies[m] = vi.spyOn(studioHttp, m).mockImplementation(() => ok());
  }
});
afterEach(() => vi.restoreAllMocks());

describe("paths", () => {
  it("pins every endpoint path", async () => {
    const blob = new Blob(["x"]);
    await studioApi.session();                 expect(last("get")).toBe("/session");
    await studioApi.createUpload({});          expect(last("post")).toBe("/uploads");
    await studioApi.putChunk("u1", 3, blob);   expect(last("put")).toBe("/uploads/u1/chunks/3");
    await studioApi.uploadStatus("u1");        expect(last("get")).toBe("/uploads/u1");
    await studioApi.cancelUpload("u1");        expect(last("delete")).toBe("/uploads/u1");
    await studioApi.project();                 expect(last("get")).toBe("/projects/current");
    await studioApi.completeUpload("u1");      expect(last("post")).toBe("/uploads/u1/complete");
    await studioApi.deleteFile("f1");          expect(last("delete")).toBe("/files/f1");
    await studioApi.clearProject();            expect(last("delete")).toBe("/projects/current");
    await studioApi.analyze("m1");
    expect(lastCall("post").slice(0, 2)).toEqual(["/projects/analyze", { musicFileId: "m1" }]);
    await studioApi.draft({ seed: 1 });        expect(last("post")).toBe("/projects/draft");
    await studioApi.createRender({});          expect(last("post")).toBe("/renders");
    await studioApi.renderStatus("j1");        expect(last("get")).toBe("/renders/j1");
    await studioApi.deleteRender("j1");        expect(last("delete")).toBe("/renders/j1");
  });

  it("unwraps the envelope data", async () => {
    spies.get.mockImplementation(() => ok({ allowed: true }));
    expect(await studioApi.session()).toEqual({ allowed: true });
  });
});

describe("request options", () => {
  it("sends chunks as raw bytes with no total timeout, and passes the caller's abort through", async () => {
    const blob = new Blob(["x"]);
    const outer = new AbortController();
    await studioApi.putChunk("u1", 0, blob, { signal: outer.signal });
    const [, body, config] = lastCall("put");
    expect(body).toBe(blob);
    expect(config.headers["Content-Type"]).toBe("application/octet-stream");
    expect(config.timeout).toBe(0);
    expect(typeof config.onUploadProgress).toBe("function");
    expect(config.signal.aborted).toBe(false);
    outer.abort();
    // The request already settled, so its listener is gone: nothing to abort.
    expect(config.signal.aborted).toBe(false);
  });

  it("aborts the request when the caller aborts while it runs", async () => {
    let seen = null;
    spies.put.mockImplementation((url, body, config) => {
      seen = config;
      return new Promise((_, reject) => config.signal.addEventListener("abort", () => reject(new Error("canceled"))));
    });
    const outer = new AbortController();
    const p = studioApi.putChunk("u1", 0, new Blob(["x"]), { signal: outer.signal });
    outer.abort();
    const err = await p.catch((e) => e);
    expect(seen.signal.aborted).toBe(true);
    expect(err.code).not.toBe("ERR_STALLED");
  });

  it("gives the slow calls 120 s and the rest 30 s", async () => {
    await studioApi.completeUpload("u1");
    expect(lastCall("post")[2].timeout).toBe(120000);
    await studioApi.analyze("m1");
    expect(lastCall("post")[2].timeout).toBe(120000);
    await studioApi.draft({});
    expect(lastCall("post")[2].timeout).toBe(120000);
    await studioApi.createRender({});
    expect(lastCall("post")[2].timeout).toBe(30000);
    await studioApi.session();
    expect(lastCall("get")[1].timeout).toBe(30000);
  });
});

describe("download link", () => {
  it("is absolute", async () => {
    spies.post.mockImplementation(() => ok({ url: "/renders/j1/file?token=t" }));
    expect(await studioApi.downloadLink("j1")).toBe(`${STUDIO_URL}/renders/j1/file?token=t`);
  });
});

describe("error helpers", () => {
  it("errorMessage prefers the service message", () => {
    expect(errorMessage({ response: { data: { message: "Studio is private." } } })).toBe("Studio is private.");
    expect(errorMessage(new Error("Network Error"))).toBe("Can't reach Studio. Check your connection.");
  });

  it("errorCode reads the envelope code or null", () => {
    expect(errorCode({ response: { data: { code: "unknown_render" } } })).toBe("unknown_render");
    expect(errorCode(new Error("Network Error"))).toBeNull();
  });
});

describe("interceptors", () => {
  const reply = (config, status, data = { data: "ok", message: null }) => {
    const response = { status, data, config, headers: {}, statusText: "" };
    if (status < 400) return Promise.resolve(response);
    return Promise.reject(new AxiosError("fail", "ERR_BAD_REQUEST", config, null, response));
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    refreshAccessToken.mockClear();
    store.token = "old-token";
  });

  it("attaches the bearer token", async () => {
    const seen = [];
    await studioHttp.get("/session", {
      adapter: (config) => { seen.push(config.headers.Authorization); return reply(config, 200); },
    });
    expect(seen).toEqual(["Bearer old-token"]);
  });

  it("refreshes once on 401 and replays with the new token", async () => {
    const seen = [];
    const res = await studioHttp.get("/session", {
      adapter: (config) => {
        seen.push(config.headers.Authorization);
        return reply(config, seen.length === 1 ? 401 : 200);
      },
    });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(["Bearer old-token", "Bearer new-token"]);
    expect(res.data.data).toBe("ok");
  });

  it("does not retry a second 401", async () => {
    let calls = 0;
    await expect(
      studioHttp.get("/session", {
        adapter: (config) => { calls += 1; return reply(config, 401, { data: null, message: "no", code: "unauthorized" }); },
      }),
    ).rejects.toMatchObject({ response: { status: 401 } });
    expect(calls).toBe(2);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });
});

describe("token expiry", () => {
  const b64url = (o) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const jwt = (expSec) => `${b64url({ alg: "HS256" })}.${b64url({ sub: "1", exp: expSec })}.sig`;
  const now = () => Math.floor(Date.now() / 1000);
  const okAdapter = (seen) => (config) => {
    seen.push(config.headers.Authorization);
    return Promise.resolve({ status: 200, data: { data: "ok", message: null }, config, headers: {}, statusText: "" });
  };

  // Like workApi: one refresh shared by every caller until it settles.
  let posts;
  let fresh;
  function singleFlight(outcome = "ok") {
    let inFlight = null;
    refreshAccessToken.mockImplementation(() => {
      if (inFlight) return inFlight;
      posts += 1;
      inFlight = Promise.resolve()
        .then(() => {
          if (outcome !== "ok") throw new Error("Network Error");
          store.token = fresh;
          return fresh;
        })
        .finally(() => { inFlight = null; });
      return inFlight;
    });
  }

  const defaultRefresh = refreshAccessToken.getMockImplementation();
  beforeEach(() => {
    vi.restoreAllMocks();
    refreshAccessToken.mockClear();
    posts = 0;
    fresh = jwt(now() + 900);
  });
  afterEach(() => {
    refreshAccessToken.mockImplementation(defaultRefresh);
    store.token = "old-token";
  });

  it("reads exp from a token and tolerates garbage", () => {
    expect(tokenExpiry(jwt(1234))).toBe(1234);
    for (const bad of ["garbage", "a.b.c", "", null, undefined, "x.e30.y", `x.${b64url({ exp: "soon" })}.y`]) {
      expect(tokenExpiry(bad)).toBeNull();
    }
    expect(expiresSoon(jwt(now() + 30))).toBe(true);
    expect(expiresSoon(jwt(now() - 5))).toBe(true);
    expect(expiresSoon(jwt(now() + 600))).toBe(false);
    expect(expiresSoon("garbage")).toBe(false);
  });

  it("refreshes once before sending when the token has under 60 s left, for three parallel requests", async () => {
    singleFlight();
    store.token = jwt(now() + 30);
    const seen = [];
    const adapter = okAdapter(seen);
    await Promise.all([
      studioHttp.get("/projects/current", { adapter }),
      studioHttp.get("/uploads/u1", { adapter }),
      studioHttp.get("/renders/j1", { adapter }),
    ]);
    expect(posts).toBe(1);
    expect(seen).toEqual([`Bearer ${fresh}`, `Bearer ${fresh}`, `Bearer ${fresh}`]);
  });

  it("does not refresh a token with 10 minutes left", async () => {
    singleFlight();
    const token = jwt(now() + 600);
    store.token = token;
    const seen = [];
    await studioHttp.get("/projects/current", { adapter: okAdapter(seen) });
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(seen).toEqual([`Bearer ${token}`]);
  });

  it("sends a request with a token it cannot read, without refreshing", async () => {
    singleFlight();
    store.token = "garbage";
    const seen = [];
    await studioHttp.get("/projects/current", { adapter: okAdapter(seen) });
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(seen).toEqual(["Bearer garbage"]);
  });

  it("does nothing when there is no token", async () => {
    singleFlight();
    store.token = null;
    const seen = [];
    await studioHttp.get("/projects/current", { adapter: okAdapter(seen) });
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(seen).toEqual([undefined]);
  });

  it("sends with the current token when the early refresh fails", async () => {
    singleFlight("fail");
    const token = jwt(now() + 30);
    store.token = token;
    const seen = [];
    await studioHttp.get("/projects/current", { adapter: okAdapter(seen) });
    expect(posts).toBe(1);
    expect(seen).toEqual([`Bearer ${token}`]);
  });

  it("never refreshes early for the session check, which every Work user makes", async () => {
    singleFlight();
    store.token = jwt(now() + 30);
    const seen = [];
    const original = studioHttp.defaults.adapter;
    studioHttp.defaults.adapter = okAdapter(seen);
    try {
      await studioApi.session();
    } finally {
      studioHttp.defaults.adapter = original;
    }
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(seen).toHaveLength(1);
  });

  it("replays a 401 with the stored token, without a refresh, when another request already refreshed", async () => {
    singleFlight();
    store.token = "old-token";
    const seen = [];
    const res = await studioHttp.get("/projects/current", {
      adapter: (config) => {
        seen.push(config.headers.Authorization);
        if (seen.length === 1) {
          // Another request refreshed while this one was on the wire.
          store.token = "newer-token";
          return Promise.reject(new AxiosError("fail", "ERR_BAD_REQUEST", config, null, {
            status: 401, data: { data: null, message: "expired", code: "unauthorized" }, config, headers: {}, statusText: "",
          }));
        }
        return Promise.resolve({ status: 200, data: { data: "ok", message: null }, config, headers: {}, statusText: "" });
      },
    });
    expect(res.data.data).toBe("ok");
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(seen).toEqual(["Bearer old-token", "Bearer newer-token"]);
  });
});

describe("chunk stall watchdog", () => {
  const original = studioHttp.defaults.adapter;
  afterEach(() => {
    vi.useRealTimers();
    studioHttp.defaults.adapter = original;
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    store.token = "old-token";
  });

  /** An adapter that reports progress every `everyMs` (or never) and answers after `totalMs`. */
  function slowAdapter({ everyMs, totalMs }) {
    const state = { signal: null, aborted: false };
    studioHttp.defaults.adapter = (config) => {
      state.signal = config.signal;
      return new Promise((resolve, reject) => {
        let loaded = 0;
        const tick = everyMs ? setInterval(() => { loaded += 1000; config.onUploadProgress?.({ loaded, total: 8000 }); }, everyMs) : null;
        const done = setTimeout(() => {
          clearInterval(tick);
          resolve({ status: 200, data: { data: { received: [0] }, message: null }, config, headers: {}, statusText: "" });
        }, totalMs);
        config.signal.addEventListener("abort", () => {
          state.aborted = true;
          clearInterval(tick);
          clearTimeout(done);
          reject(new AxiosError("canceled", "ERR_CANCELED", config));
        });
      });
    };
    return state;
  }

  it("never aborts a chunk that keeps making progress, even past 180 s", async () => {
    vi.useFakeTimers();
    const state = slowAdapter({ everyMs: 10_000, totalMs: 250_000 });
    const progress = [];
    const p = studioApi.putChunk("u1", 0, new Blob(["x"]), { onProgress: (b) => progress.push(b) });
    await vi.advanceTimersByTimeAsync(250_000);
    await expect(p).resolves.toEqual({ received: [0] });
    expect(state.aborted).toBe(false);
    expect(progress.length).toBeGreaterThan(20);
    expect(progress.at(-1)).toBeGreaterThan(progress[0]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts a chunk with no progress for 60 s, as a network-style error with no response", async () => {
    vi.useFakeTimers();
    const state = slowAdapter({ everyMs: 0, totalMs: 500_000 });
    const p = studioApi.putChunk("u1", 0, new Blob(["x"]));
    const caught = p.catch((e) => e);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(state.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const err = await caught;
    expect(state.aborted).toBe(true);
    expect(err.code).toBe("ERR_STALLED");
    expect(err.name).not.toBe("AbortError");
    expect(err.response).toBeUndefined();
    expect(errorMessage(err)).toBe("Can't reach Studio. Check your connection.");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("counts the 60 s from the last progress event", async () => {
    vi.useFakeTimers();
    let config;
    studioHttp.defaults.adapter = (c) => {
      config = c;
      return new Promise((_, reject) => c.signal.addEventListener("abort", () => reject(new AxiosError("canceled", "ERR_CANCELED", c))));
    };
    const caught = studioApi.putChunk("u1", 0, new Blob(["x"])).catch((e) => e);
    await vi.advanceTimersByTimeAsync(50_000);
    config.onUploadProgress({ loaded: 10 });
    await vi.advanceTimersByTimeAsync(50_000);
    expect(config.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(config.signal.aborted).toBe(true);
    expect((await caught).code).toBe("ERR_STALLED");
  });
});

describe("refresh failure", () => {
  it("hands the caller the original 401, not the refresh error", async () => {
    vi.restoreAllMocks();
    refreshAccessToken.mockImplementationOnce(() => Promise.reject(new Error("Network Error")));
    const body = { data: null, message: "Studio is private.", code: "unauthorized" };
    const err = await studioHttp
      .get("/session", {
        adapter: (config) =>
          Promise.reject(
            new AxiosError("fail", "ERR_BAD_REQUEST", config, null, {
              status: 401, data: body, config, headers: {}, statusText: "",
            }),
          ),
      })
      .catch((e) => e);
    expect(err.response.status).toBe(401);
    expect(errorMessage(err)).toBe("Studio is private.");
  });
});

describe("service url", () => {
  it("is empty in production when unset or blank, so Studio is off", () => {
    expect(resolveStudioUrl({ DEV: false })).toBe("");
    expect(resolveStudioUrl({ DEV: false, VITE_STUDIO_URL: "" })).toBe("");
    expect(resolveStudioUrl({ DEV: false, VITE_STUDIO_URL: "  " })).toBe("");
  });
  it("falls back to localhost in dev only", () => {
    expect(resolveStudioUrl({ DEV: true })).toBe("http://localhost:8000");
    expect(resolveStudioUrl({ DEV: true, VITE_STUDIO_URL: "" })).toBe("http://localhost:8000");
  });
  it("uses the configured value with the trailing slash trimmed", () => {
    expect(resolveStudioUrl({ DEV: false, VITE_STUDIO_URL: "https://studio.example.com/" }))
      .toBe("https://studio.example.com");
  });
  it("reports configured state from the resolved url", () => {
    expect(isStudioConfigured()).toBe(STUDIO_URL !== "");
  });
});

describe("not configured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("rejects every request at once, with no network call", async () => {
    vi.resetModules();
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_STUDIO_URL", "");
    const fresh = await import("./studioApi");
    expect(fresh.isStudioConfigured()).toBe(false);
    const adapter = vi.fn((config) => Promise.resolve({ status: 200, data: { data: "ok" }, config, headers: {} }));
    const err = await fresh.default.get("/session", { adapter }).catch((e) => e);
    expect(adapter).not.toHaveBeenCalled();
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("studio_not_configured");
  });

  it("lets requests through when configured", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_STUDIO_URL", "https://studio.example.com");
    const fresh = await import("./studioApi");
    const adapter = vi.fn((config) => Promise.resolve({ status: 200, data: { data: "ok" }, config, headers: {} }));
    await fresh.default.get("/session", { adapter });
    expect(adapter).toHaveBeenCalledTimes(1);
  });
});
