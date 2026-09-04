import workApi, { unwrap } from "./workApi";

export const labelsApi = {
  query:  ()            => workApi.get("/labels").then(unwrap),
  create: (dto)         => workApi.post("/labels", dto).then(unwrap),
  remove: (publicId)    => workApi.delete(`/labels/${publicId}`).then(unwrap),
};

export default labelsApi;
