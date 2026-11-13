// The Studio page's side effects: uploads, API calls and render polling.
// Every decision about state lives in studioState.js; this file only wires it up.
import { useEffect, useReducer, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "../context/toastContext";
import { errorCode, errorMessage, studioApi } from "./studioApi";
import { findInterrupted, forgetAllUploads, forgetUpload, kindOf, uploadFile } from "./upload/chunks";
import { createUploadQueue } from "./upload/uploadQueue";
import { loadTemplates, saveTemplate, toTemplate } from "./templates";
import { MAX_PARALLEL_UPLOADS, draftRequest, initialState, jobView, planPick, projectSnapshot, reducer } from "./studioState";

const POLL_MS = 2000;

/** A random 31-bit integer. */
const newSeed = () => Math.floor(Math.random() * 2 ** 31);

let counter = 0;
const newLocalId = () => `l:${Date.now().toString(36)}:${(counter += 1)}`;

/** A 404 means the server no longer has it, which is what we wanted. */
const ignore404 = (promise) =>
  promise.catch((error) => {
    if (error?.response?.status !== 404) throw error;
  });

function runAnalysis(fileId, dispatch, alive) {
  dispatch({ type: "analysis/started", fileId });
  studioApi.analyze(fileId).then(
    (result) => {
      if (alive.current) dispatch({ type: "analysis/done", fileId, tempo: result.tempo, durationSec: result.durationSec });
    },
    (error) => {
      if (alive.current) dispatch({ type: "analysis/failed", fileId, message: errorMessage(error) });
    },
  );
}

/** Refreshes "x of y GB used" after the project changed. Failures are not worth a message. */
function refreshUsage(dispatch, alive) {
  studioApi.project().then(
    (project) => {
      if (alive.current) dispatch({ type: "usage/loaded", usedBytes: project.usedBytes, limits: project.limits });
    },
    () => {},
  );
}

export function useStudio() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const toast = useToast();
  const alive = useRef(true);
  const files = useRef(new Map()); // localId -> File, for rows picked in this visit
  const onEvent = useRef(null);
  const loadStarted = useRef(false);
  const [templates, setTemplates] = useState(loadTemplates);
  const [downloading, setDownloading] = useState(false);
  const [clearing, setClearing] = useState(false);

  const [queue] = useState(() =>
    createUploadQueue({
      limit: MAX_PARALLEL_UPLOADS,
      run: (item, { signal, onProgress }) => uploadFile(item.file, { signal, onProgress, resume: item.resume ?? undefined }),
      onEvent: (event) => onEvent.current?.(event),
    }),
  );

  // Leaving the page aborts every upload (the server keeps what arrived, so it
  // can resume later) and silences every callback. StrictMode runs this
  // cleanup once at mount, before anything is queued; revive undoes it.
  useEffect(() => {
    alive.current = true;
    queue.revive();
    return () => {
      alive.current = false;
      queue.dispose();
    };
  }, [queue]);

  // Load the project once, also under StrictMode's double effect.
  useEffect(() => {
    if (loadStarted.current) return;
    loadStarted.current = true;
    studioApi.project().then(
      (project) => {
        if (!alive.current) return;
        dispatch({ type: "project/loaded", project });
        const { musicFileId } = projectSnapshot(project);
        if (musicFileId) runAnalysis(musicFileId, dispatch, alive);
      },
      (error) => {
        if (alive.current) dispatch({ type: "project/failed", message: errorMessage(error) });
      },
    );
  }, []);

  const send = (action) => {
    if (alive.current) dispatch(action);
  };
  const say = {
    success: (m) => alive.current && toast.success(m),
    error: (m) => alive.current && toast.error(m),
    info: (m) => alive.current && toast.info(m),
  };

  function handleQueueEvent(event) {
    const { id } = event;
    switch (event.type) {
      case "started":
        send({ type: "upload/started", localId: id });
        break;
      case "progress":
        send({ type: "upload/progress", localId: id, progress: event.progress });
        break;
      case "done":
        files.current.delete(id);
        send({ type: "upload/done", localId: id, meta: event.meta });
        if (event.meta?.kind === "audio") runAnalysis(event.meta.fileId, send, alive);
        refreshUsage(send, alive);
        break;
      case "failed": {
        const { error } = event;
        if (error?.name === "UploadPausedError") {
          send({ type: "upload/paused", localId: id, uploadId: error.uploadId });
          break;
        }
        const mismatch = error?.code === "resume_mismatch";
        const file = files.current.get(id);
        if (mismatch && file) forgetUpload(file);
        send({
          type: "upload/failed",
          localId: id,
          message: mismatch ? error.message : errorMessage(error),
          code: mismatch ? "resume_mismatch" : errorCode(error),
          network: !mismatch && !error?.response,
        });
        break;
      }
      default:
        break;
    }
  }

  useEffect(() => {
    onEvent.current = handleQueueEvent;
  });

  function enqueue(localId, file, resume) {
    files.current.set(localId, file);
    queue.add({ id: localId, file, resume });
  }

  /** Removes what the server holds for a row. Throws when the server call fails. */
  async function discardOnServer(row) {
    const file = files.current.get(row.localId);
    files.current.delete(row.localId);
    if (row.status === "done" && row.meta) {
      await ignore404(studioApi.deleteFile(row.meta.fileId));
      return;
    }
    let uploadId = row.uploadId;
    if (queue.has(row.localId)) {
      const result = await queue.cancel(row.localId);
      if (result.status === "done") {
        // It finished while being cancelled.
        await ignore404(studioApi.deleteFile(result.meta.fileId));
        return;
      }
      if (result.status === "failed" && result.error?.uploadId) uploadId = result.error.uploadId;
    }
    if (!uploadId && file) uploadId = findInterrupted(file)?.uploadId ?? null;
    if (file) forgetUpload(file);
    if (uploadId) await ignore404(studioApi.cancelUpload(uploadId));
  }

  // ---- step 1 -------------------------------------------------------------

  function pickFiles(fileList) {
    const picks = Array.from(fileList ?? []).map((file) => {
      const kind = kindOf(file);
      return { localId: newLocalId(), file, kind, remembered: kind ? findInterrupted(file) : null };
    });
    if (picks.length === 0) return;
    const plan = planPick(state, picks);
    dispatch({ type: "files/picked", plan });
    for (const row of plan.replaced) {
      discardOnServer(row).then(
        () => refreshUsage(send, alive),
        (error) => say.error(errorMessage(error)),
      );
    }
    for (const entry of plan.queue) enqueue(entry.localId, entry.file, entry.resume);
  }

  /** Remove a finished file, cancel an upload, or dismiss a failed row. */
  async function removeRow(row) {
    send({ type: "row/busy", localId: row.localId, busy: true });
    try {
      await discardOnServer(row);
      send({ type: "row/removed", localId: row.localId });
      refreshUsage(send, alive);
    } catch (error) {
      say.error(errorMessage(error));
      // A finished file is still on the server, so it stays. An upload was
      // already stopped; it shows again after a reload if the server kept it.
      if (row.status === "done") send({ type: "row/busy", localId: row.localId, busy: false });
      else send({ type: "row/removed", localId: row.localId });
    }
  }

  function resumeRow(row) {
    const file = files.current.get(row.localId);
    if (!file) return;
    const resume = findInterrupted(file) ?? (row.uploadId && state.limits ? { uploadId: row.uploadId, chunkSize: state.limits.chunkSize } : null);
    dispatch({ type: "upload/requeued", localId: row.localId });
    enqueue(row.localId, file, resume);
  }

  /** "Upload as new" after a mismatch or a lost upload; "Retry" after a network error. */
  function restartRow(row) {
    const file = files.current.get(row.localId);
    if (!file) return;
    if (row.errorCode === "resume_mismatch" || row.errorCode === "unknown_upload") {
      forgetUpload(file);
      if (row.uploadId) studioApi.cancelUpload(row.uploadId).catch(() => {});
      dispatch({ type: "upload/requeued", localId: row.localId, fresh: true });
      enqueue(row.localId, file, null);
      return;
    }
    dispatch({ type: "upload/requeued", localId: row.localId });
    enqueue(row.localId, file, findInterrupted(file));
  }

  // ---- step 2 and 3 -------------------------------------------------------

  function makeDraft(mode) {
    const seed = mode === "reshuffle" || state.seed === null ? newSeed() : state.seed;
    const request = draftRequest(state, seed);
    dispatch({ type: "draft/started", mode, seed });
    studioApi.draft(request).then(
      (result) => send({ type: "draft/done", editList: result.editList, warnings: result.warnings, request }),
      (error) => send({ type: "draft/failed", message: errorMessage(error) }),
    );
  }

  function chooseTemplate(id) {
    dispatch({ type: "template/chosen", template: templates.find((t) => t.id === id) ?? null });
  }

  /** Returns true when saved. */
  function saveAsTemplate(name) {
    if (!state.draft) return false;
    const ok = saveTemplate(toTemplate(state.draft.editList, name));
    if (ok) {
      setTemplates(loadTemplates());
      say.success("Template saved.");
    } else {
      say.error("Could not save the template on this device.");
    }
    return ok;
  }

  // ---- step 4 -------------------------------------------------------------

  const jobId = state.job?.jobId ?? null;
  const poll = useQuery({
    queryKey: ["studio", "render", jobId],
    queryFn: () => studioApi.renderStatus(jobId),
    enabled: jobId !== null,
    retry: (count, error) => errorCode(error) !== "unknown_render" && count < 2,
    refetchInterval: (query) => {
      if (query.state.status === "error") return false;
      const status = query.state.data?.status;
      return status === "done" || status === "failed" ? false : POLL_MS;
    },
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 0,
  });
  const pollError = poll.isError ? { code: errorCode(poll.error), message: errorMessage(poll.error) } : null;
  const job = jobView(state.job, poll.data, pollError);

  function startRender() {
    if (!state.draft) return;
    dispatch({ type: "render/started" });
    studioApi.createRender(state.draft.editList).then(
      (result) => send({ type: "render/created", jobId: result.jobId }),
      (error) => send({ type: "render/failed", message: errorMessage(error) }),
    );
  }

  function download() {
    if (!jobId) return;
    setDownloading(true);
    studioApi
      .downloadLink(jobId)
      .then(
        (url) => {
          // The server sends the mp4 as an attachment, so the page stays put.
          const link = document.createElement("a");
          link.href = url;
          link.setAttribute("download", "");
          link.rel = "noopener";
          document.body.appendChild(link);
          link.click();
          link.remove();
          say.info("Download started. The video is deleted from the server 15 minutes later.");
        },
        (error) => say.error(errorMessage(error)),
      )
      .finally(() => {
        if (alive.current) setDownloading(false);
      });
  }

  async function clearAll() {
    setClearing(true);
    const stopped = await queue.cancelAll();
    try {
      await studioApi.clearProject();
      forgetAllUploads();
      files.current.clear();
      send({ type: "project/cleared" });
      refreshUsage(send, alive);
      say.success("All files and renders are deleted.");
    } catch (error) {
      say.error(errorMessage(error));
      // Nothing was deleted: put the stopped uploads back.
      for (const [id, result] of Object.entries(stopped)) {
        const file = files.current.get(id);
        if (result.status === "done") send({ type: "upload/done", localId: id, meta: result.meta });
        else if (file && alive.current) {
          send({ type: "upload/requeued", localId: id });
          enqueue(id, file, findInterrupted(file));
        }
      }
    } finally {
      if (alive.current) setClearing(false);
    }
  }

  return {
    state,
    job,
    templates,
    downloading,
    clearing,
    actions: {
      pickFiles,
      removeRow,
      resumeRow,
      restartRow,
      dismissNotices: () => dispatch({ type: "notices/dismissed" }),
      setOption: (key, value) => dispatch({ type: "options/changed", key, value }),
      setStart: (text) => dispatch({ type: "start/changed", text }),
      chooseTemplate,
      makeDraft: () => makeDraft("draft"),
      reshuffle: () => makeDraft("reshuffle"),
      saveAsTemplate,
      fillSlot: (index, file, inSec) => dispatch({ type: "slot/filled", index, file, inSec }),
      skipSlot: (index) => dispatch({ type: "slot/skipped", index }),
      render: startRender,
      checkAgain: () => poll.refetch(),
      download,
      clearAll,
    },
  };
}
