import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import StepCard from "./StepCard";
import { canPick, formatSize, restartLabel, rowStatusText, usageLine } from "../studioState";

const ACCEPT = "video/mp4,video/quicktime,image/*,audio/*,.heic,.heif,.m4a";

function MusicLine({ analysis }) {
  if (!analysis) return null;
  if (analysis.status === "working") {
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <CircularProgress size={12} color="inherit" />
        <Typography variant="caption" color="text.secondary">
          Finding the beat. The first time can take a minute.
        </Typography>
      </Stack>
    );
  }
  if (analysis.status === "error") {
    return (
      <Typography variant="caption" color="error.main">
        {analysis.error}
      </Typography>
    );
  }
  return (
    <Typography variant="caption" color="primary.main" fontWeight={700}>
      ♪ {Math.round(analysis.tempo)} BPM
    </Typography>
  );
}

function FileRow({ row, analysis, locked, actions }) {
  const showBar = row.status === "uploading" || row.status === "paused" || row.status === "interrupted";
  const restart = restartLabel(row);
  const cancellable = ["waiting", "uploading", "paused", "interrupted"].includes(row.status);
  const isMusic = row.kind === "audio" && row.status === "done" && analysis?.fileId === row.meta?.fileId;

  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, borderColor: row.status === "error" ? "error.main" : undefined }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="baseline" sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap sx={{ minWidth: 0 }} title={row.name}>
              {row.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
              {formatSize(row.size)}
            </Typography>
          </Stack>
          <Typography
            variant="caption"
            component="div"
            color={row.status === "error" ? "error.main" : row.status === "done" ? "primary.main" : "text.secondary"}
            sx={{ overflowWrap: "anywhere" }}
          >
            {rowStatusText(row)}
          </Typography>
          {showBar && (
            <LinearProgress
              variant={row.status === "uploading" && row.progress >= 0.99 ? "indeterminate" : "determinate"}
              value={Math.round((row.progress || 0) * 100)}
              sx={{ mt: 0.75, height: 6 }}
            />
          )}
          {isMusic && <MusicLine analysis={analysis} />}
        </Box>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ flexShrink: 0 }}>
          {row.status === "paused" && (
            <Button size="small" onClick={() => actions.resumeRow(row)} disabled={row.busy || locked}>
              Resume
            </Button>
          )}
          {restart && (
            <Button size="small" onClick={() => actions.restartRow(row)} disabled={row.busy || locked}>
              {restart}
            </Button>
          )}
          {cancellable && (
            <Button size="small" color="inherit" onClick={() => actions.removeRow(row)} disabled={row.busy || locked}>
              Cancel
            </Button>
          )}
          {(row.status === "done" || row.status === "error") && (
            <Button size="small" color="error" onClick={() => actions.removeRow(row)} disabled={row.busy || locked}>
              Remove
            </Button>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}

export default function UploadStep({ state, actions }) {
  const [over, setOver] = useState(false);
  const ready = canPick(state);
  const usage = usageLine(state);

  const onDrop = (event) => {
    event.preventDefault();
    setOver(false);
    if (ready) actions.pickFiles(event.dataTransfer?.files);
  };

  return (
    <StepCard number="1" title="Upload">
      <Stack spacing={1.5}>
        <Box
          onDragOver={(event) => {
            event.preventDefault();
            if (ready) setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          sx={{
            p: 2,
            border: "1px dashed",
            borderColor: over ? "primary.main" : "divider",
            borderRadius: 1,
            bgcolor: over ? "action.hover" : "transparent",
          }}
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "flex-start", sm: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Drop files here or
            </Typography>
            <Button variant="outlined" size="small" component="label" disabled={!ready} startIcon={<UploadFileIcon fontSize="small" />}>
              Choose files
              <input
                hidden
                type="file"
                multiple
                accept={ACCEPT}
                onChange={(event) => {
                  actions.pickFiles(event.target.files);
                  // Let the same file be picked again (for example to resume it).
                  event.target.value = "";
                }}
              />
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
            Clips (mp4, mov), photos (jpg, png, heic) and one song (mp3, m4a, wav).
          </Typography>
        </Box>

        {state.phase === "loading" && (
          <Box>
            <LinearProgress />
            <Typography variant="caption" color="text.secondary">
              Loading your files.
            </Typography>
          </Box>
        )}

        {state.phase === "error" && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => window.location.reload()}>
                Try again
              </Button>
            }
          >
            {state.loadError}
          </Alert>
        )}

        {state.notices.length > 0 && (
          <Alert severity="warning" onClose={actions.dismissNotices}>
            {state.notices.map((line, i) => (
              // Two rejected files can share a name, so the index is the key.
              <Box key={i}>{line}</Box>
            ))}
          </Alert>
        )}

        {state.files.map((row) => (
          <FileRow key={row.localId} row={row} analysis={state.analysis} locked={state.clearing} actions={actions} />
        ))}

        {state.phase === "ready" && state.files.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No files yet. Add a few clips or photos and one song.
          </Typography>
        )}

        {usage && (
          <Typography variant="caption" color="text.secondary">
            {usage}
          </Typography>
        )}
      </Stack>
    </StepCard>
  );
}
