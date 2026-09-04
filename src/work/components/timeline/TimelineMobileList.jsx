import { Box, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import StatusChip from "../common/StatusChip";
import DateRangeChip from "../common/DateRangeChip";
import { getStatus } from "../../constants/statuses";
import { parseDateOnly } from "../../utils/dates";
import { datedItems, undatedItems } from "../../utils/gantt";

const monthKey = (date) =>
  date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` : "undated";

const monthLabel = (date) =>
  date
    ? date.toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : "No dates";

/**
 * A Gantt does not work on a phone. Same data, different shape: a vertical
 * list grouped by month — not a scaled-down chart.
 *
 * @param {object}   timeline     ProjectTimelineDto
 * @param {function} onItemClick  (publicId) => void
 */
export default function TimelineMobileList({ timeline, onItemClick }) {
  const items = timeline?.items ?? [];
  const dated = datedItems(items);
  const undated = undatedItems(items);

  const groups = new Map();
  dated
    .slice()
    .sort((a, b) => {
      const aDate = parseDateOnly(a.startDate ?? a.dueDate);
      const bDate = parseDateOnly(b.startDate ?? b.dueDate);
      return (aDate?.getTime() ?? 0) - (bDate?.getTime() ?? 0);
    })
    .forEach((item) => {
      const date = parseDateOnly(item.startDate ?? item.dueDate);
      const key = monthKey(date);
      if (!groups.has(key)) groups.set(key, { label: monthLabel(date), items: [] });
      groups.get(key).items.push(item);
    });

  if (undated.length > 0) {
    groups.set("undated", { label: "Undated", items: undated });
  }

  if (groups.size === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
        Nothing on this timeline yet.
      </Typography>
    );
  }

  return (
    <Stack spacing={2.5}>
      {[...groups.entries()].map(([key, group]) => (
        <Box key={key}>
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ fontWeight: 700, letterSpacing: 0.6 }}
          >
            {group.label}
          </Typography>

          <Stack spacing={1} sx={{ mt: 0.5 }}>
            {group.items.map((item) => {
              const status = getStatus(item.status);
              const progress = Math.max(0, Math.min(100, Number(item.progressPercent) || 0));

              return (
                <Paper
                  key={item.publicId}
                  variant="outlined"
                  onClick={() => onItemClick?.(item.publicId)}
                  sx={{
                    p: 1.25,
                    borderLeft: "3px solid",
                    borderLeftColor: status.color,
                    borderRadius: 1.5,
                    cursor: onItemClick ? "pointer" : "default",
                  }}
                >
                  <Stack spacing={0.75}>
                    <Typography variant="body2" fontWeight={600}>
                      {item.title}
                    </Typography>

                    <Stack direction="row" gap={0.5} flexWrap="wrap" alignItems="center">
                      <StatusChip status={item.status} />
                      <DateRangeChip
                        start={item.startDate}
                        due={item.dueDate}
                        status={item.status}
                      />
                    </Stack>

                    <LinearProgress
                      variant="determinate"
                      value={progress}
                      sx={{
                        height: 4,
                        borderRadius: 2,
                        bgcolor: (t) => alpha(t.palette.text.primary, 0.08),
                        "& .MuiLinearProgress-bar": { bgcolor: status.color },
                      }}
                    />
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}
