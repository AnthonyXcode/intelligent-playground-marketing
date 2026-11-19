#!/usr/bin/env node
// Entry point used by the shell scripts. Usage: node src/cli.mjs <command> [options]
//   run [--dry-run] [--check-only] [--scheduled] [--limit N]   one pipeline run
//   retry-errors                                                put error schools back in the queue
//   reactivate [--campaign NAME] [--level KG|PRI|SEC|SPE] [--include-replied] [--dry-run]
//                                                               new campaign for cap-reached schools
//   reset-test                                                  undo state created by testRecipient sends
//   login | labels | whoami                                     Gmail OAuth / labels / check token
//   init                                                        create DB + import data/schools.csv
//   import                                                      re-import data/schools.csv
//   status                                                      print summary + write state/report.html
//   plist --run-sh <path> --path <PATH> [--out <file>]          print/write the launchd plist
import fs from "node:fs";
import os from "node:os";
import { resolvePaths } from "./paths.mjs";
import { loadConfig } from "./config.mjs";
import { makeLogger } from "./log.mjs";
import { openDb, importSchools, reactivate, LEVELS } from "./db.mjs";
import { loadContent } from "./content.mjs";
import { makeClaude } from "./claude.mjs";
import { runPipeline } from "./runner.mjs";
import { writeReport, renderText } from "./report.mjs";
import { scheduleSlots, buildPlist, LABEL } from "./launchd.mjs";
import { tzOffsetMinutes } from "./time.mjs";

const argv = process.argv.slice(2);
const cmd = argv[0];
const has = (f) => argv.includes(f);
const opt = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };

const paths = resolvePaths();
const cfg = loadConfig(paths.config);
const log = makeLogger(paths.logs, cfg.timezone);

async function gmailClient({ required }) {
  const { authClient, makeGmail } = await import("./gmail.mjs");
  try { return makeGmail(authClient(paths), { log }); } catch (e) {
    if (required) throw e;
    return null;
  }
}

function ctxBase(db) {
  return { paths, cfg, db, log, now: () => new Date() };
}

function contentLoader() {
  const cache = new Map();
  return (campaign) => {
    if (!cache.has(campaign)) cache.set(campaign, loadContent(paths.content, (campaign && cfg.campaigns?.[campaign]) || {}));
    return cache.get(campaign);
  };
}

function randomDelay() {
  if (process.env.IP_NO_DELAY) return Promise.resolve();
  const [a, b] = cfg.delaySeconds;
  const ms = Math.round((a + Math.random() * (b - a)) * 1000);
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  switch (cmd) {
    case "run": {
      if (cfg.enabled === false) { log.warn("config.enabled = false: kill switch on, exiting."); return 0; }
      const db = openDb(paths.db);
      const dryRun = has("--dry-run");
      const ctx = {
        ...ctxBase(db),
        content: loadContent(paths.content),
        contentFor: contentLoader(),
        claude: makeClaude(cfg, { log, cwd: paths.claudeWork }),
        delay: randomDelay,
        gmail: dryRun ? null : await gmailClient({ required: false }),
      };
      const res = await runPipeline(ctx, { dryRun, checkOnly: has("--check-only"), scheduled: has("--scheduled"), limit: opt("--limit") ? Number(opt("--limit")) : undefined });
      if (res.previews?.length) console.log(`\n預覽已寫入 ${paths.outbox}/（.eml 及 .html）`);
      return res.code;
    }
    case "retry-errors": {
      const db = openDb(paths.db);
      const r = db.prepare("UPDATE school_state SET status = CASE WHEN emails_sent > 0 THEN 'active' ELSE 'pending' END, stop_reason = NULL WHERE status = 'error'").run();
      log.info(`retry-errors: ${r.changes} schools back in the queue`);
      return 0;
    }
    case "reactivate": {
      const db = openDb(paths.db);
      const level = opt("--level")?.toUpperCase();
      if (level && !LEVELS.includes(level)) { console.error(`--level must be one of ${LEVELS.join(", ")}`); return 64; }
      const campaign = opt("--campaign") || `c${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
      if (cfg.campaigns?.[campaign]) loadContent(paths.content, cfg.campaigns[campaign]); // fail early on missing files
      else log.info(`campaign ${campaign}: no entry in config.campaigns, using default templates/ and topics.json`);
      const rows = reactivate(db, { campaign, level, includeReplied: has("--include-replied"), dryRun: has("--dry-run") });
      const byStatus = rows.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
      log.info(`reactivate${has("--dry-run") ? " (dry-run, nothing changed)" : ""}: ${rows.length} schools -> active in campaign "${campaign}"${level ? ` [${level}]` : ""} ${JSON.stringify(byStatus)}. Unsubscribed/bounced are never reactivated.`);
      return 0;
    }
    case "reset-test": {
      const db = openDb(paths.db);
      const ids = db.prepare("SELECT DISTINCT school_id FROM messages WHERE test = 1 AND dry_run = 0").all().map((r) => r.school_id);
      const real = new Set(db.prepare("SELECT DISTINCT school_id FROM messages WHERE test = 0 AND dry_run = 0").all().map((r) => r.school_id));
      let n = 0;
      for (const id of ids) {
        if (real.has(id)) { log.warn(`reset-test: ${id} also has real sends; left unchanged`); continue; }
        db.prepare("DELETE FROM messages WHERE school_id = ?").run(id);
        db.prepare("DELETE FROM replies WHERE school_id = ?").run(id);
        db.prepare("DELETE FROM suppressions WHERE school_id = ?").run(id);
        db.prepare("UPDATE school_state SET status = 'pending', emails_sent = 0, last_sent_at = NULL, next_due_at = NULL, topics_used = '[]', stop_reason = NULL WHERE school_id = ?").run(id);
        n++;
      }
      log.info(`reset-test: ${n} schools reset to pending`);
      return 0;
    }
    case "login": {
      const { login } = await import("./gmail.mjs");
      await login(paths, { log });
      const g = await gmailClient({ required: true });
      const me = await g.profileEmail();
      log.info(`Logged in as ${me}`);
      if (me.toLowerCase() !== cfg.sender.email.toLowerCase()) { log.error(`Expected ${cfg.sender.email}. Run setup again and choose that account.`); return 2; }
      return 0;
    }
    case "whoami": {
      const g = await gmailClient({ required: true });
      const me = await g.profileEmail();
      console.log(me);
      return me.toLowerCase() === cfg.sender.email.toLowerCase() ? 0 : 3;
    }
    case "labels": {
      const g = await gmailClient({ required: true });
      for (const name of Object.values(cfg.labels)) log.info(`label ${name}: ${await g.ensureLabel(name)}`);
      return 0;
    }
    case "init":
    case "import": {
      const db = openDb(paths.db);
      if (!fs.existsSync(paths.schoolsCsv)) { log.warn(`${paths.schoolsCsv} not found; DB created, nothing imported`); return cmd === "init" ? 0 : 1; }
      const c = importSchools(db, paths.schoolsCsv, log);
      log.info(`import: ${c.rows} rows, ${c.inserted} new, ${c.updated} updated, ${c.noEmail} without email, ${c.suppressed} suppressed, ${c.invalid} invalid`);
      return 0;
    }
    case "status": {
      const db = openDb(paths.db);
      const s = writeReport(ctxBase(db));
      console.log(renderText(s));
      console.log(`\n報告：${paths.report}`);
      return 0;
    }
    case "plist": {
      const { slots, deltaMinutes, localTz } = scheduleSlots(cfg);
      if (deltaMinutes !== 0) {
        console.error(`WARNING: this Mac's timezone is ${localTz}, not ${cfg.timezone}. Schedule converted to local time (${deltaMinutes > 0 ? "+" : ""}${deltaMinutes} min).`);
        if (tzOffsetMinutes(localTz, new Date()) !== tzOffsetMinutes(localTz, new Date(Date.now() + 182 * 86400000))) console.error("WARNING: local timezone has daylight saving; run ./emails/scripts/start.sh again after each DST change.");
      }
      const xml = buildPlist({ runSh: opt("--run-sh"), pathEnv: opt("--path") || process.env.PATH, home: os.homedir(), logsDir: paths.logs, workDir: paths.root, slots });
      fs.mkdirSync(paths.logs, { recursive: true });
      if (opt("--out")) fs.writeFileSync(opt("--out"), xml); else process.stdout.write(xml);
      console.error(`launchd ${LABEL}: ${slots.map((s) => `${s.Weekday !== undefined ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][s.Weekday] : "daily"} ${String(s.Hour).padStart(2, "0")}:${String(s.Minute).padStart(2, "0")}`).join(", ")} (local time)`);
      return 0;
    }
    default:
      console.error("usage: node src/cli.mjs run|retry-errors|reactivate|reset-test|login|whoami|labels|init|import|status|plist");
      return 64;
  }
}

main().then((code) => process.exit(code ?? 0), (e) => {
  log.error(e.name === "AuthError" ? `AUTH: ${e.message}` : e.stack || e.message);
  process.exit(e.name === "AuthError" ? 2 : 1);
});
