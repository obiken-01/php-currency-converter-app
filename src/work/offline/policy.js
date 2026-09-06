/**
 * How to read a failed request: is the network down, or did the server say no?
 *
 * Everything offline hinges on telling those two apart. Treating them alike is
 * what logged you out the moment you lost signal -- a fetch that never left the
 * device was read as "your session is invalid".
 */

/** No response at all: DNS, airplane mode, a dead tunnel, a timeout. */
export const isNetworkError = (error) =>
  Boolean(error) && !error.response && error.code !== "ERR_CANCELED";

/** The server answered, and the answer was "not you". */
export const isAuthRejection = (error) =>
  error?.response?.status === 401 || error?.response?.status === 403;

/**
 * A queued write that comes back like this will never succeed by being sent
 * again: a validation error, a deleted record, a project you have left. 408 and
 * 429 are excluded -- both mean "try later", which is exactly what a queue is
 * for.
 */
export const isPermanentFailure = (status) =>
  typeof status === "number" && status >= 400 && status < 500 &&
  status !== 408 && status !== 429;

const WRITE_METHODS = new Set(["post", "put", "patch", "delete"]);

/**
 * Paths that must never be replayed later.
 *
 * Auth is pointless offline and dangerous to repeat. A token is shown once at
 * creation and cannot be recovered, so minting one into a queue would create a
 * secret nobody ever sees.
 */
const NEVER_QUEUE = [/^\/auth\b/, /^\/tokens\b/];

export const isQueueable = (config) => {
  if (!config) return false;
  if (!WRITE_METHODS.has(String(config.method).toLowerCase())) return false;

  const path = String(config.url ?? "");
  return !NEVER_QUEUE.some((pattern) => pattern.test(path));
};
