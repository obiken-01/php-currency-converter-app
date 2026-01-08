import { Card, CardContent, Typography, Slider } from "@mui/material";
import { formatTime } from "./timeUtils";

export default function TimeCard({ label, minutes, onChange }) {
  return (
    <Card sx={{ mx: 2, my: 1 }}>
      <CardContent>
        <Typography fontWeight={600}>{label}</Typography>
        <Typography variant="h5">{formatTime(minutes)}</Typography>

        <Slider
          value={minutes}
          min={0}
          max={1439}
          step={30}
          onChange={(_, v) => onChange(v)}
        />
      </CardContent>
    </Card>
  );
}
