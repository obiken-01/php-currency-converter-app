import { BottomNavigation, BottomNavigationAction, Paper } from "@mui/material";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import ListAltIcon from "@mui/icons-material/ListAlt";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import ViewKanbanIcon from "@mui/icons-material/ViewKanban";
import TimelineIcon from "@mui/icons-material/Timeline";
import MovieCreationOutlinedIcon from "@mui/icons-material/MovieCreationOutlined";
import { useStudioSession } from "../studio/useStudioSession";

// MUI truncates labels past five items. Projects is reachable from the
// Tasks page on mobile rather than claiming a slot here.
const ITEMS = [
  { label: "Logs",     path: "/work/logs",     icon: <ListAltIcon /> },
  { label: "Tasks",    path: "/work/tasks",    icon: <TaskAltIcon />,    view: "list" },
  { label: "Board",    path: "/work/tasks",    icon: <ViewKanbanIcon />, view: "board" },
  { label: "Timeline", path: "/work/timeline", icon: <TimelineIcon /> },
];

// The fifth and last slot, for the one account Studio allows.
const STUDIO_ITEM = { label: "Studio", path: "/work/studio", icon: <MovieCreationOutlinedIcon /> };

export default function WorkBottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") ?? "list";
  const { allowed } = useStudioSession();
  const items = allowed ? [...ITEMS, STUDIO_ITEM] : ITEMS;

  const index = items.findIndex((item) => {
    if (!pathname.startsWith(item.path)) return false;
    return item.view ? item.view === view : true;
  });

  return (
    <Paper
      sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1000 }}
      elevation={3}
    >
      <BottomNavigation
        value={index === -1 ? false : index}
        onChange={(_, next) => {
          const item = items[next];
          navigate(item.view ? `${item.path}?view=${item.view}` : item.path);
        }}
        showLabels
      >
        {items.map((item) => (
          <BottomNavigationAction
            key={`${item.path}:${item.view ?? ""}`}
            label={item.label}
            icon={item.icon}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
