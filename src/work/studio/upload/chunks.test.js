import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError } from "axios";

const store = vi.hoisted(() => ({ token: "a1" }));
vi.mock("../../api/workApi", () => ({
  getAccessToken: vi.fn(() => store.token),
  refreshAccessToken: vi.fn(() => {
    store.token = "a2";
    return Promise.resolve("a2");
  }),
}));

const { refreshAccessToken } = await import("../../api/workApi");
const { default: studioHttp, studioApi } = await import("../studioApi");
const {
  kindOf, planChunks, uploadFile, UploadPausedError, rememberUpload, forgetUpload, forgetAllUploads, findInterrupted,
} = await import("./chunks");

// ---- helpers ---------------------------------------------------------------

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    raw: data,
  };
}

/** A file of `size` bytes whose slices are recorded, without allocating anything. */
function fakeFile(size, over = {}) {
  const slices = [];
  return {
    name: "a.mp4", size, lastModified: 1, slices,
    slice(start, end) { const s = { start, end }; slices.push(s); return s; },
    ...over,
  };
}

const httpError = (status, code) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status, data: { code } } });
const networkError = () => new Error("Network Error");
const META = { fileId: "u1", kind: "video", filename: "a.mp4", size: 20 };

function fakeApi(over = {}) {
  return {
    createUpload: vi.fn(async () => ({ uploadId: "u1", chunkSize: 8, totalChunks: 3 })),
    putChunk: vi.fn(async () => ({ received: [] })),
    uploadStatus: vi.fn(async () => ({ received: [], totalChunks: 3 })),
    completeUpload: vi.fn(async () => META),
    cancelUpload: vi.fn(async () => null),
    ...over,
  };
}
const chunkNumbers = (api) => api.putChunk.mock.calls.map((c) => c[1]).sort();

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---- pure helpers ----------------------------------------------------------

describe("planChunks and kindOf", () => {
  it("plans chunks that cover the file exactly", () => {
    expect(planChunks(20, 8)).toEqual([{ n: 0, start: 0, end: 8 }, { n: 1, start: 8, end: 16 }, { n: 2, start: 16, end: 20 }]);
    expect(planChunks(16, 8)).toHaveLength(2);
    expect(planChunks(0, 8)).toEqual([]);
  });

  it("classifies files by extension, any case", () => {
    expect(kindOf({ name: "DJI_0042.MP4" })).toBe("video");
    expect(kindOf({ name: "a.heic" })).toBe("photo");
    expect(kindOf({ name: "song.m4a" })).toBe("audio");
    expect(kindOf({ name: "notes.txt" })).toBeNull();
    expect(kindOf({ name: "noextension" })).toBeNull();
    for (const n of ["x.mov", "x.jpg", "x.jpeg", "x.png", "x.heif", "x.mp3", "x.wav"]) {
      expect(kindOf({ name: n })).not.toBeNull();
    }
  });
});

// ---- uploadFile ------------------------------------------------------------

describe("uploadFile", () => {
  it("uploads every chunk then completes", async () => {
    const api = fakeApi();
    const file = fakeFile(20);
    const meta = await uploadFile(file, { api });
    expect(api.createUpload).toHaveBeenCalledWith({ filename: "a.mp4", size: 20, kind: "video" });
    expect(chunkNumbers(api)).toEqual([0, 1, 2]);
    expect(api.putChunk.mock.calls.every((c) => c[0] === "u1")).toBe(true);
    expect(file.slices).toEqual(expect.arrayContaining([{ start: 0, end: 8 }, { start: 8, end: 16 }, { start: 16, end: 20 }]));
    expect(api.completeUpload).toHaveBeenCalledTimes(1);
    expect(api.completeUpload).toHaveBeenCalledWith("u1");
    expect(meta).toBe(META);
  });

  it("never runs more than three chunks at once", async () => {
    let active = 0;
    let peak = 0;
    const api = fakeApi({
      createUpload: vi.fn(async () => ({ uploadId: "u1", chunkSize: 1, totalChunks: 10 })),
      putChunk: vi.fn(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active -= 1;
        return { received: [] };
      }),
    });
    await uploadFile(fakeFile(10), { api });
    expect(api.putChunk).toHaveBeenCalledTimes(10);
    expect(peak).toBe(3);
  });

  it("reports progress that never goes back and ends at 1", async () => {
    const api = fakeApi();
    const seen = [];
    await uploadFile(fakeFile(20), { api, onProgress: (f) => seen.push(f) });
    expect(seen.length).toBeGreaterThan(1);
    for (let i = 1; i < seen.length; i += 1) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    expect(seen.every((f) => f >= 0 && f <= 1)).toBe(true);
    expect(seen.at(-1)).toBe(1);
    // Not 1 until complete has resolved: the last-but-one report is below 1.
    expect(seen.slice(0, -1).every((f) => f < 1)).toBe(true);
  });

  it("remembers the upload while running and forgets it once complete", async () => {
    let during = null;
    const file = fakeFile(20);
    const api = fakeApi({
      putChunk: vi.fn(async () => { during = findInterrupted(file); return { received: [] }; }),
    });
    await uploadFile(file, { api });
    expect(during).toEqual({ uploadId: "u1", chunkSize: 8 });
    expect(findInterrupted(file)).toBeNull();
  });

  it("retries a failed chunk and succeeds", async () => {
    vi.useFakeTimers();
    let fails = 0;
    const api = fakeApi({
      putChunk: vi.fn(async (id, n) => {
        if (n === 1 && fails < 2) { fails += 1; throw networkError(); }
        return { received: [] };
      }),
    });
    const p = uploadFile(fakeFile(20), { api });
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(3000);
    await expect(p).resolves.toBe(META);
    expect(api.putChunk.mock.calls.filter((c) => c[1] === 1)).toHaveLength(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("retries a 5xx", async () => {
    vi.useFakeTimers();
    let first = true;
    const api = fakeApi({
      createUpload: vi.fn(async () => ({ uploadId: "u1", chunkSize: 8, totalChunks: 1 })),
      putChunk: vi.fn(async () => {
        if (first) { first = false; throw httpError(503); }
        return { received: [] };
      }),
    });
    const p = uploadFile(fakeFile(5), { api });
    await vi.advanceTimersByTimeAsync(1000);
    await expect(p).resolves.toBe(META);
    expect(api.putChunk).toHaveBeenCalledTimes(2);
  });

  it("waits 1 s, 3 s and 8 s between attempts", async () => {
    vi.useFakeTimers();
    const api = fakeApi({
      createUpload: vi.fn(async () => ({ uploadId: "u1", chunkSize: 8, totalChunks: 1 })),
      putChunk: vi.fn(async () => { throw networkError(); }),
    });
    const p = uploadFile(fakeFile(5), { api });
    const assertion = expect(p).rejects.toBeInstanceOf(UploadPausedError);
    await vi.advanceTimersByTimeAsync(999);
    expect(api.putChunk).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(api.putChunk).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2999);
    expect(api.putChunk).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(api.putChunk).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(7999);
    expect(api.putChunk).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(api.putChunk).toHaveBeenCalledTimes(4);
    await assertion;
  });

  it("pauses after three retries and keeps the upload remembered", async () => {
    vi.useFakeTimers();
    const cause = networkError();
    const file = fakeFile(5);
    const api = fakeApi({
      createUpload: vi.fn(async () => ({ uploadId: "u1", chunkSize: 8, totalChunks: 1 })),
      putChunk: vi.fn(async () => { throw cause; }),
    });
    const p = uploadFile(file, { api });
    const assertion = expect(p).rejects.toMatchObject({ name: "UploadPausedError", uploadId: "u1", cause });
    await vi.advanceTimersByTimeAsync(1000 + 3000 + 8000);
    await assertion;
    expect(api.putChunk).toHaveBeenCalledTimes(4);
    expect(api.completeUpload).not.toHaveBeenCalled();
    expect(findInterrupted(file)).toEqual({ uploadId: "u1", chunkSize: 8 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops starting new chunks once one has failed for good", async () => {
    const api = fakeApi({
      createUpload: vi.fn(async () => ({ uploadId: "u1", chunkSize: 1, totalChunks: 10 })),
      putChunk: vi.fn(async (id, n) => {
        if (n === 0) throw httpError(400, "bad_chunk");
        await new Promise((r) => setTimeout(r, 5));
        return { received: [] };
      }),
    });
    await expect(uploadFile(fakeFile(10), { api })).rejects.toMatchObject({ response: { status: 400 } });
    expect(api.putChunk.mock.calls.length).toBeLessThanOrEqual(3);
    expect(api.completeUpload).not.toHaveBeenCalled();
  });

  it("resumes only the missing chunks", async () => {
    // Three chunks of 8 over 20 bytes; the status reply, like the service's, has no chunk size.
    const api = fakeApi({ uploadStatus: vi.fn(async () => ({ received: [0, 2], totalChunks: 3 })) });
    const seen = [];
    const meta = await uploadFile(fakeFile(20), { api, resume: { uploadId: "u1", chunkSize: 8 }, onProgress: (f) => seen.push(f) });
    expect(api.uploadStatus).toHaveBeenCalledWith("u1");
    expect(api.createUpload).not.toHaveBeenCalled();
    expect(chunkNumbers(api)).toEqual([1]);
    expect(seen[0]).toBeCloseTo(12 / 20);
    expect(meta).toBe(META);
  });

  it("resumes with the remembered chunk size, sending the right byte ranges", async () => {
    const file = fakeFile(20);
    const api = fakeApi({ uploadStatus: vi.fn(async () => ({ received: [0], totalChunks: 3 })) });
    await uploadFile(file, { api, resume: { uploadId: "u1", chunkSize: 8 } });
    expect(chunkNumbers(api)).toEqual([1, 2]);
    expect(api.cancelUpload).not.toHaveBeenCalled();
    const sizes = Object.fromEntries(api.putChunk.mock.calls.map((c) => [c[1], c[2].end - c[2].start]));
    expect(sizes).toEqual({ 1: 8, 2: 4 });
  });

  it("rejects a resume for a different file without sending anything", async () => {
    const api = fakeApi({ uploadStatus: vi.fn(async () => ({ received: [0], totalChunks: 5 })) });
    const p = uploadFile(fakeFile(20), { api, resume: { uploadId: "u1", chunkSize: 8 } });
    await expect(p).rejects.toMatchObject({
      code: "resume_mismatch",
      message: "This is not the same file as the interrupted upload.",
    });
    expect(api.putChunk).not.toHaveBeenCalled();
    expect(api.createUpload).not.toHaveBeenCalled();
    expect(api.cancelUpload).not.toHaveBeenCalled();
  });

  it("starts a fresh upload when the server no longer has the resumed one", async () => {
    const api = fakeApi({ uploadStatus: vi.fn(async () => { throw httpError(404, "unknown_upload"); }) });
    await uploadFile(fakeFile(20), { api, resume: { uploadId: "gone", chunkSize: 8 } });
    expect(api.createUpload).toHaveBeenCalledTimes(1);
    expect(chunkNumbers(api)).toEqual([0, 1, 2]);
    expect(api.putChunk.mock.calls.every((c) => c[0] === "u1")).toBe(true);
  });

  it("rejects, without retrying, when the upload vanishes mid-way", async () => {
    const api = fakeApi({ putChunk: vi.fn(async () => { throw httpError(404, "unknown_upload"); }) });
    const file = fakeFile(5);
    api.createUpload.mockResolvedValue({ uploadId: "u1", chunkSize: 8, totalChunks: 1 });
    await expect(uploadFile(file, { api })).rejects.toMatchObject({ response: { status: 404 } });
    expect(api.putChunk).toHaveBeenCalledTimes(1);
    expect(findInterrupted(file)).toBeNull();
  });

  it("does not treat a 4xx as retryable", async () => {
    const err = httpError(413, "body_too_large");
    const api = fakeApi({
      createUpload: vi.fn(async () => ({ uploadId: "u1", chunkSize: 8, totalChunks: 1 })),
      putChunk: vi.fn(async () => { throw err; }),
    });
    await expect(uploadFile(fakeFile(5), { api })).rejects.toBe(err);
    expect(api.putChunk).toHaveBeenCalledTimes(1);
  });
});

// ---- abort -----------------------------------------------------------------

describe("abort", () => {
  it("rejects before the first request without calling the service", async () => {
    const api = fakeApi();
    const ac = new AbortController();
    ac.abort();
    await expect(uploadFile(fakeFile(20), { api, signal: ac.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(api.createUpload).not.toHaveBeenCalled();
    expect(api.putChunk).not.toHaveBeenCalled();
  });

  it("stops during in-flight chunks, sends nothing more and does not cancel on the server", async () => {
    const ac = new AbortController();
    const api = fakeApi({
      createUpload: vi.fn(async () => ({ uploadId: "u1", chunkSize: 1, totalChunks: 10 })),
      putChunk: vi.fn((id, n, blob, { signal }) =>
        new Promise((resolve, reject) => {
          signal.addEventListener("abort", () => reject(Object.assign(new Error("canceled"), { code: "ERR_CANCELED" })));
        })),
    });
    const p = uploadFile(fakeFile(10), { api, signal: ac.signal });
    const assertion = expect(p).rejects.toMatchObject({ name: "AbortError" });
    await new Promise((r) => setTimeout(r, 5));
    expect(api.putChunk).toHaveBeenCalledTimes(3);
    ac.abort();
    await assertion;
    expect(api.putChunk).toHaveBeenCalledTimes(3);
    expect(api.completeUpload).not.toHaveBeenCalled();
    expect(api.cancelUpload).not.toHaveBeenCalled();
  });

  it("stops promptly during a backoff wait", async () => {
    vi.useFakeTimers();
    const ac = new AbortController();
    const api = fakeApi({
      createUpload: vi.fn(async () => ({ uploadId: "u1", chunkSize: 8, totalChunks: 1 })),
      putChunk: vi.fn(async () => { throw networkError(); }),
    });
    const p = uploadFile(fakeFile(5), { api, signal: ac.signal });
    const assertion = expect(p).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(10);
    expect(vi.getTimerCount()).toBe(1);
    ac.abort();
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
    expect(api.putChunk).toHaveBeenCalledTimes(1);
    expect(api.cancelUpload).not.toHaveBeenCalled();
  });
});

// ---- expired token, through the real http client ---------------------------

describe("token refresh mid-upload", () => {
  const original = studioHttp.defaults.adapter;
  afterEach(() => { studioHttp.defaults.adapter = original; });

  it("survives an expired token mid-upload", async () => {
    store.token = "a1";
    refreshAccessToken.mockClear();
    const puts = [];
    const reply = (config, status, body) => {
      const response = { status, data: body, config, headers: {}, statusText: "" };
      if (status < 400) return Promise.resolve(response);
      return Promise.reject(new AxiosError("fail", "ERR_BAD_REQUEST", config, null, response));
    };
    let chunk1Seen = 0;
    studioHttp.defaults.adapter = (config) => {
      const auth = config.headers.Authorization;
      if (config.method === "post" && config.url === "/uploads") {
        return reply(config, 200, { data: { uploadId: "u1", chunkSize: 8, totalChunks: 3 }, message: null });
      }
      if (config.method === "put") {
        puts.push([config.url, auth]);
        if (config.url.endsWith("/chunks/1")) {
          chunk1Seen += 1;
          if (chunk1Seen === 1) return reply(config, 401, { data: null, message: "expired", code: "unauthorized" });
        }
        return reply(config, 200, { data: { received: [] }, message: null });
      }
      if (config.method === "post" && config.url === "/uploads/u1/complete") {
        return reply(config, 200, { data: META, message: null });
      }
      return reply(config, 404, { data: null, message: "no", code: "not_found" });
    };

    const file = new File([new Uint8Array(20)], "a.mp4", { lastModified: 1 });
    const meta = await uploadFile(file, { api: studioApi });

    expect(meta).toEqual(META);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    const chunk1 = puts.filter(([url]) => url.endsWith("/chunks/1"));
    expect(chunk1).toEqual([["/uploads/u1/chunks/1", "Bearer a1"], ["/uploads/u1/chunks/1", "Bearer a2"]]);
    expect(puts.filter(([url]) => url.endsWith("/chunks/0"))).toHaveLength(1);
    expect(puts.filter(([url]) => url.endsWith("/chunks/2"))).toHaveLength(1);
  });
});

// ---- remembered uploads ----------------------------------------------------

describe("remembered uploads", () => {
  it("finds an interrupted upload for the same file after a reload", () => {
    const file = { name: "a.mp4", size: 5, lastModified: 1 };
    rememberUpload(file, "u1", 8);
    expect(findInterrupted({ name: "a.mp4", size: 5, lastModified: 1 })).toEqual({ uploadId: "u1", chunkSize: 8 });
    expect(JSON.parse(localStorage.getItem("studio_uploads"))["a.mp4|5|1"]).toMatchObject({ uploadId: "u1" });
  });

  it("does not match a different file with the same name and size", () => {
    rememberUpload({ name: "a.mp4", size: 5, lastModified: 1 }, "u1", 8);
    expect(findInterrupted({ name: "a.mp4", size: 5, lastModified: 2 })).toBeNull();
  });

  it("drops remembered uploads older than 24 hours", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const file = { name: "a.mp4", size: 5, lastModified: 1 };
    rememberUpload(file, "u1", 8);
    vi.setSystemTime(new Date("2026-01-01T23:59:00Z"));
    expect(findInterrupted(file)).toEqual({ uploadId: "u1", chunkSize: 8 });
    vi.setSystemTime(new Date("2026-01-02T00:01:00Z"));
    expect(findInterrupted(file)).toBeNull();
    expect(JSON.parse(localStorage.getItem("studio_uploads"))).toEqual({});
  });

  it("forgets one file or all of them", () => {
    const a = { name: "a.mp4", size: 5, lastModified: 1 };
    const b = { name: "b.mp4", size: 5, lastModified: 1 };
    rememberUpload(a, "u1", 8);
    rememberUpload(b, "u2", 4);
    forgetUpload(a);
    expect(findInterrupted(a)).toBeNull();
    expect(findInterrupted(b)).toEqual({ uploadId: "u2", chunkSize: 4 });
    forgetAllUploads();
    expect(localStorage.getItem("studio_uploads")).toBeNull();
    expect(findInterrupted(b)).toBeNull();
  });

  it("tolerates garbage or missing storage", () => {
    const file = { name: "a.mp4", size: 5, lastModified: 1 };
    for (const raw of ["not json", "null", "[1,2]", '"str"', '{"a.mp4|5|1":"oops"}', '{"a.mp4|5|1":{"uploadId":1}}']) {
      localStorage.setItem("studio_uploads", raw);
      expect(findInterrupted(file)).toBeNull();
      rememberUpload(file, "u1", 8);
      expect(findInterrupted(file)).toEqual({ uploadId: "u1", chunkSize: 8 });
      forgetUpload(file);
    }
    vi.stubGlobal("localStorage", undefined);
    expect(findInterrupted(file)).toBeNull();
    expect(() => { rememberUpload(file, "u1", 8); forgetUpload(file); forgetAllUploads(); }).not.toThrow();
  });
});
