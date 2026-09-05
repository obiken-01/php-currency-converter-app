import { useCallback, useEffect, useState } from "react";

const DISMISSED_KEY = "pwa_install_dismissed";

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  // Safari's own flag, set when launched from the home screen.
  window.navigator.standalone === true;

const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  // iPadOS 13+ reports itself as a Mac; the touch points give it away.
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/**
 * Install affordance for both platforms.
 *
 * Chrome, Edge and Android fire `beforeinstallprompt`, which can be deferred
 * and replayed on a button press. iOS Safari never fires it, so there the
 * only option is telling the user where Add to Home Screen lives.
 *
 * @returns {{
 *   canPrompt: boolean,      // a deferred prompt is available to replay
 *   showIosHint: boolean,    // no prompt available; show manual instructions
 *   installed: boolean,      // already running as an installed app
 *   promptInstall: function, // replays the deferred prompt
 *   dismiss: function,       // hides the banner for good
 * }}
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      // Private mode and blocked site data both throw here.
      return false;
    }
  });

  useEffect(() => {
    const onBeforeInstall = (e) => {
      // Chrome shows its own mini-infobar unless this is prevented.
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return null;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // The event is single-use; Chrome fires a fresh one if it re-qualifies.
    setDeferred(null);
    return outcome;
  }, [deferred]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Dismissal just will not persist; not worth failing over.
    }
  }, []);

  const hidden = installed || dismissed;

  return {
    canPrompt: !hidden && Boolean(deferred),
    showIosHint: !hidden && !deferred && isIos(),
    installed,
    promptInstall,
    dismiss,
  };
}

export default useInstallPrompt;
