import { useQuery } from "@tanstack/react-query";
import { getAccessToken } from "../api/workApi";
import { isStudioConfigured, studioApi } from "./studioApi";

/** The session query only runs with a configured service and a signed-in user. */
export const sessionQueryEnabled = (configured, token) => Boolean(configured && token);

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
    enabled: sessionQueryEnabled(isStudioConfigured(), getAccessToken()),
  });
  return { allowed: !isError && data?.allowed === true, isLoading };
}
