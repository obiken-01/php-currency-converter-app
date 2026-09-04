import { describe, expect, it } from "vitest";
import {
  DAY_WIDTH,
  barGeometry,
  buildDateColumns,
  columnsWidth,
  datedItems,
  itemsRange,
  padRange,
  pickScale,
  todayOffset,
  undatedItems,
} from "./gantt";

const d = (iso) => {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(y, m - 1, day);
};

describe("pickScale", () => {
  it("uses days for short ranges", () => {
    expect(pickScale(d("2026-01-01"), d("2026-01-20"))).toBe("day");
  });

  it("uses weeks for a quarter", () => {
    expect(pickScale(d("2026-01-01"), d("2026-04-30"))).toBe("week");
  });

  it("uses months for a year", () => {
    expect(pickScale(d("2026-01-01"), d("2026-12-31"))).toBe("month");
  });
});

describe("padRange", () => {
  it("widens a single-day range to at least minDays", () => {
    const { start, end } = padRange(d("2026-03-10"), d("2026-03-10"), 14);
    const span = Math.round((end - start) / 86_400_000) + 1;
    expect(span).toBeGreaterThanOrEqual(14);
  });

  it("keeps a long range, adding only the edge padding", () => {
    const { start, end } = padRange(d("2026-01-01"), d("2026-02-01"), 14);
    expect(start).toEqual(d("2025-12-30"));
    expect(end).toEqual(d("2026-02-03"));
  });

  it("survives an end date before the start", () => {
    const { start, end } = padRange(d("2026-05-10"), d("2026-05-01"));
    expect(end >= start).toBe(true);
  });
});

describe("buildDateColumns", () => {
  it("emits one column per day on the day scale", () => {
    const columns = buildDateColumns(d("2026-06-01"), d("2026-06-07"), "day");
    expect(columns).toHaveLength(7);
    expect(columns[0].label).toBe("1");
    expect(columns[0].width).toBe(DAY_WIDTH.day);
  });

  it("marks weekends on the day scale", () => {
    // 2026-06-06 is a Saturday, 2026-06-07 a Sunday.
    const columns = buildDateColumns(d("2026-06-01"), d("2026-06-07"), "day");
    expect(columns.map((c) => c.isWeekend)).toEqual([
      false, false, false, false, false, true, true,
    ]);
  });

  it("snaps week columns back to Monday", () => {
    // 2026-06-03 is a Wednesday; the first column should be Monday the 1st.
    const columns = buildDateColumns(d("2026-06-03"), d("2026-06-20"), "week");
    expect(columns[0].date).toEqual(d("2026-06-01"));
    expect(columns[0].width).toBe(DAY_WIDTH.week * 7);
  });

  it("gives month columns their real length", () => {
    const columns = buildDateColumns(d("2026-01-15"), d("2026-03-02"), "month");
    expect(columns.map((c) => c.days)).toEqual([31, 28, 31]);
  });

  it("returns nothing when the range is inverted", () => {
    expect(buildDateColumns(d("2026-06-10"), d("2026-06-01"), "day")).toEqual([]);
  });
});

describe("barGeometry", () => {
  const origin = d("2026-06-01");

  it("places a bar at the right offset and width", () => {
    const geometry = barGeometry(
      { startDate: "2026-06-03", dueDate: "2026-06-05" },
      origin,
      DAY_WIDTH.day
    );
    expect(geometry).toEqual({ left: 2 * 32, width: 3 * 32 });
  });

  it("gives a single-day item one column of width", () => {
    const geometry = barGeometry(
      { startDate: "2026-06-03", dueDate: "2026-06-03" },
      origin,
      DAY_WIDTH.day
    );
    expect(geometry.width).toBe(32);
  });

  it("falls back to the other end when only one date is set", () => {
    expect(barGeometry({ dueDate: "2026-06-04" }, origin, 32))
      .toEqual({ left: 3 * 32, width: 32 });
    expect(barGeometry({ startDate: "2026-06-04" }, origin, 32))
      .toEqual({ left: 3 * 32, width: 32 });
  });

  it("returns null when the item has no dates", () => {
    expect(barGeometry({ title: "no dates" }, origin, 32)).toBeNull();
  });

  it("tolerates a due date before the start date", () => {
    const geometry = barGeometry(
      { startDate: "2026-06-05", dueDate: "2026-06-03" },
      origin,
      32
    );
    expect(geometry).toEqual({ left: 2 * 32, width: 3 * 32 });
  });

  it("does not shift the day across timezones", () => {
    // toISOString() on a local midnight would land on the previous day for
    // anyone east of UTC; parseDateOnly avoids that.
    const geometry = barGeometry({ startDate: "2026-06-01" }, origin, 32);
    expect(geometry.left).toBe(0);
  });
});

describe("todayOffset", () => {
  it("is null when today is outside the range", () => {
    expect(todayOffset(d("2020-01-01"), d("2020-01-10"), 32)).toBeNull();
  });

  it("is zero when the range starts today", () => {
    const today = new Date();
    expect(todayOffset(today, today, 32)).toBe(0);
  });
});

describe("itemsRange and the dated/undated split", () => {
  const items = [
    { publicId: "a", startDate: "2026-04-10", dueDate: "2026-04-20" },
    { publicId: "b", dueDate: "2026-05-02" },
    { publicId: "c" },
  ];

  it("spans every dated item", () => {
    expect(itemsRange(items)).toEqual({
      start: d("2026-04-10"),
      end: d("2026-05-02"),
    });
  });

  it("is null when nothing has dates", () => {
    expect(itemsRange([{ publicId: "x" }])).toBeNull();
  });

  it("splits dated from undated", () => {
    expect(datedItems(items).map((i) => i.publicId)).toEqual(["a", "b"]);
    expect(undatedItems(items).map((i) => i.publicId)).toEqual(["c"]);
  });
});

describe("columnsWidth", () => {
  it("sums the column widths", () => {
    const columns = buildDateColumns(d("2026-06-01"), d("2026-06-05"), "day");
    expect(columnsWidth(columns)).toBe(5 * DAY_WIDTH.day);
  });
});
