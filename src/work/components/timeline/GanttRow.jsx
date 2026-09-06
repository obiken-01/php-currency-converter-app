import { Box, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { barGeometry, ROW_HEIGHT } from "../../utils/gantt";
import { getStatus } from "../../constants/statuses";
import { formatShortDate } from "../../utils/dates";

/**
 * One bar on the chart. Colour comes from the status; ProgressPercent
 * renders as an inner fill rather than a separate element.
 *
 * @param {object}   item        needs title, status, startDate/dueDate
 * @param {Date}     originDate  date of the first column
 * @param {number}   dayWidth
 * @param {number}   totalWidth
 * @param {Array}    columns     for the weekend tinting behind the bar
 * @param {function} onClick     (publicId) => void
 */
export default function GanttRow({ item, originDate, dayWidth, totalWidth, columns, onClick }) {
  const geometry = barGeometry(item, originDate, dayWidth);
  const status = getStatus(item.status);
  const progress = Math.max(0, Math.min(100, Number(item.progressPercent) || 0));
  const end = item.endDate ?? item.dueDate;

  return (
    <Box
      sx={{
        position: "relative",
        width: totalWidth,
        height: ROW_HEIGHT,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      {/* Column tinting so the grid reads through behind the bars */}
      <Box sx={{ position: "absolute", inset: 0, display: "flex" }}>
        {columns.map((column) => (
          <Box
            key={column.date.toISOString()}
            sx={{
              width: column.width,
              flexShrink: 0,
              borderRight: "1px solid",
              borderColor: "divider",
              bgcolor: column.isWeekend
                ? (t) => alpha(t.palette.text.primary, 0.035)
                : "transparent",
            }}
          />
        ))}
      </Box>

      {geometry && (
        <Tooltip
          title={
            <>
              <div>{item.title}</div>
              <div>
                {formatShortDate(item.startDate)}
                {end ? ` → ${formatShortDate(end)}` : ""}
              </div>
              <div>{status.label}{progress ? ` · ${progress}%` : ""}</div>
            </>
          }
        >
          <Box
            onClick={() => onClick?.(item.publicId)}
            sx={{
              position: "absolute",
              left: geometry.left,
              top: 6,
              width: geometry.width,
              height: ROW_HEIGHT - 14,
              bgcolor: alpha(status.color, 0.28),
              border: "1px solid",
              borderColor: status.color,
              borderRadius: 0.75,
              overflow: "hidden",
              cursor: onClick ? "pointer" : "default",
              "&:hover": { filter: "brightness(1.08)" },
            }}
          >
            {progress > 0 && (
              <Box
                sx={{
                  width: `${progress}%`,
                  height: "100%",
                  bgcolor: alpha(status.color, 0.85),
                }}
              />
            )}
            {geometry.width > 60 && (
              <Typography
                variant="caption"
                noWrap
                sx={{
                  position: "absolute",
                  inset: 0,
                  px: 0.75,
                  fontSize: 10,
                  lineHeight: `${ROW_HEIGHT - 14}px`,
                  color: "text.primary",
                  pointerEvents: "none",
                }}
              >
                {item.title}
              </Typography>
            )}
          </Box>
        </Tooltip>
      )}
    </Box>
  );
}
