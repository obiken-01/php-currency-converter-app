import { describe, expect, it } from "vitest";
import { assigneeOf, toWorkItemDto } from "./workItem";

/**
 * These two helpers exist because the app and the API disagreed about the shape
 * of a work item, and every symptom of that disagreement was silent: the server
 * ignores a key it does not know, answers 200, and the task comes back with no
 * project and nobody assigned. Nothing to see in the console, nothing in a
 * toast — just a field that would not stick. So the field NAMES are asserted
 * here, not merely the values.
 */
describe("toWorkItemDto", () => {
  const form = {
    title: "  V1.8.0 Phase 3  ",
    summary: "",
    description: "",
    projectId: "11111111-1111-1111-1111-111111111111",
    status: "InProgress",
    priority: "Normal",
    startDate: "2026-09-04",
    dueDate: "",
    labelIds: [3, 7],
    assigneeId: "22222222-2222-2222-2222-222222222222",
  };

  it("sends the project as projectPublicId", () => {
    expect(toWorkItemDto(form)).toMatchObject({
      projectPublicId: "11111111-1111-1111-1111-111111111111",
    });
    expect(toWorkItemDto(form)).not.toHaveProperty("projectId");
  });

  it("sends the assignee as assigneePublicId", () => {
    expect(toWorkItemDto(form)).toMatchObject({
      assigneePublicId: "22222222-2222-2222-2222-222222222222",
    });
    expect(toWorkItemDto(form)).not.toHaveProperty("assigneeId");
  });

  it("trims the title and nulls empty optional text", () => {
    const dto = toWorkItemDto(form);
    expect(dto.title).toBe("V1.8.0 Phase 3");
    expect(dto.summary).toBeNull();
    expect(dto.dueDate).toBeNull();
  });

  it("passes label ids through as they are", () => {
    expect(toWorkItemDto(form).labelIds).toEqual([3, 7]);
  });

  it("does not ask to clear the project when one is chosen", () => {
    expect(toWorkItemDto(form, { isEdit: true }).clearProject).toBeUndefined();
  });

  it("asks to clear the project when an edit chooses No project", () => {
    const dto = toWorkItemDto({ ...form, projectId: "" }, { isEdit: true });

    // Without this the server keeps the existing project, and "No project"
    // would look like a save that did nothing.
    expect(dto.clearProject).toBe(true);
    expect(dto.projectPublicId).toBeNull();
  });

  it("does not send clearProject on a create", () => {
    expect(toWorkItemDto({ ...form, projectId: "" })).not.toHaveProperty("clearProject");
  });
});

describe("assigneeOf", () => {
  it("builds a person from the flat fields the API returns", () => {
    expect(assigneeOf({
      assigneePublicId: "22222222-2222-2222-2222-222222222222",
      assigneeDisplayName: "Ralph",
    })).toEqual({
      publicId: "22222222-2222-2222-2222-222222222222",
      displayName: "Ralph",
    });
  });

  it("is null when nobody is assigned", () => {
    expect(assigneeOf({ assigneePublicId: null })).toBeNull();
    expect(assigneeOf(undefined)).toBeNull();
  });
});
