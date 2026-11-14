import { Box, Stack, Typography } from "@mui/material";
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
  const { allowed, isLoading } = useStudioSession();

  if (isLoading) return null;

  if (!allowed) {
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
