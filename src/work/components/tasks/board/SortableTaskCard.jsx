import { Box } from "@mui/material";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import TaskCard from "../TaskCard";

/** Wraps TaskCard in a dnd-kit sortable so the board and list share one card. */
export default function SortableTaskCard({ task, onClick, onLogTime }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.publicId,
    data: { type: "card", status: task.status },
  });

  return (
    <Box
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
      }}
    >
      <TaskCard
        task={task}
        onClick={onClick}
        onLogTime={onLogTime}
        compact
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </Box>
  );
}
