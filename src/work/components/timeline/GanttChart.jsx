import { useRef, useState } from "react";
import {
  Box,
  Button,
  Collapse,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import GanttHeader from "./GanttHeader";
import GanttRow from "./GanttRow";
import StatusChip from "../common/StatusChip";
import {
  DAY_WIDTH,
  LABEL_COLUMN_WIDTH,
  ROW_HEIGHT,
  buildDateColumns,
  chartRange,
  columnsWidth,
  datedItems,
  pickScale,
  todayOffset,
  undatedItems,
} from "../../utils/gantt";

const SCALES = ["day", "week", "month"];

/**
 * CSS-grid renderer rather than a Gantt library: gantt-task-react and
 * frappe-gantt both fight MUI theming and neither handles a small viewport.
 *
 * @param {object}   timeline     ProjectTimelineDto
 * @param {function} onItemClick  (publicId) => void
 * @param {string}   [scale]      'day' | 'week' | 'month'; auto when omitted
 */
export default function GanttChart({ timeline, onItemClick, scale: scaleProp }) {
  const [scaleOverride, setScaleOverride] = useState(scaleProp ?? null);
  const [showUndated, setShowUndated] = useState(false);
  const labelPaneRef = useRef(null);

  const items = timeline?.items ?? [];
  const milestones = timeline?.milestones ?? [];

  // No useMemo here: the React Compiler memoises these, and hand-written
  // deps on optional chains fight it.
  // The API already keeps undated items out of `items` and returns them
  // separately; splitting `items` again left the undated list permanently
  // empty, so tasks with no dates vanished from the screen entirely.
  const dated = datedItems(items);
  const undated = [...(timeline?.undatedItems ?? []), ...undatedItems(items)];

  const range = chartRange(dated, timeline);

  const scale = scaleOverride ?? pickScale(range.start, range.end);
  const dayWidth = DAY_WIDTH[scale];

  const columns = buildDateColumns(range.start, range.end, scale);
  // The label column's header cell and the chart's header have to be the same
  // height or every row sits half a line off its own name.
  const headerHeight = milestones.length > 0 ? 62 : 46;

  const totalWidth = columnsWidth(columns);
  const originDate = columns[0]?.date ?? range.start;
  const todayLeft = todayOffset(originDate, range.end, dayWidth);

  // The label pane scrolls vertically with the chart pane.
  const handleScroll = (e) => {
    if (labelPaneRef.current) labelPaneRef.current.scrollTop = e.currentTarget.scrollTop;
  };

  if (dated.length === 0) {
    return (
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
          Nothing on this timeline has dates yet.
        </Typography>
        {undated.length > 0 && (
          <UndatedList
            items={undated}
            open={showUndated}
            onToggle={() => setShowUndated((v) => !v)}
            onItemClick={onItemClick}
          />
        )}
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box flexGrow={1} />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={scale}
          onChange={(_, next) => next && setScaleOverride(next)}
        >
          {SCALES.map((value) => (
            <ToggleButton key={value} value={value} sx={{ textTransform: "capitalize", px: 1.5 }}>
              {value}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      <Paper variant="outlined" sx={{ display: "flex", overflow: "hidden" }}>
        {/* Fixed label column */}
        <Box
          sx={{
            width: LABEL_COLUMN_WIDTH,
            flexShrink: 0,
            borderRight: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box
            sx={{
              height: headerHeight,
              borderBottom: "1px solid",
              borderColor: "divider",
              display: "flex",
              alignItems: "flex-end",
              px: 1,
              pb: 0.5,
            }}
          >
            <Typography variant="caption" fontWeight={700} color="text.secondary">
              Item
            </Typography>
          </Box>

          <Box ref={labelPaneRef} sx={{ maxHeight: 460, overflow: "hidden" }}>
            {dated.map((item) => (
              <Box
                key={item.publicId}
                onClick={() => onItemClick?.(item.publicId)}
                sx={{
                  height: ROW_HEIGHT,
                  display: "flex",
                  alignItems: "center",
                  px: 1,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  cursor: onItemClick ? "pointer" : "default",
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <Typography variant="caption" noWrap title={item.title}>
                  {item.title}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* The one scroller. Both axes belong to the same element: a child with
            overflowY set computes its overflowX to auto, so a vertically
            scrolling box in here grew a second horizontal scrollbar under the
            pane's own. The header is sticky, so it stays put as rows scroll. */}
        <Box
          sx={{
            flexGrow: 1,
            position: "relative",
            overflow: "auto",
            maxHeight: headerHeight + 460,
          }}
          onScroll={handleScroll}
        >
          <GanttHeader
            columns={columns}
            milestones={milestones}
            originDate={originDate}
            dayWidth={dayWidth}
            totalWidth={totalWidth}
          />

          {/* Relative only, so the today line can span every row. */}
          <Box sx={{ position: "relative", width: totalWidth }}>
            {todayLeft != null && (
              <Box
                sx={{
                  position: "absolute",
                  left: todayLeft,
                  top: 0,
                  bottom: 0,
                  width: "2px",
                  bgcolor: "error.main",
                  opacity: 0.7,
                  zIndex: 2,
                  pointerEvents: "none",
                }}
              />
            )}

            {dated.map((item) => (
              <GanttRow
                key={item.publicId}
                item={item}
                originDate={originDate}
                dayWidth={dayWidth}
                totalWidth={totalWidth}
                columns={columns}
                onClick={onItemClick}
              />
            ))}
          </Box>
        </Box>
      </Paper>

      {undated.length > 0 && (
        <UndatedList
          items={undated}
          open={showUndated}
          onToggle={() => setShowUndated((v) => !v)}
          onItemClick={onItemClick}
        />
      )}
    </Stack>
  );
}

/** Dateless items are excluded from the chart, not from the page. */
function UndatedList({ items, open, onToggle, onItemClick }) {
  return (
    <Box>
      <Button
        size="small"
        onClick={onToggle}
        endIcon={
          <ExpandMoreIcon
            sx={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }}
          />
        }
      >
        Undated ({items.length})
      </Button>

      <Collapse in={open}>
        <Stack spacing={0.5} sx={{ pt: 1 }}>
          {items.map((item) => (
            <Stack
              key={item.publicId}
              direction="row"
              spacing={1}
              alignItems="center"
              onClick={() => onItemClick?.(item.publicId)}
              sx={{
                px: 1,
                py: 0.5,
                borderRadius: 1,
                cursor: onItemClick ? "pointer" : "default",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
                {item.title}
              </Typography>
              <StatusChip status={item.status} />
            </Stack>
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
}
