import { Tabs, Tab, Box } from "@mui/material";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ListAltIcon from "@mui/icons-material/ListAlt";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import ViewKanbanIcon from "@mui/icons-material/ViewKanban";
import TimelineIcon from "@mui/icons-material/Timeline";
import FolderIcon from "@mui/icons-material/Folder";

// `view` distinguishes the two tabs that share the /work/tasks route.
const TABS = [
  { label: "Dashboard", path: "/work",           icon: <DashboardIcon fontSize="small" />,  exact: true },
  { label: "Time Logs", path: "/work/logs",      icon: <ListAltIcon fontSize="small" /> },
  { label: "Tasks",     path: "/work/tasks",     icon: <TaskAltIcon fontSize="small" />,    view: "list" },
  { label: "Board",     path: "/work/tasks",     icon: <ViewKanbanIcon fontSize="small" />, view: "board" },
  { label: "Timeline",  path: "/work/timeline",  icon: <TimelineIcon fontSize="small" /> },
  { label: "Projects",  path: "/work/projects",  icon: <FolderIcon fontSize="small" /> },
];

function currentSubNavIndex(pathname, view) {
  const index = TABS.findIndex((t) => {
    if (t.exact) return pathname === t.path || pathname === `${t.path}/`;
    if (!pathname.startsWith(t.path)) return false;
    return t.view ? t.view === view : true;
  });
  return index === -1 ? false : index;
}

export default function WorkSubNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") ?? "list";

  const value = currentSubNavIndex(pathname, view);

  const handleChange = (_, index) => {
    const tab = TABS[index];
    navigate(tab.view ? `${tab.path}?view=${tab.view}` : tab.path);
  };

  return (
    <Box sx={{ borderBottom: "1px solid", borderColor: "divider", px: { xs: 1, sm: 2 } }}>
      <Tabs
        value={value}
        onChange={handleChange}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{ minHeight: 44, "& .MuiTab-root": { minHeight: 44, textTransform: "none" } }}
      >
        {TABS.map((tab) => (
          <Tab
            key={`${tab.path}:${tab.view ?? ""}`}
            label={tab.label}
            icon={tab.icon}
            iconPosition="start"
          />
        ))}
      </Tabs>
    </Box>
  );
}
