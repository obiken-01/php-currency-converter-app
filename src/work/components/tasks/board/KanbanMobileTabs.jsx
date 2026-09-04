import { useState } from "react";
import { Badge, Box, IconButton, Stack, Tab, Tabs, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { DndContext, DragOverlay, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import SortableTaskCard from "./SortableTaskCard";
import TaskCard from "../TaskCard";
import { useBoardSensors } from "./sensors";

/**
 * One column at a time behind swipeable tabs.
 *
 * There is nowhere to drag across to here, but reordering *within* the
 * visible column works via the TouchSensor's hold-to-drag. Cross-column
 * moves go through the status dropdown in TaskDetailModal.
 *
 * @param {Array}    columns
 * @param {function} onOpenTask
 * @param {function} onAddCard
 * @param {function} onReorder   (status, publicId, newIndex) => void
 */
export default function KanbanMobileTabs({
  columns,
  onOpenTask,
  onAddCard,
  onLogTime,
  onReorder,
}) {
  const sensors = useBoardSensors();
  const [index, setIndex] = useState(0);
  const [activeTask, setActiveTask] = useState(null);
  // Local order only while a drag is in flight, so the list does not jump
  // before the server confirms.
  const [dragItems, setDragItems] = useState(null);

  const active = columns[Math.min(index, columns.length - 1)];
  if (!active) return null;

  const items = dragItems ?? active.items;

  const handleDragEnd = ({ active: dragged, over }) => {
    setActiveTask(null);

    if (!over || dragged.id === over.id) {
      setDragItems(null);
      return;
    }

    const from = items.findIndex((i) => i.publicId === dragged.id);
    const to = items.findIndex((i) => i.publicId === over.id);
    setDragItems(null);
    if (from === -1 || to === -1) return;

    onReorder?.(active.status, dragged.id, to);
  };

  return (
    <Box>
      <Tabs
        value={Math.min(index, columns.length - 1)}
        onChange={(_, next) => {
          setIndex(next);
          setDragItems(null);
        }}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{
          borderBottom: "1px solid",
          borderColor: "divider",
          mb: 1.5,
          "& .MuiTab-root": { textTransform: "none", minHeight: 44 },
        }}
      >
        {columns.map((column) => (
          <Tab
            key={column.status}
            label={
              <Badge
                badgeContent={column.items.length}
                showZero
                sx={{
                  pr: column.items.length > 9 ? 2 : 1.5,
                  "& .MuiBadge-badge": {
                    position: "static",
                    transform: "none",
                    ml: 0.75,
                    bgcolor: "action.selected",
                    color: "text.secondary",
                  },
                }}
              >
                {column.label}
              </Badge>
            }
          />
        ))}
      </Tabs>

      <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ color: active.color, flexGrow: 1 }}>
          {active.label}
        </Typography>
        {onAddCard && (
          <Tooltip title={`Add a card to ${active.label}`}>
            <IconButton size="small" onClick={() => onAddCard(active.status)}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {items.length === 0 ? (
        <Typography
          variant="body2"
          color="text.disabled"
          sx={{ textAlign: "center", py: 6 }}
        >
          Nothing in {active.label}.
        </Typography>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={({ active: dragged }) => {
            setActiveTask(dragged.data.current?.task ?? null);
            setDragItems(active.items);
          }}
          onDragOver={({ active: dragged, over }) => {
            if (!over || dragged.id === over.id) return;
            setDragItems((prev) => {
              const current = prev ?? active.items;
              const from = current.findIndex((i) => i.publicId === dragged.id);
              const to = current.findIndex((i) => i.publicId === over.id);
              if (from === -1 || to === -1) return current;
              return arrayMove(current, from, to);
            });
          }}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            setActiveTask(null);
            setDragItems(null);
          }}
        >
          <SortableContext
            items={items.map((i) => i.publicId)}
            strategy={verticalListSortingStrategy}
          >
            <Stack spacing={1}>
              {items.map((task) => (
                <SortableTaskCard
                  key={task.publicId}
                  task={task}
                  onClick={onOpenTask}
                  onLogTime={onLogTime}
                />
              ))}
            </Stack>
          </SortableContext>

          <DragOverlay>
            {activeTask && (
              <Box sx={{ cursor: "grabbing" }}>
                <TaskCard task={activeTask} compact isDragging />
              </Box>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </Box>
  );
}
