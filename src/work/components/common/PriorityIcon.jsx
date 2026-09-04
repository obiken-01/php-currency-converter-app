import { Tooltip } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import RemoveIcon from "@mui/icons-material/Remove";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardDoubleArrowUpIcon from "@mui/icons-material/KeyboardDoubleArrowUp";
import { getPriority } from "../../constants/statuses";

const ICONS = {
  Low:    KeyboardArrowDownIcon,
  Normal: RemoveIcon,
  High:   KeyboardArrowUpIcon,
  Urgent: KeyboardDoubleArrowUpIcon,
};

/**
 * @param {string} priority  Priority value
 * @param {boolean} [withTooltip]
 */
export default function PriorityIcon({ priority, fontSize = "small", withTooltip = true, sx }) {
  const meta = getPriority(priority);
  const Icon = ICONS[meta.value] ?? RemoveIcon;

  const icon = (
    <Icon fontSize={fontSize} sx={{ color: meta.color, display: "block", ...sx }} />
  );

  return withTooltip ? (
    <Tooltip title={`${meta.label} priority`}>
      <span style={{ display: "inline-flex" }}>{icon}</span>
    </Tooltip>
  ) : (
    icon
  );
}
