import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import StepCard from "./StepCard";
import { slotProblems } from "../slotEdits";
import { canRender, filesById, problemSummary, renderLine, ttlLine } from "../studioState";

function JobStatus({ job, retryDisabled, onRetry, onCheckAgain, onDownload, downloading }) {
  if (!job) return null;
  const retry = (
    <Button color="inherit" size="small" onClick={onRetry} disabled={retryDisabled}>
      Retry
    </Button>
  );

  return (
    <Stack spacing={1}>
      {job.status === "running" && (
        <Box>
          <Typography variant="body2">{renderLine(job)}</Typography>
          <LinearProgress variant="determinate" value={job.percent ?? 0} sx={{ mt: 0.5, height: 8 }} />
        </Box>
      )}
      {job.status === "queued" && (
        <Box>
          <Typography variant="body2">{renderLine(job)}</Typography>
          <LinearProgress sx={{ mt: 0.5, height: 8 }} />
        </Box>
      )}
      {job.status === "failed" && (
        <Alert severity="error" action={retry}>
          {renderLine(job)}
        </Alert>
      )}
      {job.status === "lost" && (
        <Alert severity="warning" action={retry}>
          {renderLine(job)}
        </Alert>
      )}
      {job.pollError && job.status !== "lost" && (
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" onClick={onCheckAgain}>
              Check again
            </Button>
          }
        >
          {job.pollError}
        </Alert>
      )}
      {job.status === "done" && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
          <Typography variant="body2" color="primary.main" fontWeight={700}>
            {renderLine(job)}
          </Typography>
          <Button
            variant="contained"
            onClick={onDownload}
            disabled={downloading}
            startIcon={downloading ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ width: { xs: "100%", sm: "auto" } }}
          >
            Download
          </Button>
        </Stack>
      )}
    </Stack>
  );
}

function ClearDialog({ open, onClose, onConfirm }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Clear files</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mt: 2 }}>
          Delete all uploaded files and renders?
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" color="error" onClick={onConfirm}>
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function RenderStep({ state, job, downloading, actions }) {
  const [confirming, setConfirming] = useState(false);
  const enabled = Boolean(state.draft || job);
  const problems = state.draft ? slotProblems(state.draft.editList, filesById(state)) : [];
  const summary = problemSummary(problems);
  const allowed = canRender(state, job);
  const { clearing } = state;

  const footer = (
    <Box sx={{ mt: 1.5, pt: 1, borderTop: "1px solid", borderColor: "divider" }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }} justifyContent="space-between">
        <Typography variant="caption" color="text.secondary">
          {ttlLine(state.limits)}
        </Typography>
        <Button
          variant="outlined"
          color="error"
          size="small"
          onClick={() => setConfirming(true)}
          disabled={clearing || state.phase !== "ready"}
          startIcon={clearing ? <CircularProgress size={14} color="inherit" /> : null}
        >
          Clear files
        </Button>
      </Stack>
    </Box>
  );

  return (
    <StepCard number="4" title="Render" disabled={!enabled} footer={footer}>
      <Stack spacing={1.5}>
        {!enabled && (
          <Typography variant="body2" color="text.secondary">
            Make a draft first.
          </Typography>
        )}
        {summary && <Alert severity="warning">{summary}</Alert>}

        <Box>
          <Button
            variant="contained"
            onClick={actions.render}
            disabled={!allowed}
            startIcon={state.rendering ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ width: { xs: "100%", sm: "auto" } }}
          >
            Render
          </Button>
        </Box>

        {state.renderError && <Alert severity="error">{state.renderError}</Alert>}

        <JobStatus
          job={job}
          retryDisabled={!allowed}
          onRetry={actions.render}
          onCheckAgain={actions.checkAgain}
          onDownload={actions.download}
          downloading={downloading || state.clearing}
        />
      </Stack>

      <ClearDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          actions.clearAll();
        }}
      />
    </StepCard>
  );
}
