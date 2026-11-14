import { useQueries } from "@tanstack/react-query";
import timeLogsApi from "../api/timeLogsApi";
import tasksApi from "../api/tasksApi";
import { qk } from "../constants/queryKeys";
import { BOARD_STATUSES } from "../constants/statuses";
import { cutoffRange, toDateString } from "../utils/dates";

const sumHours = (result) =>
  (result?.items ?? []).reduce((total, log) => total + (Number(log.duration) || 0), 0);

/**
 * Composed from the endpoints that already exist rather than a dedicated
 * dashboard endpoint — nothing here needs a new backend contract.
 *
 * Tasks are grouped by the status each one carries; nothing is derived from
 * dates. Cutoffs are the 1–15 and 16–end DTR periods, matching the
 * accomplishment report.
 */
export function useDashboard(projectId = "") {
  const today = toDateString(new Date());
  const cutoff = cutoffRange(new Date());
  const cutoffStart = toDateString(cutoff.start);
  const cutoffEnd = toDateString(cutoff.end);

  const logsToday = { from: today, to: today, page: 1, pageSize: 200 };
  const logsCutoff = { from: cutoffStart, to: cutoffEnd, page: 1, pageSize: 500 };
  // One query for every task, grouped here. The API does not reliably apply a
  // `statuses` filter, so asking per status mixed statuses together.
  const allTasks = {
    page: 1, pageSize: 200, sortBy: "updatedAt", sortDir: "desc",
    ...(projectId ? { projectId } : {}),
  };

  const results = useQueries({
    queries: [
      { queryKey: qk.timeLogs(logsToday),  queryFn: () => timeLogsApi.query(logsToday),  staleTime: 60_000 },
      { queryKey: qk.timeLogs(logsCutoff), queryFn: () => timeLogsApi.query(logsCutoff), staleTime: 60_000 },
      { queryKey: qk.tasks(allTasks),      queryFn: () => tasksApi.query(allTasks),      staleTime: 30_000 },
    ],
  });

  const [todayQ, cutoffQ, tasksQ] = results;

  const inScope = (t) => !projectId || !t.projectId || t.projectId === projectId;
  const tasks = (tasksQ.data?.items ?? []).filter(inScope);

  const byStatus = Object.fromEntries(
    BOARD_STATUSES.map((s) => [s.value, tasks.filter((t) => t.status === s.value)])
  );

  return {
    isPending: results.some((r) => r.isPending),
    isError: results.some((r) => r.isError),

    hoursToday: sumHours(todayQ.data),
    hoursCutoff: sumHours(cutoffQ.data),
    cutoffLabel: `${cutoffStart.slice(8)}–${cutoffEnd.slice(8)} ${
      cutoff.start.toLocaleDateString(undefined, { month: "short" })
    }`,

    byStatus,
  };
}
