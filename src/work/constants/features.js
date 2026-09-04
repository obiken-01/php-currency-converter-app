/**
 * Frontend feature gates for endpoints that are not live yet.
 *
 * A permanent warning banner in a screen you open constantly trains you to
 * ignore warnings, so an unfinished section is hidden rather than shown
 * broken. Flip the flag once the backend endpoint ships.
 */

// GET /api/work/tasks/{publicId}/logs -- backend doc section 8.
export const LINKED_LOGS_ENABLED = false;
