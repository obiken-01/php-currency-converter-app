import { Box, Chip, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import SortableTaskCard from "./SortableTaskCard";
import { COLUMN_WIDTH } from "../../../constants/board";

/**
 * @param {object}   column     { status, label, color, items, count }
 * @param {function} onOpenTask (publicId) => void
 * @param {function} onAddCard  (status) => void
 * @param {boolean}  fullWidth  true inside the mobile one-column tabs
 */
export default function KanbanColumn({ column, onOpenTask, onAddCard, fullWidth = false }) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.status,
    data: { type: "column", status: column.status },
  });

  const itemIds = column.items.map((item) => item.publicId);

  return (
    <Box
      sx={{
        width: fullWidth ? "100%" : COLUMN_WIDTH,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        maxHeight: "100%",
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
          bgcolor: "background.paper",
          borderBottom: "2px solid",
          borderBottomColor: column.color,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
        }}
      >
        <Typography variant="subtitle2" fontWeight={700} sx={{ color: column.color }}>
          {column.label}
        </Typography>
        <Chip
          size="small"
          label={column.count}
          sx={{ height: 18, fontSize: 11, bgcolor: alpha(column.color, 0.16), color: column.color }}
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
        ref={setNodeRef}
        sx={{
          flexGrow: 1,
          overflowY: "auto",
          p: 1,
          borderRadius: "0 0 6px 6px",
          bgcolor: (t) =>
            isOver ? alpha(column.color, 0.08) : alpha(t.palette.text.primary, 0.03),
          transition: "background-color 120ms",
          minHeight: 120,
        }}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <Stack spacing={1}>
            {column.items.map((task) => (
              <SortableTaskCard key={task.publicId} task={task} onClick={onOpenTask} />
            ))}
          </Stack>
        </SortableContext>

        {column.items.length === 0 && (
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ display: "block", textAlign: "center", py: 3 }}
          >
            Nothing here
          </Typography>
        )}
      </Box>
    </Box>
  );
}
