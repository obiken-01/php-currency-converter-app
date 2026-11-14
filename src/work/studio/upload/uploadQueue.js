// Runs uploads a few at a time, in the order they were added. No React here.
//
// run(item, { signal, onProgress, onOpened }) returns a promise for the file's metadata.
// onEvent receives { type: "started" | "opened" | "progress" | "done" | "failed", id, ... }.
// An item that was cancelled, or a queue that was disposed, emits nothing more,
// so a page that has gone away is never told about an upload.

export function createUploadQueue({ run, limit = 2, onEvent }) {
  const waiting = [];
  const running = new Map(); // id -> { controller, settled: Promise<result> }
  const silenced = new Set();
  let disposed = false;

  const emit = (event) => {
    if (!disposed && !silenced.has(event.id)) onEvent(event);
  };

  function start(item) {
    const { id } = item;
    const controller = new AbortController();
    emit({ type: "started", id });
    let started;
    try {
      started = Promise.resolve(
        run(item, {
          signal: controller.signal,
          onProgress: (progress) => emit({ type: "progress", id, progress }),
          onOpened: (uploadId, chunkSize) => emit({ type: "opened", id, uploadId, chunkSize }),
        }),
      );
    } catch (error) {
      started = Promise.reject(error);
    }
    const settled = started
      .then(
        (meta) => {
          emit({ type: "done", id, meta });
          return { status: "done", meta };
        },
        (error) => {
          if (error?.name === "AbortError") return { status: "aborted" };
          emit({ type: "failed", id, error });
          return { status: "failed", error };
        },
      )
      .finally(() => {
        running.delete(id);
        silenced.delete(id);
        pump();
      });
    running.set(id, { controller, settled });
  }

  function pump() {
    while (!disposed && running.size < limit && waiting.length > 0) {
      start(waiting.shift());
    }
  }

  const has = (id) => running.has(id) || waiting.some((item) => item.id === id);

  /**
   * Stops one upload. Resolves with how it ended: { status: "waiting" } (it never
   * started), "aborted", "done" with meta (it finished anyway, for example while
   * the file was being completed), "failed" with the error, or "none".
   */
  function cancel(id) {
    const index = waiting.findIndex((item) => item.id === id);
    if (index >= 0) {
      waiting.splice(index, 1);
      return Promise.resolve({ status: "waiting" });
    }
    const entry = running.get(id);
    if (!entry) return Promise.resolve({ status: "none" });
    silenced.add(id);
    entry.controller.abort();
    return entry.settled;
  }

  return {
    has,
    add(item) {
      if (disposed || has(item.id)) return;
      waiting.push(item);
      pump();
    },
    cancel,
    /** Cancels everything; resolves with { [id]: result }. */
    async cancelAll() {
      const ids = [...waiting.map((item) => item.id), ...running.keys()];
      // Empty the waiting list first so a finishing upload does not start one.
      const results = {};
      for (const item of waiting.splice(0)) results[item.id] = { status: "waiting" };
      const pending = ids.filter((id) => !(id in results));
      const settled = await Promise.all(pending.map((id) => cancel(id)));
      pending.forEach((id, i) => {
        results[id] = settled[i];
      });
      return results;
    },
    /** The page is going away: abort everything, say nothing more. */
    dispose() {
      disposed = true;
      waiting.length = 0;
      for (const entry of running.values()) entry.controller.abort();
    },
  };
}
