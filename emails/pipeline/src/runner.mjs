// One pipeline run: lock -> check replies -> send due -> report -> unlock.
import { acquireLock } from "./lock.mjs";
import { checkReplies } from "./replies.mjs";
import { sendDue } from "./sender.mjs";
import { writeReport } from "./report.mjs";
import { zonedParts, localDate } from "./time.mjs";

/** --scheduled: send on a send day after sendTime (until sendWindowEndHour) if no send run completed today. */
export function scheduledMode(ctx) {
  const { cfg, db } = ctx;
  const now = ctx.now();
  const p = zonedParts(now, cfg.timezone);
  const [h, m] = cfg.schedule.sendTime.split(":").map(Number);
  const cur = p.hour * 60 + p.minute;
  const sendDay = cfg.schedule.sendDays.includes(p.weekday);
  const inWindow = cur >= h * 60 + m - 10 && p.hour < (cfg.schedule.sendWindowEndHour ?? 20);
  const today = localDate(now, cfg.timezone);
  const doneToday = db.prepare("SELECT started_at FROM runs WHERE mode = 'send' AND status IN ('ok','partial')").all()
    .some((r) => localDate(new Date(r.started_at), cfg.timezone) === today);
  return sendDay && inWindow && !doneToday ? "send" : "check-only";
}

export async function runPipeline(ctx, { dryRun = false, checkOnly = false, scheduled = false, limit } = {}) {
  const { db, cfg, log } = ctx;
  if (cfg.enabled === false) { log.warn("config.enabled = false: kill switch on, exiting without doing anything"); return { code: 0, skipped: true }; }
  const release = acquireLock(ctx.paths.lock);
  let mode = dryRun ? "dry-run" : checkOnly ? "check-only" : "send";
  if (scheduled && !dryRun && !checkOnly) mode = scheduledMode(ctx);
  const runId = Number(db.prepare("INSERT INTO runs (started_at, mode, status) VALUES (?,?, 'running')").run(ctx.now().toISOString(), mode).lastInsertRowid);
  const result = { code: 0, mode, sent: 0, replies: 0, errors: 0, replyList: [] };
  let hold = new Set();
  let status = "ok", note = "";
  log.info(`=== run ${runId} start: mode=${mode}${cfg.testRecipient ? `, TEST MODE -> ${cfg.testRecipient}` : ""}`);
  try {
    if (mode !== "dry-run") {
      if (!ctx.gmail) throw Object.assign(new Error("Gmail client not available (not logged in). Run ./emails/scripts/setup.sh"), { name: "AuthError" });
      const me = (await ctx.gmail.profileEmail()).toLowerCase();
      if (me !== cfg.sender.email.toLowerCase()) throw Object.assign(new Error(`Logged in as ${me} but config.sender.email is ${cfg.sender.email}. Run ./emails/scripts/setup.sh and log in with the right account.`), { name: "AuthError" });
      const r = await checkReplies(ctx);
      result.replies = r.newReplies; result.errors += r.errors; result.replyList = r.replies; hold = r.hold || hold;
    } else log.info("dry-run: reply check skipped, nothing is sent and no state or labels change");
    if (mode === "send" || mode === "dry-run") {
      const s = await sendDue(ctx, { dryRun: mode === "dry-run", limit, hold });
      result.sent = s.sent; result.errors += s.errors; result.previews = s.previews;
    }
    if (result.errors) status = "partial";
  } catch (e) {
    result.errors++;
    if (e.name === "AuthError") { status = "auth_error"; result.code = 2; log.error(`AUTH: ${e.message}`); }
    else { status = "failed"; result.code = 1; log.error(`run failed: ${e.stack || e.message}`); }
    note = e.message.slice(0, 300);
  } finally {
    db.prepare("UPDATE runs SET finished_at = ?, sent = ?, replies = ?, errors = ?, status = ?, note = ? WHERE id = ?")
      .run(ctx.now().toISOString(), result.sent, result.replies, result.errors, status, note, runId);
    try { writeReport(ctx); } catch (e) { log.error(`report: ${e.message}`); }
    release();
    log.info(`=== run ${runId} end: ${status}, sent ${result.sent}${mode === "dry-run" ? " (previews)" : ""}, new replies ${result.replies}, errors ${result.errors}`);
  }
  result.status = status;
  return result;
}
