import { Box, Typography } from "@mui/material";
import { useStudioSession } from "./useStudioSession";

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

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        Studio
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Steps go here.
      </Typography>
    </Box>
  );
}
