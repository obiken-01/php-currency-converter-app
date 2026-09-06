import { useCallback, useEffect, useState } from "react";
import workApi from "../api/workApi";
import { flush, pendingCount, subscribe } from "../offline/outbox";
import { useToast } from "../context/toastContext";

/**
 * Drains the outbox whenever there is a connection to drain it into.
 *
 * Flushes on mount and on the browser's `online` event. navigator.onLine lies
 * in one direction -- it says true on a captive portal with no route out -- but
 * a flush that fails simply stops and leaves the queue intact, so an optimistic
 * "we're back" costs one failed request rather than any data.
 */
export function useOutbox() {
  const toast = useToast();
  const [count, setCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => subscribe(setCount), []);

  const sync = useCallback(async () => {
    if (syncing) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    if ((await pendingCount().catch(() => 0)) === 0) return;

    setSyncing(true);
    try {
      const result = await flush((entry) =>
        workApi.request({ method: entry.method, url: entry.url, data: entry.data })
      );

      if (result.sent > 0) {
        toast.success(
          `Synced ${result.sent} change${result.sent === 1 ? "" : "s"}.`
        );
      }

      // Work the server refused outright is gone. Saying so is the whole point
      // -- these are hours and tasks someone believed were saved.
      result.dropped.forEach((entry) => {
        toast.error(
          `Could not sync "${entry.label}"${entry.message ? `: ${entry.message}` : ""}. That change was discarded.`
        );
      });
    } finally {
      setSyncing(false);
    }
  }, [syncing, toast]);

  useEffect(() => {
    sync();
    const onOnline = () => sync();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
    // sync is stable enough: it only changes with `syncing`, and a flush in
    // flight is exactly when a re-run should be skipped.
  }, [sync]);

  return { count, syncing, sync };
}

export default useOutbox;
