import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  Grid,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import TimelapseIcon from "@mui/icons-material/Timelapse";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import BlockIcon from "@mui/icons-material/Block";
import InboxIcon from "@mui/icons-material/Inbox";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import TaskCard from "../components/tasks/TaskCard";
import TaskDetailModal from "../components/tasks/TaskDetailModal";
import { BOARD_STATUSES, getProjectStatus, WORK_ITEM_STATUSES } from "../constants/statuses";
import { useDashboard } from "../hooks/useDashboard";
import { useProjects } from "../hooks/useProjects";
import { useSetWorkItemStatus } from "../hooks/useWorkItems";

const ACTIVE_PROJECT_STATUSES = ["Planning", "Active"];

function StatCard({ icon, label, value, hint, tone = "primary", onClick }) {
  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        p: 2,
        height: "100%",
        borderRadius: 1.5,
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 120ms",
        "&:hover": onClick ? { boxShadow: 2 } : undefined,
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            bgcolor: (t) => alpha(t.palette[tone].main, 0.14),
            color: `${tone}.main`,
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {label}
          </Typography>
        </Box>
      </Stack>
      {hint && (
        <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 1 }}>
          {hint}
        </Typography>
      )}
    </Paper>
  );
}

/** Progress strip for the projects actually being worked on. */
function ActiveProjects({ onOpen }) {
  const { data, isPending } = useProjects();
  const projects = (data?.items ?? data ?? []).filter((p) =>
    ACTIVE_PROJECT_STATUSES.includes(p.status)
  );

  if (isPending) return <Skeleton variant="rounded" height={90} />;
  if (projects.length === 0) return null;

  return (
    <Box>
      <Typography
        variant="caption"
        color="text.secondary"
        fontWeight={700}
        gutterBottom
        sx={{ letterSpacing: "0.08em", textTransform: "uppercase", display: "block" }}
      >
        Active projects
      </Typography>
      <Grid container spacing={1.5}>
        {projects.map((project) => {
          const status = getProjectStatus(project.status);
          const progress = Math.max(0, Math.min(100, Number(project.progressPercent) || 0));

          return (
            <Grid key={project.publicId} size={{ xs: 12, sm: 6, md: 4 }}>
              <Paper
                variant="outlined"
                onClick={() => onOpen(project.publicId)}
                sx={{ p: 1.5, borderRadius: 1.5, cursor: "pointer", "&:hover": { boxShadow: 2 } }}
              >
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
                  <Typography variant="body2" fontWeight={600} noWrap sx={{ flexGrow: 1 }}>
                    {project.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {progress}%
                  </Typography>
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
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

// One column per status a task can carry — the dashboard just follows the
// status set on each task.
const COLUMN_STYLE = {
  Backlog:    { tone: "secondary", icon: <InboxIcon fontSize="small" /> },
  Todo:       { tone: "warning",   icon: <RadioButtonUncheckedIcon fontSize="small" /> },
  InProgress: { tone: "info",      icon: <PlayCircleOutlineIcon fontSize="small" /> },
  Blocked:    { tone: "error",     icon: <BlockIcon fontSize="small" /> },
  Done:       { tone: "success",   icon: <CheckCircleOutlineIcon fontSize="small" /> },
};

const COLUMNS = BOARD_STATUSES.map((s) => ({
  key: s.value,
  label: s.label,
  empty: "Nothing here.",
  ...COLUMN_STYLE[s.value],
}));

const MAX_PER_COLUMN = 8;

function Column({ column, tasks, count, children }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, height: "100%" }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
        <Box sx={{ color: `${column.tone}.main`, display: "flex" }}>{column.icon}</Box>
        <Typography variant="body2" fontWeight={700} sx={{ flexGrow: 1 }}>
          {column.label}
        </Typography>
        <Chip
          size="small"
          label={count}
          sx={{
            height: 20,
            fontWeight: 700,
            bgcolor: (t) => alpha(t.palette[column.tone].main, 0.16),
            color: `${column.tone}.main`,
          }}
        />
      </Stack>
      {tasks.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
          {column.empty}
        </Typography>
      ) : (
        <Stack spacing={1}>{children}</Stack>
      )}
    </Paper>
  );
}

export default function WorkDashboardPage() {
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState("");
  const [visible, setVisible] = useState(COLUMNS.map((c) => c.key));
  const dashboard = useDashboard(projectId);
  const { data: projectData } = useProjects();
  const setStatus = useSetWorkItemStatus();
  const [openTaskId, setOpenTaskId] = useState(null);

  const projectList = projectData?.items ?? projectData ?? [];
  const logTimeFor = (task) => navigate(`/work/logs?workItemId=${task.publicId}`);
  const toggle = (key) =>
    setVisible((v) => (v.includes(key) ? v.filter((k) => k !== key) : [...v, key]));

  if (dashboard.isPending) {
    return (
      <Stack spacing={2}>
        <Grid container spacing={2}>
          {Array.from({ length: 5 }, (_, i) => (
            <Grid key={i} size={{ xs: 6, md: "grow" }}>
              <Skeleton variant="rounded" height={80} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rounded" height={220} />
      </Stack>
    );
  }

  if (dashboard.isError) {
    return <Alert severity="error">Could not load the dashboard.</Alert>;
  }

  const format = (hours) => `${hours.toFixed(2).replace(/\.00$/, "")} h`;
  const { byStatus } = dashboard;
  const shown = COLUMNS.filter((c) => visible.includes(c.key));

  return (
    <Stack spacing={3}>
      {/* Summary row */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 4, lg: "grow" }}>
          <StatCard
            icon={<AccessTimeIcon fontSize="small" />}
            label="Hours today"
            value={format(dashboard.hoursToday)}
            onClick={() => navigate("/work/logs")}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, lg: "grow" }}>
          <StatCard
            icon={<TimelapseIcon fontSize="small" />}
            label="Hours this cutoff"
            value={format(dashboard.hoursCutoff)}
            hint={dashboard.cutoffLabel}
            tone="info"
            onClick={() => navigate("/work/logs")}
          />
        </Grid>
        {COLUMNS.map((c) => (
          <Grid key={c.key} size={{ xs: 6, sm: 4, lg: "grow" }}>
            <StatCard
              icon={c.icon}
              label={c.label}
              value={byStatus[c.key].length}
              tone={c.tone}
              onClick={() => setVisible([c.key])}
            />
          </Grid>
        ))}
      </Grid>

      <ActiveProjects onOpen={(publicId) => navigate(`/work/projects/${publicId}`)} />

      {/* Filters: project + status */}
      <Stack direction="row" flexWrap="wrap" gap={1.5} alignItems="center">
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="dash-project">Project</InputLabel>
          <Select
            labelId="dash-project"
            label="Project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <MenuItem value="">All projects</MenuItem>
            {projectList.map((p) => (
              <MenuItem key={p.publicId} value={p.publicId}>{p.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ flexGrow: 1 }}>
          {COLUMNS.map((c) => {
            const on = visible.includes(c.key);
            return (
              <Chip
                key={c.key}
                label={c.label}
                size="small"
                onClick={() => toggle(c.key)}
                color={on ? c.tone : "default"}
                variant={on ? "filled" : "outlined"}
              />
            );
          })}
        </Stack>

        <Button size="small" variant="outlined" onClick={() => navigate("/work/tasks?view=board")}>
          Open board
        </Button>
      </Stack>

      {shown.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
          Select a status to show tasks.
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {shown.map((c) => {
            const tasks = byStatus[c.key];
            const hidden = tasks.length - MAX_PER_COLUMN;
            return (
              <Grid
                key={c.key}
                size={{ xs: 12, md: shown.length === 1 ? 12 : 6, lg: 12 / Math.min(shown.length, 3) }}
              >
                <Column column={c} tasks={tasks} count={tasks.length}>
                  {tasks.slice(0, MAX_PER_COLUMN).map((task) => (
                    <Stack key={task.publicId} spacing={0.75}>
                      <TaskCard task={task} onClick={setOpenTaskId} onLogTime={logTimeFor} />
                      {/* Quick status change without opening the modal */}
                      <Select
                        size="small"
                        value={task.status}
                        onChange={(e) =>
                          setStatus.mutate({ publicId: task.publicId, status: e.target.value })
                        }
                      >
                        {WORK_ITEM_STATUSES.map((st) => (
                          <MenuItem key={st.value} value={st.value}>{st.label}</MenuItem>
                        ))}
                      </Select>
                    </Stack>
                  ))}
                  {hidden > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
                      +{hidden} more on the board
                    </Typography>
                  )}
                </Column>
              </Grid>
            );
          })}
        </Grid>
      )}

      <TaskDetailModal
        publicId={openTaskId}
        onClose={() => setOpenTaskId(null)}
        onLogTime={logTimeFor}
      />
    </Stack>
  );
}
