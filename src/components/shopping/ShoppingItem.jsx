import { Checkbox, TextField, IconButton, Stack } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

export default function ShoppingItem({ item, onChange, onDelete }) {
  function handleField(field, value) {
    onChange({ ...item, [field]: value, edited: true });
  }

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      flexWrap="wrap"
      rowGap={1}
    >
      <Checkbox
        checked={item.checked}
        onChange={(e) => handleField("checked", e.target.checked)}
        size="small"
        sx={{ p: 0.5 }}
      />

      <TextField
        size="small"
        value={item.name}
        onChange={(e) => handleField("name", e.target.value)}
        placeholder="Item name"
        sx={{
          flexGrow: 1,
          minWidth: 120,
          "& input": {
            textDecoration: item.checked ? "line-through" : "none",
            color: item.checked ? "text.disabled" : "text.primary"
          }
        }}
      />

      <TextField
        size="small"
        type="number"
        value={item.quantity}
        onChange={(e) => handleField("quantity", Number(e.target.value))}
        inputProps={{ min: 0, step: 0.5 }}
        placeholder="Qty"
        sx={{ width: 72 }}
      />

      <TextField
        size="small"
        value={item.unit ?? ""}
        onChange={(e) => handleField("unit", e.target.value || null)}
        placeholder="Unit"
        sx={{ width: 80 }}
      />

      <TextField
        size="small"
        value={item.notes ?? ""}
        onChange={(e) => handleField("notes", e.target.value || null)}
        placeholder="Notes"
        sx={{ flexGrow: 1, minWidth: 80 }}
      />

      <IconButton size="small" onClick={onDelete} color="error" sx={{ p: 0.5 }}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}
