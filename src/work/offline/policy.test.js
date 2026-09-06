import { describe, expect, it } from "vitest";
import {
  isAuthRejection,
  isNetworkError,
  isPermanentFailure,
  isQueueable,
} from "./policy";

/**
 * The whole offline story rests on one distinction: the server said no, versus
 * the request never got there. Conflating them is what cleared the tokens and
 * forced a fresh login every time signal dropped.
 */
describe("isNetworkError", () => {
  it("is true when there is no response at all", () => {
    expect(isNetworkError({ message: "Network Error", request: {} })).toBe(true);
  });

  it("is false when the server answered, whatever it said", () => {
    expect(isNetworkError({ response: { status: 401 } })).toBe(false);
    expect(isNetworkError({ response: { status: 500 } })).toBe(false);
  });

  it("does not count a cancelled request", () => {
    expect(isNetworkError({ code: "ERR_CANCELED" })).toBe(false);
  });
});

describe("isAuthRejection", () => {
  it("is only 401 and 403", () => {
    expect(isAuthRejection({ response: { status: 401 } })).toBe(true);
    expect(isAuthRejection({ response: { status: 403 } })).toBe(true);
    expect(isAuthRejection({ response: { status: 500 } })).toBe(false);
    expect(isAuthRejection({ message: "Network Error" })).toBe(false);
  });
});

describe("isPermanentFailure", () => {
  it("treats client errors as final", () => {
    expect(isPermanentFailure(400)).toBe(true);
    expect(isPermanentFailure(404)).toBe(true);
    expect(isPermanentFailure(409)).toBe(true);
  });

  it("keeps the ones that mean try later", () => {
    expect(isPermanentFailure(408)).toBe(false);
    expect(isPermanentFailure(429)).toBe(false);
    expect(isPermanentFailure(500)).toBe(false);
    expect(isPermanentFailure(undefined)).toBe(false);
  });
});

describe("isQueueable", () => {
  it("queues writes", () => {
    expect(isQueueable({ method: "post", url: "/tasks" })).toBe(true);
    expect(isQueueable({ method: "PUT", url: "/tasks/abc" })).toBe(true);
    expect(isQueueable({ method: "patch", url: "/tasks/abc/status" })).toBe(true);
    expect(isQueueable({ method: "delete", url: "/logs/3" })).toBe(true);
  });

  it("never queues a read", () => {
    expect(isQueueable({ method: "get", url: "/tasks" })).toBe(false);
  });

  it("never queues auth", () => {
    // Replaying a login later is pointless, and a refresh replayed out of
    // order would rotate a token nobody is waiting for.
    expect(isQueueable({ method: "post", url: "/auth/login" })).toBe(false);
    expect(isQueueable({ method: "post", url: "/auth/refresh" })).toBe(false);
  });

  it("never queues minting a token", () => {
    // The secret is shown once, at the moment of creation. Created later, in
    // the background, it is a credential nobody ever sees.
    expect(isQueueable({ method: "post", url: "/tokens" })).toBe(false);
  });
});
