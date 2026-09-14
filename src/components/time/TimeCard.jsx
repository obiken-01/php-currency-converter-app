import { Card, CardContent, Typography, Slider, Stack } from "@mui/material";
import { formatTime } from "./timeUtils";

export default function TimeCard({ label, minutes, onChange, isBase = false }) {
  return (
    <Card
      elevation={0}
      sx={{
        mx: { xs: 2, sm: 3 },
        my: 1.25,
        borderColor: isBase ? "primary.main" : "divider"
      }}
    >
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={1}>
          <Typography
            variant="caption"
            color={isBase ? "primary.main" : "text.secondary"}
            fontWeight={700}
            sx={{ letterSpacing: "0.04em", textTransform: "uppercase" }}
          >
            {label}{isBase ? " · base" : ""}
          </Typography>
        </Stack>

        <Typography
          fontWeight={700}
          sx={{
            fontSize: isBase ? { xs: 32, sm: 36 } : { xs: 24, sm: 26 },
            lineHeight: 1.3,
            color: isBase ? "text.primary" : "primary.main"
          }}
        >
          {formatTime(minutes)}
        </Typography>

        <Slider
          value={minutes}
          min={0}
          max={1439}
          step={30}
          onChange={(_, v) => onChange(v)}
          sx={{ mt: 0.5 }}
        />
      </CardContent>
    </Card>
  );
}
