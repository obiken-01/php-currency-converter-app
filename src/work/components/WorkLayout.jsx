// src/work/components/WorkLayout.jsx

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
import { clearTokens, getAccessToken } from "../api/workApi";
import authApi from "../api/authApi";

export default function WorkLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      navigate("/work/login", { replace: true });
      return;
    }

    authApi
      .me()
      .then(setUser)
      .catch(() => {
        clearTokens();
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
      <AppBar position="static" elevation={0} variant="outlined">
        <Toolbar>
          <Stack direction="row" alignItems="center" spacing={1} flexGrow={1}>
            <AccessTimeIcon fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>
              Work
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