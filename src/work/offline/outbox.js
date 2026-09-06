import { addRecord, allRecords, deleteRecord, putRecord } from "./db";
import { isNetworkError, isPermanentFailure } from "./policy";

/**
 * Writes made with no connection, kept until the server has them.
 *
 * The server was built for this: a create carries a client-generated publicId,
 * so a replay whose first response was lost returns the existing record instead
 * of booking the work twice. That is why replaying is safe and why the queue can
 * simply retry rather than reason about what already landed.
 *
 * Order is the whole contract. Entries go out oldest-first, one at a time, and
 * the flush stops at the first entry that is merely unlucky (offline again, a
 * 5xx, a rate limit) so a later edit can never overtake the create it depends
 * on.
 */

const listeners = new Set();

const notify = async () => {
  const count = await pendingCount().catch(() => 0);
  listeners.forEach((fn) => fn(count));
};

/** Called with the pending count whenever the queue changes. */
export function subscribe(listener) {
  listeners.add(listener);
  notify();
  return () => listeners.delete(listener);
}

export async function enqueue({ method, url, data, label }) {
  const entry = {
    method: String(method).toLowerCase(),
    url,
    data: data ?? null,
    label: label ?? `${String(method).toUpperCase()} ${url}`,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };

  const id = await addRecord(entry);
  await notify();
  return { ...entry, id };
}

export async function pending() {
  const rows = await allRecords();
  return rows.sort((a, b) => a.id - b.id);
}

export const pendingCount = async () => (await pending()).length;

export async function clear() {
  const rows = await pending();
  await Promise.all(rows.map((row) => deleteRecord(row.id)));
  await notify();
}

/**
 * Send everything waiting.
 *
 * @param {function} send  (entry) => Promise, normally the axios instance
 * @returns {Promise<{sent: number, dropped: Array, stoppedBecause: string|null}>}
 *   `dropped` holds entries the server refused outright -- they are gone from
 *   the queue and the caller has to tell someone, because that work is lost.
 */
export async function flush(send) {
  const queue = await pending();
  const result = { sent: 0, dropped: [], stoppedBecause: null };

  for (const entry of queue) {
    try {
      await send(entry);
      await deleteRecord(entry.id);
      result.sent += 1;
    } catch (error) {
      if (isNetworkError(error)) {
        // Still offline. Everything after this stays queued, in order.
        result.stoppedBecause = "offline";
        break;
      }

      const status = error?.response?.status;

      if (isPermanentFailure(status)) {
        // Retrying will not change the answer. Drop it, and let the caller
        // say so -- silently discarding someone's logged hours is worse than
        // an awkward message.
        await deleteRecord(entry.id);
        result.dropped.push({
          ...entry,
          status,
          message: error?.response?.data?.message ?? null,
        });
        continue;
      }

      // 5xx, 429, 408: the server is having a moment. Keep the entry, count
      // the attempt, and stop so the order holds.
      await putRecord({ ...entry, attempts: (entry.attempts ?? 0) + 1 });
      result.stoppedBecause = status ? `server:${status}` : "unknown";
      break;
    }
  }

  await notify();
  return result;
}
