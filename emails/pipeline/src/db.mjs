// SQLite state (built-in node:sqlite, Node >= 22.13). Schema per SPEC + runs/suppressions.
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { parseCsv } from "./csv.mjs";

export const LEVELS = ["KG", "PRI", "SEC", "SPE"];
export const STATUSES = ["pending", "active", "replied", "unsubscribed", "bounced", "no_response", "skipped_no_email", "skipped_flagged", "error"];
/** Default `notes` flags for contacts that may be personal mailboxes (PDPO): skipped unless config.includeFlaggedContacts. */
export const FLAGGED_NOTES_RE = /免費郵箱|可能為個人電郵|校長郵箱/;
const PERMANENT = new Set(["unsubscribed", "bounced"]);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS schools (
  id TEXT PRIMARY KEY, level TEXT NOT NULL, name_zh TEXT, name_en TEXT, district TEXT, address TEXT,
  email TEXT, website TEXT, phone TEXT, principal TEXT, source TEXT, notes TEXT, imported_at TEXT);
CREATE TABLE IF NOT EXISTS school_state (
  school_id TEXT PRIMARY KEY REFERENCES schools(id), status TEXT NOT NULL,
  emails_sent INTEGER NOT NULL DEFAULT 0, last_sent_at TEXT, next_due_at TEXT,
  topics_used TEXT NOT NULL DEFAULT '[]', stop_reason TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, school_id TEXT NOT NULL, gmail_id TEXT, thread_id TEXT,
  rfc822_message_id TEXT, n INTEGER, topic_id TEXT, subject TEXT, sent_at TEXT, dry_run INTEGER NOT NULL DEFAULT 0,
  to_addr TEXT, test INTEGER NOT NULL DEFAULT 0, body_text TEXT);
CREATE INDEX IF NOT EXISTS messages_school ON messages(school_id);
CREATE INDEX IF NOT EXISTS messages_thread ON messages(thread_id);
CREATE TABLE IF NOT EXISTS replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT, school_id TEXT, gmail_id TEXT UNIQUE, thread_id TEXT,
  "from" TEXT, received_at TEXT, category TEXT, summary TEXT, detected_at TEXT);
CREATE TABLE IF NOT EXISTS suppressions (
  email TEXT PRIMARY KEY, reason TEXT, school_id TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS seen_messages (gmail_id TEXT PRIMARY KEY, note TEXT, seen_at TEXT);
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, started_at TEXT, finished_at TEXT, mode TEXT,
  sent INTEGER NOT NULL DEFAULT 0, replies INTEGER NOT NULL DEFAULT 0, errors INTEGER NOT NULL DEFAULT 0,
  status TEXT, note TEXT);
`;

export function openDb(file) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  ensureColumn(db, "messages", "campaign", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "school_state", "campaign", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "school_state", "campaigns_done", "INTEGER NOT NULL DEFAULT 0");
  return db;
}

function ensureColumn(db, table, col, decl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${decl}`);
}

/**
 * Start a new campaign for schools whose cap was reached (no_response): fresh email budget,
 * new thread, history kept. Never touches unsubscribed/bounced (or suppressed emails);
 * replied schools only with includeReplied. Returns the affected school ids.
 */
export function reactivate(db, { campaign, level, includeReplied = false, dryRun = false, nowIso = new Date().toISOString() }) {
  if (!campaign || !/^[\w.-]+$/.test(campaign)) throw new Error("campaign name required (letters, digits, - _ .)");
  const statuses = includeReplied ? ["no_response", "replied"] : ["no_response"];
  const rows = db.prepare(`SELECT st.school_id, st.status, s.email, s.level FROM school_state st JOIN schools s ON s.id = st.school_id
    WHERE st.status IN (${statuses.map(() => "?").join(",")}) AND st.campaign <> ? ${level ? "AND s.level = ?" : ""}`)
    .all(...statuses, campaign, ...(level ? [level] : []))
    .filter((r) => r.email && !isSuppressed(db, r.email));
  if (!dryRun) {
    const upd = db.prepare(`UPDATE school_state SET status = 'active', emails_sent = 0, topics_used = '[]', campaign = ?,
      campaigns_done = campaigns_done + 1, stop_reason = ?, next_due_at = NULL, updated_at = ? WHERE school_id = ?`);
    tx(db, () => { for (const r of rows) upd.run(campaign, `reactivated (${campaign}) from ${r.status}`, nowIso, r.school_id); });
  }
  return rows;
}

export function tx(db, fn) {
  db.exec("BEGIN");
  try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; }
}

export function normEmail(raw) {
  const m = String(raw || "").toLowerCase().match(/[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}/);
  return m ? m[0] : "";
}

/**
 * Import schools.csv. Upserts school info. Never resurrects unsubscribed/bounced schools
 * (by school status or by suppressed email). Rows whose notes flag a free-mail / personal /
 * principal mailbox become skipped_flagged unless includeFlagged. A repeated email address
 * is kept only on its first row. Returns counts.
 */
export function importSchools(db, csvFile, log, nowIso = new Date().toISOString(), { includeFlagged = false, flaggedRe = FLAGGED_NOTES_RE } = {}) {
  const rows = parseCsv(fs.readFileSync(csvFile, "utf8"));
  const counts = { rows: rows.length, inserted: 0, updated: 0, invalid: 0, noEmail: 0, suppressed: 0, flagged: 0, duplicateEmail: 0 };
  const emailOwner = new Map();
  const getState = db.prepare("SELECT * FROM school_state WHERE school_id = ?");
  const getSchool = db.prepare("SELECT id FROM schools WHERE id = ?");
  const getSup = db.prepare("SELECT * FROM suppressions WHERE email = ?");
  const upsert = db.prepare(`INSERT INTO schools (id, level, name_zh, name_en, district, address, email, website, phone, principal, source, notes, imported_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET level=excluded.level, name_zh=excluded.name_zh, name_en=excluded.name_en,
      district=excluded.district, address=excluded.address, email=excluded.email, website=excluded.website,
      phone=excluded.phone, principal=excluded.principal, source=excluded.source, notes=excluded.notes, imported_at=excluded.imported_at`);
  const insState = db.prepare("INSERT INTO school_state (school_id, status, stop_reason, updated_at) VALUES (?,?,?,?)");
  const setStatus = db.prepare("UPDATE school_state SET status = ?, stop_reason = ?, updated_at = ? WHERE school_id = ?");
  const seen = new Set();
  tx(db, () => {
    for (const r of rows) {
      const id = (r.id || "").trim();
      const level = (r.level || "").trim().toUpperCase();
      if (!id || !LEVELS.includes(level) || seen.has(id)) {
        counts.invalid++;
        log?.warn(`import: skipped row (id=${id || "?"}, level=${level || "?"})${seen.has(id) ? " duplicate id" : ""}`);
        continue;
      }
      seen.add(id);
      const rawEmail = normEmail(r.email);
      let email = rawEmail;
      if (email && emailOwner.has(email)) {
        counts.duplicateEmail++;
        log?.warn(`import: ${id} has the same email as ${emailOwner.get(email)} (${email}); only the first row is emailed`);
        email = "";
      } else if (email) emailOwner.set(email, id);
      const existed = !!getSchool.get(id);
      upsert.run(id, level, r.name_zh || "", r.name_en || "", r.district || "", r.address || "", email,
        r.website || "", r.phone || "", r.principal || "", r.source || "", r.notes || "", nowIso);
      existed ? counts.updated++ : counts.inserted++;
      const st = getState.get(id);
      const sup = rawEmail ? getSup.get(rawEmail) : null;
      if (sup) {
        counts.suppressed++;
        const status = sup.reason === "bounce" ? "bounced" : "unsubscribed";
        if (!st) insState.run(id, status, `suppressed: ${sup.reason}`, nowIso);
        else if (!PERMANENT.has(st.status)) setStatus.run(status, `suppressed: ${sup.reason}`, nowIso, id);
        continue;
      }
      if (!email) counts.noEmail++;
      const flagged = !!email && !includeFlagged && flaggedRe.test(r.notes || "");
      if (flagged) {
        counts.flagged++;
        const why = `flagged contact (${(r.notes || "").match(flaggedRe)[0]}); set includeFlaggedContacts to include`;
        if (!st) insState.run(id, "skipped_flagged", why, nowIso);
        else if (["pending", "active", "skipped_no_email"].includes(st.status)) setStatus.run("skipped_flagged", why, nowIso, id);
        continue;
      }
      if (!st) {
        insState.run(id, email ? "pending" : "skipped_no_email", email ? null : "no email", nowIso);
      } else if (PERMANENT.has(st.status)) {
        // never resurrect
      } else if (!email && st.status === "pending") {
        setStatus.run("skipped_no_email", "no email", nowIso, id);
      } else if (email && (st.status === "skipped_no_email" || st.status === "skipped_flagged")) {
        setStatus.run(st.emails_sent > 0 ? "active" : "pending", null, nowIso, id);
      }
    }
  });
  return counts;
}

export function suppress(db, email, reason, schoolId, nowIso = new Date().toISOString()) {
  if (!email) return;
  db.prepare("INSERT INTO suppressions (email, reason, school_id, created_at) VALUES (?,?,?,?) ON CONFLICT(email) DO NOTHING")
    .run(email.toLowerCase(), reason, schoolId, nowIso);
}

export function isSuppressed(db, email) {
  return !!(email && db.prepare("SELECT 1 FROM suppressions WHERE email = ?").get(email.toLowerCase()));
}

export function setSchoolStatus(db, schoolId, status, reason, nowIso = new Date().toISOString()) {
  db.prepare("UPDATE school_state SET status = ?, stop_reason = ?, updated_at = ? WHERE school_id = ?").run(status, reason ?? null, nowIso, schoolId);
}
