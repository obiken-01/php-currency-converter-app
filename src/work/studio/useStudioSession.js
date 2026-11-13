import { useQuery } from "@tanstack/react-query";
import { getAccessToken } from "../api/workApi";
import { studioApi } from "./studioApi";

/**
 * Whether this Work user may use Studio. Any failure (401, 403, network)
 * means no: the tab stays hidden rather than showing something that errors.
 */
export function useStudioSession() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["studio", "session"],
    queryFn: studioApi.session,
    staleTime: Infinity,
    retry: false,
    enabled: Boolean(getAccessToken()),
  });
  return { allowed: !isError && data?.allowed === true, isLoading };
}
