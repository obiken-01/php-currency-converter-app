import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toTemplate, loadTemplates, saveTemplate, deleteTemplate } from "./templates";

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

function deepFreeze(o) {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
}

const crop = { focusX: 0.5, focusY: 0.5 };
const DRAFT = deepFreeze({
  version: 1,
  project: { aspect: "9:16", width: 1080, height: 1920, fps: 30 },
  music: { fileId: "up_song", startSec: 10, endSec: 14, fadeOutSec: 1.5, beats: [10, 10.5, 11, 12.25, 14] },
  audioMode: "music",
  timeline: [
    { type: "video", slotStartSec: 0, durationSec: 1, source: { fileId: "up_clip1", inSec: 3, outSec: 4 }, crop, transitionOut: "cut" },
    { type: "photo", slotStartSec: 1, durationSec: 2, source: { fileId: "up_img1" }, motion: { kind: "zoom_in" }, crop, transitionOut: "cut" },
    { type: "video", slotStartSec: 3, durationSec: 1, source: { fileId: "up_clip2", inSec: 0, outSec: 1 }, crop, transitionOut: "crossfade" },
  ],
});

const make = (name, savedAt) => ({ ...toTemplate(DRAFT, name), savedAt });

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("toTemplate", () => {
  it("strips sources and keeps timings", () => {
    const t = toTemplate(DRAFT, "Fast 4s");
    expect(t.editList.timeline).toEqual([
      { type: "empty", slotStartSec: 0, durationSec: 1 },
      { type: "empty", slotStartSec: 1, durationSec: 2 },
      { type: "empty", slotStartSec: 3, durationSec: 1 },
    ]);
    expect(t.editList.music.fileId).toBe("");
    expect(t.editList.music.startSec).toBe(0);
    expect(t.editList.music.endSec).toBe(4);
    expect(t.editList.music.beats[0]).toBe(0);
    expect(t.editList.music.beats).toEqual([0, 0.5, 1, 2.25, 4]);
    expect(JSON.stringify(t)).not.toContain("up_");
  });
  it("keeps the rest of the edit list and adds no keys", () => {
    const t = toTemplate(DRAFT, "x");
    expect(Object.keys(t.editList).sort()).toEqual(["audioMode", "music", "project", "timeline", "version"]);
    expect(Object.keys(t.editList.music).sort()).toEqual(["beats", "endSec", "fadeOutSec", "fileId", "startSec"]);
    expect(t.editList.music.fadeOutSec).toBe(1.5);
    expect(t.editList.project).toEqual(DRAFT.project);
    expect(t.editList.audioMode).toBe("music");
    expect(t.editList.version).toBe(1);
  });
  it("sets name, a unique id and an ISO savedAt (input is frozen, so not mutated)", () => {
    const a = toTemplate(DRAFT, "A");
    const b = toTemplate(DRAFT, "A");
    expect(a.name).toBe("A");
    expect(a.id).toEqual(expect.any(String));
    expect(a.id).not.toBe(b.id);
    expect(new Date(a.savedAt).toISOString()).toBe(a.savedAt);
    expect(DRAFT.music.fileId).toBe("up_song");
  });
});

describe("template storage", () => {
  it("round-trips through localStorage", () => {
    const t = make("One", "2026-01-01T00:00:00.000Z");
    expect(saveTemplate(t)).toBe(true);
    expect(loadTemplates()).toEqual([t]);
  });
  it("returns newest first", () => {
    [make("old", "2026-01-01T00:00:00.000Z"), make("new", "2026-03-01T00:00:00.000Z"), make("mid", "2026-02-01T00:00:00.000Z")]
      .forEach(saveTemplate);
    expect(loadTemplates().map((t) => t.name)).toEqual(["new", "mid", "old"]);
  });
  it("replaces a template with the same id", () => {
    const t = make("One", "2026-01-01T00:00:00.000Z");
    saveTemplate(t);
    saveTemplate({ ...t, name: "Renamed" });
    const all = loadTemplates();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("Renamed");
  });
  it("skips a template that no longer parses and keeps the rest", () => {
    const good = make("good", "2026-01-01T00:00:00.000Z");
    const badTimes = { id: "y", editList: { timeline: [{ slotStartSec: "0", durationSec: 1 }] } };
    localStorage.setItem("studio_templates", JSON.stringify([good, { id: "x", editList: "broken" }, badTimes, null]));
    expect(loadTemplates()).toEqual([good]);
  });
  it("returns an empty list when storage holds garbage", () => {
    localStorage.setItem("studio_templates", "not json");
    expect(loadTemplates()).toEqual([]);
    localStorage.setItem("studio_templates", JSON.stringify({ not: "an array" }));
    expect(loadTemplates()).toEqual([]);
  });
  it("returns an empty list when nothing is stored or storage is unavailable", () => {
    expect(loadTemplates()).toEqual([]);
    vi.stubGlobal("localStorage", { getItem() { throw new Error("denied"); } });
    expect(loadTemplates()).toEqual([]);
  });
  it("deletes by id", () => {
    const a = make("a", "2026-01-01T00:00:00.000Z");
    const b = make("b", "2026-02-01T00:00:00.000Z");
    saveTemplate(a);
    saveTemplate(b);
    deleteTemplate(a.id);
    expect(loadTemplates()).toEqual([b]);
    deleteTemplate("nope");
    expect(loadTemplates()).toEqual([b]);
  });
  it("does not throw and returns false when storage fails", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem() { throw new DOMException("full", "QuotaExceededError"); },
    });
    expect(saveTemplate(make("x", "2026-01-01T00:00:00.000Z"))).toBe(false);
    expect(() => deleteTemplate("x")).not.toThrow();
  });
});
