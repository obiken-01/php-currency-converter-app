// Single source of truth for status and priority display.
// Never hardcode a status string in a component — import from here.

export const WORK_ITEM_STATUSES = [
  { value: "Backlog",    label: "Backlog",     color: "#9E9E9E", order: 0 },
  { value: "Todo",       label: "To Do",       color: "#42A5F5", order: 1 },
  { value: "InProgress", label: "In Progress", color: "#FFA726", order: 2 },
  { value: "Blocked",    label: "Blocked",     color: "#EF5350", order: 3 },
  { value: "Done",       label: "Done",        color: "#66BB6A", order: 4 },
  { value: "Cancelled",  label: "Cancelled",   color: "#BDBDBD", order: 5 },
];

export const BOARD_STATUSES = WORK_ITEM_STATUSES.filter(
  (s) => s.value !== "Cancelled"
);

export const PRIORITIES = [
  { value: "Low",    label: "Low",    color: "#90A4AE", order: 0 },
  { value: "Normal", label: "Normal", color: "#42A5F5", order: 1 },
  { value: "High",   label: "High",   color: "#FFA726", order: 2 },
  { value: "Urgent", label: "Urgent", color: "#EF5350", order: 3 },
];

export const getStatus = (v) =>
  WORK_ITEM_STATUSES.find((s) => s.value === v) ?? WORK_ITEM_STATUSES[0];

export const getPriority = (v) =>
  PRIORITIES.find((p) => p.value === v) ?? PRIORITIES[1];

/** Statuses that count as finished — used for overdue and progress logic. */
export const CLOSED_STATUSES = ["Done", "Cancelled"];
export const isClosed = (v) => CLOSED_STATUSES.includes(v);

/** Sensible defaults for the WorkItemPicker and "log time against" flows. */
export const ACTIVE_STATUSES = ["Todo", "InProgress"];

export const PROJECT_STATUSES = [
  { value: "Planning",  label: "Planning",  color: "#9E9E9E" },
  { value: "Active",    label: "Active",    color: "#42A5F5" },
  { value: "OnHold",    label: "On Hold",   color: "#FFA726" },
  { value: "Completed", label: "Completed", color: "#66BB6A" },
  { value: "Archived",  label: "Archived",  color: "#BDBDBD" },
];

export const getProjectStatus = (v) =>
  PROJECT_STATUSES.find((s) => s.value === v) ?? PROJECT_STATUSES[0];
