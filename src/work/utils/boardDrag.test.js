import { describe, expect, it } from "vitest";
import {
  findCardLocation,
  findColumnIndex,
  moveCardBetweenColumns,
  resolveDrop,
} from "./boardDrag";

const card = (id, status) => ({ publicId: id, title: id, status });

/**
 * Todo:       a, b, c
 * InProgress: d
 * Blocked:    (empty)
 */
const board = () => [
  { status: "Todo",       items: [card("a", "Todo"), card("b", "Todo"), card("c", "Todo")] },
  { status: "InProgress", items: [card("d", "InProgress")] },
  { status: "Blocked",    items: [] },
];

describe("findColumnIndex", () => {
  it("resolves a column status id", () => {
    expect(findColumnIndex(board(), "InProgress")).toBe(1);
  });

  it("resolves a card id to its column", () => {
    expect(findColumnIndex(board(), "b")).toBe(0);
    expect(findColumnIndex(board(), "d")).toBe(1);
  });

  it("is -1 for an unknown id", () => {
    expect(findColumnIndex(board(), "nope")).toBe(-1);
  });
});

describe("findCardLocation", () => {
  it("reports the column and index", () => {
    expect(findCardLocation(board(), "c")).toEqual({ status: "Todo", index: 2 });
  });

  it("is null for an unknown card", () => {
    expect(findCardLocation(board(), "nope")).toBeNull();
  });
});

describe("moveCardBetweenColumns", () => {
  it("moves a card onto another card's position and rewrites its status", () => {
    const next = moveCardBetweenColumns(board(), "a", "d");
    expect(next[0].items.map((i) => i.publicId)).toEqual(["b", "c"]);
    expect(next[1].items.map((i) => i.publicId)).toEqual(["a", "d"]);
    expect(next[1].items[0].status).toBe("InProgress");
  });

  it("appends when dropped on an empty column's own id", () => {
    const next = moveCardBetweenColumns(board(), "a", "Blocked");
    expect(next[2].items.map((i) => i.publicId)).toEqual(["a"]);
    expect(next[2].items[0].status).toBe("Blocked");
  });

  it("is a no-op within the same column", () => {
    const input = board();
    expect(moveCardBetweenColumns(input, "a", "c")).toBe(input);
  });

  it("is a no-op for an unknown target", () => {
    const input = board();
    expect(moveCardBetweenColumns(input, "a", "nope")).toBe(input);
  });

  it("does not mutate the input", () => {
    const input = board();
    moveCardBetweenColumns(input, "a", "d");
    expect(input[0].items.map((i) => i.publicId)).toEqual(["a", "b", "c"]);
    expect(input[1].items).toHaveLength(1);
  });
});

describe("resolveDrop", () => {
  const server = board();

  it("returns nothing when dropped outside any column", () => {
    expect(resolveDrop(board(), server, "a", undefined)).toBeNull();
  });

  it("returns nothing when the target is unknown", () => {
    expect(resolveDrop(board(), server, "a", "nope")).toBeNull();
  });

  it("returns nothing when the card lands back where it started", () => {
    // Dropped on itself: same column, same index.
    expect(resolveDrop(board(), server, "b", "b")).toBeNull();
  });

  it("reorders within a column", () => {
    // a (index 0) dropped onto c (index 2)
    expect(resolveDrop(board(), server, "a", "c")).toEqual({
      status: "Todo",
      newIndex: 2,
    });
  });

  it("targets the end of an empty column", () => {
    // The mirror has already moved the card in via onDragOver.
    const mirror = moveCardBetweenColumns(board(), "a", "Blocked");
    expect(resolveDrop(mirror, server, "a", "Blocked")).toEqual({
      status: "Blocked",
      newIndex: 0,
    });
  });

  it("keeps the slot the preview put the card in across columns", () => {
    const mirror = moveCardBetweenColumns(board(), "a", "d");
    expect(resolveDrop(mirror, server, "a", "d")).toEqual({
      status: "InProgress",
      newIndex: 0,
    });
  });

  it("appends when dropped on a non-empty column's own id", () => {
    // over.id is the column, so there is no card index to land on.
    const mirror = moveCardBetweenColumns(board(), "a", "InProgress");
    expect(resolveDrop(mirror, server, "a", "InProgress")).toEqual({
      status: "InProgress",
      newIndex: 1,
    });
  });

  it("still moves a card whose index is unchanged but column is not", () => {
    // "a" is index 0 in Todo and lands at index 0 of InProgress -- the index
    // matches, so only the status comparison stops this being a no-op.
    const mirror = moveCardBetweenColumns(board(), "a", "d");
    expect(resolveDrop(mirror, server, "a", "d")).not.toBeNull();
  });
});
