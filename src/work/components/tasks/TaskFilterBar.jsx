import {
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  InputAdornment,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import { useTaskFilters, activeFilterCount } from "../../context/taskFilterContext";
import { useProjects } from "../../hooks/useProjects";
import { useLabels } from "../../hooks/useLabels";
import { WORK_ITEM_STATUSES, PRIORITIES, getStatus } from "../../constants/statuses";

const FIELD = { minWidth: 140 };

export default function TaskFilterBar() {
  const { filters, setFilter, reset, searchInput, setSearchInput } = useTaskFilters();
  const { data: projects } = useProjects();
  const { data: labels } = useLabels();

  const projectList = projects?.items ?? projects ?? [];
  const labelList = labels?.items ?? labels ?? [];
  const activeCount = activeFilterCount(filters);

  return (
    <Stack
      direction="row"
      flexWrap="wrap"
      gap={1.5}
      alignItems="center"
      sx={{ mb: 2 }}
    >
      <TextField
        size="small"
        placeholder="Search tasks"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        sx={{ minWidth: 200, flexGrow: 1, maxWidth: 320 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
          endAdornment: searchInput ? (
            <InputAdornment position="end">
              <ClearIcon
                fontSize="small"
                sx={{ cursor: "pointer" }}
                onClick={() => setSearchInput("")}
              />
            </InputAdornment>
          ) : null,
        }}
      />

      {/* My tasks | All -- hides unassigned backlog noise even with one account */}
      <ToggleButtonGroup
        size="small"
        exclusive
        value={filters.assignee === "me" ? "me" : "all"}
        onChange={(_, next) => {
          if (next === null) return;
          setFilter("assignee", next === "me" ? "me" : "");
        }}
      >
        <ToggleButton value="me" sx={{ textTransform: "none", px: 1.5 }}>
          My tasks
        </ToggleButton>
        <ToggleButton value="all" sx={{ textTransform: "none", px: 1.5 }}>
          All
        </ToggleButton>
      </ToggleButtonGroup>

      <FormControl size="small" sx={FIELD}>
        <InputLabel>Project</InputLabel>
        <Select
          label="Project"
          value={filters.projectId}
          onChange={(e) => setFilter("projectId", e.target.value)}
        >
          <MenuItem value="">All projects</MenuItem>
          {projectList.map((p) => (
            <MenuItem key={p.publicId} value={p.publicId}>{p.name}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ ...FIELD, minWidth: 170 }}>
        <InputLabel>Status</InputLabel>
        <Select
          multiple
          label="Status"
          value={filters.statuses}
          onChange={(e) => setFilter("statuses", e.target.value)}
          input={<OutlinedInput label="Status" />}
          renderValue={(selected) => (
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "nowrap", overflow: "hidden" }}>
              {selected.map((value) => (
                <Chip
                  key={value}
                  size="small"
                  label={getStatus(value).label}
                  sx={{ height: 20 }}
                />
              ))}
            </Box>
          )}
        >
          {WORK_ITEM_STATUSES.map((status) => (
            <MenuItem key={status.value} value={status.value}>
              <Checkbox
                size="small"
                checked={filters.statuses.includes(status.value)}
              />
              <ListItemText primary={status.label} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={FIELD}>
        <InputLabel>Priority</InputLabel>
        <Select
          label="Priority"
          value={filters.priority}
          onChange={(e) => setFilter("priority", e.target.value)}
        >
          <MenuItem value="">Any</MenuItem>
          {PRIORITIES.map((p) => (
            <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={FIELD}>
        <InputLabel>Label</InputLabel>
        <Select
          label="Label"
          value={filters.labelId}
          onChange={(e) => setFilter("labelId", e.target.value)}
        >
          <MenuItem value="">Any</MenuItem>
          {labelList.map((l) => (
            <MenuItem key={l.publicId} value={l.publicId}>{l.name}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        size="small"
        type="date"
        label="From"
        value={filters.from}
        onChange={(e) => setFilter("from", e.target.value)}
        InputLabelProps={{ shrink: true }}
        sx={{ width: 150 }}
      />
      <TextField
        size="small"
        type="date"
        label="To"
        value={filters.to}
        onChange={(e) => setFilter("to", e.target.value)}
        InputLabelProps={{ shrink: true }}
        sx={{ width: 150 }}
      />

      {activeCount > 0 && (
        <Tooltip title="Clear all filters">
          <Button size="small" onClick={reset} startIcon={<ClearIcon fontSize="small" />}>
            Clear ({activeCount})
          </Button>
        </Tooltip>
      )}
    </Stack>
  );
}
