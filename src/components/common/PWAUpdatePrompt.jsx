import { Button, Snackbar } from "@mui/material";
import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * registerType is 'prompt', so a new worker waits until the user agrees.
 * Reload activates it and refreshes; Later leaves the current version alone
 * until the next load.
 */
export default function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  return (
    <Snackbar
      open={needRefresh}
      message="A new version is available."
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      // Clear of the mobile bottom navigation.
      sx={{ mb: { xs: 8, sm: 0 } }}
      action={
        <>
          <Button color="secondary" size="small" onClick={() => updateServiceWorker(true)}>
            Reload
          </Button>
          <Button color="inherit" size="small" onClick={() => setNeedRefresh(false)}>
            Later
          </Button>
        </>
      }
    />
  );
}
