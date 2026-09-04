import workApi, { unwrap } from "./workApi";

// The set of users assignable to a work item.
export const directoryApi = {
  query: () => workApi.get("/directory").then(unwrap),
};

export default directoryApi;
