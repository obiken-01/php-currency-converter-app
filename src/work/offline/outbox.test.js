import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clear, enqueue, flush, pending, subscribe } from "./outbox";

const netError = () => Object.assign(new Error("Network Error"), { request: {} });
const httpError = (status, message) =>
  Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data: message ? { message } : undefined },
  });

const log = (description) => ({
  method: "post",
  url: "/logs",
  data: { taskDescription: description, duration: 1 },
  label: `Log "${description}"`,
});

beforeEach(async () => {
  await clear();
});

describe("the queue", () => {
  it("keeps writes in the order they were made", async () => {
    await enqueue(log("first"));
    await enqueue(log("second"));
    await enqueue(log("third"));

    expect((await pending()).map((e) => e.data.taskDescription))
      .toEqual(["first", "second", "third"]);
  });

  it("tells subscribers how many are waiting", async () => {
    const seen = [];
    const stop = subscribe((n) => seen.push(n));
    await enqueue(log("one"));
    stop();

    expect(seen.at(-1)).toBe(1);
  });
});

describe("flushing", () => {
  it("sends everything and empties the queue", async () => {
    await enqueue(log("a"));
    await enqueue(log("b"));
    const send = vi.fn().mockResolvedValue({});

    const result = await flush(send);

    expect(result.sent).toBe(2);
    expect(await pending()).toEqual([]);
  });

  it("sends oldest first", async () => {
    await enqueue(log("first"));
    await enqueue(log("second"));
    const order = [];
    const send = vi.fn((entry) => {
      order.push(entry.data.taskDescription);
      return Promise.resolve({});
    });

    await flush(send);

    // A create and the edit that follows it must land in that order, or the
    // edit hits a task the server has not been told about yet.
    expect(order).toEqual(["first", "second"]);
  });

  it("stops at the first entry that cannot be sent, and keeps the rest", async () => {
    await enqueue(log("a"));
    await enqueue(log("b"));
    await enqueue(log("c"));
    const send = vi.fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(netError());

    const result = await flush(send);

    expect(result.sent).toBe(1);
    expect(result.stoppedBecause).toBe("offline");
    expect(send).toHaveBeenCalledTimes(2);        // never reached "c"
    expect((await pending()).map((e) => e.data.taskDescription)).toEqual(["b", "c"]);
  });

  it("keeps a write the server fumbled, and counts the attempt", async () => {
    await enqueue(log("a"));
    const send = vi.fn().mockRejectedValue(httpError(503));

    const result = await flush(send);

    expect(result.sent).toBe(0);
    expect(result.stoppedBecause).toBe("server:503");
    expect((await pending())[0].attempts).toBe(1);
  });

  it("keeps a rate-limited write rather than discarding it", async () => {
    await enqueue(log("a"));

    await flush(vi.fn().mockRejectedValue(httpError(429)));

    expect(await pending()).toHaveLength(1);
  });

  it("drops a write the server refuses outright, and reports it", async () => {
    await enqueue(log("doomed"));
    await enqueue(log("fine"));
    const send = vi.fn()
      .mockRejectedValueOnce(httpError(400, "Duration must be positive."))
      .mockResolvedValueOnce({});

    const result = await flush(send);

    // Retrying a 400 forever would wedge the queue and block every write
    // behind it, so it is dropped -- loudly, because that work is lost.
    expect(result.dropped).toHaveLength(1);
    expect(result.dropped[0].label).toBe('Log "doomed"');
    expect(result.dropped[0].message).toBe("Duration must be positive.");
    expect(result.sent).toBe(1);
    expect(await pending()).toEqual([]);
  });

  it("does nothing when there is nothing queued", async () => {
    const send = vi.fn();
    const result = await flush(send);

    expect(send).not.toHaveBeenCalled();
    expect(result).toMatchObject({ sent: 0, dropped: [] });
  });
});
