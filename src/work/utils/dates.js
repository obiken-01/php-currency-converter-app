// ── datetime-local helpers ───────────────────────────────────────
// datetime-local inputs want "YYYY-MM-DDTHH:mm" in *local* time.
// toISOString() is UTC, so the offset has to be subtracted first.

/** @param {Date} [date] @returns {string} "YYYY-MM-DDTHH:mm" in local time */
export const toLocalDateTimeString = (date = new Date()) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

/**
 * Date-only fields ("YYYY-MM-DD") for the API. Never run these through
 * toISOString() — it shifts the day for anyone east or west of UTC.
 * @param {Date|string|null} date @returns {string|null}
 */
export const toDateString = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Today as "YYYY-MM-DD" in local time. */
export const today = () => toDateString(new Date());

/** Parses "YYYY-MM-DD" as local midnight rather than UTC midnight. */
export const parseDateOnly = (value) => {
  if (!value) return null;
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

/** @returns {string} e.g. "4 Sep" or "4 Sep 2025" when not the current year */
export const formatShortDate = (value) => {
  const d = parseDateOnly(value) ?? (value ? new Date(value) : null);
  if (!d || Number.isNaN(d.getTime())) return "";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
};

/** @returns {string} e.g. "4 Sep 2025, 14:30" */
export const formatDateTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

/** True when `due` is strictly before today (local). */
export const isOverdue = (due) => {
  const d = parseDateOnly(due);
  if (!d) return false;
  const now = new Date();
  return d < new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

export const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

/** Whole days between two dates, ignoring time-of-day. */
export const daysBetween = (a, b) => {
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const end   = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((end - start) / 86_400_000);
};

/** DTR cutoff containing `date`: the 1–15 or 16–end period. */
export const cutoffRange = (date = new Date()) => {
  const y = date.getFullYear();
  const m = date.getMonth();
  return date.getDate() <= 15
    ? { start: new Date(y, m, 1),  end: new Date(y, m, 15) }
    : { start: new Date(y, m, 16), end: new Date(y, m + 1, 0) };
};
