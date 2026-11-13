import { describe, expect, it } from "vitest";
import {
  snap, totalDuration, fillSlot, skipSlot, slotProblems, describeSlot, formatTime, parseTime,
} from "./slotEdits";

function deepFreeze(o) {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
}

const base = (timeline) => ({
  version: 1,
  project: { aspect: "9:16", width: 1080, height: 1920, fps: 30 },
  music: { fileId: "m1", startSec: 10, endSec: 14, fadeOutSec: 1, beats: [10, 10.5, 11, 12, 13, 14] },
  audioMode: "music",
  timeline,
});
const vid = (start, dur, fileId, inSec) => ({
  type: "video", slotStartSec: start, durationSec: dur,
  source: { fileId, inSec, outSec: snap(inSec + dur) },
  crop: { focusX: 0.5, focusY: 0.5 }, transitionOut: "cut",
});
const photo = (start, dur, fileId) => ({
  type: "photo", slotStartSec: start, durationSec: dur, source: { fileId },
  motion: { kind: "zoom_in" }, crop: { focusX: 0.5, focusY: 0.5 }, transitionOut: "cut",
});
const empty = (start, dur) => ({ type: "empty", slotStartSec: start, durationSec: dur });

const DRAFT = () => base([vid(0, 1, "v1", 34), photo(1, 2, "p1"), vid(3, 1, "v2", 5)]);
const TEMPLATE = () => base([empty(0, 1), empty(1, 2), empty(3, 1)]);

const SEG_KEYS = {
  video: ["crop", "durationSec", "slotStartSec", "source", "transitionOut", "type"],
  photo: ["crop", "durationSec", "motion", "slotStartSec", "source", "transitionOut", "type"],
  empty: ["durationSec", "slotStartSec", "type"],
};
const keysOk = (list) => list.timeline.every((s) => Object.keys(s).sort().join() === SEG_KEYS[s.type].join());

describe("snap", () => {
  it("rounds to the 1/30 s grid and then to 6 decimals", () => {
    expect(snap(1.02)).toBe(1.033333);
    expect(snap(1)).toBe(1);
    expect(snap(0.5)).toBe(0.5);
    expect(snap(34.2)).toBe(34.2);
    expect(snap(0.017)).toBe(0.033333);
    expect(snap(0.0166)).toBe(0);
    expect(snap(0.0149)).toBe(0);
  });
});

describe("totalDuration", () => {
  it("sums snapped durations", () => {
    expect(totalDuration(DRAFT())).toBe(4);
    const g = (n) => snap(n / 30);
    const list = base([empty(0, g(31)), empty(g(31), g(14)), empty(g(45), g(75))]);
    expect(totalDuration(list)).toBe(snap(120 / 30));
    expect(totalDuration(list)).toBe(4);
  });
});

describe("fillSlot", () => {
  it("fills a video slot from a start time", () => {
    const t = deepFreeze(TEMPLATE());
    const out = fillSlot(t, 1, { fileId: "v1", kind: "video" }, 10);
    expect(out.timeline[1]).toEqual({
      type: "video", slotStartSec: 1, durationSec: 2,
      source: { fileId: "v1", inSec: 10, outSec: 12 },
      crop: { focusX: 0.5, focusY: 0.5 }, transitionOut: "cut",
    });
    expect(t.timeline[1].type).toBe("empty");
    expect(out.timeline[0]).toBe(t.timeline[0]);
    expect(keysOk(out)).toBe(true);
  });
  it("defaults inSec to 0, snaps it and clamps below 0", () => {
    const t = TEMPLATE();
    const v = { fileId: "v", kind: "video" };
    expect(fillSlot(t, 0, v).timeline[0].source).toEqual({ fileId: "v", inSec: 0, outSec: 1 });
    expect(fillSlot(t, 0, v, -3).timeline[0].source.inSec).toBe(0);
    expect(fillSlot(t, 0, v, 1.01).timeline[0].source.inSec).toBe(snap(1.01));
  });
  it("does not check clip length itself", () => {
    const out = fillSlot(TEMPLATE(), 1, { fileId: "v1", kind: "video", durationSec: 1 }, 10);
    expect(out.timeline[1].source.outSec).toBe(12);
  });
  it("fills a photo slot", () => {
    const out = fillSlot(deepFreeze(TEMPLATE()), 2, { fileId: "p1", kind: "photo" });
    expect(out.timeline[2]).toEqual({
      type: "photo", slotStartSec: 3, durationSec: 1, source: { fileId: "p1" },
      motion: { kind: "zoom_in" }, crop: { focusX: 0.5, focusY: 0.5 }, transitionOut: "cut",
    });
    expect(keysOk(out)).toBe(true);
  });
  it("replaces an already filled slot", () => {
    const out = fillSlot(deepFreeze(DRAFT()), 0, { fileId: "p9", kind: "photo" });
    expect(out.timeline[0].type).toBe("photo");
    expect(out.timeline[0].source).toEqual({ fileId: "p9" });
    expect(keysOk(out)).toBe(true);
  });
  it("throws a TypeError for an audio file and a RangeError for a bad index", () => {
    expect(() => fillSlot(TEMPLATE(), 0, { fileId: "a", kind: "audio" })).toThrow(TypeError);
    expect(() => fillSlot(TEMPLATE(), 9, { fileId: "a", kind: "photo" })).toThrow(RangeError);
  });
});

describe("skipSlot", () => {
  it("gives time to the previous slot", () => {
    const d = deepFreeze(DRAFT());
    const out = skipSlot(d, 1);
    expect(out.timeline).toHaveLength(2);
    expect(out.timeline[0].durationSec).toBe(3);
    expect(out.timeline[0].source).toEqual({ fileId: "v1", inSec: 34, outSec: 37 });
    expect(out.timeline[1].slotStartSec).toBe(3);
    expect(keysOk(out)).toBe(true);
  });
  it("skipping the first slot gives time to the next", () => {
    const d = deepFreeze(base([vid(0, 1, "v1", 34), vid(1, 2, "v2", 5), photo(3, 1, "p1")]));
    const out = skipSlot(d, 0);
    expect(out.timeline).toHaveLength(2);
    expect(out.timeline[0].slotStartSec).toBe(0);
    expect(out.timeline[0].durationSec).toBe(3);
    expect(out.timeline[0].source).toEqual({ fileId: "v2", inSec: 5, outSec: 8 });
    expect(out.timeline[1].slotStartSec).toBe(3);
  });
  it("only lengthens a photo or empty neighbour", () => {
    const out = skipSlot(deepFreeze(base([photo(0, 1, "p1"), empty(1, 2), vid(3, 1, "v", 0)])), 2);
    expect(out.timeline[1]).toEqual(empty(1, 3));
    const out2 = skipSlot(deepFreeze(base([empty(0, 1), photo(1, 2, "p1")])), 0);
    expect(out2.timeline).toEqual([photo(0, 3, "p1")]);
    const out3 = skipSlot(deepFreeze(base([photo(0, 1, "p1"), vid(1, 2, "v", 0)])), 1);
    expect(out3.timeline).toEqual([photo(0, 3, "p1")]);
  });
  it("returns the edit list unchanged when only one slot remains", () => {
    const d = deepFreeze(base([empty(0, 4)]));
    expect(skipSlot(d, 0)).toEqual(d);
  });
  it("keeps the timeline contiguous, on the grid, with the same total, for any skip order", () => {
    const g = (n) => snap(n / 30);
    const durs = [g(31), g(14), g(46), g(10), g(33), g(17)];
    const make = () => {
      let start = 0;
      const tl = durs.map((d, i) => {
        const seg = i % 3 === 0 ? vid(start, d, "v" + i, 2) : i % 3 === 1 ? photo(start, d, "p" + i) : empty(start, d);
        start = snap(start + d);
        return seg;
      });
      return base(tl);
    };
    const orders = [[0, 0, 0, 0, 0], [5, 4, 3, 2, 1], [2, 0, 3, 1, 0], [1, 3, 0, 2, 0], [4, 0, 2, 2, 0]];
    for (const order of orders) {
      let list = deepFreeze(make());
      const total = totalDuration(list);
      for (const idx of order) {
        list = deepFreeze(skipSlot(list, Math.min(idx, list.timeline.length - 1)));
        let expectStart = 0;
        for (const s of list.timeline) {
          expect(s.slotStartSec).toBe(expectStart);
          expect(snap(s.durationSec)).toBe(s.durationSec);
          expect(snap(s.slotStartSec)).toBe(s.slotStartSec);
          if (s.type === "video") expect(Math.abs(s.source.outSec - s.source.inSec - s.durationSec)).toBeLessThan(1 / 30);
          expectStart = snap(expectStart + s.durationSec);
        }
        expect(totalDuration(list)).toBe(total);
        expect(keysOk(list)).toBe(true);
      }
      expect(list.timeline).toHaveLength(1);
    }
  });
  it("throws a RangeError for a bad index", () => {
    expect(() => skipSlot(DRAFT(), 5)).toThrow(RangeError);
  });
});

describe("slotProblems", () => {
  const files = { v1: { durationSec: 34.5 }, p1: { durationSec: 0 }, v2: { durationSec: 100 } };
  it("flags empty, too-short and missing-file slots", () => {
    const list = base([
      vid(0, 1, "v1", 34), empty(1, 1), vid(2, 1, "gone", 0),
      photo(3, 1, "nope"), photo(4, 1, "p1"), vid(5, 1, "v2", 99.5),
    ]);
    expect(slotProblems(deepFreeze(list), files)).toEqual([
      { index: 0, reason: "too_short" },
      { index: 1, reason: "empty" },
      { index: 2, reason: "missing_file" },
      { index: 3, reason: "missing_file" },
      { index: 5, reason: "too_short" },
    ]);
  });
  it("reports nothing for a fully valid list", () => {
    expect(slotProblems(base([vid(0, 1, "v2", 0), photo(1, 1, "p1")]), files)).toEqual([]);
  });
  it("accepts a clip that is exactly long enough", () => {
    expect(slotProblems(base([vid(0, 1, "v1", 33.5)]), files)).toEqual([]);
  });
});

describe("describeSlot", () => {
  const files = { v1: { filename: "DJI_0042.mp4" }, p1: { filename: "beach.jpg" } };
  it("describes video, photo, empty and missing", () => {
    expect(describeSlot(vid(0, 1.02, "v1", 34.2), files)).toBe("DJI_0042.mp4  0:34–0:35");
    expect(describeSlot(photo(0, 1, "p1"), files)).toBe("beach.jpg  zoom in");
    expect(describeSlot(empty(0, 1), files)).toBe("— empty —");
    expect(describeSlot(photo(0, 1, "zzz"), files)).toBe("— missing file —");
    expect(describeSlot(vid(0, 1, "zzz", 0), files)).toBe("— missing file —");
  });
  it("names every photo motion", () => {
    const m = (kind) => describeSlot({ ...photo(0, 1, "p1"), motion: { kind } }, files);
    expect(m("zoom_out")).toBe("beach.jpg  zoom out");
    expect(m("pan_left")).toBe("beach.jpg  pan left");
    expect(m("pan_right")).toBe("beach.jpg  pan right");
  });
});

describe("formatTime / parseTime", () => {
  it("formats time", () => {
    expect(formatTime(34.2)).toBe("0:34");
    expect(formatTime(75)).toBe("1:15");
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(-4)).toBe("0:00");
  });
  it("parses m:ss, ss and s.s", () => {
    expect(parseTime("1:15")).toBe(75);
    expect(parseTime("0:34")).toBe(34);
    expect(parseTime(" 34 ")).toBe(34);
    expect(parseTime("75")).toBe(75);
    expect(parseTime("34.5")).toBe(34.5);
    expect(parseTime("1:05.5")).toBe(65.5);
  });
  it("returns null for invalid or negative input", () => {
    for (const bad of ["", "abc", "-5", "1:75", "1:", ":30", "1:2:3", "1,5", null, undefined, 12]) {
      expect(parseTime(bad)).toBeNull();
    }
  });
  it("round-trips formatTime", () => {
    for (const s of [0, 9, 59, 60, 75, 600]) expect(parseTime(formatTime(s))).toBe(s);
  });
});
