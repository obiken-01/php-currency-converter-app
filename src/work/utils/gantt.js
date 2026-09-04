import { addDays, daysBetween, parseDateOnly } from "./dates";

/**
 * Pixels per *day* at each scale. Columns group days together, so a week
 * column is 7 * DAY_WIDTH.week wide — every offset stays in day units and
 * the bar maths never has to care which scale is active.
 */
export const DAY_WIDTH = { day: 32, week: 12, month: 4 };

export const LABEL_COLUMN_WIDTH = 220;
export const ROW_HEIGHT = 34;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const startOfWeek = (date) => {
  const d = startOfDay(date);
  // Monday-based: getDay() is 0 for Sunday.
  const offset = (d.getDay() + 6) % 7;
  return addDays(d, -offset);
};

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const isWeekendDay = (date) => date.getDay() === 0 || date.getDay() === 6;

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Auto-selects a scale from the range length. */
export function pickScale(rangeStart, rangeEnd) {
  const days = daysBetween(rangeStart, rangeEnd);
  if (days <= 45) return "day";
  if (days <= 270) return "week";
  return "month";
}

/**
 * Widens a range so a short project is not a single column, and pads both
 * ends a little so bars do not sit flush against the chart edge.
 *
 * @returns {{start: Date, end: Date}}
 */
export function padRange(rangeStart, rangeEnd, minDays = 14) {
  const start = startOfDay(rangeStart ?? new Date());
  let end = startOfDay(rangeEnd ?? rangeStart ?? new Date());
  if (end < start) end = start;

  const span = daysBetween(start, end) + 1;
  const shortfall = Math.max(0, minDays - span);
  const before = Math.ceil(shortfall / 2);
  const after = shortfall - before;

  return {
    start: addDays(start, -(before + 2)),
    end: addDays(end, after + 2),
  };
}

/**
 * @param {Date}   rangeStart
 * @param {Date}   rangeEnd
 * @param {string} scale  'day' | 'week' | 'month'
 * @returns {Array<{date: Date, label: string, days: number, width: number,
 *                  isWeekend: boolean, isToday: boolean}>}
 */
export function buildDateColumns(rangeStart, rangeEnd, scale = "day") {
  const dayWidth = DAY_WIDTH[scale] ?? DAY_WIDTH.day;
  const start = startOfDay(rangeStart);
  const end = startOfDay(rangeEnd);
  const today = startOfDay(new Date());
  const columns = [];

  if (end < start) return columns;

  if (scale === "day") {
    for (let d = start; d <= end; d = addDays(d, 1)) {
      columns.push({
        date: d,
        label: String(d.getDate()),
        days: 1,
        width: dayWidth,
        isWeekend: isWeekendDay(d),
        isToday: isSameDay(d, today),
      });
    }
    return columns;
  }

  if (scale === "week") {
    for (let d = startOfWeek(start); d <= end; d = addDays(d, 7)) {
      const weekEnd = addDays(d, 6);
      columns.push({
        date: d,
        label: `${d.getDate()} ${MONTHS[d.getMonth()]}`,
        days: 7,
        width: dayWidth * 7,
        isWeekend: false,
        isToday: today >= d && today <= weekEnd,
      });
    }
    return columns;
  }

  for (let d = startOfMonth(start); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    columns.push({
      date: d,
      label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      days,
      width: dayWidth * days,
      isWeekend: false,
      isToday: today.getFullYear() === d.getFullYear() && today.getMonth() === d.getMonth(),
    });
  }
  return columns;
}

/** Total chart width for a set of columns. */
export const columnsWidth = (columns) =>
  columns.reduce((sum, column) => sum + column.width, 0);

/**
 * Pixel offsets for one bar. The first column may start before rangeStart
 * (weeks and months snap backwards), so offsets are measured from the first
 * column's date rather than from rangeStart itself.
 *
 * @param {object} item        needs startDate and/or dueDate
 * @param {Date}   originDate  date of the first column
 * @param {number} dayWidth
 * @returns {{left: number, width: number}|null} null when the item has no dates
 */
export function barGeometry(item, originDate, dayWidth) {
  const start = parseDateOnly(item.startDate) ?? parseDateOnly(item.dueDate);
  const end = parseDateOnly(item.dueDate) ?? parseDateOnly(item.startDate);
  if (!start || !end) return null;

  const from = start <= end ? start : end;
  const to = start <= end ? end : start;

  const left = daysBetween(originDate, from) * dayWidth;
  // +1 so a single-day item is one column wide rather than zero.
  const width = Math.max(dayWidth, (daysBetween(from, to) + 1) * dayWidth);

  return { left, width };
}

/** Pixel offset of today's line, or null when today is outside the range. */
export function todayOffset(originDate, rangeEnd, dayWidth) {
  const today = startOfDay(new Date());
  if (today < startOfDay(originDate) || today > startOfDay(rangeEnd)) return null;
  return daysBetween(originDate, today) * dayWidth;
}

/**
 * The union of every dated item, so the chart covers all of them even when
 * the project's own dates are narrower.
 *
 * @returns {{start: Date, end: Date}|null} null when nothing has dates
 */
export function itemsRange(items = []) {
  let min = null;
  let max = null;

  items.forEach((item) => {
    const start = parseDateOnly(item.startDate);
    const end = parseDateOnly(item.dueDate);
    [start, end].forEach((date) => {
      if (!date) return;
      if (!min || date < min) min = date;
      if (!max || date > max) max = date;
    });
  });

  return min && max ? { start: min, end: max } : null;
}

/** Items the chart cannot place — shown in a collapsed list below it. */
export const undatedItems = (items = []) =>
  items.filter((item) => !item.startDate && !item.dueDate);

export const datedItems = (items = []) =>
  items.filter((item) => item.startDate || item.dueDate);
