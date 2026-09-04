import { useState } from "react";
import { Badge, Box, Stack, Tab, Tabs, Typography, IconButton, Tooltip } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import TaskCard from "../TaskCard";

/**
 * One column at a time behind swipeable tabs. No drag here — cross-column
 * drag does not work at this size, so moving a card is done through the
 * status dropdown in TaskDetailModal.
 *
 * @param {Array}    columns
 * @param {function} onOpenTask
 * @param {function} onAddCard
 */
export default function KanbanMobileTabs({ columns, onOpenTask, onAddCard }) {
  const [index, setIndex] = useState(0);
  const active = columns[Math.min(index, columns.length - 1)];

  if (!active) return null;

  return (
    <Box>
      <Tabs
        value={Math.min(index, columns.length - 1)}
        onChange={(_, next) => setIndex(next)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{
          borderBottom: "1px solid",
          borderColor: "divider",
          mb: 1.5,
          "& .MuiTab-root": { textTransform: "none", minHeight: 44 },
        }}
      >
        {columns.map((column) => (
          <Tab
            key={column.status}
            label={
              <Badge
                badgeContent={column.count}
                showZero
                sx={{
                  pr: column.count > 9 ? 2 : 1.5,
                  "& .MuiBadge-badge": {
                    position: "static",
                    transform: "none",
                    ml: 0.75,
                    bgcolor: "action.selected",
                    color: "text.secondary",
                  },
                }}
              >
                {column.label}
              </Badge>
            }
          />
        ))}
      </Tabs>

      <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ color: active.color, flexGrow: 1 }}>
          {active.label}
        </Typography>
        {onAddCard && (
          <Tooltip title={`Add a card to ${active.label}`}>
            <IconButton size="small" onClick={() => onAddCard(active.status)}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {active.items.length === 0 ? (
        <Typography
          variant="body2"
          color="text.disabled"
          sx={{ textAlign: "center", py: 6 }}
        >
          Nothing in {active.label}.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {active.items.map((task) => (
            <TaskCard key={task.publicId} task={task} onClick={onOpenTask} compact />
          ))}
        </Stack>
      )}
    </Box>
  );
}
