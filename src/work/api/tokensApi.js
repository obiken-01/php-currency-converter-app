import workApi, { unwrap } from "./workApi";

export const tokensApi = {
  query:  ()         => workApi.get("/tokens").then(unwrap),
  // Returns the raw token exactly once — the caller must show it before
  // anything can navigate away.
  create: (dto)      => workApi.post("/tokens", dto).then(unwrap),
  revoke: (publicId) => workApi.delete(`/tokens/${publicId}`).then(unwrap),
};

export default tokensApi;
