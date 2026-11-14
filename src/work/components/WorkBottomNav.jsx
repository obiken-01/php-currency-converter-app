import { BottomNavigation, BottomNavigationAction, Paper } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import ListAltIcon from "@mui/icons-material/ListAlt";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import TimelineIcon from "@mui/icons-material/Timeline";
import MovieCreationOutlinedIcon from "@mui/icons-material/MovieCreationOutlined";
import { useStudioSession } from "../studio/useStudioSession";

// MUI truncates labels past five items. Projects is reachable from the
// Tasks page on mobile rather than claiming a slot here.
const ITEMS = [
  { label: "Logs",     path: "/work/logs",     icon: <ListAltIcon /> },
  { label: "Tasks",    path: "/work/tasks",    icon: <TaskAltIcon /> },
  { label: "Timeline", path: "/work/timeline", icon: <TimelineIcon /> },
];

// The last slot, for the one account Studio allows.
const STUDIO_ITEM = { label: "Studio", path: "/work/studio", icon: <MovieCreationOutlinedIcon /> };

// Five actions at MUI's 80 px minimum overflow a 360-400 px phone. From five
// items on they share the width instead, and the selected label keeps its
// size so "Timeline" still fits. Fewer items keep MUI's default look.
const CROWDED = 5;
const SHARED_WIDTH = {
  minWidth: 0,
  flex: "1 1 0",
  px: 0.5,
  "& .MuiBottomNavigationAction-label": { whiteSpace: "nowrap" },
  "& .MuiBottomNavigationAction-label.Mui-selected": { fontSize: "0.75rem" },
};

export default function WorkBottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { showTab } = useStudioSession();
  const items = showTab ? [...ITEMS, STUDIO_ITEM] : ITEMS;

  const index = items.findIndex((item) => pathname.startsWith(item.path));

  return (
    <Paper
      sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1000 }}
      elevation={3}
    >
      <BottomNavigation
        value={index === -1 ? false : index}
        onChange={(_, next) => {
          navigate(items[next].path);
        }}
        showLabels
      >
        {items.map((item) => (
          <BottomNavigationAction
            key={item.path}
            label={item.label}
            icon={item.icon}
            sx={items.length >= CROWDED ? SHARED_WIDTH : undefined}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
