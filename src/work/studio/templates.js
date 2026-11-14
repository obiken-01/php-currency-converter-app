// Cut templates: an edit list with the sources removed, kept in localStorage.
import { snap, totalDuration } from "./slotEdits";

const KEY = "studio_templates";
const round6 = (t) => Math.round(t * 1e6) / 1e6;

let counter = 0;
/** crypto.randomUUID only exists on secure origins (not a phone on a LAN dev address). */
function newId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  counter += 1;
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${counter}`;
}

/** Strip every segment to an empty slot and rebase the music so the cut starts at 0. */
export function toTemplate(editList, name) {
  const total = totalDuration(editList);
  const offset = editList.music.startSec;
  const music = {
    ...editList.music,
    fileId: "",
    startSec: 0,
    endSec: total,
    beats: (editList.music.beats || []).map((b) => round6(b - offset)),
  };
  return {
    id: newId(),
    name,
    savedAt: new Date().toISOString(),
    editList: {
      ...editList,
      music,
      timeline: editList.timeline.map((s) => ({
        type: "empty",
        slotStartSec: snap(s.slotStartSec),
        durationSec: snap(s.durationSec),
      })),
    },
  };
}

function parses(t) {
  const list = t && t.editList && t.editList.timeline;
  return (
    !!t &&
    typeof t.id === "string" &&
    Array.isArray(list) &&
    list.every((s) => s && typeof s === "object" && typeof s.slotStartSec === "number" && typeof s.durationSec === "number")
  );
}

/** Saved templates, newest first. Unparseable entries are skipped. */
export function loadTemplates() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(parses).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  } catch {
    return [];
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** Add or replace (same id). Returns false when storage fails. */
export function saveTemplate(template) {
  const rest = loadTemplates().filter((t) => t.id !== template.id);
  return write([template, ...rest]);
}

/** Returns false when storage fails. */
export function deleteTemplate(id) {
  return write(loadTemplates().filter((t) => t.id !== id));
}
