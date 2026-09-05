import { Alert, Box, Button, Collapse, Typography } from "@mui/material";
import IosShareIcon from "@mui/icons-material/IosShare";
import InstallMobileIcon from "@mui/icons-material/InstallMobile";
import useInstallPrompt from "../../hooks/useInstallPrompt";

/**
 * Dismissible banner rather than a modal — installing is an offer, not a
 * step. Dismissal is remembered in localStorage.
 */
export default function InstallBanner() {
  const { canPrompt, showIosHint, promptInstall, dismiss } = useInstallPrompt();
  const open = canPrompt || showIosHint;

  return (
    <Collapse in={open}>
      <Box sx={{ px: { xs: 1, sm: 2 }, pt: 1 }}>
        <Alert
          severity="info"
          icon={showIosHint ? <IosShareIcon fontSize="small" /> : <InstallMobileIcon fontSize="small" />}
          onClose={dismiss}
          action={
            canPrompt ? (
              <Button color="inherit" size="small" onClick={promptInstall}>
                Install
              </Button>
            ) : null
          }
          sx={{ alignItems: "center" }}
        >
          {showIosHint ? (
            <Typography variant="body2">
              Add to your home screen: tap <strong>Share</strong>, then{" "}
              <strong>Add to Home Screen</strong>.
            </Typography>
          ) : (
            <Typography variant="body2">
              Install Ralphy Tools for offline access and a home-screen icon.
            </Typography>
          )}
        </Alert>
      </Box>
    </Collapse>
  );
}
