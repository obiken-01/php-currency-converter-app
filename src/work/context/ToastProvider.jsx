import { useCallback, useMemo, useState } from "react";
import { Alert, Snackbar } from "@mui/material";
import { ToastContext } from "./toastContext";

/**
 * Minimal snackbar so mutations have somewhere to report failures.
 * The spec's `toast.error(...)` calls map onto useToast().error(...).
 */
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const show = useCallback(
    (message, severity = "info") => setToast({ message, severity }),
    []
  );

  const api = useMemo(
    () => ({
      show,
      success: (m) => show(m, "success"),
      error:   (m) => show(m, "error"),
      info:    (m) => show(m, "info"),
      warn:    (m) => show(m, "warning"),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        // Clear of the mobile bottom nav.
        sx={{ mb: { xs: 8, sm: 0 } }}
      >
        {toast ? (
          <Alert
            severity={toast.severity}
            variant="filled"
            onClose={() => setToast(null)}
            sx={{ width: "100%" }}
          >
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </ToastContext.Provider>
  );
}

export default ToastProvider;
