import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The paths each api module asks for, pinned.
 *
 * A wrong path is a 404 the UI shows as "nothing here": /work/directory
 * returned 404 for months and the only symptom was an assignee dropdown with
 * nobody in it. Nothing else in this suite touches a URL, so these assert the
 * one thing that cannot be seen from inside a component.
 *
 * Every path below is relative to the /api/work prefix baked into workApi.
 */
vi.mock("./workApi", () => {
  const method = () => vi.fn(() => Promise.resolve({ data: { data: null } }));
  return {
    default: {
      get: method(),
      post: method(),
      put: method(),
      patch: method(),
      delete: method(),
    },
    unwrap: (res) => res.data.data,
  };
});

const { default: workApi } = await import("./workApi");
const { default: directoryApi } = await import("./directoryApi");
const { default: tasksApi } = await import("./tasksApi");
const { default: projectsApi } = await import("./projectsApi");
const { default: labelsApi } = await import("./labelsApi");
const { default: tokensApi } = await import("./tokensApi");

const GUID = "fad7b333-b6b5-42ed-b930-baf3af736f20";

const pathOf = (spy) => spy.mock.calls.at(-1)[0];

beforeEach(() => {
  Object.values(workApi).forEach((spy) => spy.mockClear());
});

describe("directory", () => {
  it("hangs off the users controller, not off /work", async () => {
    await directoryApi.query();
    expect(pathOf(workApi.get)).toBe("/users/directory");
  });
});

describe("tasks", () => {
  it("reads and writes /tasks", async () => {
    await tasksApi.get(GUID);
    expect(pathOf(workApi.get)).toBe(`/tasks/${GUID}`);

    await tasksApi.board(null, null);
    expect(pathOf(workApi.get)).toBe("/tasks/board");

    await tasksApi.update(GUID, {});
    expect(pathOf(workApi.put)).toBe(`/tasks/${GUID}`);

    await tasksApi.move(GUID, {});
    expect(pathOf(workApi.patch)).toBe(`/tasks/${GUID}/move`);

    await tasksApi.setAssignee(GUID, {});
    expect(pathOf(workApi.patch)).toBe(`/tasks/${GUID}/assignee`);
  });
});

describe("projects", () => {
  it("reads a project and its timeline", async () => {
    await projectsApi.get(GUID);
    expect(pathOf(workApi.get)).toBe(`/projects/${GUID}`);

    await projectsApi.timeline(GUID);
    expect(pathOf(workApi.get)).toBe(`/projects/${GUID}/timeline`);
  });
});

describe("integer-keyed resources", () => {
  // Both routes are constrained to {id:int}. A GUID -- or the undefined a
  // missing publicId produces -- does not match the constraint and 404s
  // before any handler runs.
  it("deletes a label by its integer id", async () => {
    await labelsApi.remove(7);
    expect(pathOf(workApi.delete)).toBe("/labels/7");
  });

  it("revokes a token by its integer id", async () => {
    await tokensApi.revoke(3);
    expect(pathOf(workApi.delete)).toBe("/tokens/3");
  });
});
