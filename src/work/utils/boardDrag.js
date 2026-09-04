/**
 * Pure column/index maths for the Kanban drag. Kept out of the component so
 * the off-by-one cases can be tested — they are invisible until a card lands
 * in the wrong slot.
 *
 * Throughout, `id` is either a card publicId or a column status string:
 * dnd-kit reports a drop on an empty column using the column's own id.
 */

/** @returns {number} index of the column holding `id`, or -1 */
export function findColumnIndex(columns, id) {
  const asColumn = columns.findIndex((c) => c.status === id);
  if (asColumn !== -1) return asColumn;
  return columns.findIndex((c) => c.items.some((i) => i.publicId === id));
}

/** @returns {{status: string, index: number}|null} */
export function findCardLocation(columns, publicId) {
  for (const column of columns) {
    const index = column.items.findIndex((i) => i.publicId === publicId);
    if (index !== -1) return { status: column.status, index };
  }
  return null;
}

/**
 * The onDragOver transform: moves the dragged card into the column it is
 * currently over, so the preview is accurate mid-drag. Returns the input
 * unchanged when the move is a no-op.
 */
export function moveCardBetweenColumns(columns, activeId, overId) {
  const from = findColumnIndex(columns, activeId);
  const to = findColumnIndex(columns, overId);
  if (from === -1 || to === -1 || from === to) return columns;

  const next = columns.map((c) => ({ ...c, items: [...c.items] }));
  const idx = next[from].items.findIndex((i) => i.publicId === activeId);
  if (idx === -1) return columns;

  const [card] = next[from].items.splice(idx, 1);
  const overIdx = next[to].items.findIndex((i) => i.publicId === overId);
  const insertAt = overIdx === -1 ? next[to].items.length : overIdx;
  next[to].items.splice(insertAt, 0, { ...card, status: next[to].status });

  return next;
}

/**
 * Where a drop should land, given the drag-preview columns and the pre-drag
 * server state.
 *
 * @param {Array} columns        the drag mirror (already reflects onDragOver)
 * @param {Array} serverColumns  state before the drag started
 * @returns {{status: string, newIndex: number}|null} null when nothing moved
 */
export function resolveDrop(columns, serverColumns, activeId, overId) {
  if (overId == null) return null;

  const colIdx = findColumnIndex(columns, overId);
  if (colIdx === -1) return null;

  const column = columns[colIdx];
  const currentIndex = column.items.findIndex((i) => i.publicId === activeId);
  const overIndex = column.items.findIndex((i) => i.publicId === overId);

  // Compared against the pre-drag state, because the mirror has already
  // rewritten the card's status.
  const origin = findCardLocation(serverColumns, activeId);
  const previewMoved = Boolean(origin) && origin.status !== column.status;

  let newIndex = currentIndex;

  // Only reorder onto the hovered card when the preview has NOT already
  // placed this card. Across columns moveCardBetweenColumns has put it in the
  // slot the user can see; re-running the reorder here would shift it one
  // further and land it below the card it was dropped above.
  if (!previewMoved && overIndex !== -1 && currentIndex !== -1 && overIndex !== currentIndex) {
    newIndex = overIndex;
  }

  // Dropped on an empty column, or on the column body rather than a card.
  if (newIndex === -1) newIndex = column.items.length;

  if (origin && origin.status === column.status && origin.index === newIndex) {
    return null;
  }

  return { status: column.status, newIndex };
}
