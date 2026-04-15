import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";

import ShoppingItem from "./ShoppingItem";

const API_URL =
  "https://ralph-portfolio-production.up.railway.app/api/shopping-list/parse";
const API_KEY = import.meta.env.VITE_SHOPPING_API_KEY ?? "";
const STORAGE_KEY = "ralphy-shopping-list";

function loadList() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function createItem(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: "",
    quantity: 1,
    unit: null,
    notes: null,
    checked: false,
    edited: false,
    ...overrides
  };
}

export default function ShoppingListPage() {
  const [items, setItems] = useState(loadList);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const resp = await fetch(API_URL, {
        method: "POST",
        headers: { "X-Api-Key": API_KEY },
        body: formData
      });

      const data = await resp.json();

      if (!data.success) {
        setError(data.message ?? "Failed to parse image.");
        return;
      }

      if (!data.data.items.length) {
        setError(
          "No items found. Try a clearer photo with better lighting."
        );
        return;
      }

      const parsed = data.data.items.map((item) =>
        createItem({
          name: item.name,
          quantity: item.quantity ?? 1,
          unit: item.unit ?? null,
          notes: item.notes ?? null
        })
      );

      setItems((prev) => [...prev, ...parsed]);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(updatedItem) {
    setItems((prev) =>
      prev.map((item) => (item.id === updatedItem.id ? updatedItem : item))
    );
  }

  function handleDelete(id) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function handleAdd() {
    setItems((prev) => [...prev, createItem()]);
  }

  function handleClear() {
    setItems([]);
  }

  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <Card
      elevation={0}
      sx={{
        maxWidth: 720,
        mx: "auto",
        mt: { xs: 2, sm: 4 },
        borderRadius: 0,
        backgroundColor: "transparent"
      }}
    >
      <CardContent sx={{ px: { xs: 2, sm: 3 } }}>
        <Stack spacing={2.5}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h6" fontWeight={600}>
              Shopping List
            </Typography>

            {items.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                {checkedCount}/{items.length}
              </Typography>
            )}

            <Stack flexGrow={1} />

            {items.length > 0 && (
              <Tooltip title="Clear all items">
                <IconButton size="small" onClick={handleClear} color="error">
                  <DeleteSweepIcon />
                </IconButton>
              </Tooltip>
            )}
          </Stack>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleImageUpload}
          />
          <Button
            variant="outlined"
            startIcon={
              loading ? <CircularProgress size={16} /> : <CameraAltIcon />
            }
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            fullWidth
          >
            {loading ? "Scanning…" : "Scan List"}
          </Button>

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {items.length > 0 && (
            <>
              <Divider />
              <Stack spacing={1.5}>
                {items.map((item) => (
                  <ShoppingItem
                    key={item.id}
                    item={item}
                    onChange={handleChange}
                    onDelete={() => handleDelete(item.id)}
                  />
                ))}
              </Stack>
            </>
          )}

          <Button
            variant="text"
            startIcon={<AddIcon />}
            onClick={handleAdd}
            sx={{ alignSelf: "flex-start" }}
          >
            Add item
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
