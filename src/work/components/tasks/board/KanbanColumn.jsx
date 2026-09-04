import { Box, Chip, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import SortableTaskCard from "./SortableTaskCard";
import { COLUMN_WIDTH } from "../../../constants/board";

/**
 * @param {object}   column      { status, label, color, items, count }
 * @param {function} onOpenTask  (publicId) => void
 * @param {function} onAddCard   (status) => void
 * @param {boolean}  fullWidth   true inside the mobile one-column tabs
 */
export default function KanbanColumn({
  column,
  onOpenTask,
  onAddCard,
  onLogTime,
  fullWidth = false,
}) {
  // The droppable wraps the whole column, header included, rather than only
  // the card list — otherwise an empty column has nothing to hover over and
  // cannot be dropped into.
  const { setNodeRef, isOver } = useDroppable({
    id: column.status,
    data: { type: "column", status: column.status },
  });

  const itemIds = column.items.map((item) => item.publicId);

  return (
    <Paper
      ref={setNodeRef}
      variant="outlined"
      sx={{
        width: fullWidth ? "100%" : COLUMN_WIDTH,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        maxHeight: "100%",
        borderRadius: 2,
        borderColor: isOver ? "primary.main" : "divider",
        bgcolor: (t) =>
          isOver ? alpha(column.color, 0.08) : alpha(t.palette.text.primary, 0.02),
        transition: "background-color 120ms, border-color 120ms",
      }}
    >
      {/* Sticky header so counts stay visible while the column scrolls */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 2,
          px: 1,
          py: 0.75,
          bgcolor: "inherit",
          borderBottom: "2px solid",
          borderBottomColor: column.color,
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
        }}
      >
        <Typography variant="subtitle2" fontWeight={700} sx={{ color: column.color }}>
          {column.label}
        </Typography>
        <Chip
          size="small"
          label={column.items.length}
          sx={{
            height: 18,
            fontSize: 11,
            bgcolor: alpha(column.color, 0.16),
            color: column.color,
          }}
        />
        <Box flexGrow={1} />
        {onAddCard && (
          <Tooltip title={`Add a card to ${column.label}`}>
            <IconButton size="small" onClick={() => onAddCard(column.status)}>
              <AddIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      <Box
        sx={{
          flexGrow: 1,
          overflowY: "auto",
          p: 1,
          display: "flex",
          flexDirection: "column",
          gap: 1,
          minHeight: 120,
        }}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {column.items.map((task) => (
            <SortableTaskCard
              key={task.publicId}
              task={task}
              onClick={onOpenTask}
              onLogTime={onLogTime}
            />
          ))}
        </SortableContext>

        {column.items.length === 0 && (
          <Box
            sx={{
              flexGrow: 1,
              display: "grid",
              placeItems: "center",
              color: "text.disabled",
              minHeight: 80,
            }}
          >
            <Typography variant="caption">Drop here</Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
