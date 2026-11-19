// launchd plist generation. StartCalendarInterval uses the Mac's local time, so
// schedule times given in config.timezone are converted to the local zone.
import { tzOffsetMinutes, WEEKDAYS } from "./time.mjs";

export const LABEL = "com.antapp.ip-outreach";

const hm = (s) => s.split(":").map(Number);

/** Returns { slots: [{Weekday?, Hour, Minute}], deltaMinutes, localTz }. */
export function scheduleSlots(cfg, now = new Date(), localTz = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const delta = tzOffsetMinutes(localTz, now) - tzOffsetMinutes(cfg.timezone, now);
  const out = [];
  const add = (weekday, time) => {
    const [h, m] = hm(time);
    let t = h * 60 + m + delta;
    const shift = Math.floor(t / 1440);
    t = ((t % 1440) + 1440) % 1440;
    const slot = {};
    if (weekday !== null) slot.Weekday = (((weekday + shift) % 7) + 7) % 7;
    slot.Hour = Math.floor(t / 60);
    slot.Minute = t % 60;
    if (!out.some((o) => JSON.stringify(o) === JSON.stringify(slot))) out.push(slot);
  };
  for (const d of cfg.schedule.sendDays) add(WEEKDAYS.indexOf(d), cfg.schedule.sendTime);
  add(null, cfg.schedule.checkTime);
  return { slots: out, deltaMinutes: delta, localTz };
}

const x = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function buildPlist({ runSh, pathEnv, home, logsDir, workDir, slots }) {
  const dict = (o) => `<dict>${Object.entries(o).map(([k, v]) => `<key>${k}</key><integer>${v}</integer>`).join("")}</dict>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>${x(runSh)}</string><string>--scheduled</string></array>
  <key>WorkingDirectory</key><string>${x(workDir)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>${x(pathEnv)}</string>
    <key>HOME</key><string>${x(home)}</string>
    <key>LANG</key><string>en_US.UTF-8</string>
  </dict>
  <key>StartCalendarInterval</key>
  <array>
    ${slots.map(dict).join("\n    ")}
  </array>
  <key>RunAtLoad</key><false/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>${x(logsDir)}/launchd.out.log</string>
  <key>StandardErrorPath</key><string>${x(logsDir)}/launchd.err.log</string>
</dict>
</plist>
`;
}
