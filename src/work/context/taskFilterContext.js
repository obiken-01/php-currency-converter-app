import { createContext, useContext } from "react";

export const TaskFilterContext = createContext(null);

export function useTaskFilters() {
  const ctx = useContext(TaskFilterContext);
  if (!ctx) throw new Error("useTaskFilters must be used inside a TaskFilterProvider");
  return ctx;
}

export const DEFAULT_FILTERS = {
  search:    "",
  projectId: "",
  statuses:  [],
  priority:  "",
  labelId:   "",
  assignee:  "",      // "" = all, "me" = mine, "unassigned", or a guid
  from:      "",
  to:        "",
  page:      1,
  pageSize:  25,
  sortBy:    "updatedAt",
  sortDir:   "desc",
};

// Only non-default values reach the URL, so a plain /work/tasks stays clean.
export const filtersToSearchParams = (filters, extra = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    const isDefault =
      Array.isArray(value)
        ? value.length === 0
        : value === DEFAULT_FILTERS[key];
    if (isDefault || value === "" || value == null) return;
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  });
  Object.entries(extra).forEach(([key, value]) => {
    if (value != null && value !== "") params.set(key, String(value));
  });
  return params;
};

export const searchParamsToFilters = (params) => {
  const read = (key) => params.get(key);
  return {
    ...DEFAULT_FILTERS,
    search:    read("search")    ?? DEFAULT_FILTERS.search,
    projectId: read("projectId") ?? DEFAULT_FILTERS.projectId,
    statuses:  read("statuses")  ? read("statuses").split(",").filter(Boolean) : [],
    priority:  read("priority")  ?? DEFAULT_FILTERS.priority,
    labelId:   read("labelId")   ?? DEFAULT_FILTERS.labelId,
    assignee:  read("assignee")  ?? DEFAULT_FILTERS.assignee,
    from:      read("from")      ?? DEFAULT_FILTERS.from,
    to:        read("to")        ?? DEFAULT_FILTERS.to,
    page:      Number(read("page"))     || DEFAULT_FILTERS.page,
    pageSize:  Number(read("pageSize")) || DEFAULT_FILTERS.pageSize,
    sortBy:    read("sortBy")    ?? DEFAULT_FILTERS.sortBy,
    sortDir:   read("sortDir")   ?? DEFAULT_FILTERS.sortDir,
  };
};

/** Strips empty values so they never reach the API as `?search=`. */
export const toQueryParams = (filters) => {
  const params = {
    page:     filters.page,
    pageSize: filters.pageSize,
    sortBy:   filters.sortBy,
    sortDir:  filters.sortDir,
  };
  if (filters.search)          params.search    = filters.search;
  if (filters.projectId)       params.projectId = filters.projectId;
  if (filters.statuses.length) params.statuses  = filters.statuses.join(",");
  if (filters.priority)        params.priority  = filters.priority;
  if (filters.labelId)         params.labelId   = filters.labelId;
  if (filters.assignee)        params.assignee  = filters.assignee;
  if (filters.from)            params.from      = filters.from;
  if (filters.to)              params.to        = filters.to;
  return params;
};

export const activeFilterCount = (filters) =>
  ["search", "projectId", "priority", "labelId", "assignee", "from", "to"]
    .filter((key) => filters[key]).length + (filters.statuses.length ? 1 : 0);
