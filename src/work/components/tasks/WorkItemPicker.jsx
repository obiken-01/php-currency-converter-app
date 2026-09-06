import { useState } from "react";
import { Autocomplete, Box, CircularProgress, TextField, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import tasksApi from "../../api/tasksApi";
import { qk } from "../../constants/queryKeys";
import { ACTIVE_STATUSES } from "../../constants/statuses";
import StatusChip from "../common/StatusChip";

const PAGE_SIZE = 20;

/**
 * Searchable picker for the item a time log belongs to.
 *
 * With no search term the options default to Todo and InProgress — you are
 * almost never logging time against Backlog.
 *
 * @param {object|null} value     the selected item, or null
 * @param {function}    onChange  (item|null) => void
 * @param {string}      [label]
 */
export default function WorkItemPicker({ value, onChange, label = "Task", size = "small", sx }) {
  const [input, setInput] = useState("");
  const search = input.trim();

  const params = {
    page: 1,
    pageSize: PAGE_SIZE,
    sortBy: "updatedAt",
    sortDir: "desc",
    ...(search
      ? { search }
      : { statuses: ACTIVE_STATUSES.join(",") }),
  };

  const { data, isFetching } = useQuery({
    queryKey: qk.tasks(params),
    queryFn: () => tasksApi.query(params),
    staleTime: 30_000,
  });

  const options = data?.items ?? [];

  return (
    <Autocomplete
      value={value ?? null}
      onChange={(_, next) => onChange(next)}
      inputValue={input}
      onInputChange={(_, next, reason) => {
        // Selecting an option would otherwise overwrite the search term.
        if (reason !== "reset") setInput(next);
      }}
      options={options}
      getOptionLabel={(option) => option?.title ?? ""}
      isOptionEqualToValue={(option, selected) => option.publicId === selected?.publicId}
      filterOptions={(x) => x}
      loading={isFetching}
      size={size}
      sx={sx}
      noOptionsText={search ? "No matching tasks" : "No open tasks"}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        return (
          <Box component="li" key={key} {...rest} sx={{ display: "flex", gap: 1 }}>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="body2" noWrap>{option.title}</Typography>
              {option.projectName && (
                <Typography variant="caption" color="text.secondary" noWrap>
                  {option.projectName}
                </Typography>
              )}
            </Box>
            <StatusChip status={option.status} />
          </Box>
        );
      }}
      renderInput={(params_) => (
        <TextField
          {...params_}
          label={label}
          placeholder="Link this log to a task"
          InputProps={{
            ...params_.InputProps,
            endAdornment: (
              <>
                {isFetching ? <CircularProgress size={16} /> : null}
                {params_.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
