/**
 * The smallest IndexedDB the outbox needs.
 *
 * IndexedDB rather than localStorage because a queued write has to survive the
 * tab being closed and the phone being locked, and because localStorage is
 * synchronous and capped at a few megabytes shared with everything else.
 *
 * Hand-rolled rather than a library: this is one store, four operations, and a
 * dependency here would be larger than the code it replaced.
 */

const DB_NAME = "ralphy-work-offline";
const DB_VERSION = 1;
export const OUTBOX_STORE = "outbox";

let dbPromise = null;

const request = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export function openDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is unavailable"));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const open = indexedDB.open(DB_NAME, DB_VERSION);

      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
          // autoIncrement keys double as the send order: a create and the edit
          // that follows it must reach the server the way they happened.
          db.createObjectStore(OUTBOX_STORE, { keyPath: "id", autoIncrement: true });
        }
      };

      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    }).catch((error) => {
      // A failed open must not poison every later call -- private windows and
      // storage-blocked webviews recover once the setting changes.
      dbPromise = null;
      throw error;
    });
  }

  return dbPromise;
}

async function withStore(mode, fn) {
  const db = await openDb();
  const tx = db.transaction(OUTBOX_STORE, mode);
  const result = await fn(tx.objectStore(OUTBOX_STORE));

  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  return result;
}

export const addRecord = (value) =>
  withStore("readwrite", (store) => request(store.add(value)));

export const allRecords = () =>
  withStore("readonly", (store) => request(store.getAll()));

export const putRecord = (value) =>
  withStore("readwrite", (store) => request(store.put(value)));

export const deleteRecord = (id) =>
  withStore("readwrite", (store) => request(store.delete(id)));

/** Test seam: forget the cached connection. */
export const resetDb = () => {
  dbPromise = null;
};
