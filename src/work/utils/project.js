/**
 * The API reports a project's task counts as totalItems / completedItems and
 * sends no percentage at all. The pages read progressPercent, itemCount and
 * doneCount -- three names it has never returned -- so every project showed
 * 0 of 0 done at 0%, whatever its board actually held.
 *
 * Deriving the percentage here keeps it identical everywhere it is drawn.
 */
export const taskCounts = (project) => ({
  total: project?.totalItems ?? 0,
  done: project?.completedItems ?? 0,
});

export const projectProgress = (project) => {
  const { total, done } = taskCounts(project);
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
};

/**
 * The owner arrives flat -- ownerPublicId + ownerDisplayName -- and only on the
 * detail response. AssigneeAvatar wants a person, and null for nobody.
 */
export const ownerOf = (project) =>
  project?.ownerPublicId
    ? { publicId: project.ownerPublicId, displayName: project.ownerDisplayName }
    : null;
