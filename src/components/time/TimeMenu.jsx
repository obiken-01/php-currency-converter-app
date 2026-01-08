import { Stack, Button } from "@mui/material";

export default function TimeMenu({ onReset }) {
  return (
    <Stack
      direction="row"
      justifyContent="flex-end"
      sx={{ px: 2, py: 1 }}
    >
      <Button size="small" onClick={onReset}>
        Reset to Now (PH)
      </Button>
    </Stack>
  );
}
