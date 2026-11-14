import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAccessToken } from "../api/workApi";
import { isStudioConfigured, studioApi } from "./studioApi";

/** Set once this browser has been allowed, cleared on a refusal. */
export const WAS_ALLOWED_KEY = "studio_was_allowed";

/** The session query only runs with a configured service and a signed-in user. */
export const sessionQueryEnabled = (configured, token) => Boolean(configured && token);

const isRefusal = (error) => error?.response?.status === 403;

/**
 * "off" (no service or not signed in), "loading", "allowed", "denied" (403 or
 * an explicit no) or "unreachable" (any other failure: network, timeout, 5xx).
 */
export function sessionStatus({ configured, token, data, error }) {
  if (!sessionQueryEnabled(configured, token)) return "off";
  if (error) return isRefusal(error) ? "denied" : "unreachable";
  if (data) return data.allowed === true ? "allowed" : "denied";
  return "loading";
}

/** The tab shows when allowed, and while unreachable for a browser that was allowed before. */
export const showStudioTab = (status, wasAllowed) => status === "allowed" || (status === "unreachable" && Boolean(wasAllowed));

/** A failed check that was not a refusal is tried again when the page is focused or back online. */
export const refetchWhenUnreachable = (query) => query.state.status === "error" && !isRefusal(query.state.error);

export function readWasAllowed() {
  try {
    return localStorage.getItem(WAS_ALLOWED_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberAccess(status) {
  try {
    if (status === "allowed") localStorage.setItem(WAS_ALLOWED_KEY, "1");
    else if (status === "denied") localStorage.removeItem(WAS_ALLOWED_KEY);
  } catch {
    // Storage unavailable: the tab then only shows while the service answers.
  }
}

/**
 * Whether this Work user may use Studio. One request per page load: a refusal
 * stays cached, and a failed check is never retried on mount, only on focus,
 * on reconnect, or through retry().
 */
export function useStudioSession() {
  const configured = isStudioConfigured();
  const token = getAccessToken();
  const query = useQuery({
    queryKey: ["studio", "session"],
    queryFn: studioApi.session,
    staleTime: Infinity,
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: refetchWhenUnreachable,
    refetchOnReconnect: refetchWhenUnreachable,
    enabled: sessionQueryEnabled(configured, token),
  });
  const status = sessionStatus({ configured, token, data: query.data, error: query.error });

  useEffect(() => {
    rememberAccess(status);
  }, [status]);

  return {
    status,
    allowed: status === "allowed",
    showTab: showStudioTab(status, readWasAllowed()),
    isLoading: status === "loading",
    isFetching: query.isFetching,
    retry: () => query.refetch(),
  };
}
