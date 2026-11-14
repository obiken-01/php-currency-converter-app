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
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import StepCard from "./StepCard";
import { formatTime, parseTime } from "../slotEdits";
import {
  DRAFT_NOT_KEPT,
  STALE_DRAFT,
  canMakeDraft,
  draftHeader,
  draftStale,
  inputsReady,
  problemText,
  slotRows,
  visualFiles,
  warningLines,
} from "../studioState";

/** Start time within a video. Applied when the field loses focus or on Enter. */
function FromField({ segment, file, onApply }) {
  const initial = formatTime(segment.source.inSec);
  const [text, setText] = useState(initial);
  const [error, setError] = useState(false);

  const apply = () => {
    if (text === initial) return;
    const sec = parseTime(text);
    if (sec === null) {
      setError(true);
      return;
    }
    setError(false);
    onApply(file, sec);
  };

  return (
    <TextField
      size="small"
      label="From"
      value={text}
      error={error}
      helperText={error ? "Use m:ss." : undefined}
      onChange={(event) => setText(event.target.value)}
      onBlur={apply}
      onKeyDown={(event) => {
        if (event.key === "Enter") apply();
      }}
      sx={{ width: { xs: "100%", sm: 110 } }}
    />
  );
}

function SlotRow({ item, preview, clips, byId, canSkip, actions }) {
  const { segment, index } = item;
  const currentId = segment.type === "empty" ? "" : segment.source.fileId;
  const current = byId[currentId];

  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, borderColor: item.problem ? "warning.main" : undefined }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
        <Stack direction="row" spacing={1.5} alignItems="baseline" sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
            {item.number}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
            {item.range}
          </Typography>
          <Typography variant="body2" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
            {item.label}
          </Typography>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} sx={{ flexShrink: 0 }}>
          {!preview && (
            <TextField
              select
              size="small"
              label="Pick clip"
              value={current ? currentId : ""}
              onChange={(event) => {
                const file = byId[event.target.value];
                if (file) actions.fillSlot(index, file, 0);
              }}
              sx={{ width: { xs: "100%", sm: 200 } }}
            >
              {clips.map((f) => (
                <MenuItem key={f.fileId} value={f.fileId}>
                  {f.filename}
                </MenuItem>
              ))}
            </TextField>
          )}
          {!preview && segment.type === "video" && current && (
            <FromField
              key={`${currentId}:${segment.source.inSec}`}
              segment={segment}
              file={current}
              onApply={(file, sec) => actions.fillSlot(index, file, sec)}
            />
          )}
          <Button size="small" color="inherit" disabled={!canSkip} onClick={() => actions.skipSlot(index)}>
            Skip
          </Button>
        </Stack>
      </Stack>
      {item.problem && (
        <Typography variant="caption" color="warning.main" component="div" sx={{ mt: 0.5 }}>
          {problemText(item.problem)}
        </Typography>
      )}
    </Paper>
  );
}

function SaveTemplateDialog({ open, onClose, onSave }) {
  const [name, setName] = useState("");
  const close = () => {
    setName("");
    onClose();
  };
  const save = () => {
    if (onSave(name.trim())) close();
  };
  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="xs">
      <DialogTitle>Save as template</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && name.trim()) save();
          }}
          sx={{ mt: 2 }}
        />
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
          The cut timing is kept on this device. The clips are not.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={close} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" onClick={save} disabled={!name.trim()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function DraftStep({ state, templates, actions }) {
  const [saving, setSaving] = useState(false);
  const rows = slotRows(state);
  const clips = visualFiles(state);
  const byId = Object.fromEntries(clips.map((f) => [f.fileId, f]));
  const reshuffling = state.drafting === "reshuffle";
  const filling = state.drafting === "autofill";
  const enabled = Boolean(rows) || inputsReady(state);
  const template = templates.find((t) => t.id === state.options.templateId);

  let action = null;
  if (rows && !rows.preview) {
    action = (
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button
          variant="outlined"
          size="small"
          onClick={actions.reshuffle}
          disabled={!canMakeDraft(state)}
          startIcon={reshuffling ? <CircularProgress size={14} color="inherit" /> : null}
        >
          {reshuffling ? "Reshuffling" : "Reshuffle"}
        </Button>
        <Button variant="outlined" size="small" onClick={() => setSaving(true)} disabled={state.drafting !== null}>
          Save as template
        </Button>
      </Stack>
    );
  } else if (rows && rows.preview) {
    action = (
      <Button
        variant="outlined"
        size="small"
        onClick={actions.autofill}
        disabled={!canMakeDraft(state)}
        startIcon={filling ? <CircularProgress size={14} color="inherit" /> : null}
      >
        {filling ? "Filling" : "Auto-fill"}
      </Button>
    );
  }

  return (
    <StepCard number="3" title="Draft" disabled={!enabled} action={action}>
      {!rows ? (
        <Typography variant="body2" color="text.secondary">
          {state.restored ? DRAFT_NOT_KEPT : "No draft yet."}
        </Typography>
      ) : (
        <Stack spacing={1}>
          <Typography variant="body2" fontWeight={700}>
            {rows.preview && template ? `${template.name}: ` : ""}
            {draftHeader(rows.editList)}
          </Typography>
          {rows.preview && (
            <Typography variant="caption" color="text.secondary">
              Auto-fill picks clips for these slots. Skip a slot to give its time to the one before.
            </Typography>
          )}
          {(reshuffling || filling) && (
            <Typography variant="caption" color="text.secondary">
              Working. The first draft after a while can take a minute.
            </Typography>
          )}
          {!rows.preview && draftStale(state) && <Alert severity="info">{STALE_DRAFT}</Alert>}
          {state.draftError && (state.draftErrorFrom === "reshuffle" || state.draftErrorFrom === "autofill") && <Alert severity="error">{state.draftError}</Alert>}
          {!rows.preview &&
            warningLines(state.draft.warnings).map((line) => (
              <Alert key={line} severity="warning">
                {line}
              </Alert>
            ))}
          <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1 }}>
            {rows.items.map((item) => (
              <Box component="li" key={item.index} sx={{ minWidth: 0 }}>
                <SlotRow
                  item={item}
                  preview={rows.preview}
                  clips={clips}
                  byId={byId}
                  canSkip={rows.items.length > 1}
                  actions={actions}
                />
              </Box>
            ))}
          </Box>
        </Stack>
      )}
      <SaveTemplateDialog open={saving} onClose={() => setSaving(false)} onSave={actions.saveAsTemplate} />
    </StepCard>
  );
}
