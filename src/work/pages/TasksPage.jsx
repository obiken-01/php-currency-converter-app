import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import TaskFilterProvider from "../context/TaskFilterProvider";
import TaskFilterBar from "../components/tasks/TaskFilterBar";
import TaskListView from "../components/tasks/TaskListView";
import TaskDetailModal from "../components/tasks/TaskDetailModal";
import TaskFormDialog from "../components/tasks/TaskFormDialog";
import ViewSwitcher from "../components/tasks/ViewSwitcher";

function TasksPageInner() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") === "board" ? "board" : "list";

  const [openTaskId, setOpenTaskId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

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
          onClick={() => setCreateOpen(true)}
        >
          New task
        </Button>
      </Stack>

      <TaskFilterBar />

      {view === "board" ? (
        <Alert severity="info">
          The board view arrives in F3. Use the list for now.
        </Alert>
      ) : (
        <TaskListView onOpenTask={setOpenTaskId} />
      )}

      <TaskDetailModal
        publicId={openTaskId}
        onClose={() => setOpenTaskId(null)}
      />

      <TaskFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
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
