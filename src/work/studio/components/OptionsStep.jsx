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
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import StepCard from "./StepCard";
import { ASPECTS, AUDIO_MODES, LENGTHS, PACES, canMakeDraft, inputsReady } from "../studioState";

function Choice({ label, value, values, onChange, disabled }) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.5, sm: 2 }} alignItems={{ sm: "center" }}>
      <Typography variant="caption" color="text.secondary" sx={{ width: { sm: 72 }, flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </Typography>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(_, next) => {
          if (next !== null) onChange(next);
        }}
        sx={{ flexWrap: "wrap" }}
      >
        {values.map((v) => (
          <ToggleButton key={String(v)} value={v} sx={{ px: 1.5 }}>
            {String(v)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Stack>
  );
}

function DeleteTemplateDialog({ open, onClose, onConfirm }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Delete template</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mt: 2 }}>
          Delete this template?
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

export default function OptionsStep({ state, templates, actions }) {
  const [confirming, setConfirming] = useState(false);
  const enabled = inputsReady(state);
  const { options } = state;
  const working = state.drafting === "draft";

  return (
    <StepCard number="2" title="Options" disabled={!enabled}>
      <Stack spacing={1.5}>
        {!enabled && (
          <Typography variant="body2" color="text.secondary">
            Upload at least one clip or photo and a song first.
          </Typography>
        )}
        <Choice label="Aspect" value={options.aspect} values={ASPECTS} disabled={!enabled} onChange={(v) => actions.setOption("aspect", v)} />
        <Choice label="Pace" value={options.pace} values={PACES} disabled={!enabled} onChange={(v) => actions.setOption("pace", v)} />
        <Choice label="Length" value={options.length} values={LENGTHS} disabled={!enabled} onChange={(v) => actions.setOption("length", v)} />
        <Choice label="Audio" value={options.audioMode} values={AUDIO_MODES} disabled={!enabled} onChange={(v) => actions.setOption("audioMode", v)} />

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Start at"
            size="small"
            placeholder="0:12"
            value={state.startText}
            disabled={!enabled}
            onChange={(event) => actions.setStart(event.target.value)}
            error={state.startError}
            helperText={state.startError ? "Use m:ss, for example 0:12." : "Optional. Where in the song to start."}
            sx={{ width: { xs: "100%", sm: 200 } }}
          />
          <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ minWidth: 0 }}>
            <TextField
              select
              label="Template"
              size="small"
              value={options.templateId ?? ""}
              disabled={!enabled}
              onChange={(event) => actions.chooseTemplate(event.target.value || null)}
              sx={{ width: { xs: "100%", sm: 240 }, minWidth: 0 }}
            >
              <MenuItem value="">none</MenuItem>
              {templates.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </TextField>
            {options.templateId && (
              <Button
                size="small"
                color="error"
                onClick={() => setConfirming(true)}
                disabled={!enabled}
                sx={{ flexShrink: 0, mt: 0.5 }}
              >
                Delete
              </Button>
            )}
          </Stack>
        </Stack>

        <DeleteTemplateDialog
          open={confirming}
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            if (options.templateId) actions.removeTemplate(options.templateId);
          }}
        />

        <Box>
          <Button
            variant="contained"
            disabled={!canMakeDraft(state)}
            onClick={actions.makeDraft}
            startIcon={working ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ width: { xs: "100%", sm: "auto" } }}
          >
            {working ? "Making draft" : "Make draft"}
          </Button>
          {working && (
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
              Working. The first draft after a while can take a minute.
            </Typography>
          )}
        </Box>

        {state.draftError && state.draftErrorFrom === "draft" && <Alert severity="error">{state.draftError}</Alert>}
      </Stack>
    </StepCard>
  );
}
