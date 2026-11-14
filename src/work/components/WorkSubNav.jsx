import { Box, Stack } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { tui } from "../../theme/tuiTheme";
import { useStudioSession } from "../studio/useStudioSession";

// Tasks covers both the list and board views (switched on the page itself).
const TABS = [
  { label: "Dashboard", path: "/work",           exact: true },
  { label: "Time Logs", path: "/work/logs" },
  { label: "Tasks",     path: "/work/tasks" },
  { label: "Timeline",  path: "/work/timeline" },
  { label: "Projects",  path: "/work/projects" },
];

// Shown only to the one account the Studio service allows.
const STUDIO_TAB = { label: "Studio", path: "/work/studio" };

function isActive(tab, pathname) {
  if (tab.exact) return pathname === tab.path || pathname === `${tab.path}/`;
  return pathname.startsWith(tab.path);
}

// Same "[label]" solid-fill tab-bar convention as the site's TopMenu — this
// is the Work section's equivalent primary nav, just one level down.
export default function WorkSubNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { showTab } = useStudioSession();
  const tabs = showTab ? [...TABS, STUDIO_TAB] : TABS;

  const go = (tab) => navigate(tab.path);

  return (
    <Stack
      direction="row"
      sx={{
        borderBottom: "1px solid",
        borderColor: "divider",
        overflowX: "auto",
      }}
    >
      {tabs.map((tab) => {
        const active = isActive(tab, pathname);
        return (
          <Box
            key={tab.path}
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
