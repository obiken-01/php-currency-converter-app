import workApi, { unwrap } from "./workApi";

export const projectsApi = {
  query:    (params)        => workApi.get("/projects", { params }).then(unwrap),
  get:      (publicId)      => workApi.get(`/projects/${publicId}`).then(unwrap),
  create:   (dto)           => workApi.post("/projects", dto).then(unwrap),
  update:   (publicId, dto) => workApi.put(`/projects/${publicId}`, dto).then(unwrap),
  remove:   (publicId)      => workApi.delete(`/projects/${publicId}`).then(unwrap),
  timeline: (publicId)      => workApi.get(`/projects/${publicId}/timeline`).then(unwrap),
  members:  (publicId)      => workApi.get(`/projects/${publicId}/members`).then(unwrap),
};

export default projectsApi;
