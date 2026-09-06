// src/work/components/WorkLayout.jsx

import { useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import SyncIcon from "@mui/icons-material/Sync";
import LogoutIcon from "@mui/icons-material/Logout";
import TimerIcon from "@mui/icons-material/Timer";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import { clearTokens, getAccessToken } from "../api/workApi";
import { isAuthRejection } from "../offline/policy";
import { cachedUser, rememberUser, forgetUser } from "../offline/session";
import useOutbox from "../hooks/useOutbox";
import authApi from "../api/authApi";
import WorkSubNav from "./WorkSubNav";
import WorkBottomNav from "./WorkBottomNav";

/**
 * Guards everything nested under /work. The module keeps its own AppBar
 * rather than the site TopMenu — WorkSubNav slots underneath it.
 */
export default function WorkLayout() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  // Seeded from the last successful check so an offline start has a name to
  // show and nothing flashes through a signed-out state.
  const [user, setUser] = useState(cachedUser);
  const [checking, setChecking] = useState(true);
  const outbox = useOutbox();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      navigate("/work/login", { replace: true });
      return;
    }

    authApi
      .me()
      .then((me) => {
        setUser(me);
        rememberUser(me);
      })
      .catch((error) => {
        // Only the server may end a session. A request that never reached it
        // says nothing about whether the token is good, and clearing it there
        // meant every lost signal became a forced login -- with the queued
        // work still sitting in the outbox, now unsendable.
        if (!isAuthRejection(error)) return;

        clearTokens();
        forgetUser();
        navigate("/work/login", { replace: true });
      })
      .finally(() => setChecking(false));
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await authApi.revoke();
    } catch {
      // ignore revoke errors
    } finally {
      clearTokens();
      forgetUser();
      navigate("/work/login", { replace: true });
    }
  };

  if (checking) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh" }}>

      {/* Top bar */}
      <AppBar position="static" elevation={0} variant="outlined" color="inherit">
        <Toolbar variant="dense">
          {/* Mobile swaps the site bottom nav for the module one, so this is
              the only way back out to the other tools. */}
          <Tooltip title="Back to tools">
            <IconButton
              edge="start"
              size="small"
              onClick={() => navigate("/currency")}
              sx={{ mr: 1 }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            flexGrow={1}
            sx={{ cursor: "pointer" }}
            onClick={() => navigate("/work")}
          >
            <TimerIcon fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>
              Work
            </Typography>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1}>
            {outbox.count > 0 && (
              <Tooltip
                title={
                  outbox.syncing
                    ? "Sending your offline changes"
                    : "Saved on this device, waiting for a connection"
                }
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={0.5}
                  onClick={outbox.sync}
                  sx={{ cursor: "pointer", color: "warning.main" }}
                >
                  {outbox.syncing
                    ? <SyncIcon fontSize="small" />
                    : <CloudOffIcon fontSize="small" />}
                  <Typography variant="caption" fontWeight={700}>
                    {outbox.count}
                  </Typography>
                </Stack>
              </Tooltip>
            )}

            <Tooltip title="Access tokens">
              <IconButton size="small" onClick={() => navigate("/work/tokens")}>
                <VpnKeyIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {user && !isMobile && (
              <Typography variant="body2" color="text.secondary">
                {user.username}
              </Typography>
            )}

            <Button
              size="small"
              color="inherit"
              startIcon={<LogoutIcon fontSize="small" />}
              onClick={handleLogout}
            >
              {isMobile ? "" : "Logout"}
            </Button>
          </Stack>
        </Toolbar>

        {!isMobile && <WorkSubNav />}
      </AppBar>

      {/* Page content */}
      <Box
        sx={{
          maxWidth: 1400,
          mx: "auto",
          p: { xs: 2, sm: 3 },
          pb: isMobile ? 9 : 3,
        }}
      >
        <Outlet />
      </Box>

      {isMobile && <WorkBottomNav />}
    </Box>
  );
}
