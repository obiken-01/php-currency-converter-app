import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import tasksApi from "../api/tasksApi";
import { qk, qkPrefix } from "../constants/queryKeys";
import { toQueryParams } from "../context/taskFilterContext";

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
  return useMutation({
    mutationFn: ({ publicId, status }) => tasksApi.setStatus(publicId, status),
    onMutate: async ({ publicId, status }) => {
      const key = qk.task(publicId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData(key);
      if (previous) qc.setQueryData(key, { ...previous, status });
      return { previous, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
    },
    onSettled: (_data, _err, { publicId }) => invalidateAll(qc, publicId),
  });
}

export function useSetWorkItemAssignee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ publicId, assigneeId }) =>
      tasksApi.setAssignee(publicId, { assigneeId }),
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
