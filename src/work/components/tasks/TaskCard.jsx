import { Box, Card, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import MoreTimeIcon from "@mui/icons-material/MoreTime";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import { getPriority } from "../../constants/statuses";
import PriorityIcon from "../common/PriorityIcon";
import LabelChip from "../common/LabelChip";
import DateRangeChip from "../common/DateRangeChip";
import AssigneeAvatar from "../common/AssigneeAvatar";

const MAX_LABELS = 3;

// Two lines of text, ellipsised. Card height has to be stable across
// states or the board jumps while a card is being dragged.
const clamp = (lines) => ({
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  wordBreak: "break-word",
});

/**
 * One card for both the list and the board. Building two diverges them.
 *
 * @param {object}   task             WorkItemCardDto
 * @param {function} onClick          (publicId) => void -- opens the detail modal
 * @param {boolean}  compact          true on the Kanban board (hides the project chip)
 * @param {boolean}  isDragging       board drag state -> reduced elevation
 * @param {function} [onLogTime]      (task) => void -- opens a prefilled time log
 */
export default function TaskCard({
  task,
  onClick,
  compact = false,
  isDragging = false,
  onLogTime,
}) {
  if (!task) return null;

  const priority = getPriority(task.priority);
  const labels = task.labels ?? [];
  const visibleLabels = labels.slice(0, MAX_LABELS);
  const overflow = labels.length - visibleLabels.length;

  return (
    <Card
      variant="outlined"
      onClick={() => onClick?.(task.publicId)}
      sx={{
        position: "relative",
        p: 1.25,
        pl: 1.75,
        cursor: onClick ? "pointer" : "default",
        borderLeft: "3px solid",
        borderLeftColor: priority.color,
        borderRadius: 1.5,
        opacity: isDragging ? 0.5 : 1,
        boxShadow: isDragging ? 0 : undefined,
        transition: "box-shadow 120ms, border-color 120ms",
        "&:hover": { boxShadow: 2 },
        "&:hover .task-card-actions": { opacity: 1 },
      }}
    >
      <Stack spacing={0.75}>

        {/* Title row */}
        <Stack direction="row" alignItems="flex-start" spacing={0.5}>
          <PriorityIcon priority={task.priority} sx={{ mt: "2px", flexShrink: 0 }} />

          <Typography
            variant="body2"
            fontWeight={600}
            sx={{ ...clamp(2), flexGrow: 1, lineHeight: 1.35 }}
          >
            {task.title}
          </Typography>

          {onLogTime && (
            <Stack
              direction="row"
              className="task-card-actions"
              // On the board the whole card carries the drag listeners, so a
              // press here would start a drag. stopPropagation on click is too
              // late — the sensor activates on pointerdown.
              onPointerDown={(e) => e.stopPropagation()}
              sx={{ opacity: 0, transition: "opacity 120ms", flexShrink: 0 }}
            >
              <Tooltip title="Log time against this task">
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); onLogTime(task); }}
                >
                  <MoreTimeIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          )}
        </Stack>

        {/* Summary */}
        {task.summary && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ ...clamp(2), lineHeight: 1.4 }}
          >
            {task.summary}
          </Typography>
        )}

        {/* Dates + labels */}
        {(task.startDate || task.dueDate || labels.length > 0) && (
          <Stack direction="row" flexWrap="wrap" gap={0.5} alignItems="center">
            <DateRangeChip
              start={task.startDate}
              due={task.dueDate}
              status={task.status}
            />
            {visibleLabels.map((label) => (
              <LabelChip key={label.publicId ?? label.name} label={label} />
            ))}
            {overflow > 0 && (
              <Tooltip title={labels.slice(MAX_LABELS).map((l) => l.name).join(", ")}>
                <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
                  +{overflow}
                </Typography>
              </Tooltip>
            )}
          </Stack>
        )}

        {/* Footer: project + assignee */}
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minHeight: 24 }}>
          {!compact && task.project && (
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
              <FolderOutlinedIcon sx={{ fontSize: 14, color: "text.disabled" }} />
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                sx={{ maxWidth: 160 }}
              >
                {task.project.name}
              </Typography>
            </Stack>
          )}
          <Box flexGrow={1} />
          <AssigneeAvatar user={task.assignee} size={22} />
        </Stack>

      </Stack>
    </Card>
  );
}
