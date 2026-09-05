import { useEffect, useState } from "react";

/**
 * Connectivity, as far as the browser will admit to it.
 *
 * navigator.onLine lies: it reports true on a network that has no route to
 * the internet (captive portals, a router with no WAN). It is reliable in one
 * direction only — false really does mean offline. Treat true as "probably",
 * and for anything that matters confirm with a real request instead.
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}

export default useOnlineStatus;
