import { Box, Stack } from "@mui/material";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { tui } from "../../theme/tuiTheme";

// `view` distinguishes the two tabs that share the /work/tasks route.
const TABS = [
  { label: "Dashboard", path: "/work",           exact: true },
  { label: "Time Logs", path: "/work/logs" },
  { label: "Tasks",     path: "/work/tasks",     view: "list" },
  { label: "Board",     path: "/work/tasks",     view: "board" },
  { label: "Timeline",  path: "/work/timeline" },
  { label: "Projects",  path: "/work/projects" },
];

function isActive(tab, pathname, view) {
  if (tab.exact) return pathname === tab.path || pathname === `${tab.path}/`;
  if (!pathname.startsWith(tab.path)) return false;
  return tab.view ? tab.view === view : true;
}

// Same "[label]" solid-fill tab-bar convention as the site's TopMenu — this
// is the Work section's equivalent primary nav, just one level down.
export default function WorkSubNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") ?? "list";

  const go = (tab) => navigate(tab.view ? `${tab.path}?view=${tab.view}` : tab.path);

  return (
    <Stack
      direction="row"
      sx={{
        borderBottom: "1px solid",
        borderColor: "divider",
        overflowX: "auto",
      }}
    >
      {TABS.map((tab) => {
        const active = isActive(tab, pathname, view);
        return (
          <Box
            key={`${tab.path}:${tab.view ?? ""}`}
            component="button"
            onClick={() => go(tab)}
            sx={{
              font: "inherit",
              fontSize: "0.75rem",
              fontWeight: active ? 700 : 500,
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
              border: "none",
              borderRight: "1px solid",
              borderColor: "divider",
              cursor: "pointer",
              px: 1.5,
              py: 1,
              bgcolor: active ? "primary.main" : "transparent",
              color: active ? tui.bg : "text.secondary",
              "&:hover": { color: active ? tui.bg : "text.primary" },
            }}
          >
            {tab.label}
          </Box>
        );
      })}
    </Stack>
  );
}
