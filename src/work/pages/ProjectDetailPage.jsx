import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import { getProjectStatus } from "../constants/statuses";
import DateRangeChip from "../components/common/DateRangeChip";
import AssigneeAvatar from "../components/common/AssigneeAvatar";
import ProjectFormDialog from "../components/projects/ProjectFormDialog";
import GanttChart from "../components/timeline/GanttChart";
import TimelineMobileList from "../components/timeline/TimelineMobileList";
import KanbanBoard from "../components/tasks/board/KanbanBoard";
import TaskDetailModal from "../components/tasks/TaskDetailModal";
import TaskFormDialog from "../components/tasks/TaskFormDialog";
import { useProject } from "../hooks/useProjects";
import { useTimeline } from "../hooks/useTimeline";

const TABS = ["Overview", "Board", "Timeline"];

function Stat({ label, value }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h6" fontWeight={700}>{value}</Typography>
    </Paper>
  );
}

export default function ProjectDetailPage() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [tab, setTab] = useState(0);
  const [openTaskId, setOpenTaskId] = useState(null);
  const [createFrom, setCreateFrom] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  const { data: project, isPending, isError } = useProject(publicId);
  // Only fetched once the Timeline tab is actually open.
  const { data: timeline, isPending: timelinePending } = useTimeline(
    tab === 2 ? publicId : null
  );

  if (isPending) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="text" height={44} width={280} />
        <Skeleton variant="rounded" height={280} />
      </Stack>
    );
  }

  if (isError || !project) {
    return <Alert severity="error">Could not load this project.</Alert>;
  }

  const status = getProjectStatus(project.status);
  const progress = Math.max(0, Math.min(100, Number(project.progressPercent) || 0));

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <IconButton size="small" onClick={() => navigate("/work/projects")}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
          {project.name}
        </Typography>
        <Chip
          size="small"
          label={status.label}
          sx={{
            bgcolor: alpha(status.color, 0.16),
            color: status.color,
            fontWeight: 600,
            borderRadius: 1,
          }}
        />
        <Button size="small" startIcon={<EditIcon fontSize="small" />} onClick={() => setEditOpen(true)}>
          Edit
        </Button>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_, next) => setTab(next)}
        sx={{
          borderBottom: "1px solid",
          borderColor: "divider",
          mb: 2,
          "& .MuiTab-root": { textTransform: "none" },
        }}
      >
        {TABS.map((label) => <Tab key={label} label={label} />)}
      </Tabs>

      {tab === 0 && (
        <Stack spacing={2}>
          {project.description && (
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
              {project.description}
            </Typography>
          )}

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" gap={1}>
            <DateRangeChip start={project.startDate} due={project.dueDate} status={project.status} />
            {project.owner && (
              <Stack direction="row" spacing={0.75} alignItems="center">
                <AssigneeAvatar user={project.owner} size={22} />
                <Typography variant="caption" color="text.secondary">
                  {project.owner.displayName || project.owner.username}
                </Typography>
              </Stack>
            )}
          </Stack>

          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary" flexGrow={1}>
                Progress
              </Typography>
              <Typography variant="caption" fontWeight={600}>{progress}%</Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: (t) => alpha(t.palette.text.primary, 0.08),
                "& .MuiLinearProgress-bar": { bgcolor: status.color },
              }}
            />
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}><Stat label="Tasks" value={project.itemCount ?? 0} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><Stat label="Done" value={project.doneCount ?? 0} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><Stat label="In progress" value={project.inProgressCount ?? 0} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><Stat label="Overdue" value={project.overdueCount ?? 0} /></Grid>
          </Grid>
        </Stack>
      )}

      {tab === 1 && (
        <KanbanBoard
          projectId={publicId}
          onOpenTask={setOpenTaskId}
          onAddCard={(status_) => setCreateFrom({ status: status_ })}
        />
      )}

      {tab === 2 && (
        timelinePending ? (
          <Skeleton variant="rounded" height={320} />
        ) : isMobile ? (
          <TimelineMobileList timeline={timeline} onItemClick={setOpenTaskId} />
        ) : (
          <GanttChart timeline={timeline} onItemClick={setOpenTaskId} />
        )
      )}

      <TaskDetailModal publicId={openTaskId} onClose={() => setOpenTaskId(null)} />

      <TaskFormDialog
        open={Boolean(createFrom)}
        onClose={() => setCreateFrom(null)}
        defaultStatus={createFrom?.status ?? null}
        defaultProjectId={publicId}
      />

      <ProjectFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initial={project}
      />
    </Box>
  );
}
