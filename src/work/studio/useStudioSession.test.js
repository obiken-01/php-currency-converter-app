import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/workApi", () => ({ getAccessToken: vi.fn() }));

const { sessionQueryEnabled, sessionStatus, showStudioTab, refetchWhenUnreachable, readWasAllowed, rememberAccess, WAS_ALLOWED_KEY } =
  await import("./useStudioSession");

const httpError = (status) => ({ response: { status, data: { message: "x" } } });

describe("sessionQueryEnabled", () => {
  it("is off when Studio is not configured, even when signed in", () => {
    expect(sessionQueryEnabled(false, "token")).toBe(false);
  });
  it("is off without an access token", () => {
    expect(sessionQueryEnabled(true, null)).toBe(false);
  });
  it("is on when configured and signed in", () => {
    expect(sessionQueryEnabled(true, "token")).toBe(true);
  });
});

describe("sessionStatus", () => {
  const base = { configured: true, token: "t", data: undefined, error: null };

  it("is off when not configured or signed out", () => {
    expect(sessionStatus({ ...base, configured: false })).toBe("off");
    expect(sessionStatus({ ...base, token: null })).toBe("off");
    expect(sessionStatus({ ...base, configured: false, error: httpError(403) })).toBe("off");
  });
  it("is loading until the service answers", () => {
    expect(sessionStatus(base)).toBe("loading");
  });
  it("is allowed only on an explicit yes", () => {
    expect(sessionStatus({ ...base, data: { allowed: true } })).toBe("allowed");
    expect(sessionStatus({ ...base, data: { allowed: false } })).toBe("denied");
  });
  it("a 403 is denied", () => {
    expect(sessionStatus({ ...base, error: httpError(403) })).toBe("denied");
  });
  it("anything else is unreachable: network, timeout, 5xx, 401", () => {
    expect(sessionStatus({ ...base, error: new Error("Network Error") })).toBe("unreachable");
    expect(sessionStatus({ ...base, error: { code: "ECONNABORTED" } })).toBe("unreachable");
    expect(sessionStatus({ ...base, error: httpError(502) })).toBe("unreachable");
    expect(sessionStatus({ ...base, error: httpError(401) })).toBe("unreachable");
  });
  it("an error wins over older data", () => {
    expect(sessionStatus({ ...base, data: { allowed: true }, error: new Error("Network Error") })).toBe("unreachable");
  });
});

describe("showStudioTab", () => {
  it("shows for an allowed user", () => {
    expect(showStudioTab("allowed", false)).toBe(true);
  });
  it("shows while unreachable only for a browser that was allowed before", () => {
    expect(showStudioTab("unreachable", true)).toBe(true);
    expect(showStudioTab("unreachable", false)).toBe(false);
  });
  it("never shows when denied, off or loading", () => {
    for (const s of ["denied", "off", "loading"]) {
      expect(showStudioTab(s, true)).toBe(false);
    }
  });
});

describe("refetchWhenUnreachable", () => {
  const q = (status, error = null) => ({ state: { status, error } });
  it("refetches an unreachable session on focus, never a refusal or a success", () => {
    expect(refetchWhenUnreachable(q("error", new Error("Network Error")))).toBe(true);
    expect(refetchWhenUnreachable(q("error", httpError(502)))).toBe(true);
    expect(refetchWhenUnreachable(q("error", httpError(403)))).toBe(false);
    expect(refetchWhenUnreachable(q("success"))).toBe(false);
    expect(refetchWhenUnreachable(q("pending"))).toBe(false);
  });
});

describe("remembering access", () => {
  let data;
  beforeEach(() => {
    data = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => data.set(k, String(v)),
      removeItem: (k) => data.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sets the flag when allowed and clears it when denied; other states leave it", () => {
    expect(WAS_ALLOWED_KEY).toBe("studio_was_allowed");
    expect(readWasAllowed()).toBe(false);
    rememberAccess("allowed");
    expect(readWasAllowed()).toBe(true);
    rememberAccess("unreachable");
    rememberAccess("loading");
    rememberAccess("off");
    expect(readWasAllowed()).toBe(true);
    rememberAccess("denied");
    expect(readWasAllowed()).toBe(false);
  });

  it("tolerates storage that throws", () => {
    vi.stubGlobal("localStorage", {
      getItem() { throw new Error("denied"); },
      setItem() { throw new Error("denied"); },
      removeItem() { throw new Error("denied"); },
    });
    expect(readWasAllowed()).toBe(false);
    expect(() => rememberAccess("allowed")).not.toThrow();
    expect(() => rememberAccess("denied")).not.toThrow();
  });
});
