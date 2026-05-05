import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  IconButton,
  Pagination,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FilterListIcon from "@mui/icons-material/FilterList";
import SaveIcon from "@mui/icons-material/Save";
import tkApi from "./api/timekeepingApi";

const toLocalDateTimeString = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

const DEFAULT_FORM = {
  taskDescription: "",
  duration: "",
  loggedAt: toLocalDateTimeString(),
};

const DEFAULT_FILTERS = {
  from: "",
  to: "",
  search: "",
  sortBy: "loggedAt",
  sortDir: "desc",
  page: 1,
  pageSize: 20,
};

export default function TimeLogPage() {
  const [logs,          setLogs]          = useState([]);
  const [totalCount,    setTotalCount]    = useState(0);
  const [totalPages,    setTotalPages]    = useState(1);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);

  // Log form
  const [form,          setForm]          = useState(DEFAULT_FORM);
  const [submitting,    setSubmitting]    = useState(false);
  const [formError,     setFormError]     = useState(null);

  // Edit
  const [editingId,     setEditingId]     = useState(null);
  const [editForm,      setEditForm]      = useState({});

  // Filters
  const [filters,       setFilters]       = useState(DEFAULT_FILTERS);
  const [activeFilters, setActiveFilters] = useState(DEFAULT_FILTERS);
  const [exporting,     setExporting]     = useState(false);

  // ── Fetch logs ─────────────────────────────────────────────────
  const fetchLogs = async (f = activeFilters) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page:     f.page,
        pageSize: f.pageSize,
        sortBy:   f.sortBy,
        sortDir:  f.sortDir,
        ...(f.from   && { from:   f.from }),
        ...(f.to     && { to:     f.to }),
        ...(f.search && { search: f.search }),
      };
      const res = await tkApi.get("/logs", { params });
      const data = res.data.data;
      setLogs(data.items ?? []);
      setTotalCount(data.totalCount ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch {
      setError("Failed to load time logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  // ── Create log ─────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!form.taskDescription.trim()) {
      setFormError("Task description is required.");
      return;
    }
    if (!form.duration || isNaN(form.duration) || Number(form.duration) <= 0) {
      setFormError("Duration must be a positive number.");
      return;
    }

    setSubmitting(true);
    try {
      await tkApi.post("/logs", {
        taskDescription: form.taskDescription,
        duration:        Number(form.duration),
        loggedAt:        new Date(form.loggedAt).toISOString(),
      });
      setForm({
        ...DEFAULT_FORM,
        loggedAt: new Date().toISOString().slice(0, 16),
      });
      fetchLogs();
    } catch (err) {
      setFormError(err.response?.data?.message ?? "Failed to create log.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete log ─────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this time log?")) return;
    try {
      await tkApi.delete(`/logs/${id}`);
      fetchLogs();
    } catch {
      setError("Failed to delete log.");
    }
  };

  // ── Edit log ───────────────────────────────────────────────────
  const startEdit = (log) => {
    setEditingId(log.id);
    setEditForm({
      taskDescription: log.taskDescription,
      duration:        log.duration,
      loggedAt:        new Date(log.loggedAt).toISOString().slice(0, 16),
    });
  };

  const handleEditSave = async (id) => {
    try {
      await tkApi.put(`/logs/${id}`, {
        taskDescription: editForm.taskDescription,
        duration:        Number(editForm.duration),
        loggedAt:        new Date(editForm.loggedAt).toISOString(),
      });
      setEditingId(null);
      fetchLogs();
    } catch {
      setError("Failed to update log.");
    }
  };

  // ── Apply filters ──────────────────────────────────────────────
  const handleApplyFilters = () => {
    const updated = { ...filters, page: 1 };
    setActiveFilters(updated);
    fetchLogs(updated);
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setActiveFilters(DEFAULT_FILTERS);
    fetchLogs(DEFAULT_FILTERS);
  };

  const handlePageChange = (_, page) => {
    const updated = { ...activeFilters, page };
    setActiveFilters(updated);
    fetchLogs(updated);
  };

  // ── Export CSV ─────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {
        sortBy:  activeFilters.sortBy,
        sortDir: activeFilters.sortDir,
        ...(activeFilters.from   && { from:   activeFilters.from }),
        ...(activeFilters.to     && { to:     activeFilters.to }),
        ...(activeFilters.search && { search: activeFilters.search }),
      };
      const res = await tkApi.get("/logs/export", {
        params,
        responseType: "blob",
      });
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      const from = activeFilters.from || "all";
      const to   = activeFilters.to   || "all";
      link.href  = url;
      link.setAttribute("download", `timelogs-${from}-${to}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Failed to export CSV.");
    } finally {
      setExporting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <Stack spacing={3}>

      {/* ── Log Form ── */}
      <Card elevation={0} variant="outlined">
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Log a Task
          </Typography>

          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}
                   onClose={() => setFormError(null)}>
              {formError}
            </Alert>
          )}

          <Stack
            component="form"
            onSubmit={handleSubmit}
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ sm: "flex-end" }}
          >
            <TextField
                label="Task Description *"
                value={form.taskDescription}
                onChange={e => setForm({ ...form, taskDescription: e.target.value })}
                placeholder="e.g. Daily standup"
                size="small"
                multiline
                minRows={1}
                maxRows={4}
                sx={{ flex: 3 }}
                required
                />
            <TextField
              label="Duration (hrs) *"
              type="number"
              value={form.duration}
              onChange={e => setForm({ ...form, duration: e.target.value })}
              placeholder="e.g. 1.5"
              size="small"
              inputProps={{ step: "0.5", min: "0.5" }}
              sx={{ flex: 1 }}
              required
            />
            <TextField
              label="Logged At *"
              type="datetime-local"
              value={form.loggedAt}
              onChange={e => setForm({ ...form, loggedAt: e.target.value })}
              size="small"
              sx={{ flex: 2 }}
              InputLabelProps={{ shrink: true }}
              required
            />
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              startIcon={submitting
                ? <CircularProgress size={16} color="inherit" />
                : <AddIcon />}
              sx={{ flexShrink: 0 }}
            >
              {submitting ? "Saving..." : "Add Log"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Filters ── */}
      <Card elevation={0} variant="outlined">
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <FilterListIcon fontSize="small" color="action" />
            <Typography variant="subtitle1" fontWeight={600}>
              Filter Logs
            </Typography>
            {totalCount > 0 && (
              <Typography variant="body2" color="text.secondary">
                — {totalCount} result{totalCount !== 1 ? "s" : ""}
              </Typography>
            )}
          </Stack>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ sm: "flex-end" }}
            flexWrap="wrap"
          >
            <TextField
              label="From"
              type="date"
              value={filters.from}
              onChange={e => setFilters({ ...filters, from: e.target.value })}
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1, minWidth: 140 }}
            />
            <TextField
              label="To"
              type="date"
              value={filters.to}
              onChange={e => setFilters({ ...filters, to: e.target.value })}
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1, minWidth: 140 }}
            />
            <TextField
              label="Search description"
              value={filters.search}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
              placeholder="e.g. standup"
              size="small"
              sx={{ flex: 2, minWidth: 180 }}
            />
            <Stack direction="row" spacing={2} sx={{ flexShrink: 0 }}>
              <Button variant="contained" onClick={handleApplyFilters}>
                Apply
              </Button>
              <Button variant="outlined" onClick={handleResetFilters}>
                Reset
              </Button>
              <Button
                variant="outlined"
                startIcon={exporting
                  ? <CircularProgress size={16} color="inherit" />
                  : <FileDownloadIcon />}
                onClick={handleExport}
                disabled={exporting || totalCount === 0}
              >
                {exporting ? "Exporting..." : "Export CSV"}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Logs Table ── */}
      <Card elevation={0} variant="outlined">
        <CardContent sx={{ p: 0 }}>

          {error && (
            <Alert severity="error" sx={{ m: 2 }}
                   onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
              <CircularProgress />
            </Box>
          ) : logs.length === 0 ? (
            <Box sx={{ textAlign: "center", p: 6 }}>
              <Typography color="text.secondary">
                No time logs found.
              </Typography>
            </Box>
          ) : (
            <>
              <TableContainer sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Logged At</TableCell>
                      <TableCell>Task Description</TableCell>
                      <TableCell align="right">Duration (hrs)</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id} hover>
                        {editingId === log.id ? (
                          <>
                            <TableCell>
                              <TextField
                                type="datetime-local"
                                value={editForm.loggedAt}
                                onChange={e => setEditForm({
                                  ...editForm, loggedAt: e.target.value
                                })}
                                size="small"
                                InputLabelProps={{ shrink: true }}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                value={editForm.taskDescription}
                                onChange={e => setEditForm({
                                  ...editForm,
                                  taskDescription: e.target.value
                                })}
                                size="small"
                                fullWidth
                              />
                            </TableCell>
                            <TableCell align="right">
                              <TextField
                                type="number"
                                value={editForm.duration}
                                onChange={e => setEditForm({
                                  ...editForm, duration: e.target.value
                                })}
                                size="small"
                                inputProps={{ step: "0.5", min: "0.5" }}
                                sx={{ width: 90 }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Stack direction="row"
                                     justifyContent="flex-end"
                                     spacing={0.5}>
                                <Tooltip title="Save">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => handleEditSave(log.id)}
                                  >
                                    <SaveIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Cancel">
                                  <IconButton
                                    size="small"
                                    onClick={() => setEditingId(null)}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell>
                              <Typography variant="body2" noWrap>
                                {new Date(log.loggedAt).toLocaleString(
                                  "en-US", {
                                    month:  "short",
                                    day:    "numeric",
                                    year:   "numeric",
                                    hour:   "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {log.taskDescription}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2">
                                {Number(log.duration).toFixed(2).replace(/\.00$/, '')}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Stack direction="row"
                                     justifyContent="flex-end"
                                     spacing={0.5}>
                                <Tooltip title="Edit">
                                  <IconButton
                                    size="small"
                                    onClick={() => startEdit(log)}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleDelete(log.id)}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {totalPages > 1 && (
                <>
                  <Divider />
                  <Box sx={{ display: "flex", justifyContent: "center",
                             p: 2 }}>
                    <Pagination
                      count={totalPages}
                      page={activeFilters.page}
                      onChange={handlePageChange}
                      color="primary"
                      size="small"
                    />
                  </Box>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

    </Stack>
  );
}