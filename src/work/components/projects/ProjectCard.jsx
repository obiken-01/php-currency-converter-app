import { Box, Card, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { getProjectStatus } from "../../constants/statuses";
import DateRangeChip from "../common/DateRangeChip";
import AssigneeAvatar from "../common/AssigneeAvatar";

/**
 * @param {object}   project   ProjectCardDto
 * @param {function} onClick   (publicId) => void
 */
export default function ProjectCard({ project, onClick }) {
  if (!project) return null;

  const status = getProjectStatus(project.status);
  const progress = Math.max(0, Math.min(100, Number(project.progressPercent) || 0));
  const done = project.doneCount ?? 0;
  const total = project.itemCount ?? 0;

  return (
    <Card
      variant="outlined"
      onClick={() => onClick?.(project.publicId)}
      sx={{
        p: 2,
        height: "100%",
        borderRadius: 1.5,
        borderTop: "3px solid",
        borderTopColor: status.color,
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 120ms",
        "&:hover": { boxShadow: 2 },
      }}
    >
      <Stack spacing={1.25} sx={{ height: "100%" }}>
        <Stack direction="row" alignItems="flex-start" spacing={1}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1, minWidth: 0 }}>
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
              height: 20,
            }}
          />
        </Stack>

        {project.description && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {project.description}
          </Typography>
        )}

        <DateRangeChip start={project.startDate} due={project.dueDate} status={project.status} />

        <Box flexGrow={1} />

        <Stack spacing={0.5}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="caption" color="text.secondary" flexGrow={1}>
              {done} of {total} done
            </Typography>
            <Typography variant="caption" fontWeight={600}>
              {progress}%
            </Typography>
            <AssigneeAvatar user={project.owner} size={20} />
          </Stack>

          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 5,
              borderRadius: 2,
              bgcolor: (t) => alpha(t.palette.text.primary, 0.08),
              "& .MuiLinearProgress-bar": { bgcolor: status.color },
            }}
          />
        </Stack>
      </Stack>
    </Card>
  );
}
