import workApi, { unwrap } from "./workApi";

export const labelsApi = {
  query:  ()            => workApi.get("/labels").then(unwrap),
  create: (dto)         => workApi.post("/labels", dto).then(unwrap),
  // LabelDto is keyed by an integer id, like the {id:int} route it deletes.
  remove: (id)          => workApi.delete(`/labels/${id}`).then(unwrap),
};

export default labelsApi;
