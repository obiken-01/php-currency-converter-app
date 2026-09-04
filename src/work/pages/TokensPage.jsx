import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import KeyOffIcon from "@mui/icons-material/KeyOff";
import TokenFormDialog from "../components/tokens/TokenFormDialog";
import TokenRevealDialog from "../components/tokens/TokenRevealDialog";
import { useRevokeToken, useTokens } from "../hooks/useTokens";
import { useToast } from "../context/toastContext";
import { formatDateTime, formatShortDate, isOverdue } from "../utils/dates";

const API_BASE =
  import.meta.env.VITE_API_URL ??
  "https://ralph-portfolio-production.up.railway.app/api";

const MCP_URL = `${API_BASE}/work/mcp`;

const MCP_JSON = `{
  "mcpServers": {
    "work": {
      "type": "http",
      "url": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}`;

function CodeBlock({ children }) {
  const toast = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      toast.success("Copied.");
    } catch {
      toast.error("Could not copy — select the text instead.");
    }
  };

  return (
    <Box sx={{ position: "relative" }}>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1.5,
          pr: 5,
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "action.hover",
          fontSize: 12,
          overflowX: "auto",
        }}
      >
        {children}
      </Box>
      <Tooltip title="Copy">
        <IconButton
          size="small"
          onClick={copy}
          sx={{ position: "absolute", top: 6, right: 6 }}
        >
          <ContentCopyIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

function SetupPanel() {
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          Claude Desktop — custom connector
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Settings → Connectors → Add custom connector. Use the URL below and
          paste the token when prompted for authentication.
        </Typography>
        <CodeBlock>{MCP_URL}</CodeBlock>
      </Box>

      <Box>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          Claude Code — .mcp.json
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Drop this in your project root (or merge it into an existing
          <Box component="code" sx={{ mx: 0.5 }}>.mcp.json</Box>) and replace the
          placeholder with a token created above.
        </Typography>
        <CodeBlock>{MCP_JSON}</CodeBlock>
      </Box>

      <Alert severity="info">
        A token grants exactly the scopes you picked, nothing more. Create a
        separate one per client so you can revoke them independently.
      </Alert>
    </Stack>
  );
}

function TokenRow({ token, onRevoke, revoking }) {
  const expired = token.expiresAt ? isOverdue(token.expiresAt) : false;
  const revoked = Boolean(token.revokedAt);
  const inactive = expired || revoked;

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, borderRadius: 1.5, opacity: inactive ? 0.6 : 1 }}
    >
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" gap={0.5}>
            <Typography variant="subtitle2" fontWeight={700}>
              {token.name}
            </Typography>
            {revoked && <Chip size="small" color="error" variant="outlined" label="Revoked" />}
            {!revoked && expired && (
              <Chip size="small" color="warning" variant="outlined" label="Expired" />
            )}
          </Stack>

          <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.75 }}>
            {(token.scopes ?? []).map((scope) => (
              <Chip
                key={scope}
                size="small"
                label={scope}
                sx={{ height: 20, fontFamily: "monospace", fontSize: 11 }}
              />
            ))}
          </Stack>

          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
            {token.tokenPrefix ? `${token.tokenPrefix}… · ` : ""}
            Created {formatShortDate(token.createdAt)}
            {token.expiresAt ? ` · Expires ${formatShortDate(token.expiresAt)}` : " · No expiry"}
            {token.lastUsedAt
              ? ` · Last used ${formatDateTime(token.lastUsedAt)}`
              : " · Never used"}
          </Typography>
        </Box>

        {!revoked && (
          <Button
            size="small"
            color="error"
            startIcon={<DeleteOutlineIcon fontSize="small" />}
            disabled={revoking}
            onClick={() => onRevoke(token)}
          >
            Revoke
          </Button>
        )}
      </Stack>
    </Paper>
  );
}

export default function TokensPage() {
  const toast = useToast();
  const { data, isPending, isError, error } = useTokens();
  const revoke = useRevokeToken();

  const [tab, setTab] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [reveal, setReveal] = useState(null);   // { token, name }

  const tokens = data?.items ?? data ?? [];

  const handleRevoke = async (token) => {
    if (!window.confirm(`Revoke "${token.name}"? Anything using it stops working immediately.`)) {
      return;
    }
    try {
      await revoke.mutateAsync(token.publicId);
      toast.success("Token revoked.");
    } catch {
      toast.error("Could not revoke the token.");
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700} flexGrow={1}>
          Access tokens
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setFormOpen(true)}
        >
          New token
        </Button>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_, next) => setTab(next)}
        sx={{
          borderBottom: "1px solid",
          borderColor: "divider",
          mb: 2,
          "& .MuiTab-root": { textTransform: "none" },
        }}
      >
        <Tab label="Tokens" />
        <Tab label="Setup" />
      </Tabs>

      {tab === 1 ? (
        <SetupPanel />
      ) : isPending ? (
        <Stack spacing={1}>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} variant="rounded" height={96} />
          ))}
        </Stack>
      ) : isError ? (
        <Alert severity="error">
          {error?.response?.data?.message ?? "Failed to load tokens."}
        </Alert>
      ) : tokens.length === 0 ? (
        <Stack alignItems="center" spacing={1} sx={{ py: 8, color: "text.secondary" }}>
          <KeyOffIcon sx={{ fontSize: 40, opacity: 0.4 }} />
          <Typography variant="body2">No tokens yet.</Typography>
          <Typography variant="caption">
            Create one to connect Claude Desktop or Claude Code to this module.
          </Typography>
        </Stack>
      ) : (
        <Stack spacing={1}>
          {tokens.map((token) => (
            <TokenRow
              key={token.publicId}
              token={token}
              onRevoke={handleRevoke}
              revoking={revoke.isPending}
            />
          ))}
        </Stack>
      )}

      <TokenFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={(token, name) => setReveal({ token, name })}
      />

      <TokenRevealDialog
        token={reveal?.token ?? null}
        name={reveal?.name ?? ""}
        onClose={() => setReveal(null)}
      />
    </Box>
  );
}
