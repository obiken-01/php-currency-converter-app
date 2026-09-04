import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import MoreTimeIcon from "@mui/icons-material/MoreTime";
import CheckIcon from "@mui/icons-material/Check";
import { WORK_ITEM_STATUSES, PRIORITIES } from "../../constants/statuses";
import { LINKED_LOGS_ENABLED } from "../../constants/features";
import { formatDateTime, formatShortDate } from "../../utils/dates";
import LabelChip from "../common/LabelChip";
import AssigneeAvatar from "../common/AssigneeAvatar";
import DateRangeChip from "../common/DateRangeChip";
import PriorityIcon from "../common/PriorityIcon";
import TaskFormDialog from "./TaskFormDialog";
import { useDirectory } from "../../hooks/useDirectory";
import {
  useDeleteWorkItem,
  useSetWorkItemAssignee,
  useSetWorkItemStatus,
  useUpdateWorkItem,
  useWorkItem,
  useWorkItemLogs,
} from "../../hooks/useWorkItems";
import { useToast } from "../../context/toastContext";

function MetaRow({ label, children }) {
  return (
    <Stack direction="row" spacing={2} alignItems="center" sx={{ minHeight: 32 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ width: 84, flexShrink: 0 }}
      >
        {label}
      </Typography>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>{children}</Box>
    </Stack>
  );
}

/**
 * The list and total, gated on LINKED_LOGS_ENABLED. Only mounted when the
 * flag is on, so the query never fires while the endpoint is missing.
 */
function LinkedLogsList({ publicId }) {
  const { data, isPending, isError } = useWorkItemLogs(publicId);

  if (isPending) return <Skeleton variant="rounded" height={64} />;
  if (isError) return <Alert severity="warning">Could not load linked time logs.</Alert>;

  const logs = data?.items ?? data ?? [];
  const total = logs.reduce((sum, log) => sum + (Number(log.duration) || 0), 0);

  return (
    <Stack spacing={1}>
      <Stack direction="row" justifyContent="flex-end">
        <Typography variant="caption" color="text.secondary">
          {total.toFixed(2)} h total
        </Typography>
      </Stack>

      {logs.length === 0 ? (
        <Typography variant="caption" color="text.secondary">
          No time logged against this task yet.
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          {logs.map((log) => (
            <Stack
              key={log.id ?? log.publicId}
              direction="row"
              spacing={1}
              alignItems="baseline"
              sx={{ py: 0.25 }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ width: 130, flexShrink: 0 }}>
                {formatDateTime(log.loggedAt)}
              </Typography>
              <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
                {log.taskDescription}
              </Typography>
              <Typography variant="caption" fontWeight={600}>
                {Number(log.duration).toFixed(2)} h
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

/** Remounted per task (see the key below) so no state leaks between them. */
function TaskDetailBody({ publicId, onClose, onLogTime, onRequestEdit }) {
  const toast = useToast();

  const { data: task, isPending, isError } = useWorkItem(publicId);
  const { data: directory } = useDirectory();
  const userList = directory?.items ?? directory ?? [];

  const setStatus = useSetWorkItemStatus();
  const setAssignee = useSetWorkItemAssignee();
  const updateItem = useUpdateWorkItem();
  const deleteItem = useDeleteWorkItem();

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const startTitleEdit = () => {
    setTitleDraft(task?.title ?? "");
    setEditingTitle(true);
  };

  const handleTitleSave = async () => {
    const next = titleDraft.trim();
    if (!next || next === task.title) {
      setEditingTitle(false);
      setTitleDraft(task?.title ?? "");
      return;
    }
    try {
      await updateItem.mutateAsync({ publicId, dto: { ...task, title: next } });
      setEditingTitle(false);
    } catch {
      toast.error("Could not rename the task.");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this task? This cannot be undone.")) return;
    try {
      await deleteItem.mutateAsync(publicId);
      toast.success("Task deleted.");
      onClose();
    } catch {
      toast.error("Could not delete the task.");
    }
  };

  return (
    <>
      {(setStatus.isPending || updateItem.isPending) && <LinearProgress />}

      <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
        {isPending && (
          <Stack spacing={2}>
            <Skeleton variant="text" height={40} />
            <Skeleton variant="rounded" height={120} />
          </Stack>
        )}

        {isError && <Alert severity="error">Failed to load this task.</Alert>}

        {task && (
          <Stack spacing={2.5}>

            {/* ── Header ── */}
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                {editingTitle ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleTitleSave();
                        if (e.key === "Escape") {
                          setEditingTitle(false);
                          setTitleDraft(task.title);
                        }
                      }}
                      size="small"
                      fullWidth
                      autoFocus
                    />
                    <IconButton size="small" onClick={handleTitleSave}>
                      <CheckIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ) : (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <PriorityIcon priority={task.priority} />
                    <Typography variant="h6" fontWeight={700} sx={{ wordBreak: "break-word" }}>
                      {task.title}
                    </Typography>
                    <Tooltip title="Rename">
                      <IconButton size="small" onClick={startTitleEdit}>
                        <EditIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                )}
              </Box>

              {/* On a phone this dropdown is the only way to move a card
                  between columns -- the board cannot drag across them. */}
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={task.status}
                  onChange={(e) =>
                    setStatus.mutate({ publicId, status: e.target.value })
                  }
                >
                  {WORK_ITEM_STATUSES.map((s) => (
                    <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <IconButton onClick={onClose} size="small">
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>

            <Divider />

            {/* ── Meta strip ── */}
            <Stack spacing={0.5}>
              <MetaRow label="Project">
                <Typography variant="body2">
                  {task.project?.name ?? <Box component="span" color="text.disabled">None</Box>}
                </Typography>
              </MetaRow>

              <MetaRow label="Assignee">
                <Stack direction="row" spacing={1} alignItems="center">
                  <AssigneeAvatar user={task.assignee} size={24} />
                  <FormControl size="small" sx={{ minWidth: 180 }}>
                    <Select
                      value={task.assignee?.publicId ?? ""}
                      displayEmpty
                      onChange={(e) =>
                        setAssignee.mutate({
                          publicId,
                          assigneeId: e.target.value || null,
                        })
                      }
                    >
                      <MenuItem value="">Unassigned</MenuItem>
                      {userList.map((u) => (
                        <MenuItem key={u.publicId} value={u.publicId}>
                          {u.displayName || u.username}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              </MetaRow>

              <MetaRow label="Priority">
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <PriorityIcon priority={task.priority} withTooltip={false} />
                  <Typography variant="body2">
                    {PRIORITIES.find((p) => p.value === task.priority)?.label ?? task.priority}
                  </Typography>
                </Stack>
              </MetaRow>

              <MetaRow label="Dates">
                {task.startDate || task.dueDate ? (
                  <DateRangeChip
                    start={task.startDate}
                    due={task.dueDate}
                    status={task.status}
                  />
                ) : (
                  <Typography variant="body2" color="text.disabled">Not scheduled</Typography>
                )}
              </MetaRow>

              <MetaRow label="Labels">
                {task.labels?.length ? (
                  <Stack direction="row" gap={0.5} flexWrap="wrap">
                    {task.labels.map((l) => (
                      <LabelChip key={l.publicId ?? l.name} label={l} />
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.disabled">None</Typography>
                )}
              </MetaRow>
            </Stack>

            <Divider />

            {/* ── Description ── */}
            <Box>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Description
              </Typography>
              {task.description ? (
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                  {task.description}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.disabled">
                  No description.
                </Typography>
              )}
            </Box>

            <Divider />

            {/* The "Log time" button stays regardless -- only the list is
                gated, so gating does not remove the way to record time. */}
            <Stack spacing={1}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="subtitle2" fontWeight={700} flexGrow={1}>
                  Time logs
                </Typography>
                {onLogTime && (
                  <Button
                    size="small"
                    startIcon={<MoreTimeIcon fontSize="small" />}
                    onClick={() => onLogTime(task)}
                  >
                    Log time
                  </Button>
                )}
              </Stack>

              {LINKED_LOGS_ENABLED && <LinkedLogsList publicId={publicId} />}
            </Stack>

            <Divider />

            {/* ── Footer ── */}
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ sm: "center" }}
            >
              <Stack spacing={0.25} flexGrow={1}>
                {task.createdBy && (
                  <Typography variant="caption" color="text.secondary">
                    Created by {task.createdBy.displayName || task.createdBy.username}
                    {task.createdAt ? ` on ${formatShortDate(task.createdAt)}` : ""}
                  </Typography>
                )}
                {task.updatedAt && (
                  <Typography variant="caption" color="text.secondary">
                    Updated {formatDateTime(task.updatedAt)}
                  </Typography>
                )}
              </Stack>

              <Button
                size="small"
                startIcon={<EditIcon fontSize="small" />}
                onClick={() => onRequestEdit(task)}
              >
                Edit
              </Button>
              <Button
                size="small"
                color="error"
                startIcon={
                  deleteItem.isPending
                    ? <CircularProgress size={14} color="inherit" />
                    : <DeleteOutlineIcon fontSize="small" />
                }
                disabled={deleteItem.isPending}
                onClick={handleDelete}
              >
                Delete
              </Button>
            </Stack>
          </Stack>
        )}
      </DialogContent>
    </>
  );
}

/**
 * @param {string|null} publicId  null = closed
 * @param {function}    onClose
 * @param {function}    [onLogTime]  (task) => void
 */
export default function TaskDetailModal({ publicId, onClose, onLogTime }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [editTarget, setEditTarget] = useState(null);

  return (
    <>
      <Dialog
        open={Boolean(publicId)}
        onClose={onClose}
        fullScreen={fullScreen}
        fullWidth
        maxWidth="md"
      >
        {publicId && (
          <TaskDetailBody
            key={publicId}
            publicId={publicId}
            onClose={onClose}
            onLogTime={onLogTime}
            onRequestEdit={setEditTarget}
          />
        )}
      </Dialog>

      <TaskFormDialog
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        initial={editTarget}
      />
    </>
  );
}
