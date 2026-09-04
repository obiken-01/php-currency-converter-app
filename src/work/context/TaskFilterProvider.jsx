import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  DEFAULT_FILTERS,
  TaskFilterContext,
  filtersToSearchParams,
  searchParamsToFilters,
} from "./taskFilterContext";

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Filter state for the task list and board. Mirrors itself into the query
 * string so a filtered view is linkable and survives a refresh.
 *
 * `search` is kept twice: the raw value drives the input, the debounced one
 * drives the query, so typing does not fire a request per keystroke.
 */
export default function TaskFilterProvider({ children }) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read the URL once on mount; after that this state is the source of truth.
  const [filters, setFilters] = useState(() => searchParamsToFilters(searchParams));
  const [searchInput, setSearchInput] = useState(filters.search);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) =>
        prev.search === searchInput ? prev : { ...prev, search: searchInput, page: 1 }
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    // The updater form reads the live params, so non-filter keys (view=)
    // survive a filter change without this effect depending on them.
    setSearchParams((prev) => {
      const view = prev.get("view");
      return filtersToSearchParams(filters, view ? { view } : {});
    }, { replace: true });
  }, [filters, setSearchParams]);

  const setFilter = useCallback((key, value) => {
    // Any filter change resets paging; page 4 of the old result set is noise.
    setFilters((prev) => ({ ...prev, [key]: value, page: key === "page" ? value : 1 }));
  }, []);

  const setPage = useCallback((page) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  const reset = useCallback(() => {
    setSearchInput("");
    setFilters({ ...DEFAULT_FILTERS });
  }, []);

  const value = useMemo(
    () => ({ filters, setFilter, setFilters, setPage, reset, searchInput, setSearchInput }),
    [filters, setFilter, setPage, reset, searchInput]
  );

  return (
    <TaskFilterContext.Provider value={value}>
      {children}
    </TaskFilterContext.Provider>
  );
}
