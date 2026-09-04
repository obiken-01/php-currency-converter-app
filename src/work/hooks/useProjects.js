import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import projectsApi from "../api/projectsApi";
import { qk, qkPrefix } from "../constants/queryKeys";

export function useProjects(filters = {}) {
  return useQuery({
    queryKey: qk.projects(filters),
    queryFn: () => projectsApi.query(filters),
    staleTime: 60_000,
  });
}

export function useProject(publicId) {
  return useQuery({
    queryKey: qk.project(publicId),
    queryFn: () => projectsApi.get(publicId),
    enabled: Boolean(publicId),
  });
}

const invalidate = (qc, publicId) => {
  qc.invalidateQueries({ queryKey: qkPrefix.projects });
  qc.invalidateQueries({ queryKey: qk.dashboard() });
  if (publicId) {
    qc.invalidateQueries({ queryKey: qk.project(publicId) });
    qc.invalidateQueries({ queryKey: qk.timeline(publicId) });
  }
};

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.create,
    onSuccess: (created) => invalidate(qc, created?.publicId),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ publicId, dto }) => projectsApi.update(publicId, dto),
    onSuccess: (_data, { publicId }) => invalidate(qc, publicId),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.remove,
    onSuccess: () => invalidate(qc),
  });
}
