/**
 * Asks the browser not to evict our IndexedDB and Cache Storage under
 * pressure.
 *
 * Requested at startup rather than when the first offline write happens:
 * Chrome decides from engagement heuristics (installed PWA, bookmarked,
 * repeat visits) and grants silently without a prompt, so asking early costs
 * nothing and the answer is already settled by the time there is a queue to
 * lose. Asking after the fact protects nothing that was written before.
 *
 * Safari ignores this entirely — there, ITP still clears storage after about
 * a week of disuse.
 *
 * @returns {Promise<boolean|null>} whether storage is persistent, or null
 *   when the browser has no opinion to give.
 */
export async function requestPersistentStorage() {
  if (!navigator.storage?.persist || !navigator.storage?.persisted) return null;

  try {
    // Already granted on a previous run; asking again is wasted work.
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    // Some embedded webviews expose the API and then throw on use.
    return null;
  }
}

/**
 * Bytes used and available, for the sync status screen in a later phase.
 * @returns {Promise<{usage: number, quota: number}|null>}
 */
export async function storageEstimate() {
  if (!navigator.storage?.estimate) return null;
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  } catch {
    return null;
  }
}
