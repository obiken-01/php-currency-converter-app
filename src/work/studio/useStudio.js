// The Studio page's side effects: uploads, API calls and render polling.
// Every decision about state lives in studioState.js; this file only wires it up.
import { useEffect, useReducer, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "../context/toastContext";
import { errorCode, errorMessage, studioApi } from "./studioApi";
import { findInterrupted, forgetAllUploads, forgetUpload, kindOf, uploadFile } from "./upload/chunks";
import { createUploadQueue } from "./upload/uploadQueue";
import { deleteTemplate, loadTemplates, saveTemplate, toTemplate } from "./templates";
import {
  MAX_PARALLEL_UPLOADS,
  canPick,
  draftRequest,
  initialState,
  jobView,
  leaveGuard,
  planPick,
  pollOnVisible,
  projectSnapshot,
  reducer,
  songSwap,
  uploadHeldElsewhere,
  uploadsRunning,
} from "./studioState";

const POLL_MS = 2000;

/** complete refused the file itself: the row goes and a notice names it. */
const UNUSABLE = ["unreadable_file", "unsupported_type"];

/** A random 31-bit integer. */
const newSeed = () => Math.floor(Math.random() * 2 ** 31);

let counter = 0;
const newLocalId = () => `l:${Date.now().toString(36)}:${(counter += 1)}`;

/** A 404 means the server no longer has it, which is what we wanted. */
const ignore404 = (promise) =>
  promise.catch((error) => {
    if (error?.response?.status !== 404) throw error;
  });

/** Refreshes "x of y GB used" after the project changed. Failures are not worth a message. */
function refreshUsage(dispatch, alive) {
  studioApi.project().then(
    (project) => {
      if (alive.current) dispatch({ type: "usage/loaded", usedBytes: project.usedBytes, limits: project.limits });
    },
    () => {},
  );
}

/** Keeps the screen on while files upload. Feature-detected; any failure is ignored. */
function useWakeLock(active) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || typeof navigator.wakeLock?.request !== "function") return undefined;
    let lock = null;
    let asking = false;
    let stopped = false;
    const acquire = () => {
      if (stopped || asking || document.visibilityState !== "visible" || (lock && !lock.released)) return;
      asking = true;
      navigator.wakeLock.request("screen").then(
        (next) => {
          asking = false;
          if (stopped) next.release().catch(() => {});
          else lock = next;
        },
        () => {
          asking = false;
        },
      );
    };
    // The browser drops the lock when the page is hidden; take it again on return.
    const onVisibility = () => {
      if (document.visibilityState === "visible") acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (lock && !lock.released) lock.release().catch(() => {});
    };
  }, [active]);
}

/** Asks before the tab is closed or reloaded while work would be lost. */
function useLeaveGuard(active) {
  useEffect(() => {
    if (!active) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);
}

export function useStudio() {
  const [state, rawDispatch] = useReducer(reducer, initialState);
  // The same reducer applied to a ref as each action is sent, so async
  // handlers read the state as of the last action, not of the last render.
  const stateRef = useRef(initialState);
  const dispatch = (action) => {
    stateRef.current = reducer(stateRef.current, action);
    rawDispatch(action);
  };
  const toast = useToast();
  const alive = useRef(true);
  const files = useRef(new Map()); // localId -> File, for rows picked in this visit
  // localId -> meta of uploads that finished in this visit. A row can still look
  // "uploading" to a handler that runs before the re-render; this tells it the
  // file exists on the server.
  const completed = useRef(new Map());
  const onEvent = useRef(null);
  const loadStarted = useRef(false);
  const [templates, setTemplates] = useState(loadTemplates);
  const [downloading, setDownloading] = useState(false);

  const queueRef = useRef(null);

  // The upload queue lives as long as the page. Leaving the page aborts every
  // upload (the server keeps what arrived, so it can resume later) and
  // silences every callback. StrictMode's extra mount gets a fresh queue; the
  // first one is disposed while still empty.
  useEffect(() => {
    alive.current = true;
    const queue = createUploadQueue({
      limit: MAX_PARALLEL_UPLOADS,
      run: (item, { signal, onProgress, onOpened }) =>
        uploadFile(item.file, { signal, onProgress, onOpened, resume: item.resume ?? undefined }),
      onEvent: (event) => onEvent.current?.(event),
    });
    queueRef.current = queue;
    return () => {
      alive.current = false;
      queue.dispose();
    };
  }, []);

  const send = (action) => {
    if (alive.current) dispatch(action);
  };
  const say = {
    success: (m) => alive.current && toast.success(m),
    error: (m) => alive.current && toast.error(m),
    info: (m) => alive.current && toast.info(m),
  };

  /**
   * Beat analysis. For a new song that replaces another, success removes the
   * old song (here and on the server); failure keeps the old song, drops the
   * new file and analyses the old song again.
   */
  function analyse(fileId) {
    send({ type: "analysis/started", fileId });
    studioApi.analyze(fileId).then(
      (result) => {
        if (!alive.current) return;
        const swap = songSwap(stateRef.current, fileId);
        dispatch({ type: "analysis/done", fileId, tempo: result.tempo, durationSec: result.durationSec });
        for (const row of swap.old) {
          discardOnServer(row).then(
            () => refreshUsage(send, alive),
            (error) => say.error(errorMessage(error)),
          );
        }
      },
      (error) => {
        if (!alive.current) return;
        const swap = songSwap(stateRef.current, fileId);
        dispatch({ type: "analysis/failed", fileId, message: errorMessage(error), code: errorCode(error) });
        if (swap.candidate) {
          ignore404(studioApi.deleteFile(fileId)).then(() => refreshUsage(send, alive), () => {});
          if (swap.restoreFileId) analyse(swap.restoreFileId);
        }
      },
    );
  }

  // Load the project once, also under StrictMode's double effect.
  useEffect(() => {
    if (loadStarted.current) return;
    loadStarted.current = true;
    studioApi.project().then(
      (project) => {
        if (!alive.current) return;
        dispatch({ type: "project/loaded", project });
        const { musicFileId } = projectSnapshot(project);
        if (musicFileId) analyse(musicFileId);
      },
      (error) => {
        if (alive.current) dispatch({ type: "project/failed", message: errorMessage(error) });
      },
    );
    // analyse only uses refs and stable helpers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The server answered unknown_file: reload the list so it matches the server. */
  function syncProject() {
    studioApi.project().then(
      (project) => send({ type: "project/synced", project }),
      () => {},
    );
  }

  function handleQueueEvent(event) {
    const { id } = event;
    switch (event.type) {
      case "started":
        send({ type: "upload/started", localId: id });
        break;
      case "opened":
        send({ type: "upload/opened", localId: id, uploadId: event.uploadId, chunkSize: event.chunkSize });
        break;
      case "progress":
        send({ type: "upload/progress", localId: id, progress: event.progress });
        break;
      case "done":
        files.current.delete(id);
        completed.current.set(id, event.meta);
        send({ type: "upload/done", localId: id, meta: event.meta });
        if (event.meta?.kind === "audio" && alive.current) analyse(event.meta.fileId);
        refreshUsage(send, alive);
        break;
      case "failed": {
        const { error } = event;
        if (error?.name === "UploadPausedError") {
          send({ type: "upload/paused", localId: id, uploadId: error.uploadId });
          break;
        }
        const file = files.current.get(id);
        if (UNUSABLE.includes(errorCode(error))) {
          if (file) forgetUpload(file);
          files.current.delete(id);
          send({ type: "upload/unusable", localId: id });
          break;
        }
        const mismatch = error?.code === "resume_mismatch";
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
    queueRef.current?.add({ id: localId, file, resume });
  }

  /** Removes what the server holds for a row. Throws when the server call fails. */
  async function discardOnServer(row) {
    const file = files.current.get(row.localId);
    files.current.delete(row.localId);
    const meta = row.meta ?? completed.current.get(row.localId);
    completed.current.delete(row.localId);
    if (meta) {
      await ignore404(studioApi.deleteFile(meta.fileId));
      return;
    }
    let uploadId = row.uploadId;
    const queue = queueRef.current;
    if (queue?.has(row.localId)) {
      const result = await queue.cancel(row.localId);
      if (result.status === "done") {
        // It finished while being cancelled.
        await ignore404(studioApi.deleteFile(result.meta.fileId));
        return;
      }
      if (result.status === "failed" && result.error?.uploadId) uploadId = result.error.uploadId;
    }
    if (!uploadId && file) uploadId = findInterrupted(file)?.uploadId ?? null;
    // Another row is still sending to this upload: leave it alone.
    if (uploadHeldElsewhere(stateRef.current, row.localId, uploadId)) return;
    if (file) forgetUpload(file);
    if (uploadId) await ignore404(studioApi.cancelUpload(uploadId));
  }

  // ---- step 1 -------------------------------------------------------------

  function pickFiles(fileList) {
    if (!canPick(state)) return;
    const picks = Array.from(fileList ?? []).map((file) => {
      const kind = kindOf(file);
      return { localId: newLocalId(), file, kind, remembered: kind ? findInterrupted(file) : null };
    });
    if (picks.length === 0) return;
    const plan = planPick(stateRef.current, picks);
    // Picked first, so a replaced row's upload is checked against the new rows.
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
    const chunkSize = row.chunkSize ?? state.limits?.chunkSize;
    const resume = findInterrupted(file) ?? (row.uploadId && chunkSize ? { uploadId: row.uploadId, chunkSize } : null);
    dispatch({ type: "upload/requeued", localId: row.localId });
    enqueue(row.localId, file, resume);
  }

  /** "Upload as new" after a mismatch or a lost upload; "Retry" after a network error. */
  function restartRow(row) {
    const file = files.current.get(row.localId);
    if (!file) return;
    if (row.errorCode === "resume_mismatch" || row.errorCode === "unknown_upload") {
      forgetUpload(file);
      if (row.uploadId && !uploadHeldElsewhere(stateRef.current, row.localId, row.uploadId)) {
        studioApi.cancelUpload(row.uploadId).catch(() => {});
      }
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
      (error) => {
        send({ type: "draft/failed", message: errorMessage(error) });
        if (errorCode(error) === "unknown_file") syncProject();
      },
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

  function removeTemplate(id) {
    const ok = deleteTemplate(id);
    setTemplates(loadTemplates());
    if (!ok) {
      say.error("Could not delete the template on this device.");
      return;
    }
    if (state.options.templateId === id) dispatch({ type: "template/chosen", template: null });
    say.success("Template deleted.");
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
    // Polling stops after failed polls; coming back to the page tries again
    // while the render can still change.
    refetchOnWindowFocus: (query) => {
      if (stateRef.current.job?.lost || errorCode(query.state.error) === "unknown_render") return false;
      return pollOnVisible(query.state.data?.status ?? stateRef.current.job?.status);
    },
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
      (error) => {
        send({ type: "render/failed", message: errorMessage(error) });
        if (errorCode(error) === "unknown_file") syncProject();
      },
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
        (error) => {
          // The render is gone: say so on the page, not only in a toast.
          if (errorCode(error) === "unknown_render") send({ type: "job/lost", jobId });
          else say.error(errorMessage(error));
        },
      )
      .finally(() => {
        if (alive.current) setDownloading(false);
      });
  }

  async function clearAll() {
    dispatch({ type: "clear/started" });
    const stopped = queueRef.current ? await queueRef.current.cancelAll() : {};
    try {
      await studioApi.clearProject();
      forgetAllUploads();
      files.current.clear();
      completed.current.clear();
      send({ type: "project/cleared" });
      refreshUsage(send, alive);
      say.success("All files and renders are deleted.");
    } catch (error) {
      say.error(errorMessage(error));
      send({ type: "clear/failed" });
      // Nothing was deleted: put the stopped uploads back.
      for (const [id, result] of Object.entries(stopped)) {
        const file = files.current.get(id);
        if (result.status === "done") send({ type: "upload/done", localId: id, meta: result.meta });
        else if (file && alive.current) {
          send({ type: "upload/requeued", localId: id });
          enqueue(id, file, findInterrupted(file));
        }
      }
    }
  }

  // ---- protecting running work -------------------------------------------

  useLeaveGuard(leaveGuard(state));
  useWakeLock(uploadsRunning(state));

  return {
    state,
    job,
    templates,
    downloading,
    actions: {
      pickFiles,
      removeRow,
      resumeRow,
      restartRow,
      dismissNotices: () => dispatch({ type: "notices/dismissed" }),
      setOption: (key, value) => dispatch({ type: "options/changed", key, value }),
      setStart: (text) => dispatch({ type: "start/changed", text }),
      chooseTemplate,
      removeTemplate,
      makeDraft: () => makeDraft("draft"),
      reshuffle: () => makeDraft("reshuffle"),
      autofill: () => makeDraft("autofill"),
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
