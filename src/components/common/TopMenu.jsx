import { Stack, Box, BottomNavigation, BottomNavigationAction, Paper } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme, useMediaQuery } from "@mui/material";
import CurrencyExchangeIcon from "@mui/icons-material/CurrencyExchange";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import TimerIcon from "@mui/icons-material/Timer";
import { tui } from "../../theme/tuiTheme";

const navItems = [
  { key: "1", label: "Currency", path: "/currency", icon: <CurrencyExchangeIcon /> },
  { key: "2", label: "Time",     path: "/time",      icon: <AccessTimeIcon /> },
  { key: "3", label: "Shopping", path: "/shopping",  icon: <ShoppingCartIcon /> },
  { key: "4", label: "Work",     path: "/work",      icon: <TimerIcon /> },
];

export default function TopMenu() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const location = useLocation();
  const navigate = useNavigate();

  const currentIndex = navItems.findIndex(item =>
    location.pathname.startsWith(item.path)
  );

  // ── Mobile — Bottom Navigation ───────────────────────────────
  if (isMobile) {
    return (
      <Paper
        sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1000 }}
        elevation={3}
      >
        <BottomNavigation
          value={currentIndex === -1 ? 0 : currentIndex}
          onChange={(_, newIndex) => navigate(navItems[newIndex].path)}
          showLabels
        >
          {navItems.map((item) => (
            <BottomNavigationAction
              key={item.path}
              label={item.label}
              icon={item.icon}
            />
          ))}
        </BottomNavigation>
      </Paper>
    );
  }

  // ── Desktop — a tab bar in the tmux/htop status-line vein: each item is
  //    "[n] Label", the active one filled solid rather than underlined. ──
  return (
    <Stack
      direction="row"
      alignItems="stretch"
      sx={{ bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" }}
    >
      {navItems.map((item) => {
        const active = location.pathname.startsWith(item.path);
        return (
          <Box
            key={item.path}
            component="button"
            onClick={() => navigate(item.path)}
            sx={{
              font: "inherit",
              fontSize: "0.8125rem",
              fontWeight: active ? 700 : 500,
              letterSpacing: "0.02em",
              border: "none",
              borderRight: "1px solid",
              borderColor: "divider",
              cursor: "pointer",
              px: 1.75,
              py: 1.1,
              bgcolor: active ? "primary.main" : "transparent",
              color: active ? tui.bg : "text.secondary",
              "&:hover": { color: active ? tui.bg : "text.primary" },
            }}
          >
            <Box component="span" sx={{ opacity: active ? 0.75 : 0.55, mr: 0.75 }}>
              [{item.key}]
            </Box>
            {item.label}
          </Box>
        );
      })}
    </Stack>
  );
}