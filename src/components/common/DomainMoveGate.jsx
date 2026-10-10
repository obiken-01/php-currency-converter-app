import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Stack, Typography } from "@mui/material";
import { subscribe } from "../../work/offline/outbox";
import { isRetiredHost, moveToNewDomain } from "../../lib/domainMove";

const retired = isRetiredHost(window.location.hostname);

/**
 * On the old Netlify address only: send everyone to tools.ralphalcaide.com.
 *
 * With nothing queued that happens straight away. With time logs still in the
 * outbox it waits -- they only exist on this address -- and says why. The
 * Work area's own sync drains the queue; the subscription sees it reach zero
 * and the move happens then, with no second click.
 */
export default function DomainMoveGate() {
  const navigate = useNavigate();
  const [pending, setPending] = useState(null);

  useEffect(() => {
    if (!retired) return undefined;
    const unsubscribe = subscribe(setPending);
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (pending === 0) moveToNewDomain();
  }, [pending]);

  if (!retired || !pending) return null;

  const changes = `${pending} unsynced change${pending === 1 ? "" : "s"}`;

  const moveAnyway = () => {
    if (window.confirm(`${changes} will stay behind on this old address. Move anyway?`)) {
      moveToNewDomain();
    }
  };

  return (
    <Box role="status" sx={{ py: 1, px: 2, bgcolor: "info.main", color: "info.contrastText" }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems="center"
        justifyContent="center"
        spacing={1}
      >
        <Typography variant="caption" fontWeight={600} textAlign="center">
          Ralphy Tools has moved to tools.ralphalcaide.com. {changes} here need to
          sync first: open Work while online and you'll be moved automatically.
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button size="small" color="inherit" variant="outlined" onClick={() => navigate("/work/logs")}>
            Open Work
          </Button>
          <Button size="small" color="inherit" onClick={moveAnyway}>
            Move anyway
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
