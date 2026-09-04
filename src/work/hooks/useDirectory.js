import { useQuery } from "@tanstack/react-query";
import directoryApi from "../api/directoryApi";
import { qk } from "../constants/queryKeys";

/** Assignable users. One entry today; the UI is built for more. */
export function useDirectory() {
  return useQuery({
    queryKey: qk.directory(),
    queryFn: directoryApi.query,
    staleTime: 10 * 60_000,
  });
}
