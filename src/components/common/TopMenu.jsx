import { Stack, Button, Switch, BottomNavigation, BottomNavigationAction, Paper, IconButton } from "@mui/material";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTheme, useMediaQuery } from "@mui/material";
import CurrencyExchangeIcon from "@mui/icons-material/CurrencyExchange";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import TimerIcon from "@mui/icons-material/Timer";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";

const navItems = [
  { label: "Currency",    path: "/currency",    icon: <CurrencyExchangeIcon /> },
  { label: "Time",        path: "/time",         icon: <AccessTimeIcon /> },
  { label: "Shopping",    path: "/shopping",     icon: <ShoppingCartIcon /> },
  { label: "Work",        path: "/work",         icon: <TimerIcon /> },
];

export default function TopMenu({ darkMode, onToggleDarkMode }) {
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

  // ── Desktop — Top Navigation ─────────────────────────────────
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{ px: 2, py: 1, borderBottom: "1px solid", borderColor: "divider" }}
    >
      {navItems.map((item) => (
        <Button key={item.path} component={NavLink} to={item.path}>
          {item.label}
        </Button>
      ))}

      <Stack flexGrow={1} />

      <IconButton onClick={onToggleDarkMode} size="small">
        {darkMode ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
      </IconButton>
    </Stack>
  );
}