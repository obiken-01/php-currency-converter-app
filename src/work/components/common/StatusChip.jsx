import { Chip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { getStatus } from "../../constants/statuses";

/**
 * @param {string} status  WorkItemStatus value
 * @param {"small"|"medium"} [size]
 * @param {boolean} [dot]  render as a filled dot + label rather than a chip
 */
export default function StatusChip({ status, size = "small", onClick, sx }) {
  const meta = getStatus(status);

  return (
    <Chip
      label={meta.label}
      size={size}
      onClick={onClick}
      sx={{
        bgcolor: alpha(meta.color, 0.16),
        color: meta.color,
        fontWeight: 600,
        borderRadius: 1,
        "& .MuiChip-label": { px: 1 },
        ...sx,
      }}
    />
  );
}
