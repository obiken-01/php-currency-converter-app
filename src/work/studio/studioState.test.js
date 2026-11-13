import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPTIONS,
  INTERRUPTED_HINT,
  canMakeDraft,
  canRender,
  draftHeader,
  draftRequest,
  draftStale,
  filesById,
  formatGb,
  formatSize,
  initialState,
  inputsReady,
  jobView,
  musicFile,
  musicRow,
  planPick,
  problemSummary,
  projectSnapshot,
  reducer,
  renderLine,
  restartLabel,
  rowStatusText,
  slotRows,
  ttlLine,
  usageLine,
  visualFiles,
  warningLines,
} from "./studioState";

const GB = 1024 ** 3;

const meta = (fileId, kind, extra = {}) => ({
  fileId,
  kind,
  filename: `${fileId}.${kind === "video" ? "mp4" : kind === "photo" ? "jpg" : "mp3"}`,
  size: 1000,
  durationSec: kind === "photo" ? null : 20,
  width: 1920,
  height: 1080,
  fps: 30,
  rotation: 0,
  createdAt: 1,
  ...extra,
});

const project = (over = {}) => ({
  files: [],
  uploads: [],
  renders: [],
  limits: { maxFileBytes: 3 * GB, maxProjectBytes: 10 * GB, ttlHours: 24, chunkSize: 8 },
  usedBytes: 0,
  ...over,
});

const loaded = (over) => reducer(initialState, { type: "project/loaded", project: project(over) });

const file = (name, size = 100, lastModified = 1) => ({ name, size, lastModified });
// Mirrors kindOf (upload/chunks.js), which the hook calls before planPick.
const KINDS = { mp4: "video", mov: "video", jpg: "photo", png: "photo", mp3: "audio", m4a: "audio" };
const kindOf = (f) => KINDS[f.name.split(".").pop()] ?? null;
const pick = (localId, f, remembered = null) => ({ localId, file: f, kind: kindOf(f), remembered });

const editList = (timeline, music = { fileId: "m1", startSec: 0, endSec: 2, fadeOutSec: 1.5, beats: [0, 1] }) => ({
  version: 1,
  project: { aspect: "9:16", width: 1080, height: 1920, fps: 30 },
  music,
  audioMode: "music",
  timeline,
});
const videoSeg = (fileId, start, dur, inSec = 0) => ({
  type: "video",
  slotStartSec: start,
  durationSec: dur,
  source: { fileId, inSec, outSec: inSec + dur },
  crop: { focusX: 0.5, focusY: 0.5 },
  transitionOut: "cut",
});
const emptySeg = (start, dur) => ({ type: "empty", slotStartSec: start, durationSec: dur });

/** A ready project with two clips, a photo and the song, all done. */
function ready() {
  return loaded({ files: [meta("v1", "video"), meta("v2", "video"), meta("p1", "photo"), meta("m1", "audio")] });
}

describe("initial state", () => {
  it("uses the brief's default options", () => {
    expect(DEFAULT_OPTIONS).toEqual({
      aspect: "9:16",
      pace: "medium",
      length: 30,
      startSec: null,
      audioMode: "music",
      templateId: null,
    });
    expect(initialState.options).toEqual(DEFAULT_OPTIONS);
    expect(initialState.phase).toBe("loading");
    expect(initialState.files).toEqual([]);
    expect(initialState.draft).toBeNull();
    expect(initialState.job).toBeNull();
  });
});

describe("project snapshot", () => {
  it("turns completed files into done rows and uploads into interrupted rows", () => {
    const snap = projectSnapshot(
      project({
        files: [meta("v1", "video")],
        uploads: [{ uploadId: "u1", filename: "big.mp4", size: 64, kind: "video", chunkSize: 8, totalChunks: 8, received: [0, 1] }],
      }),
    );
    expect(snap.files).toEqual([
      {
        localId: "f:v1",
        name: "v1.mp4",
        size: 1000,
        kind: "video",
        status: "done",
        progress: 1,
        meta: meta("v1", "video"),
        uploadId: null,
        chunkSize: null,
        error: null,
        errorCode: null,
        network: false,
        busy: false,
      },
      {
        localId: "u:u1",
        name: "big.mp4",
        size: 64,
        kind: "video",
        status: "interrupted",
        progress: 0.25,
        meta: null,
        uploadId: "u1",
        chunkSize: 8,
        error: null,
        errorCode: null,
        network: false,
        busy: false,
      },
    ]);
  });

  it("restores the newest queued, running or done render, never a failed one", () => {
    const renders = [
      { jobId: "j1", status: "done", percent: 100, position: null, message: null },
      { jobId: "j2", status: "running", percent: 40, position: null, message: null },
      { jobId: "j3", status: "failed", percent: 10, position: null, message: "boom" },
    ];
    expect(projectSnapshot(project({ renders })).job).toEqual(renders[1]);
    expect(projectSnapshot(project({ renders: [renders[2]] })).job).toBeNull();
  });

  it("reports the music file id to analyse", () => {
    expect(projectSnapshot(project({ files: [meta("m1", "audio")] })).musicFileId).toBe("m1");
    expect(projectSnapshot(project()).musicFileId).toBeNull();
  });

  it("is applied by project/loaded with limits, usage and the restored flag", () => {
    const s = loaded({ files: [meta("v1", "video")], usedBytes: 5 });
    expect(s.phase).toBe("ready");
    expect(s.usedBytes).toBe(5);
    expect(s.limits.ttlHours).toBe(24);
    expect(s.restored).toBe(true);
    expect(s.files).toHaveLength(1);
    expect(loaded().restored).toBe(false);
  });

  it("project/failed shows the message", () => {
    const s = reducer(initialState, { type: "project/failed", message: "Can't reach Studio. Check your connection." });
    expect(s.phase).toBe("error");
    expect(s.loadError).toBe("Can't reach Studio. Check your connection.");
  });

  it("interrupted rows carry the resume hint", () => {
    expect(INTERRUPTED_HINT).toBe("Choose this file again to resume.");
    expect(rowStatusText({ status: "interrupted" })).toBe("Choose this file again to resume.");
  });
});

describe("planPick", () => {
  it("rejects files kindOf cannot place, with the brief's sentence", () => {
    const plan = planPick(loaded(), [pick("a", file("notes.txt")), pick("b", file("clip.mp4"))]);
    expect(plan.notices).toEqual(["This file can't be used: notes.txt."]);
    expect(plan.add.map((r) => r.localId)).toEqual(["b"]);
    expect(plan.queue.map((q) => q.localId)).toEqual(["b"]);
  });

  it("new rows wait in order", () => {
    const plan = planPick(loaded(), [pick("a", file("a.mp4")), pick("b", file("b.jpg"))]);
    expect(plan.add.map((r) => [r.localId, r.kind, r.status, r.progress])).toEqual([
      ["a", "video", "waiting", 0],
      ["b", "photo", "waiting", 0],
    ]);
  });

  it("resumes a server upload whose name and size match, reusing its row", () => {
    const s = loaded({
      uploads: [{ uploadId: "u1", filename: "big.mp4", size: 64, kind: "video", chunkSize: 8, totalChunks: 8, received: [0] }],
    });
    const f = file("big.mp4", 64);
    const plan = planPick(s, [pick("new", f, { uploadId: "other", chunkSize: 4 })]);
    expect(plan.add).toEqual([]);
    expect(plan.queue).toEqual([{ localId: "u:u1", file: f, resume: { uploadId: "u1", chunkSize: 8 } }]);
    const next = reducer(s, { type: "files/picked", plan });
    expect(next.files).toHaveLength(1);
    expect(next.files[0]).toMatchObject({ localId: "u:u1", status: "waiting", uploadId: "u1" });
  });

  it("uses the remembered upload when no server row matches", () => {
    const f = file("a.mp4", 10);
    const plan = planPick(loaded(), [pick("a", f, { uploadId: "u9", chunkSize: 8 })]);
    expect(plan.queue).toEqual([{ localId: "a", file: f, resume: { uploadId: "u9", chunkSize: 8 } }]);
  });

  it("keeps one song: a second one replaces the first", () => {
    const s = loaded({ files: [meta("m1", "audio")] });
    const plan = planPick(s, [pick("s2", file("new.mp3"))]);
    expect(plan.replaced.map((r) => r.localId)).toEqual(["f:m1"]);
    const next = reducer(s, { type: "files/picked", plan });
    expect(next.files.map((r) => r.localId)).toEqual(["s2"]);
  });

  it("two songs in one pick: the last one is used and the other is named", () => {
    const plan = planPick(loaded(), [pick("a", file("one.mp3")), pick("b", file("two.m4a"))]);
    expect(plan.add.map((r) => r.localId)).toEqual(["b"]);
    expect(plan.notices).toEqual(["Only one song is used, so one.mp3 was left out."]);
  });

  it("does not replace the song row that is itself being resumed", () => {
    const s = loaded({
      uploads: [{ uploadId: "u1", filename: "song.mp3", size: 50, kind: "audio", chunkSize: 8, totalChunks: 7, received: [] }],
    });
    const plan = planPick(s, [pick("x", file("song.mp3", 50))]);
    expect(plan.replaced).toEqual([]);
  });

  it("files/picked stores the notices and clears the analysis when the song is replaced", () => {
    let s = ready();
    s = reducer(s, { type: "analysis/done", fileId: "m1", tempo: 118.4, durationSec: 100 });
    const plan = planPick(s, [pick("x", file("bad.exe")), pick("s2", file("new.mp3"))]);
    s = reducer(s, { type: "files/picked", plan });
    expect(s.notices).toEqual(["This file can't be used: bad.exe."]);
    expect(s.analysis).toBeNull();
    s = reducer(s, { type: "notices/dismissed" });
    expect(s.notices).toEqual([]);
  });
});

describe("upload rows", () => {
  const withRow = () => reducer(loaded(), { type: "files/picked", plan: planPick(loaded(), [pick("a", file("a.mp4", 10))]) });

  it("goes waiting, uploading with progress, done with meta", () => {
    let s = withRow();
    s = reducer(s, { type: "upload/started", localId: "a" });
    expect(s.files[0].status).toBe("uploading");
    s = reducer(s, { type: "upload/progress", localId: "a", progress: 0.4 });
    expect(s.files[0].progress).toBe(0.4);
    s = reducer(s, { type: "upload/done", localId: "a", meta: meta("v1", "video") });
    expect(s.files[0]).toMatchObject({ status: "done", progress: 1, meta: meta("v1", "video"), uploadId: null });
  });

  it("pauses with the upload id and can be requeued with a resume", () => {
    let s = reducer(withRow(), { type: "upload/paused", localId: "a", uploadId: "u1" });
    expect(s.files[0]).toMatchObject({ status: "paused", uploadId: "u1" });
    s = reducer(s, { type: "upload/requeued", localId: "a" });
    expect(s.files[0]).toMatchObject({ status: "waiting", error: null });
  });

  it("fails with the message and code", () => {
    const s = reducer(withRow(), {
      type: "upload/failed",
      localId: "a",
      message: "This file is too large. The limit is 3 GB.",
      code: "file_too_large",
      network: false,
    });
    expect(s.files[0]).toMatchObject({ status: "error", error: "This file is too large. The limit is 3 GB.", errorCode: "file_too_large" });
  });

  it("ignores events for rows that are gone", () => {
    const s = withRow();
    expect(reducer(s, { type: "upload/progress", localId: "zzz", progress: 0.5 })).toBe(s);
  });

  it("marks a row busy and removes it", () => {
    let s = reducer(withRow(), { type: "row/busy", localId: "a", busy: true });
    expect(s.files[0].busy).toBe(true);
    s = reducer(s, { type: "row/removed", localId: "a" });
    expect(s.files).toEqual([]);
  });

  it("removing the song clears its analysis", () => {
    let s = reducer(ready(), { type: "analysis/done", fileId: "m1", tempo: 120, durationSec: 90 });
    s = reducer(s, { type: "row/removed", localId: "f:m1" });
    expect(s.analysis).toBeNull();
  });

  it("restartLabel offers a new upload after a mismatch or a lost upload, and a retry after a network error", () => {
    expect(restartLabel({ status: "error", errorCode: "resume_mismatch" })).toBe("Upload as new");
    expect(restartLabel({ status: "error", errorCode: "unknown_upload" })).toBe("Upload as new");
    expect(restartLabel({ status: "error", errorCode: null, network: true })).toBe("Retry");
    expect(restartLabel({ status: "error", errorCode: "file_too_large" })).toBeNull();
    expect(restartLabel({ status: "done" })).toBeNull();
  });

  it("rowStatusText", () => {
    expect(rowStatusText({ status: "waiting" })).toBe("Waiting");
    expect(rowStatusText({ status: "uploading", progress: 0.714 })).toBe("71%");
    expect(rowStatusText({ status: "uploading", progress: 0.99 })).toBe("Checking the file");
    expect(rowStatusText({ status: "paused" })).toBe("Paused");
    expect(rowStatusText({ status: "done" })).toBe("done");
    expect(rowStatusText({ status: "error", error: "No." })).toBe("No.");
  });
});

describe("music and analysis", () => {
  it("musicRow is the song row; musicFile is its meta once done", () => {
    const s = ready();
    expect(musicRow(s).localId).toBe("f:m1");
    expect(musicFile(s).fileId).toBe("m1");
    expect(musicFile(loaded())).toBeNull();
  });

  it("keeps analysis only for the current song", () => {
    let s = reducer(ready(), { type: "analysis/started", fileId: "m1" });
    expect(s.analysis).toEqual({ fileId: "m1", status: "working", tempo: null, error: null });
    s = reducer(s, { type: "analysis/done", fileId: "old", tempo: 99, durationSec: 1 });
    expect(s.analysis.status).toBe("working");
    s = reducer(s, { type: "analysis/done", fileId: "m1", tempo: 118.4, durationSec: 100 });
    expect(s.analysis).toEqual({ fileId: "m1", status: "done", tempo: 118.4, error: null });
    s = reducer(s, { type: "analysis/failed", fileId: "m1", message: "No clear beat." });
    expect(s.analysis).toEqual({ fileId: "m1", status: "error", tempo: null, error: "No clear beat." });
  });
});

describe("options", () => {
  it("changes one option", () => {
    const s = reducer(ready(), { type: "options/changed", key: "pace", value: "fast" });
    expect(s.options.pace).toBe("fast");
  });

  it("parses Start at, and flags an invalid entry", () => {
    let s = reducer(ready(), { type: "start/changed", text: "0:12" });
    expect(s.options.startSec).toBe(12);
    expect(s.startError).toBe(false);
    s = reducer(s, { type: "start/changed", text: "abc" });
    expect(s.options.startSec).toBeNull();
    expect(s.startError).toBe(true);
    expect(canMakeDraft(s)).toBe(false);
    s = reducer(s, { type: "start/changed", text: "  " });
    expect(s.startError).toBe(false);
    expect(s.options.startSec).toBeNull();
  });

  it("choosing a template keeps its slots until a draft exists", () => {
    const template = { id: "t1", name: "Reel", editList: editList([emptySeg(0, 1), emptySeg(1, 1)]) };
    let s = reducer(ready(), { type: "template/chosen", template });
    expect(s.options.templateId).toBe("t1");
    expect(s.templateList).toBe(template.editList);
    s = reducer(s, { type: "template/chosen", template: null });
    expect(s.options.templateId).toBeNull();
    expect(s.templateList).toBeNull();
  });
});

describe("what is enabled", () => {
  it("needs a video or photo and the song, both done", () => {
    expect(inputsReady(loaded())).toBe(false);
    expect(inputsReady(loaded({ files: [meta("m1", "audio")] }))).toBe(false);
    expect(inputsReady(loaded({ files: [meta("p1", "photo")] }))).toBe(false);
    expect(inputsReady(loaded({ files: [meta("p1", "photo"), meta("m1", "audio")] }))).toBe(true);
    expect(canMakeDraft(ready())).toBe(true);
  });

  it("an uploading song does not count", () => {
    const s0 = loaded({ files: [meta("v1", "video")] });
    const s = reducer(s0, { type: "files/picked", plan: planPick(s0, [pick("s", file("s.mp3"))]) });
    expect(canMakeDraft(s)).toBe(false);
  });

  it("not while a draft is being made", () => {
    const s = reducer(ready(), { type: "draft/started", mode: "draft", seed: 5 });
    expect(canMakeDraft(s)).toBe(false);
    expect(s.drafting).toBe("draft");
    expect(s.seed).toBe(5);
  });
});

describe("draftRequest", () => {
  it("sends the done clips and photos, the song, the options and the seed", () => {
    const s = ready();
    expect(draftRequest(s, 42)).toEqual({
      fileIds: ["v1", "v2", "p1"],
      musicFileId: "m1",
      aspect: "9:16",
      pace: "medium",
      length: 30,
      audioMode: "music",
      seed: 42,
    });
  });

  it("adds startSec only when set, and the template's edit list when one is chosen", () => {
    const template = { id: "t1", name: "Reel", editList: editList([emptySeg(0, 1)]) };
    let s = reducer(ready(), { type: "start/changed", text: "1:05" });
    s = reducer(s, { type: "options/changed", key: "length", value: "all" });
    s = reducer(s, { type: "template/chosen", template });
    const req = draftRequest(s, 7);
    expect(req.startSec).toBe(65);
    expect(req.length).toBe("all");
    expect(req.template).toBe(template.editList);
    expect(Object.keys(req)).not.toContain("templateId");
  });

  it("leaves out files that are not done", () => {
    const s0 = ready();
    const s = reducer(s0, { type: "files/picked", plan: planPick(s0, [pick("x", file("late.mp4"))]) });
    expect(draftRequest(s, 1).fileIds).toEqual(["v1", "v2", "p1"]);
  });
});

describe("draft", () => {
  const draftOf = (s, timeline) =>
    reducer(reducer(s, { type: "draft/started", mode: "draft", seed: 1 }), {
      type: "draft/done",
      editList: editList(timeline),
      warnings: ["shots_repeat"],
      request: draftRequest(s, 1),
    });

  it("stores the draft and stops working", () => {
    const s = draftOf(ready(), [videoSeg("v1", 0, 1), videoSeg("v2", 1, 1)]);
    expect(s.drafting).toBeNull();
    expect(s.draft.warnings).toEqual(["shots_repeat"]);
    expect(s.draft.editList.timeline).toHaveLength(2);
  });

  it("ignores a draft that arrives after the page was cleared", () => {
    let s = reducer(ready(), { type: "draft/started", mode: "draft", seed: 1 });
    s = reducer(s, { type: "project/cleared" });
    const after = reducer(s, { type: "draft/done", editList: editList([]), warnings: [], request: {} });
    expect(after.draft).toBeNull();
  });

  it("a failed draft keeps the old one and shows the message", () => {
    let s = draftOf(ready(), [videoSeg("v1", 0, 2)]);
    s = reducer(s, { type: "draft/started", mode: "reshuffle", seed: 2 });
    s = reducer(s, { type: "draft/failed", message: "No clear beat." });
    expect(s.draft).not.toBeNull();
    expect(s.draftError).toBe("No clear beat.");
    expect(s.drafting).toBeNull();
  });

  it("changing aspect or audio makes the draft stale; changing back does not", () => {
    let s = draftOf(ready(), [videoSeg("v1", 0, 2)]);
    expect(draftStale(s)).toBe(false);
    s = reducer(s, { type: "options/changed", key: "aspect", value: "16:9" });
    expect(draftStale(s)).toBe(true);
    expect(s.files).toHaveLength(4);
    expect(canRender(s, null)).toBe(false);
    s = reducer(s, { type: "options/changed", key: "aspect", value: "9:16" });
    expect(draftStale(s)).toBe(false);
    s = reducer(s, { type: "options/changed", key: "audioMode", value: "silent" });
    expect(draftStale(s)).toBe(true);
  });

  it("a new song makes the draft stale", () => {
    let s = draftOf(ready(), [videoSeg("v1", 0, 2)]);
    s = reducer(s, { type: "files/picked", plan: planPick(s, [pick("s2", file("new.mp3"))]) });
    expect(draftStale(s)).toBe(true);
  });

  it("fills and skips slots in the draft", () => {
    let s = draftOf(ready(), [videoSeg("v1", 0, 1), videoSeg("v2", 1, 1)]);
    s = reducer(s, { type: "slot/filled", index: 1, file: meta("p1", "photo"), inSec: 0 });
    expect(s.draft.editList.timeline[1].type).toBe("photo");
    s = reducer(s, { type: "slot/skipped", index: 1 });
    expect(s.draft.editList.timeline).toHaveLength(1);
    expect(s.draft.editList.timeline[0].durationSec).toBe(2);
  });

  it("skips slots in the template before a draft exists", () => {
    const template = { id: "t1", name: "Reel", editList: editList([emptySeg(0, 1), emptySeg(1, 1)]) };
    let s = reducer(ready(), { type: "template/chosen", template });
    s = reducer(s, { type: "slot/skipped", index: 0 });
    expect(s.templateList.timeline).toEqual([emptySeg(0, 2)]);
    expect(draftRequest(s, 1).template.timeline).toHaveLength(1);
  });

  it("slotRows lists the draft, or the template preview, with problems", () => {
    const template = { id: "t1", name: "Reel", editList: editList([emptySeg(0, 1)]) };
    let s = reducer(ready(), { type: "template/chosen", template });
    let rows = slotRows(s);
    expect(rows.preview).toBe(true);
    expect(rows.items[0]).toMatchObject({ index: 0, label: "— empty —", problem: "empty", range: "0.0–1.0" });

    s = draftOf(s, [videoSeg("v1", 0, 1), videoSeg("gone", 1, 1), videoSeg("v2", 2, 1, 19.5)]);
    rows = slotRows(s);
    expect(rows.preview).toBe(false);
    expect(rows.items.map((r) => r.problem)).toEqual([null, "missing_file", "too_short"]);
    expect(rows.items[0].number).toBe("01");
    expect(slotRows(ready())).toBeNull();
  });

  it("removing a clip the draft uses keeps the draft and flags its rows", () => {
    let s = draftOf(ready(), [videoSeg("v1", 0, 1), videoSeg("v2", 1, 1)]);
    s = reducer(s, { type: "row/removed", localId: "f:v1" });
    expect(s.draft).not.toBeNull();
    expect(slotRows(s).items[0].problem).toBe("missing_file");
    expect(canRender(s, null)).toBe(false);
  });

  it("filesById and visualFiles come from done rows", () => {
    const s = ready();
    expect(Object.keys(filesById(s))).toEqual(["v1", "v2", "p1", "m1"]);
    expect(visualFiles(s).map((f) => f.fileId)).toEqual(["v1", "v2", "p1"]);
  });
});

describe("render", () => {
  const withDraft = () => {
    const s = ready();
    return reducer(reducer(s, { type: "draft/started", mode: "draft", seed: 1 }), {
      type: "draft/done",
      editList: editList([videoSeg("v1", 0, 2)]),
      warnings: [],
      request: draftRequest(s, 1),
    });
  };

  it("can render a clean draft with no active job", () => {
    expect(canRender(withDraft(), null)).toBe(true);
    expect(canRender(ready(), null)).toBe(false);
  });

  it("not while submitting, nor while the job is queued or running", () => {
    let s = reducer(withDraft(), { type: "render/started" });
    expect(canRender(s, null)).toBe(false);
    s = reducer(s, { type: "render/created", jobId: "j1" });
    expect(s.rendering).toBe(false);
    expect(s.job).toEqual({ jobId: "j1", status: "queued", percent: 0, position: null, message: null });
    const view = jobView(s.job, { status: "running", percent: 10 }, null);
    expect(canRender(s, view)).toBe(false);
    expect(canRender(s, jobView(s.job, { status: "done", percent: 100 }, null))).toBe(true);
    expect(canRender(s, jobView(s.job, { status: "failed", message: "x" }, null))).toBe(true);
  });

  it("a failed submit shows the message", () => {
    let s = reducer(withDraft(), { type: "render/started" });
    s = reducer(s, { type: "render/failed", message: "A render is already waiting. Try again when it finishes." });
    expect(s.rendering).toBe(false);
    expect(s.renderError).toBe("A render is already waiting. Try again when it finishes.");
  });

  it("jobView merges the poll result, and a lost render is reported", () => {
    const job = { jobId: "j1", status: "queued", percent: 0, position: null, message: null };
    expect(jobView(null, null, null)).toBeNull();
    expect(jobView(job, { jobId: "j1", status: "queued", position: 2 }, null)).toMatchObject({ status: "queued", position: 2 });
    expect(jobView(job, undefined, { code: "unknown_render", message: "gone" })).toMatchObject({ status: "lost" });
    expect(jobView(job, { status: "running", percent: 5 }, { code: null, message: "Can't reach Studio. Check your connection." }))
      .toMatchObject({ status: "running", pollError: "Can't reach Studio. Check your connection." });
  });

  it("renderLine words each state", () => {
    expect(renderLine({ status: "queued", position: 2 })).toBe("Waiting (position 2)");
    expect(renderLine({ status: "queued", position: null })).toBe("Waiting");
    expect(renderLine({ status: "running", percent: 62 })).toBe("62%");
    expect(renderLine({ status: "done" })).toBe("Done");
    expect(renderLine({ status: "failed", message: "FFmpeg failed." })).toBe("FFmpeg failed.");
    expect(renderLine({ status: "failed", message: null })).toBe("The render failed.");
    expect(renderLine({ status: "lost" })).toBe("The service restarted, please render again.");
  });

  it("a restored job shows even without a draft", () => {
    const s = loaded({ renders: [{ jobId: "j1", status: "done", percent: 100, position: null, message: null }] });
    expect(s.job.jobId).toBe("j1");
    expect(s.draft).toBeNull();
  });
});

describe("clear", () => {
  it("resets everything but keeps the limits", () => {
    let s = ready();
    s = reducer(s, { type: "project/cleared" });
    expect(s.files).toEqual([]);
    expect(s.usedBytes).toBe(0);
    expect(s.limits.ttlHours).toBe(24);
    expect(s.phase).toBe("ready");
    expect(s.restored).toBe(false);
  });

  it("usage/loaded updates the numbers only", () => {
    const s = reducer(ready(), { type: "usage/loaded", usedBytes: 99, limits: { maxProjectBytes: 1, ttlHours: 2 } });
    expect(s.usedBytes).toBe(99);
    expect(s.limits.ttlHours).toBe(2);
    expect(s.files).toHaveLength(4);
  });
});

describe("copy", () => {
  it("maps warnings to the brief's sentences and ignores unknown codes", () => {
    expect(
      warningLines(["song_shorter_than_length", "shots_repeat", "same_clip_back_to_back", "photos_left_out", "new_code"]),
    ).toEqual([
      "The song is shorter than that, so the whole song is used.",
      "Not enough footage: some shots repeat.",
      "Only one clip fits, so it repeats back to back.",
      "Some photos did not fit in this length.",
    ]);
    expect(warningLines(undefined)).toEqual([]);
  });

  it("draft header", () => {
    expect(draftHeader(editList([videoSeg("v1", 0, 1), videoSeg("v2", 1, 29)]))).toBe("30.0 s · 2 shots");
    expect(draftHeader(editList([videoSeg("v1", 0, 1.5)]))).toBe("1.5 s · 1 shot");
  });

  it("usage in GB, and the footer from ttlHours", () => {
    expect(formatGb(0)).toBe("0");
    expect(formatGb(10 * GB)).toBe("10");
    expect(formatGb(2.34 * GB)).toBe("2.3");
    expect(formatGb(0.05 * GB)).toBe("0.05");
    expect(usageLine({ usedBytes: 2.34 * GB, limits: { maxProjectBytes: 10 * GB } })).toBe("2.3 of 10 GB used");
    expect(usageLine({ usedBytes: 0, limits: null })).toBeNull();
    expect(ttlLine(null)).toBe("Files are deleted 24 hours after upload.");
    expect(ttlLine({ ttlHours: 48 })).toBe("Files are deleted 48 hours after upload.");
    expect(ttlLine({ ttlHours: 1 })).toBe("Files are deleted 1 hour after upload.");
  });

  it("file sizes", () => {
    expect(formatSize(2.1 * GB)).toBe("2.1 GB");
    expect(formatSize(4 * 1024 * 1024)).toBe("4 MB");
    expect(formatSize(2048)).toBe("2 KB");
    expect(formatSize(10)).toBe("1 KB");
  });

  it("lists slot numbers that stop a render", () => {
    expect(problemSummary([])).toBeNull();
    expect(problemSummary([{ index: 2 }])).toBe("Fix slot 3 before rendering.");
    expect(problemSummary([{ index: 0 }, { index: 4 }])).toBe("Fix slots 1, 5 before rendering.");
  });
});
