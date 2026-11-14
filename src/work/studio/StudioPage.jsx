import { Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { useStudioSession } from "./useStudioSession";
import { useStudio } from "./useStudio";
import UploadStep from "./components/UploadStep";
import OptionsStep from "./components/OptionsStep";
import DraftStep from "./components/DraftStep";
import RenderStep from "./components/RenderStep";

/** The four steps. Mounted only for an allowed user, so nothing loads otherwise. */
function Studio() {
  const { state, job, templates, downloading, actions } = useStudio();

  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="overline" color="primary.main" fontWeight={700} component="h1" sx={{ letterSpacing: "0.08em", display: "block", mb: 2 }}>
        Studio
      </Typography>
      <Stack spacing={2}>
        <UploadStep state={state} actions={actions} />
        <OptionsStep state={state} templates={templates} actions={actions} />
        <DraftStep state={state} templates={templates} actions={actions} />
        <RenderStep state={state} job={job} downloading={downloading} actions={actions} />
      </Stack>
    </Box>
  );
}

export default function StudioPage() {
  const { status, isFetching, retry } = useStudioSession();

  if (status === "loading") return null;

  if (status === "unreachable") {
    return (
      <Box sx={{ p: 2 }}>
        <Stack spacing={1.5} alignItems="flex-start">
          <Typography variant="body2" color="text.secondary">
            Can't reach Studio. Check your connection.
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={retry}
            disabled={isFetching}
            startIcon={isFetching ? <CircularProgress size={14} color="inherit" /> : null}
          >
            Try again
          </Button>
        </Stack>
      </Box>
    );
  }

  if (status !== "allowed") {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Studio is private.
        </Typography>
      </Box>
    );
  }

  return <Studio />;
}
