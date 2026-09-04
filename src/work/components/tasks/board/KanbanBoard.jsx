import { useState } from "react";
import {
  Alert,
  Box,
  Skeleton,
  Stack,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { DndContext, DragOverlay, closestCorners } from "@dnd-kit/core";
import KanbanColumn from "./KanbanColumn";
import KanbanMobileTabs from "./KanbanMobileTabs";
import TaskCard from "../TaskCard";
import { useBoardSensors } from "./sensors";
import { COLUMN_WIDTH } from "../../../constants/board";
import { useBoard, useMoveWorkItem, normaliseColumns } from "../../../hooks/useBoard";
import { moveCardBetweenColumns, resolveDrop } from "../../../utils/boardDrag";

/**
 * @param {string|null} projectId   null = all visible items
 * @param {string|null} assignee    "me" | "unassigned" | guid | null
 * @param {function}    onOpenTask  (publicId) => void
 * @param {function}    onAddCard   (status) => void
 */
export default function KanbanBoard({
  projectId = null,
  assignee = null,
  onOpenTask,
  onAddCard,
  onLogTime,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const sensors = useBoardSensors();

  const { data, isPending, isError, error } = useBoard(projectId, assignee);
  const move = useMoveWorkItem(projectId, assignee);

  const serverColumns = normaliseColumns(data);

  // A mirror of the columns that only exists while a drag is in flight, so
  // cards visibly move between columns mid-drag. Null the rest of the time,
  // which resyncs to server data without an effect — the react-hooks rules
  // in this project forbid setState in an effect body.
  const [dragColumns, setDragColumns] = useState(null);
  const [activeTask, setActiveTask] = useState(null);

  const columns = dragColumns ?? serverColumns;

  const handleDragStart = ({ active }) => {
    setActiveTask(active.data.current?.task ?? null);
    setDragColumns(serverColumns);
  };

  // Moves the card between columns during the drag so the preview is accurate.
  const handleDragOver = ({ active, over }) => {
    if (!over) return;
    setDragColumns((prev) =>
      moveCardBetweenColumns(prev ?? serverColumns, active.id, over.id)
    );
  };

  const handleDragEnd = ({ active, over }) => {
    setActiveTask(null);

    // resolveDrop returns null for a drop outside any column, on an unknown
    // target, or back where the card started -- all of which fire no request.
    const drop = resolveDrop(columns, serverColumns, active.id, over?.id);

    setDragColumns(null);
    if (!drop) return;

    move.mutate({ publicId: active.id, ...drop });
  };

  const handleDragCancel = () => {
    setActiveTask(null);
    setDragColumns(null);
  };

  if (isPending) {
    return (
      <Stack direction="row" spacing={2} sx={{ overflowX: "auto", pb: 1 }}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} variant="rounded" width={280} height={340} sx={{ flexShrink: 0 }} />
        ))}
      </Stack>
    );
  }

  if (isError) {
    return (
      <Alert severity="error">
        {error?.response?.data?.message ?? "Failed to load the board."}
      </Alert>
    );
  }

  if (columns.length === 0) {
    return <Alert severity="info">The board has no columns yet.</Alert>;
  }

  // A six-column board is unusable at 380px, so mobile gets one column at a
  // time. There is nowhere to drag across to; reordering within the visible
  // column still works, and cross-column moves go through the status dropdown
  // in TaskDetailModal.
  if (isMobile) {
    return (
      <KanbanMobileTabs
        columns={columns}
        onOpenTask={onOpenTask}
        onAddCard={onAddCard}
        onLogTime={onLogTime}
        onReorder={(status, publicId, newIndex) =>
          move.mutate({ publicId, status, newIndex })
        }
      />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}   // best fit for column-based boards
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <Box
        sx={{
          display: "flex",
          gap: 2,
          overflowX: "auto",
          pb: 2,
          alignItems: "flex-start",
          height: "calc(100vh - 260px)",
          minHeight: 380,
        }}
      >
        {columns.map((column) => (
          <KanbanColumn
            key={column.status}
            column={column}
            onOpenTask={onOpenTask}
            onAddCard={onAddCard}
            onLogTime={onLogTime}
          />
        ))}
      </Box>

      <DragOverlay
        dropAnimation={{ duration: 180, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}
      >
        {activeTask && (
          <Box sx={{ width: COLUMN_WIDTH.md - 16, transform: "rotate(2deg)", cursor: "grabbing" }}>
            <TaskCard task={activeTask} compact isDragging />
          </Box>
        )}
      </DragOverlay>
    </DndContext>
  );
}
