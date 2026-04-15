import { Box, Checkbox, IconButton, Stack, TextField } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

export default function ShoppingItem({ item, onChange, onDelete }) {
  function handleField(field, value) {
    onChange({ ...item, [field]: value, edited: true });
  }

  return (
    <Stack
      spacing={0.75}
      sx={{
        border: "1px solid",
        borderColor: item.checked ? "divider" : "primary.main",
        borderRadius: 2,
        px: 1.5,
        py: 1,
        opacity: item.checked ? 0.5 : 1,
        transition: "opacity 0.2s, border-color 0.2s"
      }}
    >
      {/* Row 1: Checkbox · Name · Delete */}
      <Stack direction="row" alignItems="center" spacing={1}>
        <Checkbox
          checked={item.checked}
          onChange={(e) => handleField("checked", e.target.checked)}
          size="small"
          sx={{ p: 0.5, flexShrink: 0 }}
        />

        <TextField
          size="small"
          value={item.name}
          onChange={(e) => handleField("name", e.target.value)}
          placeholder="Item name"
          fullWidth
          sx={{
            "& input": {
              textDecoration: item.checked ? "line-through" : "none",
              color: item.checked ? "text.disabled" : "text.primary"
            }
          }}
        />

        <IconButton
          size="small"
          onClick={onDelete}
          color="error"
          sx={{ p: 0.5, flexShrink: 0 }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Stack>

      {/* Row 2: Qty · Unit · Notes (indented to align under name) */}
      <Box sx={{ pl: "36px" }}>
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            type="number"
            value={item.quantity}
            onChange={(e) => handleField("quantity", Number(e.target.value))}
            inputProps={{ min: 0, step: 0.5 }}
            placeholder="Qty"
            sx={{ width: 72, flexShrink: 0 }}
          />

          <TextField
            size="small"
            value={item.unit ?? ""}
            onChange={(e) => handleField("unit", e.target.value || null)}
            placeholder="Unit"
            sx={{ width: 80, flexShrink: 0 }}
          />

          <TextField
            size="small"
            value={item.notes ?? ""}
            onChange={(e) => handleField("notes", e.target.value || null)}
            placeholder="Notes"
            fullWidth
          />
        </Stack>
      </Box>
    </Stack>
  );
}
