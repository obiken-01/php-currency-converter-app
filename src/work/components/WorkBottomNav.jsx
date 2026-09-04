import { BottomNavigation, BottomNavigationAction, Paper } from "@mui/material";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import ListAltIcon from "@mui/icons-material/ListAlt";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import ViewKanbanIcon from "@mui/icons-material/ViewKanban";
import TimelineIcon from "@mui/icons-material/Timeline";

// MUI truncates labels past five items. Projects is reachable from the
// Tasks page on mobile rather than claiming a slot here.
const ITEMS = [
  { label: "Logs",     path: "/work/logs",     icon: <ListAltIcon /> },
  { label: "Tasks",    path: "/work/tasks",    icon: <TaskAltIcon />,    view: "list" },
  { label: "Board",    path: "/work/tasks",    icon: <ViewKanbanIcon />, view: "board" },
  { label: "Timeline", path: "/work/timeline", icon: <TimelineIcon /> },
];

export default function WorkBottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") ?? "list";

  const index = ITEMS.findIndex((item) => {
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
          const item = ITEMS[next];
          navigate(item.view ? `${item.path}?view=${item.view}` : item.path);
        }}
        showLabels
      >
        {ITEMS.map((item) => (
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
