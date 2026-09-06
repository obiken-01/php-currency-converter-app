import workApi, { unwrap } from "./workApi";

export const tokensApi = {
  query:  ()         => workApi.get("/tokens").then(unwrap),
  // Returns the raw token exactly once — the caller must show it before
  // anything can navigate away.
  create: (dto)      => workApi.post("/tokens", dto).then(unwrap),
  // PatDto is keyed by an integer id, and the route is {id:int}: a publicId
  // here was undefined, so revoke asked for /tokens/undefined and 404'd.
  revoke: (id) => workApi.delete(`/tokens/${id}`).then(unwrap),
};

export default tokensApi;
