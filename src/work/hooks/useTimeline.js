import { useQuery } from "@tanstack/react-query";
import projectsApi from "../api/projectsApi";
import { qk } from "../constants/queryKeys";

/** ProjectTimelineDto — items without dates are omitted by the backend. */
export function useTimeline(publicId) {
  return useQuery({
    queryKey: qk.timeline(publicId),
    queryFn: () => projectsApi.timeline(publicId),
    enabled: Boolean(publicId),
    staleTime: 60_000,
  });
}
