// Pure helpers for editing an edit list slot by slot. No React, no mutation.
// Never adds keys to segments: the render service rejects unknown fields.

const FPS = 30;

/** Round to the 1/30 s frame grid, then to 6 decimals (mirrors the server). */
export function snap(t) {
  return Math.round((Math.round(t * FPS) / FPS) * 1e6) / 1e6;
}

/** Snapped sum of all segment durations. */
export function totalDuration(editList) {
  return editList.timeline.reduce((sum, seg) => snap(sum + seg.durationSec), 0);
}

function checkIndex(editList, index) {
  if (!Number.isInteger(index) || index < 0 || index >= editList.timeline.length) {
    throw new RangeError(`No slot at index ${index}`);
  }
}

/** Replace slot `index` with a video or photo segment from `file`. */
export function fillSlot(editList, index, file, inSec = 0) {
  checkIndex(editList, index);
  const slot = editList.timeline[index];
  const base = { slotStartSec: slot.slotStartSec, durationSec: slot.durationSec };
  const crop = { focusX: 0.5, focusY: 0.5 };
  let segment;
  if (file && file.kind === "video") {
    const start = Math.max(0, snap(inSec));
    segment = {
      type: "video",
      ...base,
      source: { fileId: file.fileId, inSec: start, outSec: snap(start + slot.durationSec) },
      crop,
      transitionOut: "cut",
    };
  } else if (file && file.kind === "photo") {
    segment = {
      type: "photo",
      ...base,
      source: { fileId: file.fileId },
      motion: { kind: "zoom_in" },
      crop,
      transitionOut: "cut",
    };
  } else {
    throw new TypeError(`Cannot fill a slot with a file of kind "${file && file.kind}"`);
  }
  return { ...editList, timeline: editList.timeline.map((s, i) => (i === index ? segment : s)) };
}

/**
 * Remove slot `index`, giving its time to the previous slot (the next one when
 * skipping the first). Total duration is unchanged; starts are recomputed from 0.
 */
export function skipSlot(editList, index) {
  checkIndex(editList, index);
  const { timeline } = editList;
  if (timeline.length === 1) return editList;

  const skipped = timeline[index];
  const target = index > 0 ? index - 1 : 1;
  const grown = timeline.map((seg, i) => {
    if (i !== target) return seg;
    const durationSec = snap(seg.durationSec + skipped.durationSec);
    if (seg.type === "video") {
      return { ...seg, durationSec, source: { ...seg.source, outSec: snap(seg.source.inSec + durationSec) } };
    }
    return { ...seg, durationSec };
  });

  let start = 0;
  const next = grown
    .filter((_, i) => i !== index)
    .map((seg) => {
      const out = { ...seg, slotStartSec: start };
      start = snap(start + seg.durationSec);
      return out;
    });
  return { ...editList, timeline: next };
}

/** Problems that would stop a render: empty slots, missing files, clips too short. */
export function slotProblems(editList, filesById) {
  const problems = [];
  editList.timeline.forEach((seg, index) => {
    if (seg.type === "empty") {
      problems.push({ index, reason: "empty" });
      return;
    }
    const file = filesById ? filesById[seg.source.fileId] : undefined;
    if (!file) {
      problems.push({ index, reason: "missing_file" });
      return;
    }
    if (seg.type === "video" && typeof file.durationSec === "number" && seg.source.outSec > file.durationSec + 1e-6) {
      problems.push({ index, reason: "too_short" });
    }
  });
  return problems;
}

/** m:ss (seconds floored). */
export function formatTime(sec) {
  const total = Number.isFinite(sec) && sec > 0 ? Math.floor(sec + 1e-9) : 0;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Inverse of formatTime: "m:ss", "ss" or "s.s" -> seconds, or null when invalid. */
export function parseTime(text) {
  if (typeof text !== "string") return null;
  const t = text.trim();
  let m = /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(t);
  if (m) {
    const secs = Number(m[2]);
    return secs < 60 ? Number(m[1]) * 60 + secs : null;
  }
  m = /^\d+(?:\.\d+)?$/.exec(t);
  return m ? Number(t) : null;
}

const MOTION_LABELS = {
  zoom_in: "zoom in",
  zoom_out: "zoom out",
  pan_left: "pan left",
  pan_right: "pan right",
};

/** One-line label for a slot, e.g. "DJI_0042.mp4  0:34–0:35". */
export function describeSlot(segment, filesById) {
  if (segment.type === "empty") return "— empty —";
  const file = filesById ? filesById[segment.source.fileId] : undefined;
  if (!file) return "— missing file —";
  if (segment.type === "video") {
    return `${file.filename}  ${formatTime(segment.source.inSec)}–${formatTime(segment.source.outSec)}`;
  }
  const kind = segment.motion && segment.motion.kind;
  return `${file.filename}  ${MOTION_LABELS[kind] || String(kind).replace(/_/g, " ")}`;
}
