import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import tokensApi from "../api/tokensApi";
import { qk } from "../constants/queryKeys";

export function useTokens() {
  return useQuery({
    queryKey: qk.tokens(),
    queryFn: tokensApi.query,
    staleTime: 30_000,
  });
}

/** The response carries the raw token exactly once — show it before anything else. */
export function useCreateToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tokensApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.tokens() }),
  });
}

export function useRevokeToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tokensApi.revoke,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.tokens() }),
  });
}
