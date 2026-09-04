import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import tasksApi from "../api/tasksApi";
import { qk, qkPrefix } from "../constants/queryKeys";
import { getStatus } from "../constants/statuses";
import { useToast } from "../context/toastContext";

/**
 * Columns come from the API, not from BOARD_STATUSES — adding a status
 * server-side then needs no frontend change. This only normalises the
 * envelope and fills in display metadata.
 */
export function useBoard(projectId = null, assignee = null) {
  return useQuery({
    queryKey: qk.board(projectId, assignee),
    queryFn: () => tasksApi.board(projectId, assignee),
    staleTime: 15_000,
  });
}

export function normaliseColumns(data) {
  const columns = data?.columns ?? data ?? [];
  return columns.map((column) => {
    const meta = getStatus(column.status);
    return {
      status: column.status,
      label:  column.label ?? meta.label,
      color:  column.color ?? meta.color,
      items:  column.items ?? [],
      count:  column.count ?? (column.items?.length ?? 0),
    };
  });
}

/**
 * Applies a move to the cached board so the card lands where it was
 * dropped rather than snapping back and waiting for the round trip.
 */
export function moveCardLocally(data, publicId, status, newIndex) {
  if (!data) return data;

  const columns = (data.columns ?? data ?? []).map((column) => ({
    ...column,
    items: [...(column.items ?? [])],
  }));

  let card = null;
  for (const column of columns) {
    const index = column.items.findIndex((item) => item.publicId === publicId);
    if (index !== -1) {
      [card] = column.items.splice(index, 1);
      break;
    }
  }
  if (!card) return data;

  const target = columns.find((column) => column.status === status);
  if (!target) return data;

  const clamped = Math.max(0, Math.min(newIndex ?? target.items.length, target.items.length));
  target.items.splice(clamped, 0, { ...card, status });

  const withCounts = columns.map((column) => ({ ...column, count: column.items.length }));

  return data.columns ? { ...data, columns: withCounts } : withCounts;
}

export function useMoveWorkItem(projectId, assignee) {
  const qc = useQueryClient();
  const toast = useToast();
  const key = qk.board(projectId, assignee);

  return useMutation({
    mutationFn: ({ publicId, status, newIndex }) =>
      tasksApi.move(publicId, { status, newIndex }),

    onMutate: async ({ publicId, status, newIndex }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData(key);
      qc.setQueryData(key, (old) => moveCardLocally(old, publicId, status, newIndex));
      return { previous };
    },

    // 409 means someone else moved it first. Roll back and refetch — that is
    // normal concurrent editing, not an error worth a toast.
    onError: (err, _vars, ctx) => {
      qc.setQueryData(key, ctx?.previous);
      if (err?.response?.status !== 409) toast.error("Could not move the card.");
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: qkPrefix.tasks });
      // The dashboard's "In progress" shortlist otherwise keeps showing a
      // card that has just been dragged to Done.
      qc.invalidateQueries({ queryKey: qk.dashboard() });
    },
  });
}
