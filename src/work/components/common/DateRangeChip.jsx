import { Chip } from "@mui/material";
import EventIcon from "@mui/icons-material/Event";
import { formatShortDate } from "../../utils/dates";

/**
 * Start -> due. Purely informational: a past due date is not flagged, the
 * task's own status says where it stands.
 *
 * @param {string|null} start
 * @param {string|null} due
 */
export default function DateRangeChip({ start, due, size = "small", sx }) {
  if (!start && !due) return null;

  const label = start && due
    ? `${formatShortDate(start)} \u2192 ${formatShortDate(due)}`
    : due
      ? `Due ${formatShortDate(due)}`
      : `From ${formatShortDate(start)}`;

  return (
    <Chip
      icon={<EventIcon sx={{ fontSize: 14 }} />}
      label={label}
      size={size}
      sx={{
        borderRadius: 1,
        fontWeight: 500,
        bgcolor: "action.hover",
        color: "text.secondary",
        "& .MuiChip-label": { px: 0.75 },
        "& .MuiChip-icon": { ml: 0.75, mr: -0.25, color: "inherit" },
        ...sx,
      }}
    />
  );
}
