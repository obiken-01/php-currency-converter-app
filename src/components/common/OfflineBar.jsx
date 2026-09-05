import { Box, Stack, Typography } from "@mui/material";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import useOnlineStatus from "../../hooks/useOnlineStatus";

/**
 * A thin persistent strip, not a toast: being offline is a state you stay in,
 * and a dismissible message would hide the one fact that explains why the
 * app is behaving differently.
 */
export default function OfflineBar() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <Box
      role="status"
      sx={{
        py: 0.5,
        px: 2,
        bgcolor: "warning.main",
        color: "warning.contrastText",
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
        <CloudOffIcon sx={{ fontSize: 16 }} />
        <Typography variant="caption" fontWeight={600}>
          Offline — showing saved data
        </Typography>
      </Stack>
    </Box>
  );
}
