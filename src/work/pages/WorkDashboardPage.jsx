import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
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
import TaskCard from "../components/tasks/TaskCard";
import TaskDetailModal from "../components/tasks/TaskDetailModal";
import { getProjectStatus, WORK_ITEM_STATUSES } from "../constants/statuses";
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
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
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

export default function WorkDashboardPage() {
  const navigate = useNavigate();
  const dashboard = useDashboard();
  const setStatus = useSetWorkItemStatus();
  const [openTaskId, setOpenTaskId] = useState(null);

  const logTimeFor = (task) => navigate(`/work/logs?workItemId=${task.publicId}`);

  if (dashboard.isPending) {
    return (
      <Stack spacing={2}>
        <Grid container spacing={2}>
        {Array.from({ length: 2 }, (_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6 }}>
              <Skeleton variant="rounded" height={92} />
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

  return (
    <Stack spacing={3}>
      <Typography variant="h6" fontWeight={700}>
        Today
      </Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <StatCard
            icon={<AccessTimeIcon fontSize="small" />}
            label="Hours logged today"
            value={format(dashboard.hoursToday)}
            onClick={() => navigate("/work/logs")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <StatCard
            icon={<TimelapseIcon fontSize="small" />}
            label="Hours this cutoff"
            value={format(dashboard.hoursCutoff)}
            hint={dashboard.cutoffLabel}
            tone="info"
            onClick={() => navigate("/work/logs")}
          />
        </Grid>
      </Grid>

      <ActiveProjects onOpen={(publicId) => navigate(`/work/projects/${publicId}`)} />

      <Box>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Typography variant="subtitle2" fontWeight={700} flexGrow={1}>
            In progress
          </Typography>
          <Button size="small" onClick={() => navigate("/work/tasks?view=board")}>
            Open board
          </Button>
        </Stack>

        {dashboard.inProgress.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
            Nothing in progress. Pick something off the board.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {dashboard.inProgress.map((task) => (
              <Stack key={task.publicId} direction="row" spacing={1} alignItems="stretch">
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <TaskCard
                    task={task}
                    onClick={setOpenTaskId}
                    onLogTime={logTimeFor}
                  />
                </Box>

                {/* Quick status change without opening the modal */}
                <Select
                  size="small"
                  value={task.status}
                  onChange={(e) =>
                    setStatus.mutate({ publicId: task.publicId, status: e.target.value })
                  }
                  sx={{ width: 130, flexShrink: 0, alignSelf: "center" }}
                >
                  {WORK_ITEM_STATUSES.map((s) => (
                    <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                  ))}
                </Select>
              </Stack>
            ))}
          </Stack>
        )}
      </Box>

      {dashboard.overdue.length > 0 && (
        <Box>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            Overdue
          </Typography>
          <Stack spacing={1}>
            {dashboard.overdue.slice(0, 5).map((task) => (
              <TaskCard
                key={task.publicId}
                task={task}
                onClick={setOpenTaskId}
                onLogTime={logTimeFor}
              />
            ))}
          </Stack>
        </Box>
      )}

      <TaskDetailModal
        publicId={openTaskId}
        onClose={() => setOpenTaskId(null)}
        onLogTime={logTimeFor}
      />
    </Stack>
  );
}
