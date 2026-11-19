// Link-visit tracking: one random code per school, added to links to the product site as
// ?r=<code>. The site reports visits to /api/visit; pullVisits() reads them back from
// /api/visits (needs secrets/tracking.json {"readKey": "..."} or env IP_TRACKING_KEY).
import fs from "node:fs";
import crypto from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
export const TOKEN_RE = /^[A-Za-z0-9]{10}$/;

export function newToken() {
  const bytes = crypto.randomBytes(10);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** The school's link code (created on first use, never changes). */
export function tokenFor(db, schoolId, nowIso = new Date().toISOString()) {
  const row = db.prepare("SELECT token FROM link_tokens WHERE school_id = ?").get(schoolId);
  if (row) return row.token;
  for (let i = 0; i < 5; i++) {
    const token = newToken();
    try {
      db.prepare("INSERT INTO link_tokens (school_id, token, created_at) VALUES (?,?,?)").run(schoolId, token, nowIso);
      return token;
    } catch (e) {
      if (!/UNIQUE/i.test(e.message)) throw e;
    }
  }
  throw new Error("could not create a unique link code");
}

function hostOf(siteUrl) {
  return new URL(siteUrl).host.replace(/^www\./, "");
}

/**
 * Add ?r=<token> to every link to the tracked site in the email markup (with or without
 * https:// and www.). Other links (e.g. www.antapp.ai in the signature) are left alone.
 */
export function trackLinks(md, token, cfg) {
  const t = cfg.tracking;
  if (!t?.enabled || !token) return md;
  const host = hostOf(t.siteUrl).replace(/\./g, "\\.");
  const re = new RegExp(`(?<![@\\w.-])(?:https?://)?(?:www\\.)?${host}(/[^\\s*)<>"'，。、；）]*)?`, "gi");
  return md.replace(re, (m, pathPart = "") => {
    const trail = pathPart.match(/[.,!?:;]+$/)?.[0] || "";
    const url = new URL(`https://www.${hostOf(t.siteUrl)}${pathPart.slice(0, pathPart.length - trail.length) || "/"}`);
    url.searchParams.set(t.param || "r", token);
    return url.toString() + trail;
  });
}

export function readKey(paths) {
  if (process.env.IP_TRACKING_KEY) return process.env.IP_TRACKING_KEY;
  try { return JSON.parse(fs.readFileSync(paths.trackingKey, "utf8")).readKey || ""; } catch { return ""; }
}

const getMeta = (db, k) => db.prepare("SELECT v FROM meta WHERE k = ?").get(k)?.v ?? null;
const setMeta = (db, k, v) => db.prepare("INSERT INTO meta (k, v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(k, v);

/**
 * Store visits. A visit is not counted (counted = 0) when its code is unknown, or when it comes
 * within cfg.tracking.ignoreSecondsAfterSend of an email to that school (mail scanners).
 */
export function recordVisits(ctx, items) {
  const { db, cfg } = ctx;
  const ignoreMs = (cfg.tracking?.ignoreSecondsAfterSend ?? 120) * 1000;
  const school = db.prepare("SELECT school_id FROM link_tokens WHERE token = ?");
  const sends = db.prepare("SELECT sent_at FROM messages WHERE school_id = ? AND dry_run = 0");
  const ins = db.prepare(`INSERT INTO visits (id, token, school_id, event, ts, device, counted, note, pulled_at)
    VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`);
  const nowIso = ctx.now().toISOString();
  let counted = 0;
  const fresh = [];
  for (const v of items) {
    if (!v?.id || !TOKEN_RE.test(v.token || "")) continue;
    const sid = school.get(v.token)?.school_id ?? null;
    const at = Date.parse(v.ts);
    let ok = 1, note = null;
    if (!sid) { ok = 0; note = "unknown code"; }
    else if (!Number.isFinite(at)) { ok = 0; note = "bad time"; }
    else if (sends.all(sid).some((m) => { const d = at - Date.parse(m.sent_at); return d >= 0 && d < ignoreMs; })) { ok = 0; note = "right after send (scanner?)"; }
    const r = ins.run(v.id, v.token, sid, v.event === "contact" ? "contact" : "visit", v.ts || "", v.device || "", ok, note, nowIso);
    if (r.changes && ok) { counted++; fresh.push({ ...v, school_id: sid }); }
  }
  return { counted, fresh };
}

/** Pull new visits from the site. Never throws (tracking must not stop a run). */
export async function pullVisits(ctx, { fetchImpl = globalThis.fetch } = {}) {
  const { db, cfg, log, paths } = ctx;
  const t = cfg.tracking;
  const out = { pulled: 0, counted: 0, fresh: [], ok: false };
  if (!t?.enabled) return out;
  const key = readKey(paths);
  if (!key) { log.warn(`tracking: no read key (${paths.trackingKey}); link visits not checked`); return out; }
  let after = getMeta(db, "visits_cursor") || "";
  try {
    for (let page = 0; page < 50; page++) {
      const url = new URL("/api/visits", t.apiBase);
      if (after) url.searchParams.set("after", after);
      url.searchParams.set("count", "500");
      const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];
      if (!items.length) break;
      const r = recordVisits(ctx, items);
      out.pulled += items.length; out.counted += r.counted; out.fresh.push(...r.fresh);
      after = items.at(-1).id;
      setMeta(db, "visits_cursor", after);
      if (items.length < 500) break;
    }
    out.ok = true;
    log.info(`tracking: ${out.pulled} new visit records, ${out.counted} counted`);
  } catch (e) {
    log.warn(`tracking: could not read link visits (${e.message}); will retry next run`);
  }
  return out;
}

/** Per-school visit stats (counted visits only). */
export function visitStats(db) {
  const m = new Map();
  for (const r of db.prepare(`SELECT school_id, SUM(event = 'visit') visits, SUM(event = 'contact') contacts, MIN(ts) first_ts, MAX(ts) last_ts
      FROM visits WHERE counted = 1 AND school_id IS NOT NULL GROUP BY school_id`).all()) m.set(r.school_id, r);
  return m;
}
