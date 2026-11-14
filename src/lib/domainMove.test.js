import { describe, expect, it } from "vitest";
import {
  CARRY_PREFIX,
  NEW_ORIGIN,
  buildMoveUrl,
  isRetiredHost,
  takeCarriedShoppingList,
} from "./domainMove";

const list = [{ id: "a", name: "Eggs", quantity: 12, checked: false }];
const carried = (value) => `${CARRY_PREFIX}${encodeURIComponent(value)}`;

describe("isRetiredHost", () => {
  it("is true only on the old Netlify address", () => {
    expect(isRetiredHost("zippy-mousse-7dfbd1.netlify.app")).toBe(true);
    expect(isRetiredHost("tools.ralphalcaide.com")).toBe(false);
    expect(isRetiredHost("localhost")).toBe(false);
    // Deploy previews have to stay usable for checking a build.
    expect(isRetiredHost("deploy-preview-24--zippy-mousse-7dfbd1.netlify.app")).toBe(false);
  });
});

describe("buildMoveUrl", () => {
  it("keeps the page and query string", () => {
    expect(buildMoveUrl({ pathname: "/work/logs", search: "?day=2026-10-10" }, null))
      .toBe(`${NEW_ORIGIN}/work/logs?day=2026-10-10`);
  });

  it("carries a non-empty shopping list in the fragment", () => {
    const json = JSON.stringify(list);
    const url = buildMoveUrl({ pathname: "/shopping", search: "" }, json);

    expect(url).toBe(`${NEW_ORIGIN}/shopping${carried(json)}`);
    expect(takeCarriedShoppingList(new URL(url).hash, null)).toBe(json);
  });

  it("carries nothing for an empty or missing list", () => {
    expect(buildMoveUrl({ pathname: "/", search: "" }, "[]")).toBe(`${NEW_ORIGIN}/`);
    expect(buildMoveUrl({ pathname: "/", search: "" }, null)).toBe(`${NEW_ORIGIN}/`);
  });
});

describe("takeCarriedShoppingList", () => {
  const json = JSON.stringify(list);

  it("imports into an empty list", () => {
    expect(takeCarriedShoppingList(carried(json), null)).toBe(json);
    expect(takeCarriedShoppingList(carried(json), "[]")).toBe(json);
  });

  it("never overwrites a list that already has items", () => {
    expect(takeCarriedShoppingList(carried(json), JSON.stringify([{ name: "Milk" }])))
      .toBeNull();
  });

  it("ignores fragments it did not write", () => {
    expect(takeCarriedShoppingList("", null)).toBeNull();
    expect(takeCarriedShoppingList("#section", null)).toBeNull();
  });

  it("ignores anything that is not a list of items", () => {
    expect(takeCarriedShoppingList(carried("not json"), null)).toBeNull();
    expect(takeCarriedShoppingList(carried('{"name":"x"}'), null)).toBeNull();
    expect(takeCarriedShoppingList(carried("[1,2]"), null)).toBeNull();
    expect(takeCarriedShoppingList(`${CARRY_PREFIX}%E0%A4%A`, null)).toBeNull();
  });
});
