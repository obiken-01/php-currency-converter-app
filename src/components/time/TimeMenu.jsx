import { Stack, Button, Typography } from "@mui/material";

export default function TimeMenu({ onReset }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{ px: { xs: 2, sm: 3 }, py: 1.25 }}
    >
      <Typography
        variant="overline"
        color="primary.main"
        fontWeight={700}
        sx={{ letterSpacing: "0.08em" }}
      >
        Time Zones
      </Typography>
      <Button size="small" variant="outlined" onClick={onReset}>
        Reset
      </Button>
    </Stack>
  );
}
