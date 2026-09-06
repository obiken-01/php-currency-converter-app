/**
 * A create carries its own id, decided here rather than by the server.
 *
 * That is what makes a queued create safe to send twice. CreateWorkItemDto and
 * CreateTimeLogDto both accept an optional publicId: send one the server has
 * already stored for you and it returns that record untouched, instead of
 * booking the same task -- or the same hours -- a second time. A reply lost to
 * a dropped connection is indistinguishable from one that never arrived, so
 * without this a retry is a duplicate.
 */
export const newPublicId = () =>
  globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    // Old WebViews have crypto but not randomUUID. Not a security value --
    // only an identity, and the server scopes it to this account.
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

/** Stamps an id on a create body, leaving one the caller already chose. */
export const withPublicId = (dto) =>
  dto?.publicId ? dto : { ...dto, publicId: newPublicId() };
