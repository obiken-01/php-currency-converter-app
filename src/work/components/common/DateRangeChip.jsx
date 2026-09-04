import { Chip, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import EventIcon from "@mui/icons-material/Event";
import { formatShortDate, isOverdue } from "../../utils/dates";
import { isClosed } from "../../constants/statuses";

/**
 * Start -> due. Turns red when the due date has passed and the item is
 * not Done or Cancelled.
 *
 * @param {string|null} start
 * @param {string|null} due
 * @param {string} [status]  suppresses the overdue styling when closed
 */
export default function DateRangeChip({ start, due, status, size = "small", sx }) {
  if (!start && !due) return null;

  const overdue = Boolean(due) && !isClosed(status) && isOverdue(due);

  const label = start && due
    ? `${formatShortDate(start)} \u2192 ${formatShortDate(due)}`
    : due
      ? `Due ${formatShortDate(due)}`
      : `From ${formatShortDate(start)}`;

  const chip = (
    <Chip
      icon={<EventIcon sx={{ fontSize: 14 }} />}
      label={label}
      size={size}
      sx={{
        borderRadius: 1,
        fontWeight: overdue ? 600 : 500,
        ...(overdue
          ? {
              bgcolor: (t) => alpha(t.palette.error.main, 0.14),
              color: "error.main",
            }
          : {
              bgcolor: "action.hover",
              color: "text.secondary",
            }),
        "& .MuiChip-label": { px: 0.75 },
        "& .MuiChip-icon": { ml: 0.75, mr: -0.25, color: "inherit" },
        ...sx,
      }}
    />
  );

  return overdue ? <Tooltip title="Overdue">{chip}</Tooltip> : chip;
}
