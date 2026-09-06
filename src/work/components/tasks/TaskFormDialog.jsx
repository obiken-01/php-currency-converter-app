import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  TextField,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { WORK_ITEM_STATUSES, PRIORITIES } from "../../constants/statuses";
import { toWorkItemDto } from "../../utils/workItem";
import { useProjects } from "../../hooks/useProjects";
import { useLabels } from "../../hooks/useLabels";
import { useDirectory } from "../../hooks/useDirectory";
import { useCreateWorkItem, useUpdateWorkItem } from "../../hooks/useWorkItems";
import { useToast } from "../../context/toastContext";

const EMPTY = {
  title: "",
  summary: "",
  description: "",
  projectId: "",
  status: "Todo",
  priority: "Normal",
  startDate: "",
  dueDate: "",
  labelIds: [],
  assigneeId: "",
};

// The API returns work items FLAT -- projectPublicId / projectName /
// assigneePublicId / assigneeDisplayName -- never a nested project or assignee
// object, and its labels carry an integer `id`. Reading the nested shape here
// left the pickers empty on every edit, so a save then posted "no project" and
// "unassigned" over whatever the task actually had.
const buildForm = (initial, defaultProjectId, defaultStatus) =>
  initial
    ? {
        title:       initial.title ?? "",
        summary:     initial.summary ?? "",
        description: initial.description ?? "",
        projectId:   initial.projectPublicId ?? "",
        status:      initial.status ?? "Todo",
        priority:    initial.priority ?? "Normal",
        // Date-only fields stay plain YYYY-MM-DD strings; running them
        // through toISOString() shifts the day across timezones.
        startDate:   initial.startDate?.slice(0, 10) ?? "",
        dueDate:     initial.dueDate?.slice(0, 10) ?? "",
        labelIds:    (initial.labels ?? []).map((l) => l.id),
        assigneeId:  initial.assigneePublicId ?? "",
      }
    : {
        ...EMPTY,
        projectId: defaultProjectId ?? "",
        status: defaultStatus ?? EMPTY.status,
      };

/**
 * Remounted on each open (see the key below), so state initialises straight
 * from `initial` rather than being reset by an effect.
 */
function TaskFormBody({ onClose, initial, defaultProjectId, defaultStatus, create, update }) {
  const toast = useToast();

  const { data: projects } = useProjects();
  const { data: labels } = useLabels();
  const { data: directory } = useDirectory();

  const projectList = projects?.items ?? projects ?? [];
  const labelList = labels?.items ?? labels ?? [];
  const userList = directory?.items ?? directory ?? [];

  const isEdit = Boolean(initial);
  const saving = create.isPending || update.isPending;

  const [form, setForm] = useState(() => buildForm(initial, defaultProjectId, defaultStatus));
  const [error, setError] = useState(null);

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    if (form.startDate && form.dueDate && form.startDate > form.dueDate) {
      setError("Start date must not be after the due date.");
      return;
    }

    const dto = toWorkItemDto(form, { isEdit });

    try {
      if (isEdit) {
        await update.mutateAsync({ publicId: initial.publicId, dto });
        toast.success("Task updated.");
      } else {
        await create.mutateAsync(dto);
        toast.success("Task created.");
      }
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message ?? "Could not save the task.");
    }
  };

  return (
    <>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {isEdit ? "Edit task" : "New task"}
      </DialogTitle>

      <DialogContent dividers>
        {/* No <form> element -- nested forms break MUI dialogs, so the save
            button is a plain onClick handler. */}
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>
          )}

          <TextField
            label="Title"
            required
            autoFocus
            value={form.title}
            onChange={set("title")}
            size="small"
            fullWidth
          />

          <TextField
            label="Summary"
            value={form.summary}
            onChange={set("summary")}
            placeholder="One line shown on the card"
            size="small"
            fullWidth
          />

          <TextField
            label="Description"
            value={form.description}
            onChange={set("description")}
            multiline
            minRows={3}
            maxRows={10}
            size="small"
            fullWidth
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>Project</InputLabel>
              <Select label="Project" value={form.projectId} onChange={set("projectId")}>
                <MenuItem value="">No project</MenuItem>
                {projectList.map((p) => (
                  <MenuItem key={p.publicId} value={p.publicId}>{p.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
              <InputLabel>Assignee</InputLabel>
              <Select label="Assignee" value={form.assigneeId} onChange={set("assigneeId")}>
                <MenuItem value="">Unassigned</MenuItem>
                {userList.map((u) => (
                  <MenuItem key={u.publicId} value={u.publicId}>
                    {u.displayName || u.username}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={form.status} onChange={set("status")}>
                {WORK_ITEM_STATUSES.map((s) => (
                  <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select label="Priority" value={form.priority} onChange={set("priority")}>
                {PRIORITIES.map((p) => (
                  <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Start date"
              type="date"
              value={form.startDate}
              onChange={set("startDate")}
              InputLabelProps={{ shrink: true }}
              size="small"
              fullWidth
            />
            <TextField
              label="Due date"
              type="date"
              value={form.dueDate}
              onChange={set("dueDate")}
              InputLabelProps={{ shrink: true }}
              size="small"
              fullWidth
            />
          </Stack>

          <FormControl size="small" fullWidth>
            <InputLabel>Labels</InputLabel>
            <Select
              multiple
              label="Labels"
              value={form.labelIds}
              onChange={set("labelIds")}
              input={<OutlinedInput label="Labels" />}
              renderValue={(selected) => (
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                  {selected.map((id) => {
                    const label = labelList.find((l) => l.id === id);
                    return (
                      <Chip key={id} size="small" label={label?.name ?? id} sx={{ height: 20 }} />
                    );
                  })}
                </Box>
              )}
            >
              {labelList.map((l) => (
                <MenuItem key={l.id} value={l.id}>
                  <Checkbox size="small" checked={form.labelIds.includes(l.id)} />
                  <ListItemText primary={l.name} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {saving ? "Saving..." : isEdit ? "Save changes" : "Create task"}
        </Button>
      </DialogActions>
    </>
  );
}

/**
 * @param {boolean}     open
 * @param {function}    onClose
 * @param {object|null} initial           null = create mode
 * @param {string|null} defaultProjectId
 * @param {string|null} defaultStatus     pre-set when created from a board column
 */
export default function TaskFormDialog({
  open,
  onClose,
  initial = null,
  defaultProjectId = null,
  defaultStatus = null,
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  // Mutations live out here so the dialog can refuse to close mid-save.
  const create = useCreateWorkItem();
  const update = useUpdateWorkItem();
  const saving = create.isPending || update.isPending;

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
    >
      <TaskFormBody
        key={initial?.publicId ?? `new:${defaultStatus ?? ""}:${defaultProjectId ?? ""}`}
        onClose={onClose}
        initial={initial}
        defaultProjectId={defaultProjectId}
        defaultStatus={defaultStatus}
        create={create}
        update={update}
      />
    </Dialog>
  );
}
