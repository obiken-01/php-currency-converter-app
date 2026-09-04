import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import FolderOffIcon from "@mui/icons-material/FolderOff";
import ProjectCard from "../components/projects/ProjectCard";
import ProjectFormDialog from "../components/projects/ProjectFormDialog";
import GanttChart from "../components/timeline/GanttChart";
import TimelineMobileList from "../components/timeline/TimelineMobileList";
import TaskDetailModal from "../components/tasks/TaskDetailModal";
import { useProjects } from "../hooks/useProjects";
import { useTimeline } from "../hooks/useTimeline";

/** /work/timeline renders this with timelineMode, picking one project. */
function TimelineMode({ projects }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [searchParams, setSearchParams] = useSearchParams();

  const selected = searchParams.get("project") ?? projects[0]?.publicId ?? "";
  const { data: timeline, isPending, isError } = useTimeline(selected);
  const [openTaskId, setOpenTaskId] = useState(null);

  const selectProject = (publicId) => {
    const params = new URLSearchParams(searchParams);
    if (publicId) params.set("project", publicId);
    else params.delete("project");
    setSearchParams(params, { replace: true });
  };

  if (projects.length === 0) {
    return (
      <Alert severity="info">
        Create a project before there is a timeline to show.
      </Alert>
    );
  }

  return (
    <Stack spacing={2}>
      <FormControl size="small" sx={{ maxWidth: 320 }}>
        <InputLabel>Project</InputLabel>
        <Select
          label="Project"
          value={selected}
          onChange={(e) => selectProject(e.target.value)}
        >
          {projects.map((p) => (
            <MenuItem key={p.publicId} value={p.publicId}>{p.name}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {isPending && <Skeleton variant="rounded" height={320} />}
      {isError && <Alert severity="error">Failed to load the timeline.</Alert>}

      {timeline && (
        isMobile
          ? <TimelineMobileList timeline={timeline} onItemClick={setOpenTaskId} />
          : <GanttChart timeline={timeline} onItemClick={setOpenTaskId} />
      )}

      <TaskDetailModal publicId={openTaskId} onClose={() => setOpenTaskId(null)} />
    </Stack>
  );
}

/**
 * @param {boolean} timelineMode  true on /work/timeline
 */
export default function ProjectsPage({ timelineMode = false }) {
  const navigate = useNavigate();
  const { data, isPending, isError, error } = useProjects();
  const [formTarget, setFormTarget] = useState(null);   // null = closed, {} = create

  const projects = data?.items ?? data ?? [];

  if (isPending) {
    return (
      <Grid container spacing={2}>
        {Array.from({ length: 6 }, (_, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
            <Skeleton variant="rounded" height={160} />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (isError) {
    return (
      <Alert severity="error">
        {error?.response?.data?.message ?? "Failed to load projects."}
      </Alert>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700} flexGrow={1}>
          {timelineMode ? "Timeline" : "Projects"}
        </Typography>

        {!timelineMode && (
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setFormTarget({})}
          >
            New project
          </Button>
        )}
      </Stack>

      {timelineMode ? (
        <TimelineMode projects={projects} />
      ) : projects.length === 0 ? (
        <Stack alignItems="center" spacing={1} sx={{ py: 8, color: "text.secondary" }}>
          <FolderOffIcon sx={{ fontSize: 40, opacity: 0.4 }} />
          <Typography variant="body2">No projects yet.</Typography>
        </Stack>
      ) : (
        <Grid container spacing={2}>
          {projects.map((project) => (
            <Grid key={project.publicId} size={{ xs: 12, sm: 6, md: 4 }}>
              <ProjectCard
                project={project}
                onClick={(publicId) => navigate(`/work/projects/${publicId}`)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <ProjectFormDialog
        open={Boolean(formTarget)}
        onClose={() => setFormTarget(null)}
        initial={formTarget?.publicId ? formTarget : null}
      />
    </Box>
  );
}
