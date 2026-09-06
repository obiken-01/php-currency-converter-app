import workApi, { unwrap } from "./workApi";

// The set of users assignable to a work item.
//
// The route is /work/users/directory -- the directory hangs off the users
// controller, not off /work itself. Calling /work/directory 404'd, so every
// assignee picker in the app came up with nobody in it.
export const directoryApi = {
  query: () => workApi.get("/users/directory").then(unwrap),
};

export default directoryApi;
