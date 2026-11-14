import workApi, { unwrap } from "./workApi";
import { withPublicId } from "../offline/identity";

// Logs are stored in UTC; the API needs our timezone to know which instants
// the picked from/to days cover and to print CSV times as we entered them.
const withTimeZone = (params = {}) => ({
  ...params,
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
});

export const timeLogsApi = {
  query:     (params)      => workApi.get("/logs", { params: withTimeZone(params) }).then(unwrap),
  create:    (dto)         => workApi.post("/logs", withPublicId(dto)).then(unwrap),
  update:    (id, dto)     => workApi.put(`/logs/${id}`, dto).then(unwrap),
  remove:    (id)          => workApi.delete(`/logs/${id}`).then(unwrap),
  exportCsv: (params)      =>
    workApi.get("/logs/export", { params: withTimeZone(params), responseType: "blob" }).then(r => r.data),
};

export default timeLogsApi;
