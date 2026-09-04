import { useQueries } from "@tanstack/react-query";
import timeLogsApi from "../api/timeLogsApi";
import tasksApi from "../api/tasksApi";
import { qk } from "../constants/queryKeys";
import { addDays, cutoffRange, toDateString } from "../utils/dates";

const OPEN_STATUSES = "Backlog,Todo,InProgress,Blocked";

const sumHours = (result) =>
  (result?.items ?? []).reduce((total, log) => total + (Number(log.duration) || 0), 0);

/**
 * Composed from the endpoints that already exist rather than a dedicated
 * dashboard endpoint — nothing here needs a new backend contract.
 *
 * Cutoffs are the 1–15 and 16–end DTR periods, matching the accomplishment
 * report.
 */
export function useDashboard() {
  const today = toDateString(new Date());
  const cutoff = cutoffRange(new Date());
  const cutoffStart = toDateString(cutoff.start);
  const cutoffEnd = toDateString(cutoff.end);
  const weekEnd = toDateString(addDays(new Date(), 7));
  const yesterday = toDateString(addDays(new Date(), -1));

  const logsToday = { from: today, to: today, page: 1, pageSize: 200 };
  const logsCutoff = { from: cutoffStart, to: cutoffEnd, page: 1, pageSize: 500 };
  const dueThisWeek = {
    from: today, to: weekEnd, statuses: OPEN_STATUSES,
    page: 1, pageSize: 50, sortBy: "dueDate", sortDir: "asc",
  };
  const overdue = {
    to: yesterday, statuses: OPEN_STATUSES,
    page: 1, pageSize: 50, sortBy: "dueDate", sortDir: "asc",
  };
  const inProgress = {
    statuses: "InProgress", page: 1, pageSize: 8,
    sortBy: "updatedAt", sortDir: "desc",
  };

  const results = useQueries({
    queries: [
      { queryKey: qk.timeLogs(logsToday),  queryFn: () => timeLogsApi.query(logsToday),  staleTime: 60_000 },
      { queryKey: qk.timeLogs(logsCutoff), queryFn: () => timeLogsApi.query(logsCutoff), staleTime: 60_000 },
      { queryKey: qk.tasks(dueThisWeek),   queryFn: () => tasksApi.query(dueThisWeek),   staleTime: 60_000 },
      { queryKey: qk.tasks(overdue),       queryFn: () => tasksApi.query(overdue),       staleTime: 60_000 },
      { queryKey: qk.tasks(inProgress),    queryFn: () => tasksApi.query(inProgress),    staleTime: 30_000 },
    ],
  });

  const [todayQ, cutoffQ, dueQ, overdueQ, inProgressQ] = results;

  return {
    isPending: results.some((r) => r.isPending),
    isError: results.some((r) => r.isError),

    hoursToday: sumHours(todayQ.data),
    hoursCutoff: sumHours(cutoffQ.data),
    cutoffLabel: `${cutoffStart.slice(8)}–${cutoffEnd.slice(8)} ${
      cutoff.start.toLocaleDateString(undefined, { month: "short" })
    }`,

    dueThisWeekCount: dueQ.data?.totalCount ?? 0,
    dueThisWeek: dueQ.data?.items ?? [],

    overdueCount: overdueQ.data?.totalCount ?? 0,
    overdue: overdueQ.data?.items ?? [],

    inProgress: inProgressQ.data?.items ?? [],
  };
}
