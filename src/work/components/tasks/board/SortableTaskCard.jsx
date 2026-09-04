import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import TaskCard from "../TaskCard";

/**
 * Thin wrapper. TaskCard stays purely presentational — putting dnd-kit hooks
 * inside it would make the list view draggable too.
 *
 * The listeners go on the whole card rather than a hover-only handle: there
 * is no hover on a phone, so a handle would make the board undraggable there.
 * PointerSensor's 8px threshold is what keeps a plain click working.
 */
export default function SortableTaskCard({ task, onClick, onLogTime }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.publicId, data: { type: "card", status: task.status, task } });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        // The ghost stays put at reduced opacity; DragOverlay shows the real card.
        opacity: isDragging ? 0.4 : 1,
        touchAction: "manipulation",
      }}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} onClick={onClick} onLogTime={onLogTime} compact />
    </div>
  );
}
