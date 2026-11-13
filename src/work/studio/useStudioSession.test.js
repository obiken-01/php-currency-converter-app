import { describe, expect, it, vi } from "vitest";

vi.mock("../api/workApi", () => ({ getAccessToken: vi.fn() }));

const { sessionQueryEnabled } = await import("./useStudioSession");

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
