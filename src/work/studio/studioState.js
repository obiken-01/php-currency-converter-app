// The Studio page's state and every decision that does not need the DOM.
// Pure: no React, no requests, no storage. The page's effects live in useStudio.js.
import { describeSlot, fillSlot, parseTime, skipSlot, slotProblems, totalDuration } from "./slotEdits";

export const DEFAULT_OPTIONS = {
  aspect: "9:16",
  pace: "medium",
  length: 30,
  startSec: null,
  audioMode: "music",
  templateId: null,
};

export const ASPECTS = ["9:16", "16:9", "4:5"];
export const PACES = ["calm", "medium", "fast"];
export const LENGTHS = [15, 30, 60, "all"];
export const AUDIO_MODES = ["music", "silent"];

export const MAX_PARALLEL_UPLOADS = 2;
export const INTERRUPTED_HINT = "Choose this file again to resume.";
export const LOST_RENDER = "The service restarted, please render again.";
export const STALE_DRAFT = "This draft is out of date. Make a new draft to render.";
export const DRAFT_NOT_KEPT = "Drafts are not kept after a reload. Make a new draft.";

const GB = 1024 ** 3;
const MB = 1024 ** 2;

const WARNINGS = {
  song_shorter_than_length: "The song is shorter than that, so the whole song is used.",
  shots_repeat: "Not enough footage: some shots repeat.",
  same_clip_back_to_back: "Only one clip fits, so it repeats back to back.",
  photos_left_out: "Some photos did not fit in this length.",
};

const PROBLEM_TEXT = {
  empty: "Pick a clip for this slot.",
  missing_file: "This file was removed. Pick another clip.",
  too_short: "The clip is too short from this start. Pick an earlier start.",
};

export const initialState = {
  phase: "loading", // "loading" | "ready" | "error"
  loadError: null,
  limits: null,
  usedBytes: 0,
  restored: false, // the page was rebuilt from the server's project
  files: [],
  notices: [],
  analysis: null, // { fileId, status: "working" | "done" | "error", tempo, error }
  options: DEFAULT_OPTIONS,
  startText: "",
  startError: false,
  templateList: null, // the chosen template's edit list (Skip edits it) until a draft exists
  seed: null,
  draft: null, // { editList, warnings, request }
  drafting: null, // "draft" | "reshuffle" | null
  draftError: null,
  draftErrorFrom: null, // "draft" | "reshuffle": which button's error it is
  job: null, // { jobId, status, percent, position, message }
  rendering: false,
  renderError: null,
};

// ---- rows -----------------------------------------------------------------

function baseRow(over) {
  return {
    localId: "",
    name: "",
    size: 0,
    kind: null,
    status: "waiting",
    progress: 0,
    meta: null,
    uploadId: null,
    chunkSize: null,
    error: null,
    errorCode: null,
    network: false,
    busy: false,
    ...over,
  };
}

/** What a server project snapshot becomes on the page. */
export function projectSnapshot(project) {
  const files = (project?.files ?? []).map((f) =>
    baseRow({ localId: `f:${f.fileId}`, name: f.filename, size: f.size, kind: f.kind, status: "done", progress: 1, meta: f }),
  );
  const uploads = (project?.uploads ?? []).map((u) =>
    baseRow({
      localId: `u:${u.uploadId}`,
      name: u.filename,
      size: u.size,
      kind: u.kind,
      status: "interrupted",
      progress: u.totalChunks > 0 ? (u.received?.length ?? 0) / u.totalChunks : 0,
      uploadId: u.uploadId,
      chunkSize: u.chunkSize,
    }),
  );
  const live = (project?.renders ?? []).filter((r) => ["queued", "running", "done"].includes(r.status));
  const songs = files.filter((r) => r.kind === "audio");
  return {
    files: [...files, ...uploads],
    job: live.length > 0 ? live[live.length - 1] : null,
    musicFileId: songs.length > 0 ? songs[songs.length - 1].meta.fileId : null,
  };
}

/**
 * What picking files does. picks are { localId, file, kind, remembered } where
 * kind is kindOf(file) and remembered is findInterrupted(file). Returns rows to add, rows to requeue,
 * the upload queue entries, song rows the new song replaces, and notices.
 */
export function planPick(state, picks) {
  const notices = [];
  const add = [];
  const queue = [];
  const claimed = new Set();
  const songs = picks.filter((p) => p.kind === "audio");
  const song = songs.length > 0 ? songs[songs.length - 1] : null;
  let songRowId = null;

  for (const p of picks) {
    const { kind } = p;
    if (!kind) {
      notices.push(`This file can't be used: ${p.file.name}.`);
      continue;
    }
    if (kind === "audio" && p !== song) {
      notices.push(`Only one song is used, so ${p.file.name} was left out.`);
      continue;
    }
    const match = state.files.find(
      (r) => r.status === "interrupted" && !claimed.has(r.localId) && r.name === p.file.name && r.size === p.file.size,
    );
    let localId;
    let resume;
    if (match) {
      claimed.add(match.localId);
      localId = match.localId;
      resume = { uploadId: match.uploadId, chunkSize: match.chunkSize };
    } else {
      localId = p.localId;
      resume = p.remembered ?? null;
      add.push(baseRow({ localId, name: p.file.name, size: p.file.size, kind }));
    }
    queue.push({ localId, file: p.file, resume });
    if (p === song) songRowId = localId;
  }

  const replaced = song ? state.files.filter((r) => r.kind === "audio" && r.localId !== songRowId) : [];
  return { notices, add, requeue: [...claimed], queue, replaced };
}

const patchRow = (state, localId, patch) => {
  if (!state.files.some((r) => r.localId === localId)) return state;
  return { ...state, files: state.files.map((r) => (r.localId === localId ? { ...r, ...patch } : r)) };
};

/** Drop the analysis when its song is no longer the music. */
function keepAnalysis(state) {
  const music = musicFile(state);
  if (state.analysis && state.analysis.fileId !== music?.fileId) return { ...state, analysis: null };
  return state;
}

// ---- selectors ------------------------------------------------------------

const doneRows = (state) => state.files.filter((r) => r.status === "done" && r.meta);

export function filesById(state) {
  const map = {};
  for (const r of doneRows(state)) map[r.meta.fileId] = r.meta;
  return map;
}

export const visualFiles = (state) =>
  doneRows(state)
    .filter((r) => r.kind === "video" || r.kind === "photo")
    .map((r) => r.meta);

/** The song row, whatever its status (there is at most one after a pick). */
export function musicRow(state) {
  const songs = state.files.filter((r) => r.kind === "audio");
  return songs.length > 0 ? songs[songs.length - 1] : null;
}

/** The song's file metadata once it is uploaded, else null. */
export function musicFile(state) {
  const songs = doneRows(state).filter((r) => r.kind === "audio");
  return songs.length > 0 ? songs[songs.length - 1].meta : null;
}

/** At least one video or photo and the song, all uploaded. */
export const inputsReady = (state) => state.phase === "ready" && visualFiles(state).length > 0 && musicFile(state) !== null;

export const canMakeDraft = (state) =>
  inputsReady(state) && !state.startError && state.drafting === null && (!state.options.templateId || state.templateList !== null);

export function draftRequest(state, seed) {
  const { aspect, pace, length, startSec, audioMode, templateId } = state.options;
  const request = {
    fileIds: visualFiles(state).map((f) => f.fileId),
    musicFileId: musicFile(state)?.fileId,
    aspect,
    pace,
    length,
    audioMode,
    seed,
  };
  if (startSec !== null && startSec !== undefined) request.startSec = startSec;
  if (templateId && state.templateList) request.template = state.templateList;
  return request;
}

/** The draft no longer matches the shape, audio or song: a new draft is needed. */
export function draftStale(state) {
  const { draft } = state;
  if (!draft) return false;
  const req = draft.request ?? {};
  return (
    req.aspect !== state.options.aspect ||
    req.audioMode !== state.options.audioMode ||
    req.musicFileId !== musicFile(state)?.fileId
  );
}

const ACTIVE = ["queued", "running"];

/**
 * The job as the page shows it: the stored job, updated by the latest poll.
 * pollError is { code, message } from the last failed poll, or null.
 */
export function jobView(job, data, pollError) {
  if (!job) return null;
  const merged = { ...job, ...(data ?? {}), pollError: null };
  if (pollError) {
    if (pollError.code === "unknown_render") return { ...merged, status: "lost" };
    return { ...merged, pollError: pollError.message };
  }
  return merged;
}

export const jobActive = (view) => Boolean(view && ACTIVE.includes(view.status));

export function canRender(state, view) {
  if (!state.draft || state.rendering || draftStale(state)) return false;
  if (jobActive(view ?? (state.job ? jobView(state.job, null, null) : null))) return false;
  return slotProblems(state.draft.editList, filesById(state)).length === 0;
}

/** The rows of step 3: the draft, or the chosen template's empty slots. */
export function slotRows(state) {
  const list = state.draft ? state.draft.editList : state.templateList;
  if (!list) return null;
  const byId = filesById(state);
  const problems = new Map(slotProblems(list, byId).map((p) => [p.index, p.reason]));
  return {
    preview: !state.draft,
    editList: list,
    items: list.timeline.map((segment, index) => ({
      index,
      number: String(index + 1).padStart(2, "0"),
      range: `${segment.slotStartSec.toFixed(1)}–${(segment.slotStartSec + segment.durationSec).toFixed(1)}`,
      label: describeSlot(segment, byId),
      problem: problems.get(index) ?? null,
      segment,
    })),
  };
}

// ---- copy -----------------------------------------------------------------

export const warningLines = (warnings) =>
  [...new Set(warnings ?? [])].filter((code) => code in WARNINGS).map((code) => WARNINGS[code]);

export const problemText = (reason) => PROBLEM_TEXT[reason] ?? null;

export function problemSummary(problems) {
  if (!problems || problems.length === 0) return null;
  const numbers = problems.map((p) => p.index + 1).join(", ");
  return problems.length === 1 ? `Fix slot ${numbers} before rendering.` : `Fix slots ${numbers} before rendering.`;
}

export function draftHeader(editList) {
  const n = editList.timeline.length;
  return `${totalDuration(editList).toFixed(1)} s · ${n} ${n === 1 ? "shot" : "shots"}`;
}

const trim = (text) => String(Number(text));

export function formatGb(bytes) {
  const v = (bytes || 0) / GB;
  if (v === 0) return "0";
  return v < 1 ? trim(v.toFixed(2)) : trim(v.toFixed(1));
}

export function usageLine(state) {
  if (!state.limits) return null;
  return `${formatGb(state.usedBytes)} of ${formatGb(state.limits.maxProjectBytes)} GB used`;
}

export function ttlLine(limits) {
  const hours = Number.isFinite(limits?.ttlHours) ? Number(limits.ttlHours.toFixed(1)) : 24;
  return `Files are deleted ${hours} ${hours === 1 ? "hour" : "hours"} after upload.`;
}

export function formatSize(bytes) {
  if (bytes >= GB) return `${trim((bytes / GB).toFixed(1))} GB`;
  if (bytes >= MB) return `${Math.round(bytes / MB)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function rowStatusText(row) {
  switch (row.status) {
    case "waiting":
      return "Waiting";
    case "uploading":
      return row.progress >= 0.99 ? "Checking the file" : `${Math.round((row.progress || 0) * 100)}%`;
    case "paused":
      return "Paused";
    case "interrupted":
      return INTERRUPTED_HINT;
    case "done":
      return "done";
    case "error":
      return row.error;
    default:
      return "";
  }
}

/** The button an error row offers to try again, or null. */
export function restartLabel(row) {
  if (row.status !== "error") return null;
  if (row.errorCode === "resume_mismatch" || row.errorCode === "unknown_upload") return "Upload as new";
  if (row.network) return "Retry";
  return null;
}

export function renderLine(view) {
  switch (view.status) {
    case "queued":
      return view.position ? `Waiting (position ${view.position})` : "Waiting";
    case "running":
      return `${view.percent ?? 0}%`;
    case "done":
      return "Done";
    case "failed":
      return view.message || "The render failed.";
    case "lost":
      return LOST_RENDER;
    default:
      return "";
  }
}

// ---- reducer --------------------------------------------------------------

export function reducer(state, action) {
  switch (action.type) {
    case "project/loaded": {
      const snap = projectSnapshot(action.project);
      return {
        ...state,
        phase: "ready",
        loadError: null,
        limits: action.project.limits ?? null,
        usedBytes: action.project.usedBytes ?? 0,
        files: snap.files,
        job: snap.job,
        restored: snap.files.length > 0 || snap.job !== null,
      };
    }
    case "project/failed":
      return { ...state, phase: "error", loadError: action.message };
    case "usage/loaded":
      return { ...state, usedBytes: action.usedBytes ?? state.usedBytes, limits: action.limits ?? state.limits };
    case "project/cleared":
      return { ...initialState, phase: "ready", limits: state.limits };

    case "files/picked": {
      const { plan } = action;
      const replaced = new Set(plan.replaced.map((r) => r.localId));
      const requeued = new Set(plan.requeue);
      const files = state.files
        .filter((r) => !replaced.has(r.localId))
        .map((r) => (requeued.has(r.localId) ? { ...r, status: "waiting", error: null, errorCode: null, network: false } : r))
        .concat(plan.add);
      return keepAnalysis({ ...state, files, notices: plan.notices });
    }
    case "notices/dismissed":
      return { ...state, notices: [] };

    case "upload/started":
      return patchRow(state, action.localId, { status: "uploading", error: null, errorCode: null, network: false });
    case "upload/progress":
      return patchRow(state, action.localId, { progress: action.progress });
    case "upload/done":
      return patchRow(state, action.localId, {
        status: "done",
        progress: 1,
        meta: action.meta,
        uploadId: null,
        chunkSize: null,
        busy: false,
      });
    case "upload/paused":
      return patchRow(state, action.localId, { status: "paused", uploadId: action.uploadId });
    case "upload/failed":
      return patchRow(state, action.localId, {
        status: "error",
        error: action.message,
        errorCode: action.code ?? null,
        network: Boolean(action.network),
      });
    case "upload/requeued":
      return patchRow(state, action.localId, {
        status: "waiting",
        error: null,
        errorCode: null,
        network: false,
        ...(action.fresh ? { uploadId: null, chunkSize: null, progress: 0 } : {}),
      });
    case "row/busy":
      return patchRow(state, action.localId, { busy: action.busy });
    case "row/removed":
      if (!state.files.some((r) => r.localId === action.localId)) return state;
      return keepAnalysis({ ...state, files: state.files.filter((r) => r.localId !== action.localId) });

    case "analysis/started":
      return { ...state, analysis: { fileId: action.fileId, status: "working", tempo: null, error: null } };
    case "analysis/done":
      if (state.analysis?.fileId !== action.fileId) return state;
      return { ...state, analysis: { fileId: action.fileId, status: "done", tempo: action.tempo, error: null } };
    case "analysis/failed":
      if (state.analysis?.fileId !== action.fileId) return state;
      return { ...state, analysis: { fileId: action.fileId, status: "error", tempo: null, error: action.message } };

    case "options/changed":
      return { ...state, options: { ...state.options, [action.key]: action.value } };
    case "start/changed": {
      const text = action.text;
      if (text.trim() === "") return { ...state, startText: text, startError: false, options: { ...state.options, startSec: null } };
      const sec = parseTime(text);
      return { ...state, startText: text, startError: sec === null, options: { ...state.options, startSec: sec } };
    }
    case "template/chosen":
      return {
        ...state,
        options: { ...state.options, templateId: action.template ? action.template.id : null },
        templateList: action.template ? action.template.editList : null,
      };

    case "draft/started":
      return { ...state, drafting: action.mode, seed: action.seed, draftError: null, draftErrorFrom: null };
    case "draft/done":
      if (state.drafting === null) return state;
      return {
        ...state,
        drafting: null,
        draft: { editList: action.editList, warnings: action.warnings ?? [], request: action.request },
      };
    case "draft/failed":
      if (state.drafting === null) return state;
      return { ...state, drafting: null, draftError: action.message, draftErrorFrom: state.drafting };

    case "slot/filled":
      if (!state.draft) return state;
      return { ...state, draft: { ...state.draft, editList: fillSlot(state.draft.editList, action.index, action.file, action.inSec) } };
    case "slot/skipped":
      if (state.draft) return { ...state, draft: { ...state.draft, editList: skipSlot(state.draft.editList, action.index) } };
      if (state.templateList) return { ...state, templateList: skipSlot(state.templateList, action.index) };
      return state;

    case "render/started":
      return { ...state, rendering: true, renderError: null };
    case "render/created":
      if (!state.rendering) return state;
      return {
        ...state,
        rendering: false,
        job: { jobId: action.jobId, status: "queued", percent: 0, position: null, message: null },
      };
    case "render/failed":
      if (!state.rendering) return state;
      return { ...state, rendering: false, renderError: action.message };

    default:
      return state;
  }
}
