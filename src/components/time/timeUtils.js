// ===============================
// Constants
// ===============================
export const PH_GMT_OFFSET = 8;
export const MINUTES_PER_DAY = 1440;

// ===============================
// Core Time Helpers
// ===============================

/**
 * Always returns current Philippine time in minutes (UTC+8)
 * Safe regardless of user location
 */
export function getCurrentPHMinutesUTC8() {
  const now = new Date();

  const utcMinutes =
    now.getUTCHours() * 60 + now.getUTCMinutes();

  return normalizeMinutes(utcMinutes + PH_GMT_OFFSET * 60);
}

/**
 * Converts PH time → target timezone
 */
export function convertTime(phMinutes, phOffset, targetOffset) {
  const diffMinutes = (targetOffset - phOffset) * 60;
  return normalizeMinutes(phMinutes + diffMinutes);
}

/**
 * Converts any minutes to HH:MM
 */
export function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Ensures minutes stay within 0–1439
 */
export function normalizeMinutes(minutes) {
  return ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}
