import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Box, Button, Stack, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import TaskFilterProvider from "../context/TaskFilterProvider";
import { useTaskFilters } from "../context/taskFilterContext";
import TaskFilterBar from "../components/tasks/TaskFilterBar";
import TaskListView from "../components/tasks/TaskListView";
import TaskDetailModal from "../components/tasks/TaskDetailModal";
import TaskFormDialog from "../components/tasks/TaskFormDialog";
import ViewSwitcher from "../components/tasks/ViewSwitcher";
import KanbanBoard from "../components/tasks/board/KanbanBoard";

function TasksPageInner() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") === "board" ? "board" : "list";
  const { filters } = useTaskFilters();
  const navigate = useNavigate();

  // "Log time" lands on the log page scoped to the task, with the picker
  // already filled in.
  const logTimeFor = (task) => navigate(`/work/logs?workItemId=${task.publicId}`);

  const [openTaskId, setOpenTaskId] = useState(null);
  // null = closed; an object carries the column a card was added from.
  const [createFrom, setCreateFrom] = useState(null);

  const setView = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next === "list") params.delete("view");
    else params.set("view", next);
    setSearchParams(params, { replace: true });
  };

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        flexWrap="wrap"
        sx={{ mb: 2 }}
      >
        <Typography variant="h6" fontWeight={700} flexGrow={1}>
          Tasks
        </Typography>

        <ViewSwitcher view={view} onChange={setView} />

        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setCreateFrom({})}
        >
          New task
        </Button>
      </Stack>

      <TaskFilterBar />

      {view === "board" ? (
        <KanbanBoard
          projectId={filters.projectId || null}
          assignee={filters.assignee || null}
          onOpenTask={setOpenTaskId}
          onAddCard={(status) => setCreateFrom({ status })}
          onLogTime={logTimeFor}
        />
      ) : (
        <TaskListView onOpenTask={setOpenTaskId} onLogTime={logTimeFor} />
      )}

      <TaskDetailModal
        publicId={openTaskId}
        onClose={() => setOpenTaskId(null)}
        onLogTime={logTimeFor}
      />

      <TaskFormDialog
        open={Boolean(createFrom)}
        onClose={() => setCreateFrom(null)}
        defaultStatus={createFrom?.status ?? null}
        defaultProjectId={filters.projectId || null}
      />
    </Box>
  );
}

export default function TasksPage() {
  // The provider reads the query string, so it has to sit above anything
  // that reads filters.
  return (
    <TaskFilterProvider>
      <TasksPageInner />
    </TaskFilterProvider>
  );
}
