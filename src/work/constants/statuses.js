// Single source of truth for status and priority display.
// Never hardcode a status string in a component — import from here.
//
// Colors are the terminal palette from src/theme/tuiTheme.jsx (kept as
// literal hex here, not imported, since these run through MUI's `alpha()`
// helper which needs plain color strings). Semantics: accent = done/active,
// cyan = calm/early, amber = needs attention, red = blocked/urgent, dim =
// neutral/inactive.

export const WORK_ITEM_STATUSES = [
  { value: "Backlog",    label: "Backlog",     color: "#7C8A99", order: 0 },
  { value: "Todo",       label: "To Do",       color: "#7C8A99", order: 1 },
  { value: "InProgress", label: "In Progress", color: "#5BC9D9", order: 2 },
  { value: "Blocked",    label: "Blocked",     color: "#F2685F", order: 3 },
  { value: "Done",       label: "Done",        color: "#39D97A", order: 4 },
  { value: "Cancelled",  label: "Cancelled",   color: "#7C8A99", order: 5 },
];

export const BOARD_STATUSES = WORK_ITEM_STATUSES.filter(
  (s) => s.value !== "Cancelled"
);

export const PRIORITIES = [
  { value: "Low",    label: "Low",    color: "#5BC9D9", order: 0 },
  { value: "Normal", label: "Normal", color: "#7C8A99", order: 1 },
  { value: "High",   label: "High",   color: "#E8B23D", order: 2 },
  { value: "Urgent", label: "Urgent", color: "#F2685F", order: 3 },
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

// `value` is the ProjectStatus enum name on the wire; `label` is ours to choose.
// The two used to be the same string, which meant "Planning" and "Archived" --
// names the enum does not have -- were sent as-is and the whole save came back
// 400. A project already stored as Planned or Cancelled also matched no row
// here, so its chip fell through to the first entry and read "Planning".
export const PROJECT_STATUSES = [
  { value: "Planned",   label: "Planning",  color: "#5BC9D9" },
  { value: "Active",    label: "Active",    color: "#39D97A" },
  { value: "OnHold",    label: "On Hold",   color: "#E8B23D" },
  { value: "Completed", label: "Completed", color: "#7C8A99" },
  { value: "Cancelled", label: "Archived",  color: "#7C8A99" },
];

export const getProjectStatus = (v) =>
  PROJECT_STATUSES.find((s) => s.value === v) ?? PROJECT_STATUSES[0];
