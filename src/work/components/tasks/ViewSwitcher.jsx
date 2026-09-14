import { ToggleButton, ToggleButtonGroup } from "@mui/material";
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
      <ToggleButton value="list" sx={{ px: 1.25, fontSize: "0.75rem", gap: 0.75 }}>
        <ViewListIcon sx={{ fontSize: 15 }} /> List
      </ToggleButton>
      <ToggleButton value="board" sx={{ px: 1.25, fontSize: "0.75rem", gap: 0.75 }}>
        <ViewKanbanIcon sx={{ fontSize: 15 }} /> Board
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
