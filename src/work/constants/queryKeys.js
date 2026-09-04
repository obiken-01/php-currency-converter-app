// React Query key factory. Never write a key inline in a component —
// invalidating ["work"] clears everything, ["work","board"] just boards.

export const qk = {
  all:       ["work"],
  tasks:     (filters)             => ["work", "tasks", filters],
  board:     (projectId, assignee) => ["work", "board", projectId ?? null, assignee ?? null],
  task:      (publicId)            => ["work", "task", publicId],
  taskLogs:  (publicId)            => ["work", "task", publicId, "logs"],
  projects:  (filters)             => ["work", "projects", filters],
  project:   (publicId)            => ["work", "project", publicId],
  timeline:  (publicId)            => ["work", "timeline", publicId],
  labels:    ()                    => ["work", "labels"],
  directory: ()                    => ["work", "directory"],
  timeLogs:  (filters)             => ["work", "timeLogs", filters],
  tokens:    ()                    => ["work", "tokens"],
  dashboard: ()                    => ["work", "dashboard"],
};

// Prefixes for bulk invalidation.
export const qkPrefix = {
  tasks:    ["work", "tasks"],
  board:    ["work", "board"],
  projects: ["work", "projects"],
  timeLogs: ["work", "timeLogs"],
};

export default qk;
