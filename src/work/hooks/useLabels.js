import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import labelsApi from "../api/labelsApi";
import { qk } from "../constants/queryKeys";

export function useLabels() {
  return useQuery({
    queryKey: qk.labels(),
    queryFn: labelsApi.query,
    staleTime: 5 * 60_000,
  });
}

export function useCreateLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: labelsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.labels() }),
  });
}

export function useDeleteLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: labelsApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.labels() }),
  });
}
