import { describe, expect, it } from "vitest";
import { createUploadQueue } from "./uploadQueue";

// A run function whose uploads finish only when the test says so.
function harness(limit = 2) {
  const calls = new Map();
  const events = [];
  const run = (item, { signal, onProgress }) =>
    new Promise((resolve, reject) => {
      calls.set(item.id, { item, signal, onProgress, resolve, reject });
      signal.addEventListener("abort", () => {
        const error = new Error("Upload aborted");
        error.name = "AbortError";
        reject(error);
      });
    });
  const queue = createUploadQueue({ run, limit, onEvent: (e) => events.push(e) });
  return { queue, calls, events };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const types = (events, id) => events.filter((e) => e.id === id).map((e) => e.type);

describe("createUploadQueue", () => {
  it("runs at most `limit` uploads at once and starts the rest in order", async () => {
    const { queue, calls, events } = harness(2);
    queue.add({ id: "a" });
    queue.add({ id: "b" });
    queue.add({ id: "c" });
    queue.add({ id: "d" });
    expect([...calls.keys()]).toEqual(["a", "b"]);
    expect(events.filter((e) => e.type === "started").map((e) => e.id)).toEqual(["a", "b"]);

    calls.get("b").resolve({ fileId: "fb" });
    await flush();
    expect([...calls.keys()]).toEqual(["a", "b", "c"]);
    expect(events).toContainEqual({ type: "done", id: "b", meta: { fileId: "fb" } });

    calls.get("a").reject(new Error("boom"));
    await flush();
    expect([...calls.keys()]).toEqual(["a", "b", "c", "d"]);
    expect(events.find((e) => e.type === "failed" && e.id === "a").error.message).toBe("boom");
  });

  it("reports progress for the running item", async () => {
    const { queue, calls, events } = harness();
    queue.add({ id: "a" });
    calls.get("a").onProgress(0.5);
    expect(events).toContainEqual({ type: "progress", id: "a", progress: 0.5 });
  });

  it("passes the item through to run", () => {
    const { queue, calls } = harness();
    const item = { id: "a", resume: { uploadId: "u1", chunkSize: 8 } };
    queue.add(item);
    expect(calls.get("a").item).toBe(item);
  });

  it("cancels a waiting item without running it", async () => {
    const { queue, calls, events } = harness(1);
    queue.add({ id: "a" });
    queue.add({ id: "b" });
    expect(await queue.cancel("b")).toEqual({ status: "waiting" });
    calls.get("a").resolve({});
    await flush();
    expect(calls.has("b")).toBe(false);
    expect(types(events, "b")).toEqual([]);
  });

  it("cancels a running item: aborts it, emits nothing more for it, starts the next", async () => {
    const { queue, calls, events } = harness(1);
    queue.add({ id: "a" });
    queue.add({ id: "b" });
    const result = await queue.cancel("a");
    expect(calls.get("a").signal.aborted).toBe(true);
    expect(result).toEqual({ status: "aborted" });
    expect(types(events, "a")).toEqual(["started"]);
    expect(calls.has("b")).toBe(true);
  });

  it("returns the meta when a cancelled upload completed anyway", async () => {
    const calls = new Map();
    const run = (item) => new Promise((resolve) => calls.set(item.id, resolve));
    const events = [];
    const queue = createUploadQueue({ run, onEvent: (e) => events.push(e) });
    queue.add({ id: "a" });
    const pending = queue.cancel("a");
    calls.get("a")({ fileId: "f1" });
    expect(await pending).toEqual({ status: "done", meta: { fileId: "f1" } });
    expect(types(events, "a")).toEqual(["started"]);
  });

  it("returns the error when a cancelled upload failed anyway", async () => {
    const calls = new Map();
    const run = (item) => new Promise((_, reject) => calls.set(item.id, reject));
    const queue = createUploadQueue({ run, onEvent: () => {} });
    queue.add({ id: "a" });
    const pending = queue.cancel("a");
    const error = new Error("paused");
    calls.get("a")(error);
    expect(await pending).toEqual({ status: "failed", error });
  });

  it("cancel of an unknown id resolves as not found", async () => {
    const { queue } = harness();
    expect(await queue.cancel("zzz")).toEqual({ status: "none" });
  });

  it("cancelAll stops everything and resolves per id", async () => {
    const { queue, calls, events } = harness(1);
    queue.add({ id: "a" });
    queue.add({ id: "b" });
    const results = await queue.cancelAll();
    expect(results).toEqual({ a: { status: "aborted" }, b: { status: "waiting" } });
    expect(calls.has("b")).toBe(false);
    expect(events.map((e) => e.type)).toEqual(["started"]);
    // Still usable afterwards.
    queue.add({ id: "c" });
    expect(calls.has("c")).toBe(true);
  });

  it("dispose aborts running uploads, drops waiting ones and emits nothing afterwards", async () => {
    const { queue, calls, events } = harness(1);
    queue.add({ id: "a" });
    queue.add({ id: "b" });
    queue.dispose();
    expect(calls.get("a").signal.aborted).toBe(true);
    await flush();
    expect(calls.has("b")).toBe(false);
    expect(events.map((e) => e.type)).toEqual(["started"]);
    queue.add({ id: "c" });
    expect(calls.has("c")).toBe(false);
  });

  it("revive makes a disposed queue usable again (StrictMode remount)", () => {
    const { queue, calls } = harness();
    queue.dispose();
    queue.revive();
    queue.add({ id: "a" });
    expect(calls.has("a")).toBe(true);
  });

  it("knows which ids it holds", async () => {
    const { queue, calls } = harness(1);
    queue.add({ id: "a" });
    queue.add({ id: "b" });
    expect(queue.has("a")).toBe(true);
    expect(queue.has("b")).toBe(true);
    calls.get("a").resolve({});
    await flush();
    expect(queue.has("a")).toBe(false);
  });

  it("does not add the same id twice", () => {
    const { queue, calls } = harness(2);
    queue.add({ id: "a" });
    queue.add({ id: "a" });
    expect(calls.size).toBe(1);
  });
});
