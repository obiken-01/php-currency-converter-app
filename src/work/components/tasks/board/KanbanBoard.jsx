import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Skeleton,
  Stack,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import KanbanColumn from "./KanbanColumn";
import { COLUMN_WIDTH } from "../../../constants/board";
import KanbanMobileTabs from "./KanbanMobileTabs";
import TaskCard from "../TaskCard";
import { useBoard, useMoveWorkItem, normaliseColumns } from "../../../hooks/useBoard";

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
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const { data, isPending, isError, error } = useBoard(projectId, assignee);
  const move = useMoveWorkItem(projectId, assignee);

  const [activeTask, setActiveTask] = useState(null);

  const columns = useMemo(() => normaliseColumns(data), [data]);

  const sensors = useSensors(
    // A small distance threshold lets a tap still open the card.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const findCard = (publicId) => {
    for (const column of columns) {
      const card = column.items.find((item) => item.publicId === publicId);
      if (card) return card;
    }
    return null;
  };

  const handleDragStart = ({ active }) => setActiveTask(findCard(active.id));

  const handleDragEnd = ({ active, over }) => {
    setActiveTask(null);
    if (!over) return;

    const overData = over.data.current;
    const targetStatus =
      overData?.type === "column" ? overData.status : overData?.status;
    if (!targetStatus) return;

    const targetColumn = columns.find((c) => c.status === targetStatus);
    if (!targetColumn) return;

    const currentIndex = targetColumn.items.findIndex((i) => i.publicId === active.id);
    const overIndex =
      overData?.type === "column"
        ? targetColumn.items.length
        : targetColumn.items.findIndex((i) => i.publicId === over.id);

    const sourceStatus = active.data.current?.status;
    const newIndex = overIndex === -1 ? targetColumn.items.length : overIndex;

    // Nothing actually changed.
    if (sourceStatus === targetStatus && currentIndex === newIndex) return;

    move.mutate({ publicId: active.id, status: targetStatus, newIndex });
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

  const dndProps = {
    sensors,
    collisionDetection: closestCorners,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onDragCancel: () => setActiveTask(null),
  };

  // A six-column board is unusable at 380px, so mobile gets one column at a
  // time. Cross-column drag is impossible there -- the status dropdown in
  // TaskDetailModal is the move mechanism instead.
  if (isMobile) {
    return (
      <KanbanMobileTabs columns={columns} onOpenTask={onOpenTask} onAddCard={onAddCard} />
    );
  }

  return (
    <DndContext {...dndProps}>
      <Box
        sx={{
          display: "flex",
          gap: 2,
          overflowX: "auto",
          pb: 1,
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
          />
        ))}
      </Box>

      <DragOverlay>
        {activeTask && (
          <Box sx={{ width: COLUMN_WIDTH.md - 16, cursor: "grabbing" }}>
            <TaskCard task={activeTask} compact />
          </Box>
        )}
      </DragOverlay>
    </DndContext>
  );
}
