// src/timekeeping/TimekeepingLayout.jsx (ADD)

import { useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  CircularProgress,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import LogoutIcon from "@mui/icons-material/Logout";
import tkApi, { clearTokens, getAccessToken } from "./api/timekeepingApi";

export default function TimekeepingLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      navigate("/timekeeping/login", { replace: true });
      return;
    }

    tkApi
      .get("/auth/me")
      .then((res) => setUser(res.data.data))
      .catch(() => {
        clearTokens();
        navigate("/timekeeping/login", { replace: true });
      })
      .finally(() => setChecking(false));
  }, [navigate]);

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem("tk_refresh_token");
      if (refreshToken) {
        await tkApi.post("/auth/revoke", { refreshToken });
      }
    } catch {
      // ignore revoke errors
    } finally {
      clearTokens();
      navigate("/timekeeping/login", { replace: true });
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
      <AppBar position="static" elevation={0} variant="outlined">
        <Toolbar>
          <Stack direction="row" alignItems="center" spacing={1} flexGrow={1}>
            <AccessTimeIcon fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>
              Timekeeping
            </Typography>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={2}>
            {user && (
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
              Logout
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Page content */}
      <Box sx={{ maxWidth: 900, mx: "auto", p: { xs: 2, sm: 3 } }}>
        <Outlet />
      </Box>

    </Box>
  );
}