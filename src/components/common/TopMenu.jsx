import { Stack, Button, Switch } from "@mui/material";
import { NavLink } from "react-router-dom";

export default function TopMenu({ darkMode, onToggleDarkMode }) {
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{ px: 2, py: 1, borderBottom: "1px solid", borderColor: "divider" }}
    >
      <Button component={NavLink} to="/currency">
        Currency
      </Button>

      <Button component={NavLink} to="/time">
        Time
      </Button>

      <Stack flexGrow={1} />

      <Switch checked={darkMode} onChange={onToggleDarkMode} />
    </Stack>
  );
}
