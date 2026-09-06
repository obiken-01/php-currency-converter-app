import { Chip } from "@mui/material";
import { alpha } from "@mui/material/styles";

const FALLBACK = "#78909C";

/**
 * @param {object} label  { id, name, colorHex } -- the API's LabelDto shape.
 */
export default function LabelChip({ label, size = "small", onDelete, onClick, sx }) {
  if (!label) return null;
  const color = label.colorHex || FALLBACK;

  return (
    <Chip
      label={label.name}
      size={size}
      onDelete={onDelete}
      onClick={onClick}
      sx={{
        bgcolor: alpha(color, 0.14),
        color,
        border: "1px solid",
        borderColor: alpha(color, 0.35),
        fontWeight: 500,
        borderRadius: 1,
        maxWidth: 140,
        "& .MuiChip-label": { px: 0.75 },
        "& .MuiChip-deleteIcon": { color, "&:hover": { color } },
        ...sx,
      }}
    />
  );
}
