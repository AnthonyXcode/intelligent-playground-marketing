// Single-run lock file (state/run.lock) holding the pid; stale locks are removed.
// A lock is stale if its pid is dead or it predates the last boot (pid reuse). A live
// run is never taken over, however long it takes (two runs would double-send).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } };

export function acquireLock(file, bootMs = Date.now() - os.uptime() * 1000) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let i = 0; i < 2; i++) {
    try {
      const fd = fs.openSync(file, "wx", 0o600);
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
      fs.closeSync(fd);
      return () => { try { if (JSON.parse(fs.readFileSync(file, "utf8")).pid === process.pid) fs.unlinkSync(file); } catch {} };
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      let info = {};
      try { info = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
      const at = Date.parse(info.at || 0);
      if (info.pid && alive(info.pid) && at > bootMs) throw new Error(`another run is in progress (pid ${info.pid}, since ${info.at}); lock: ${file}`);
      fs.rmSync(file, { force: true }); // stale
    }
  }
  throw new Error(`could not acquire lock ${file}`);
}
