import { Stack, Button, Typography } from "@mui/material";

export default function TimeMenu({ onReset }) {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      sx={{ px: 2, py: 1 }}
    >
      <Typography variant="h6" fontWeight={600}>
        Currency Converter
      </Typography>
      <Button size="small" onClick={onReset}>
        Reset to Now (PH)
      </Button>
    </Stack>
  );
}
