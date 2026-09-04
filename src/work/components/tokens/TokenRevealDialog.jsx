import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";

/**
 * The raw token comes back exactly once. This dialog deliberately has no
 * backdrop or Escape dismissal and no close icon — the only way out is the
 * acknowledge button, so a token cannot be wasted by clicking away.
 *
 * @param {string|null} token  null = closed
 * @param {string}      name
 * @param {function}    onClose
 */
export default function TokenRevealDialog({ token, name, onClose }) {
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setAcknowledged(true);
    } catch {
      // Clipboard can be blocked; selecting the text by hand still works.
      setCopied(false);
      setAcknowledged(true);
    }
  };

  const handleClose = () => {
    setCopied(false);
    setAcknowledged(false);
    onClose();
  };

  return (
    <Dialog
      open={Boolean(token)}
      disableEscapeKeyDown
      onClose={(_e, reason) => {
        if (reason === "backdropClick") return;
        handleClose();
      }}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle sx={{ fontWeight: 700 }}>
        Copy your token now
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="warning">
            This is the only time <strong>{name}</strong> will be shown. Once
            you close this dialog it cannot be retrieved — you would have to
            revoke it and create another.
          </Alert>

          <Box
            sx={{
              p: 1.5,
              borderRadius: 1,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "action.hover",
              fontFamily: "monospace",
              fontSize: 13,
              wordBreak: "break-all",
              userSelect: "all",
            }}
          >
            {token}
          </Box>

          <Stack direction="row" alignItems="center" spacing={1}>
            <Button
              variant="contained"
              startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
              onClick={copy}
            >
              {copied ? "Copied" : "Copy token"}
            </Button>
            <Tooltip title="Copy to clipboard">
              <IconButton onClick={copy} size="small">
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Box flexGrow={1} />
            {!acknowledged && (
              <Typography variant="caption" color="text.secondary">
                Copy it before closing
              </Typography>
            )}
          </Stack>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          variant={acknowledged ? "contained" : "outlined"}
          onClick={handleClose}
          disabled={!acknowledged}
        >
          I have saved it
        </Button>
      </DialogActions>
    </Dialog>
  );
}
