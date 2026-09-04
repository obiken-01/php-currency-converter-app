// Personal access token scopes, as issued by the backend.
export const TOKEN_SCOPES = [
  {
    value: "tasks:read",
    description: "Read work items, projects and time logs.",
  },
  {
    value: "tasks:write",
    description: "Create and update work items, projects and time logs.",
  },
];

export const EXPIRY_OPTIONS = [
  { label: "30 days",  days: 30 },
  { label: "90 days",  days: 90 },
  { label: "1 year",   days: 365 },
  { label: "No expiry", days: null },
];
