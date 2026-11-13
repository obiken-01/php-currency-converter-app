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
const { default: studioHttp, studioApi, errorMessage, errorCode, STUDIO_URL, resolveStudioUrl, isStudioConfigured } =
  await import("./studioApi");

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
  it("sends chunks as raw bytes with no timeout", async () => {
    const blob = new Blob(["x"]);
    const signal = new AbortController().signal;
    await studioApi.putChunk("u1", 0, blob, { signal });
    const [, body, config] = lastCall("put");
    expect(body).toBe(blob);
    expect(config.headers["Content-Type"]).toBe("application/octet-stream");
    expect(config.timeout).toBe(0);
    expect(config.signal).toBe(signal);
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
