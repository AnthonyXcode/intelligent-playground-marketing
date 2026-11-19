// Logger: console + state/logs/YYYY-MM-DD.log (date in config timezone).
import fs from "node:fs";
import path from "node:path";
import { localDate } from "./time.mjs";

export function makeLogger(logDir, tz = "Asia/Hong_Kong", { quiet = false } = {}) {
  if (logDir) fs.mkdirSync(logDir, { recursive: true });
  const write = (level, msg) => {
    const now = new Date();
    const line = `${now.toISOString()} [${level}] ${msg}`;
    if (!quiet) (level === "ERROR" || level === "WARN" ? console.error : console.log)(line);
    if (logDir) {
      try { fs.appendFileSync(path.join(logDir, `${localDate(now, tz)}.log`), line + "\n"); } catch {}
    }
  };
  return {
    info: (m) => write("INFO", m),
    warn: (m) => write("WARN", m),
    error: (m) => write("ERROR", m),
  };
}

export const nullLogger = { info() {}, warn() {}, error() {} };
