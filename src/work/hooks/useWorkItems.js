import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import tasksApi from "../api/tasksApi";
import { qk, qkPrefix } from "../constants/queryKeys";
import { toQueryParams } from "../context/taskFilterContext";
import { useToast } from "../context/toastContext";

export function useWorkItems(filters) {
  const params = toQueryParams(filters);
  return useQuery({
    queryKey: qk.tasks(params),
    queryFn: () => tasksApi.query(params),
    placeholderData: keepPreviousData,   // no flash when the page changes
    staleTime: 30_000,
  });
}

export function useWorkItem(publicId) {
  return useQuery({
    queryKey: qk.task(publicId),
    queryFn: () => tasksApi.get(publicId),
    enabled: Boolean(publicId),
  });
}

/** Invalidate every view a task can appear in. */
const invalidateAll = (qc, publicId) => {
  qc.invalidateQueries({ queryKey: qkPrefix.tasks });
  qc.invalidateQueries({ queryKey: qkPrefix.board });
  qc.invalidateQueries({ queryKey: ["work", "timeline"] });
  qc.invalidateQueries({ queryKey: qk.dashboard() });
  if (publicId) qc.invalidateQueries({ queryKey: qk.task(publicId) });
};

export function useCreateWorkItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tasksApi.create,
    onSuccess: (created) => invalidateAll(qc, created?.publicId),
  });
}

export function useUpdateWorkItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ publicId, dto }) => tasksApi.update(publicId, dto),
    onSuccess: (_data, { publicId }) => invalidateAll(qc, publicId),
  });
}

export function useDeleteWorkItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tasksApi.remove,
    onSuccess: () => invalidateAll(qc),
  });
}

/**
 * Status change from the detail modal. This is also the *only* way to move a
 * card between columns on a phone, where cross-column drag is unavailable.
 */
export function useSetWorkItemStatus() {
  const qc = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ publicId, status }) => tasksApi.setStatus(publicId, status),

    onMutate: async ({ publicId, status }) => {
      const key = qk.task(publicId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData(key);
      if (previous) qc.setQueryData(key, { ...previous, status });
      return { previous, key };
    },

    // A silent rollback here is indistinguishable from the save doing
    // nothing. RowVersion (Postgres xmin) changes on every write, so a modal
    // left open while the item was touched elsewhere sends a stale token and
    // gets a 409 -- which used to look exactly like a broken save.
    //
    // This is deliberately the opposite of the board, where the user watches
    // the card snap back and a toast would only be noise.
    onError: async (err, { publicId }, ctx) => {
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);

      if (err?.response?.status === 409) {
        await qc.invalidateQueries({ queryKey: qk.task(publicId) });
        toast.warn("This item changed elsewhere — reloaded. Try again.");
      } else {
        toast.error("Could not update status.");
      }
    },

    onSettled: (_data, _err, { publicId }) => invalidateAll(qc, publicId),
  });
}

export function useSetWorkItemAssignee() {
  const qc = useQueryClient();
  return useMutation({
    // UpdateAssigneeDto reads assigneePublicId; an assigneeId key bound to
    // nothing and every assignment silently unassigned instead.
    mutationFn: ({ publicId, assigneePublicId }) =>
      tasksApi.setAssignee(publicId, { assigneePublicId }),
    onSuccess: (_data, { publicId }) => invalidateAll(qc, publicId),
  });
}

export function useWorkItemLogs(publicId) {
  return useQuery({
    queryKey: qk.taskLogs(publicId),
    queryFn: () => tasksApi.logs(publicId),
    enabled: Boolean(publicId),
  });
}
