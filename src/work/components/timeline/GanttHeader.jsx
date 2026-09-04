import { Box, Stack, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { formatShortDate } from "../../utils/dates";

/**
 * Date columns plus milestone diamonds.
 *
 * @param {Array}  columns     from buildDateColumns
 * @param {Array}  milestones  [{ publicId, name, date }]
 * @param {Date}   originDate  date of the first column
 * @param {number} dayWidth
 * @param {number} totalWidth
 */
export default function GanttHeader({ columns, milestones = [], originDate, dayWidth, totalWidth }) {
  const monthSpans = [];
  columns.forEach((column) => {
    const key = `${column.date.getFullYear()}-${column.date.getMonth()}`;
    const last = monthSpans[monthSpans.length - 1];
    if (last && last.key === key) last.width += column.width;
    else {
      monthSpans.push({
        key,
        width: column.width,
        label: column.date.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      });
    }
  });

  return (
    <Box sx={{ position: "sticky", top: 0, zIndex: 3, bgcolor: "background.paper" }}>
      {/* Month band */}
      <Stack direction="row" sx={{ width: totalWidth, height: 22 }}>
        {monthSpans.map((span) => (
          <Box
            key={span.key}
            sx={{
              width: span.width,
              flexShrink: 0,
              borderRight: "1px solid",
              borderColor: "divider",
              px: 0.75,
              overflow: "hidden",
            }}
          >
            <Typography variant="caption" fontWeight={700} noWrap>
              {span.width > 60 ? span.label : ""}
            </Typography>
          </Box>
        ))}
      </Stack>

      {/* Date columns */}
      <Stack
        direction="row"
        sx={{
          width: totalWidth,
          height: 24,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        {columns.map((column) => (
          <Box
            key={column.date.toISOString()}
            sx={{
              width: column.width,
              flexShrink: 0,
              textAlign: "center",
              borderRight: "1px solid",
              borderColor: "divider",
              bgcolor: column.isWeekend
                ? (t) => alpha(t.palette.text.primary, 0.04)
                : "transparent",
              ...(column.isToday && {
                bgcolor: (t) => alpha(t.palette.error.main, 0.1),
              }),
            }}
          >
            <Typography
              variant="caption"
              sx={{ fontSize: 10, lineHeight: "24px", color: column.isToday ? "error.main" : "text.secondary" }}
            >
              {column.width >= 18 ? column.label : ""}
            </Typography>
          </Box>
        ))}
      </Stack>

      {/* Milestone diamonds */}
      {milestones.length > 0 && (
        <Box sx={{ position: "relative", width: totalWidth, height: 16 }}>
          {milestones.map((milestone) => {
            const date = milestone.date ?? milestone.dueDate;
            if (!date) return null;
            const days = Math.round(
              (new Date(`${String(date).slice(0, 10)}T00:00:00`) - originDate) / 86_400_000
            );
            const left = days * dayWidth;
            if (left < 0 || left > totalWidth) return null;

            return (
              <Tooltip
                key={milestone.publicId ?? `${milestone.name}-${date}`}
                title={`${milestone.name} — ${formatShortDate(date)}`}
              >
                <Box
                  sx={{
                    position: "absolute",
                    left: left - 5,
                    top: 3,
                    width: 10,
                    height: 10,
                    bgcolor: "warning.main",
                    transform: "rotate(45deg)",
                    borderRadius: "2px",
                    cursor: "default",
                  }}
                />
              </Tooltip>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
