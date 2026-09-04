import {
  Alert,
  Box,
  CircularProgress,
  Pagination,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import InboxIcon from "@mui/icons-material/Inbox";
import TaskCard from "./TaskCard";
import { useTaskFilters } from "../../context/taskFilterContext";
import { useWorkItems } from "../../hooks/useWorkItems";

function EmptyState({ filtered }) {
  return (
    <Stack alignItems="center" spacing={1} sx={{ py: 8, color: "text.secondary" }}>
      <InboxIcon sx={{ fontSize: 40, opacity: 0.4 }} />
      <Typography variant="body2">
        {filtered ? "No tasks match these filters." : "No tasks yet."}
      </Typography>
    </Stack>
  );
}

export default function TaskListView({ onOpenTask, onLogTime }) {
  const { filters, setPage } = useTaskFilters();
  const { data, isPending, isError, isFetching, error } = useWorkItems(filters);

  if (isPending) {
    return (
      <Stack spacing={1}>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} variant="rounded" height={92} />
        ))}
      </Stack>
    );
  }

  if (isError) {
    return (
      <Alert severity="error">
        {error?.response?.data?.message ?? "Failed to load tasks."}
      </Alert>
    );
  }

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.totalCount ?? items.length;
  const hasFilters = Boolean(
    filters.search || filters.projectId || filters.statuses.length ||
    filters.priority || filters.labelId || filters.assignee ||
    filters.from || filters.to
  );

  if (items.length === 0) return <EmptyState filtered={hasFilters} />;

  return (
    <Box sx={{ position: "relative" }}>
      {/* keepPreviousData means the old page stays put; this marks the refetch */}
      {isFetching && (
        <CircularProgress
          size={18}
          sx={{ position: "absolute", top: -28, right: 0 }}
        />
      )}

      <Stack spacing={1}>
        {items.map((task) => (
          <TaskCard
            key={task.publicId}
            task={task}
            onClick={onOpenTask}
            onLogTime={onLogTime}
          />
        ))}
      </Stack>

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap={1}
        sx={{ mt: 2 }}
      >
        <Typography variant="caption" color="text.secondary">
          {totalCount} task{totalCount === 1 ? "" : "s"}
        </Typography>

        {totalPages > 1 && (
          <Pagination
            page={filters.page}
            count={totalPages}
            onChange={(_, page) => setPage(page)}
            size="small"
            siblingCount={0}
          />
        )}
      </Stack>
    </Box>
  );
}
