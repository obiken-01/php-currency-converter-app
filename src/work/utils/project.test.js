import { describe, expect, it } from "vitest";
import { ownerOf, projectProgress, taskCounts } from "./project";

/**
 * Every field here was previously read under a name the API does not return,
 * and the failure mode was a number rather than an error: a project with a
 * full board reported "0 of 0 done" at 0%. Reading the right field is the
 * whole behaviour, so that is what these assert.
 */
describe("taskCounts", () => {
  it("reads totalItems and completedItems", () => {
    expect(taskCounts({ totalItems: 7, completedItems: 3 })).toEqual({ total: 7, done: 3 });
  });

  it("is zero when the counts are absent", () => {
    expect(taskCounts({})).toEqual({ total: 0, done: 0 });
    expect(taskCounts(undefined)).toEqual({ total: 0, done: 0 });
  });
});

describe("projectProgress", () => {
  it("is the share of tasks done, rounded", () => {
    expect(projectProgress({ totalItems: 3, completedItems: 1 })).toBe(33);
    expect(projectProgress({ totalItems: 4, completedItems: 4 })).toBe(100);
  });

  it("is 0 for an empty project rather than NaN", () => {
    expect(projectProgress({ totalItems: 0, completedItems: 0 })).toBe(0);
    expect(projectProgress(undefined)).toBe(0);
  });

  it("never leaves 0-100 even if the counts disagree", () => {
    expect(projectProgress({ totalItems: 2, completedItems: 5 })).toBe(100);
  });
});

describe("ownerOf", () => {
  it("builds a person from the flat owner fields", () => {
    expect(ownerOf({
      ownerPublicId: "33333333-3333-3333-3333-333333333333",
      ownerDisplayName: "Ralph",
    })).toEqual({
      publicId: "33333333-3333-3333-3333-333333333333",
      displayName: "Ralph",
    });
  });

  it("is null on a list row, which carries no owner", () => {
    expect(ownerOf({ name: "PPDO Portal v1.8" })).toBeNull();
  });
});
