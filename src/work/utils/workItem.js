/**
 * The API returns a work item flat: assigneePublicId + assigneeDisplayName,
 * projectPublicId + projectName. There is no nested `assignee` object to hand
 * an avatar, so this makes one -- in a single place, because a card and a
 * detail modal disagreeing about who is assigned is worse than either being
 * wrong on its own.
 *
 * Null when nobody is assigned; AssigneeAvatar renders nothing for null.
 */
export const assigneeOf = (task) =>
  task?.assigneePublicId
    ? {
        publicId: task.assigneePublicId,
        displayName: task.assigneeDisplayName,
      }
    : null;

/**
 * The form's own field names are not the API's. `projectId` and `assigneeId`
 * bind to nothing on CreateWorkItemDto/UpdateWorkItemDto, so a body carrying
 * them saved a task with no project and nobody assigned -- no error, no clue on
 * screen, just a task that quietly left its project.
 *
 * `isEdit` decides what an empty project means. On a create it is simply a
 * standalone task. On an edit the server keeps whatever project the task
 * already has unless told otherwise, so choosing "No project" has to say so
 * with clearProject.
 */
export const toWorkItemDto = (form, { isEdit = false } = {}) => {
  const dto = {
    title:            form.title.trim(),
    summary:          form.summary.trim() || null,
    description:      form.description.trim() || null,
    projectPublicId:  form.projectId || null,
    status:           form.status,
    priority:         form.priority,
    startDate:        form.startDate || null,
    dueDate:          form.dueDate || null,
    labelIds:         form.labelIds,
    assigneePublicId: form.assigneeId || null,
  };

  if (isEdit && !form.projectId) dto.clearProject = true;

  return dto;
};
