import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import tkApi, { saveTokens } from "./api/timekeepingApi";

export default function TimekeepingLoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await tkApi.post("/auth/login", form);
      const { accessToken, refreshToken } = res.data.data;
      saveTokens(accessToken, refreshToken);
      navigate("/timekeeping");
    } catch (err) {
      setError(
        err.response?.data?.message ?? "Invalid email or password"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 400 }}>

        {/* Header */}
        <Stack alignItems="center" spacing={1} sx={{ mb: 4 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: "primary.main",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AccessTimeIcon sx={{ color: "white" }} />
          </Box>
          <Typography variant="h6" fontWeight={700}>
            Timekeeping
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Sign in to your account
          </Typography>
        </Stack>

        {/* Card */}
        <Card elevation={0} variant="outlined">
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={2.5} component="form" onSubmit={handleSubmit}>

              {error && (
                <Alert severity="error" onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}

              <TextField
                label="Email"
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
                required
                fullWidth
                size="small"
              />

              <TextField
                label="Password"
                type="password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                required
                fullWidth
                size="small"
              />

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={loading}
                startIcon={loading
                  ? <CircularProgress size={16} color="inherit" />
                  : null}
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>

            </Stack>
          </CardContent>
        </Card>

      </Box>
    </Box>
  );
}