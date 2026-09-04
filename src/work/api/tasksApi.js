import workApi, { unwrap } from "./workApi";

// Paths are bare — workApi already carries the /api/work prefix.
export const tasksApi = {
  query:       (params)              => workApi.get("/tasks", { params }).then(unwrap),
  board:       (projectId, assignee) => workApi.get("/tasks/board", { params: { projectId, assignee } }).then(unwrap),
  get:         (publicId)            => workApi.get(`/tasks/${publicId}`).then(unwrap),
  create:      (dto)                 => workApi.post("/tasks", dto).then(unwrap),
  update:      (publicId, dto)       => workApi.put(`/tasks/${publicId}`, dto).then(unwrap),
  move:        (publicId, dto)       => workApi.patch(`/tasks/${publicId}/move`, dto).then(unwrap),
  setStatus:   (publicId, status)    => workApi.patch(`/tasks/${publicId}/status`, { status }).then(unwrap),
  setAssignee: (publicId, dto)       => workApi.patch(`/tasks/${publicId}/assignee`, dto).then(unwrap),
  remove:      (publicId)            => workApi.delete(`/tasks/${publicId}`).then(unwrap),
  logs:        (publicId)            => workApi.get(`/tasks/${publicId}/logs`).then(unwrap),
  exportCsv:   (params)              => workApi.get("/tasks/export", { params, responseType: "blob" }).then(r => r.data),
};

export default tasksApi;
