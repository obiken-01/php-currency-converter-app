import { useState } from "react";
import { Box } from "@mui/material";
import timezones from "../../config/timezones.config.json";

import TimeCard from "./TimeCard";
import TimeMenu from "./TimeMenu";
import {
  getCurrentPHMinutesUTC8,
  convertTime
} from "./timeUtils";

const PH_OFFSET = 8;

export default function TimePage() {
  const [phMinutes, setPhMinutes] = useState(
    getCurrentPHMinutesUTC8()
  );

  const phTimezone = timezones.timezones.find(tz => tz.id === "PH");
  const otherTimezones = timezones.timezones.filter(tz => tz.id !== "PH");

  return (
    <Box>
      {/* 🔒 Sticky block */}
      <Box 
        className="sticky-header"
        sx={{
          bgcolor: "background.paper",
          borderBottom: "1px solid",
          borderColor: "divider"
        }}>
        <TimeMenu onReset={() => setPhMinutes(getCurrentPHMinutesUTC8())} />

        <TimeCard
          label="Philippines (UTC+8)"
          minutes={phMinutes}
          onChange={setPhMinutes}
          isBase
        />
      </Box>

      {/* ⬇️ Scrollable content */}
      <Box>
        {otherTimezones.map(tz => {
          const minutes = convertTime(
            phMinutes,
            PH_OFFSET,
            tz.gmtOffset
          );

          return (
            <TimeCard
              key={tz.id}
              label={`${tz.label} (UTC${tz.gmtOffset >= 0 ? "+" : ""}${tz.gmtOffset})`}
              minutes={minutes}
              onChange={(m) => {
                const ph =
                  m - (tz.gmtOffset - PH_OFFSET) * 60;
                setPhMinutes(((ph % 1440) + 1440) % 1440);
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
}
