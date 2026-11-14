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
export const GONE_RENDER = "This video is no longer on the server. Render it again.";
export const STALE_DRAFT = "This draft is out of date. Make a new draft to render.";
export const DRAFT_NOT_KEPT = "Drafts are not kept after a reload. Make a new draft.";
export const KEEP_OPEN = "Keep this page open while files upload.";

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
  clip_too_short: "This clip is shorter than the slot. Pick another clip or skip the slot.",
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
  drafting: null, // "draft" | "reshuffle" | "autofill" | null
  draftError: null,
  draftErrorFrom: null, // "draft" | "reshuffle" | "autofill": which button's error it is
  job: null, // { jobId, status, percent, position, message, restored, lost }
  rendering: false,
  renderError: null,
  clearing: false,
  // The new song's row while it uploads and is analysed. Until then the
  // confirmed song stays the music; a rejected new song never replaces it.
  songCandidate: null,
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
export function planPick(state, allPicks) {
  const notices = [];
  const add = [];
  const queue = [];
  const claimed = new Set();
  // A file already on its way must not get a second uploader on the same upload.
  // A paused or failed row is picked up again instead (see below).
  const busy = new Set(
    state.files.filter((r) => ["waiting", "uploading"].includes(r.status)).map((r) => `${r.name}|${r.size}`),
  );
  const picks = [];
  for (const p of allPicks) {
    const key = `${p.file.name}|${p.file.size}`;
    if (p.kind && busy.has(key)) {
      notices.push(`${p.file.name} is already uploading.`);
      continue;
    }
    if (p.kind) busy.add(key);
    picks.push(p);
  }
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
    const same = (r) => !claimed.has(r.localId) && r.name === p.file.name && r.size === p.file.size;
    const match = state.files.find((r) => r.status === "interrupted" && same(r));
    // The same file on a paused or failed row: that row is resumed or retried,
    // never a second row sending the same upload.
    const retry = match ? null : state.files.find((r) => (r.status === "paused" || r.status === "error") && r.kind === kind && same(r));
    let localId;
    let resume;
    if (match) {
      claimed.add(match.localId);
      localId = match.localId;
      resume = { uploadId: match.uploadId, chunkSize: match.chunkSize };
    } else if (retry) {
      claimed.add(retry.localId);
      localId = retry.localId;
      const lost = retry.errorCode === "resume_mismatch" || retry.errorCode === "unknown_upload";
      const chunkSize = retry.chunkSize ?? state.limits?.chunkSize;
      const own = !lost && retry.uploadId && chunkSize ? { uploadId: retry.uploadId, chunkSize } : null;
      resume = p.remembered ?? own;
    } else {
      localId = p.localId;
      resume = p.remembered ?? null;
      add.push(baseRow({ localId, name: p.file.name, size: p.file.size, kind, uploadId: resume?.uploadId ?? null, chunkSize: resume?.chunkSize ?? null }));
    }
    queue.push({ localId, file: p.file, resume });
    if (p === song) songRowId = localId;
  }

  // The confirmed song stays until the new one is uploaded and analysed;
  // any other song row (one still uploading, failed, or pending) goes now.
  const confirmed = song ? confirmedSong(state) : null;
  const replaced = song ? state.files.filter((r) => r.kind === "audio" && r.localId !== songRowId && r !== confirmed) : [];
  const songCandidate = song ? (confirmed && confirmed.localId !== songRowId ? songRowId : null) : undefined;
  return { notices, add, requeue: [...claimed], queue, replaced, songCandidate };
}

/** The song in use: the last finished song row that is not a pending replacement. */
function confirmedSong(state) {
  const songs = state.files.filter((r) => r.kind === "audio" && r.status === "done" && r.meta && r.localId !== state.songCandidate);
  return songs.length > 0 ? songs[songs.length - 1] : null;
}

const candidateRow = (state) => (state.songCandidate ? state.files.find((r) => r.localId === state.songCandidate) ?? null : null);

/**
 * What an analysis of fileId means for the song. candidate: it is the new
 * song's; old: the rows it replaces once it succeeds (to delete on the
 * server); restoreFileId: the song to analyse again if it fails.
 */
export function songSwap(state, fileId) {
  const row = candidateRow(state);
  if (!row || row.meta?.fileId !== fileId) return { candidate: false, old: [], restoreFileId: null };
  const old = state.files.filter((r) => r.kind === "audio" && r.localId !== row.localId);
  return { candidate: true, old, restoreFileId: confirmedSong(state)?.meta?.fileId ?? null };
}

/** Clears the pending song when its row is no longer pending. */
function settleCandidate(state) {
  const row = candidateRow(state);
  // Gone, failed, or nothing left to replace: no longer pending.
  if (state.songCandidate && (!row || row.status === "error" || !confirmedSong(state))) return { ...state, songCandidate: null };
  return state;
}

const LIVE = ["waiting", "uploading", "paused", "interrupted"];

/** Another row that can still send to this upload holds it: it must not be cancelled. */
export function uploadHeldElsewhere(state, localId, uploadId) {
  if (!uploadId) return false;
  return state.files.some((r) => r.localId !== localId && r.uploadId === uploadId && LIVE.includes(r.status));
}

/** A file is being sent right now (the screen should stay on). */
export const uploadsRunning = (state) => state.files.some((r) => r.status === "uploading");

/** Files are waiting to upload or uploading (the Upload step asks to keep the page open). */
export const uploadsActive = (state) => state.files.some((r) => r.status === "waiting" || r.status === "uploading");

/** Leaving the page now would stop an upload or a render being submitted. */
export const leaveGuard = (state) => state.rendering || uploadsActive(state);

/** Poll a render again when the page becomes visible: only while it can still change. */
export const pollOnVisible = (status) => ACTIVE.includes(status);

const patchRow = (state, localId, patch) => {
  if (!state.files.some((r) => r.localId === localId)) return state;
  return { ...state, files: state.files.map((r) => (r.localId === localId ? { ...r, ...patch } : r)) };
};

/** Drop the analysis when its song is neither the music nor the pending new song. */
function keepAnalysis(state) {
  const music = musicFile(state);
  const pending = candidateRow(state)?.meta?.fileId;
  if (state.analysis && state.analysis.fileId !== music?.fileId && state.analysis.fileId !== pending) return { ...state, analysis: null };
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

/** The song in use: its file metadata once uploaded (a pending replacement does not count), else null. */
export function musicFile(state) {
  return confirmedSong(state)?.meta ?? null;
}

/** At least one video or photo and the song, all uploaded. */
/** Files can be added once the project is loaded, and not while it is being cleared. */
export const canPick = (state) => state.phase === "ready" && !state.clearing;

export const inputsReady = (state) => state.phase === "ready" && visualFiles(state).length > 0 && musicFile(state) !== null;

export const canMakeDraft = (state) =>
  inputsReady(state) && !state.clearing && !state.startError && state.drafting === null && (!state.options.templateId || state.templateList !== null);

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
  if (job.lost) return { ...merged, status: "lost" };
  if (pollError) {
    if (pollError.code === "unknown_render") return { ...merged, status: "lost" };
    return { ...merged, pollError: pollError.message };
  }
  return merged;
}

export const jobActive = (view) => Boolean(view && ACTIVE.includes(view.status));

export function canRender(state, view) {
  if (!state.draft || state.rendering || state.clearing || draftStale(state)) return false;
  if (jobActive(view ?? (state.job ? jobView(state.job, null, null) : null))) return false;
  return slotProblems(state.draft.editList, filesById(state)).length === 0;
}

/** The rows of step 3: the draft, or the chosen template's empty slots. */
export function slotRows(state) {
  const list = state.draft ? state.draft.editList : state.templateList;
  if (!list) return null;
  const byId = filesById(state);
  // From 0 the clip is simply shorter than the slot: an earlier start cannot help.
  const reasonFor = (p) =>
    p.reason === "too_short" && (list.timeline[p.index].source?.inSec ?? 0) <= 1e-6 ? "clip_too_short" : p.reason;
  const problems = new Map(slotProblems(list, byId).map((p) => [p.index, reasonFor(p)]));
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
      // A render found on the server at page load and gone since expired;
      // one that vanishes while this page polls it means a restart.
      return view.restored ? GONE_RENDER : LOST_RENDER;
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
        songCandidate: null,
        job: snap.job ? { ...snap.job, restored: true, lost: false } : null,
        restored: snap.files.length > 0 || snap.job !== null,
      };
    }
    case "project/failed":
      return { ...state, phase: "error", loadError: action.message };
    case "usage/loaded":
      return { ...state, usedBytes: action.usedBytes ?? state.usedBytes, limits: action.limits ?? state.limits };
    case "clear/started":
      return { ...state, clearing: true };
    case "clear/failed":
      return { ...state, clearing: false };
    case "project/cleared":
      return { ...initialState, phase: "ready", limits: state.limits };

    case "files/picked": {
      const { plan } = action;
      const replaced = new Set(plan.replaced.map((r) => r.localId));
      const requeued = new Set(plan.requeue);
      const resumeOf = new Map(plan.queue.map((q) => [q.localId, q.resume]));
      const requeue = (r) => {
        const resume = resumeOf.get(r.localId) ?? null;
        return {
          ...r,
          status: "waiting",
          error: null,
          errorCode: null,
          network: false,
          meta: null,
          uploadId: resume?.uploadId ?? null,
          chunkSize: resume?.chunkSize ?? null,
          progress: resume ? r.progress : 0,
        };
      };
      const files = state.files
        .filter((r) => !replaced.has(r.localId))
        .map((r) => (requeued.has(r.localId) ? requeue(r) : r))
        .concat(plan.add);
      const songCandidate = plan.songCandidate === undefined ? state.songCandidate : plan.songCandidate;
      return keepAnalysis(settleCandidate({ ...state, files, notices: plan.notices, songCandidate }));
    }
    case "notices/dismissed":
      return { ...state, notices: [] };

    case "upload/started":
      return patchRow(state, action.localId, { status: "uploading", error: null, errorCode: null, network: false });
    case "upload/opened":
      return patchRow(state, action.localId, { uploadId: action.uploadId, chunkSize: action.chunkSize ?? null });
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
      return settleCandidate(
        patchRow(state, action.localId, {
          status: "error",
          error: action.message,
          errorCode: action.code ?? null,
          network: Boolean(action.network),
        }),
      );
    case "upload/unusable": {
      const row = state.files.find((r) => r.localId === action.localId);
      if (!row) return state;
      return keepAnalysis(
        settleCandidate({
          ...state,
          files: state.files.filter((r) => r.localId !== action.localId),
          notices: [...state.notices, `This file can't be used: ${row.name}.`],
        }),
      );
    }
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
      return keepAnalysis(settleCandidate({ ...state, files: state.files.filter((r) => r.localId !== action.localId) }));
    case "project/synced": {
      // A file the server no longer has (expired, or removed elsewhere) leaves the list.
      const ids = new Set((action.project?.files ?? []).map((f) => f.fileId));
      const files = state.files.filter((r) => !(r.status === "done" && r.meta && !ids.has(r.meta.fileId)));
      return keepAnalysis(
        settleCandidate({
          ...state,
          files,
          usedBytes: action.project?.usedBytes ?? state.usedBytes,
          limits: action.project?.limits ?? state.limits,
        }),
      );
    }

    case "analysis/started":
      return { ...state, analysis: { fileId: action.fileId, status: "working", tempo: null, error: null } };
    case "analysis/done": {
      if (state.analysis?.fileId !== action.fileId) return state;
      const analysis = { fileId: action.fileId, status: "done", tempo: action.tempo, error: null };
      const swap = songSwap(state, action.fileId);
      if (!swap.candidate) return { ...state, analysis };
      // The new song is good: it replaces the old one now.
      const old = new Set(swap.old.map((r) => r.localId));
      return { ...state, analysis, songCandidate: null, files: state.files.filter((r) => !old.has(r.localId)) };
    }
    case "analysis/failed": {
      if (state.analysis?.fileId !== action.fileId) return state;
      if (songSwap(state, action.fileId).candidate) {
        // The new song was rejected: the old one stays, the new row says why.
        const next = patchRow(state, state.songCandidate, {
          status: "error",
          error: action.message,
          errorCode: action.code ?? null,
          network: false,
          meta: null,
          progress: 0,
        });
        return { ...next, songCandidate: null, analysis: null };
      }
      return { ...state, analysis: { fileId: action.fileId, status: "error", tempo: null, error: action.message } };
    }

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
        job: { jobId: action.jobId, status: "queued", percent: 0, position: null, message: null, restored: false, lost: false },
      };
    case "job/lost":
      if (state.job?.jobId !== action.jobId) return state;
      return { ...state, job: { ...state.job, lost: true } };
    case "render/failed":
      if (!state.rendering) return state;
      return { ...state, rendering: false, renderError: action.message };

    default:
      return state;
  }
}
