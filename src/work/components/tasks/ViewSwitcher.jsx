import { ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";
import ViewListIcon from "@mui/icons-material/ViewList";
import ViewKanbanIcon from "@mui/icons-material/ViewKanban";

/**
 * @param {"list"|"board"} view
 * @param {function} onChange  (view) => void
 */
export default function ViewSwitcher({ view, onChange }) {
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={view}
      onChange={(_, next) => next && onChange(next)}
    >
      <Tooltip title="List view">
        <ToggleButton value="list" sx={{ px: 1.25 }}>
          <ViewListIcon fontSize="small" />
        </ToggleButton>
      </Tooltip>
      <Tooltip title="Board view">
        <ToggleButton value="board" sx={{ px: 1.25 }}>
          <ViewKanbanIcon fontSize="small" />
        </ToggleButton>
      </Tooltip>
    </ToggleButtonGroup>
  );
}
