import {
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from "@mui/material";

export default function CurrencySelect({
  label,
  value,
  options,
  onChange
}) {
  return (
    <FormControl fullWidth>
      <InputLabel>{label}</InputLabel>
      <Select
        value={value}
        label={label}
        onChange={(e) => onChange(e.target.value)}
      >
        {Object.entries(options).map(([code, name]) => (
          <MenuItem key={code} value={code}>
            {code} — {name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}