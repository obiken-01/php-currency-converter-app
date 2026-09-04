import { useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { TOKEN_SCOPES, EXPIRY_OPTIONS } from "../../constants/tokens";
import { useCreateToken } from "../../hooks/useTokens";

/**
 * @param {boolean}  open
 * @param {function} onClose
 * @param {function} onCreated  (rawToken, name) => void -- triggers the reveal
 */
export default function TokenFormDialog({ open, onClose, onCreated }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const create = useCreateToken();

  const [name, setName] = useState("");
  const [scopes, setScopes] = useState(["tasks:read"]);
  const [expiresInDays, setExpiresInDays] = useState(90);
  const [error, setError] = useState(null);

  const reset = () => {
    setName("");
    setScopes(["tasks:read"]);
    setExpiresInDays(90);
    setError(null);
  };

  const toggleScope = (value) =>
    setScopes((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Give the token a name so you can tell them apart later.");
      return;
    }
    if (scopes.length === 0) {
      setError("Pick at least one scope.");
      return;
    }

    try {
      const created = await create.mutateAsync({
        name: name.trim(),
        scopes,
        expiresInDays: expiresInDays || null,
      });
      const raw = created?.token ?? created?.rawToken ?? created?.value;
      onCreated(raw, name.trim());
      reset();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message ?? "Could not create the token.");
    }
  };

  const handleClose = () => {
    if (create.isPending) return;
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>New access token</DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

          <TextField
            label="Name"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Claude Desktop"
            size="small"
            fullWidth
          />

          <FormControl>
            <FormLabel sx={{ fontSize: 13, mb: 0.5 }}>Scopes</FormLabel>
            <FormGroup>
              {TOKEN_SCOPES.map((scope) => (
                <FormControlLabel
                  key={scope.value}
                  control={
                    <Checkbox
                      size="small"
                      checked={scopes.includes(scope.value)}
                      onChange={() => toggleScope(scope.value)}
                    />
                  }
                  label={
                    <Stack>
                      <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                        {scope.value}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {scope.description}
                      </Typography>
                    </Stack>
                  }
                  sx={{ alignItems: "flex-start", mb: 1 }}
                />
              ))}
            </FormGroup>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel>Expires</InputLabel>
            <Select
              label="Expires"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
            >
              {EXPIRY_OPTIONS.map((option) => (
                <MenuItem key={option.label} value={option.days ?? 0}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={create.isPending}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={create.isPending}
          startIcon={create.isPending ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {create.isPending ? "Creating..." : "Create token"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
