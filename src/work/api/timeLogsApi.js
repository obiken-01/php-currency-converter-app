import workApi, { unwrap } from "./workApi";

export const timeLogsApi = {
  query:     (params)      => workApi.get("/logs", { params }).then(unwrap),
  create:    (dto)         => workApi.post("/logs", dto).then(unwrap),
  update:    (id, dto)     => workApi.put(`/logs/${id}`, dto).then(unwrap),
  remove:    (id)          => workApi.delete(`/logs/${id}`).then(unwrap),
  exportCsv: (params)      =>
    workApi.get("/logs/export", { params, responseType: "blob" }).then(r => r.data),
};

export default timeLogsApi;
