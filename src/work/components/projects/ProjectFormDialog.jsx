import { useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { PROJECT_STATUSES } from "../../constants/statuses";
import { useCreateProject, useUpdateProject } from "../../hooks/useProjects";
import { useToast } from "../../context/toastContext";

const EMPTY = {
  name: "",
  description: "",
  status: "Planned",
  startDate: "",
  targetEndDate: "",
};

// The end date is targetEndDate on both sides of the wire. Calling it dueDate
// here meant the field bound to nothing on CreateProjectDto: the save returned
// 200 and the date was simply gone, and reopening the dialog showed it blank
// because the response has no dueDate to read back either.
const buildForm = (initial) =>
  initial
    ? {
        name:          initial.name ?? "",
        description:   initial.description ?? "",
        status:        initial.status ?? "Planned",
        startDate:     initial.startDate?.slice(0, 10) ?? "",
        targetEndDate: initial.targetEndDate?.slice(0, 10) ?? "",
      }
    : { ...EMPTY };

function ProjectFormBody({ onClose, initial, create, update }) {
  const toast = useToast();
  const isEdit = Boolean(initial);
  const saving = create.isPending || update.isPending;

  const [form, setForm] = useState(() => buildForm(initial));
  const [error, setError] = useState(null);

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (form.startDate && form.targetEndDate && form.startDate > form.targetEndDate) {
      setError("Start date must not be after the due date.");
      return;
    }

    const dto = {
      name:          form.name.trim(),
      description:   form.description.trim() || null,
      status:        form.status,
      startDate:     form.startDate || null,
      targetEndDate: form.targetEndDate || null,
    };

    try {
      if (isEdit) {
        await update.mutateAsync({ publicId: initial.publicId, dto });
        toast.success("Project updated.");
      } else {
        await create.mutateAsync(dto);
        toast.success("Project created.");
      }
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message ?? "Could not save the project.");
    }
  };

  return (
    <>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {isEdit ? "Edit project" : "New project"}
      </DialogTitle>

      <DialogContent dividers>
        {/* onClick handlers only -- no <form> element in this codebase's dialogs. */}
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

          <TextField
            label="Name"
            required
            autoFocus
            value={form.name}
            onChange={set("name")}
            size="small"
            fullWidth
          />

          <TextField
            label="Description"
            value={form.description}
            onChange={set("description")}
            multiline
            minRows={3}
            maxRows={8}
            size="small"
            fullWidth
          />

          <FormControl size="small" fullWidth>
            <InputLabel>Status</InputLabel>
            <Select label="Status" value={form.status} onChange={set("status")}>
              {PROJECT_STATUSES.map((s) => (
                <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

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
              value={form.targetEndDate}
              onChange={set("targetEndDate")}
              InputLabelProps={{ shrink: true }}
              size="small"
              fullWidth
            />
          </Stack>
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
          {saving ? "Saving..." : isEdit ? "Save changes" : "Create project"}
        </Button>
      </DialogActions>
    </>
  );
}

/**
 * @param {boolean}     open
 * @param {function}    onClose
 * @param {object|null} initial  null = create mode
 */
export default function ProjectFormDialog({ open, onClose, initial = null }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const create = useCreateProject();
  const update = useUpdateProject();
  const saving = create.isPending || update.isPending;

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
    >
      <ProjectFormBody
        key={initial?.publicId ?? "new"}
        onClose={onClose}
        initial={initial}
        create={create}
        update={update}
      />
    </Dialog>
  );
}
