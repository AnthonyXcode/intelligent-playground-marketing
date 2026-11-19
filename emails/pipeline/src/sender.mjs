// Due-school selection, composing (first email / AI follow-up) and sending.
import fs from "node:fs";
import path from "node:path";
import { fill, parseTemplate, recipientName, schoolName, nextTopic } from "./content.mjs";
import { isSuppressed, setSchoolStatus } from "./db.mjs";
import { toHtml, htmlDocument, toText } from "./markup.mjs";
import { buildMime, makeMessageId, toBase64Url } from "./mime.mjs";
import { validateEmail } from "./validate.mjs";
import { dayDiff, localDate, addDaysDate } from "./time.mjs";
import { loadConfig } from "./config.mjs";
import { hasUnseenInbound } from "./replies.mjs";
import { tokenFor, trackLinks } from "./tracking.mjs";

const SENDABLE = "('pending','active')";

/** Schools due now: follow-ups first (oldest first), then first emails (level order, district). */
export function selectDue(ctx) {
  const { db, cfg } = ctx;
  const now = ctx.now();
  const rows = db.prepare(`SELECT s.*, st.status, st.emails_sent, st.last_sent_at, st.topics_used, st.campaign
    FROM schools s JOIN school_state st ON st.school_id = s.id
    WHERE st.status IN ${SENDABLE} AND s.email <> '' AND st.emails_sent < ?`).all(cfg.maxEmailsPerSchool);
  const due = rows.filter((r) => !isSuppressed(db, r.email) &&
    (!r.last_sent_at || dayDiff(r.last_sent_at, now, cfg.timezone) >= cfg.minDaysBetween));
  const lv = (l) => { const i = cfg.levelOrder.indexOf(l); return i < 0 ? 99 : i; };
  const followups = due.filter((r) => r.emails_sent > 0).sort((a, b) => a.last_sent_at.localeCompare(b.last_sent_at) || a.id.localeCompare(b.id));
  const firsts = due.filter((r) => r.emails_sent === 0).sort((a, b) =>
    lv(a.level) - lv(b.level) || (a.district || "").localeCompare(b.district || "", "zh-Hant") || a.id.localeCompare(b.id));
  return { followups, firsts };
}

/** Facts filtered for one level: fact lines `- F-ID [KG,PRI] …` kept only if tagged with level. */
export function factsForLevel(facts, level) {
  return facts.split("\n").filter((line) => {
    const m = line.match(/^\s*-\s*F-[\w-]+\s*\[([^\]]+)\]/);
    return !m || m[1].split(/[,\s]+/).includes(level);
  }).join("\n");
}
export function factIdsForLevel(facts, level) {
  const ids = new Set();
  for (const line of facts.split("\n")) {
    const m = line.match(/^\s*-\s*(F-[\w-]+)\s*\[([^\]]+)\]/);
    if (m && m[2].split(/[,\s]+/).includes(level)) ids.add(m[1]);
  }
  return ids;
}

function history(db, schoolId) {
  return db.prepare("SELECT n, topic_id, subject, sent_at, body_text FROM messages WHERE school_id = ? AND dry_run = 0 ORDER BY id").all(schoolId)
    .map((m) => `--- 第 ${m.n} 封（${m.sent_at.slice(0, 10)}${m.topic_id ? `，主題 ${m.topic_id}` : ""}）主旨：${m.subject}\n${(m.body_text || "").slice(0, 600)}`)
    .join("\n\n") || "（沒有）";
}

export function validateFollowupJson(o) {
  if (!o || typeof o.subject !== "string" || typeof o.body !== "string" || !o.body.trim()) throw new Error("follow-up JSON must have string subject and body");
  return { subject: o.subject.trim(), body: o.body.replace(/\r\n/g, "\n").trim() };
}

/** Build the email for school row r (from selectDue). Throws on any problem. */
export async function compose(ctx, r) {
  const { db, cfg } = ctx;
  const campaign = r.campaign || "";
  const content = ctx.contentFor ? ctx.contentFor(campaign) : ctx.content;
  const n = r.emails_sent + 1;
  const vars = { recipient_name: recipientName(r.principal), school_name: schoolName(r) };
  const testPrefix = cfg.testRecipient ? "【測試】" : "";
  let subject, body, topic = null, isLast = n >= cfg.maxEmailsPerSchool, threadId = null, inReplyTo = null, references = null;
  if (n === 1) {
    const t = parseTemplate(fill(content.templates[r.level], vars));
    subject = testPrefix + t.subject;
    body = t.body;
  } else {
    const prev = db.prepare("SELECT * FROM messages WHERE school_id = ? AND dry_run = 0 AND campaign = ? ORDER BY n").all(r.id, campaign);
    const first = prev.find((m) => m.n === 1);
    if (!first) throw new Error("no record of first email; cannot thread follow-up");
    const used = JSON.parse(r.topics_used || "[]");
    const pick = nextTopic(content.topics, r.level, used, n, cfg.maxEmailsPerSchool);
    if (!pick) return { exhausted: true };
    topic = pick.topic; isLast = isLast || pick.isLast;
    const okFacts = factIdsForLevel(content.facts, r.level);
    const topicForPrompt = { ...topic, facts: (topic.facts || []).filter((f) => !/^F-/.test(f) || okFacts.has(f)) };
    const prompt = fill(content.followupPrompt, {
      school_name: vars.school_name, recipient_name: vars.recipient_name, level: r.level,
      topic_json: JSON.stringify(topicForPrompt, null, 2), facts: factsForLevel(content.facts, r.level),
      history: history(db, r.id), followup_number: n - 1,
    });
    const ai = await ctx.claude(prompt, validateFollowupJson);
    body = fill(ai.body, vars);
    if (!/Best Regards\s*$/.test(body)) body = body.replace(/\s+$/, "") + "\n\nBest Regards";
    const base = first.subject.replace(/^Re:\s*/i, "");
    subject = `Re: ${base}`;
    threadId = first.thread_id;
    const ids = prev.map((m) => m.rfc822_message_id).filter(Boolean);
    inReplyTo = ids.at(-1) || null;
    references = ids.join(" ") || null;
  }
  // Links to the product site get the school's code (?r=) so visits can be matched to the school.
  // body (stored and shown to the AI as history) keeps the plain link.
  const full = trackLinks(`${body}\n\n${content.signature}`, cfg.tracking?.enabled ? tokenFor(db, r.id) : null, cfg);
  const to = cfg.testRecipient || r.email;
  const errs = validateEmail({ subject, body, full, isFollowup: n > 1, to, level: r.level }, cfg);
  if (errs.length) { const e = new Error(`validation failed: ${errs.join("; ")}`); e.validation = errs; throw e; }
  const domain = cfg.sender.email.split("@")[1];
  const messageId = makeMessageId(domain);
  const html = htmlDocument(full);
  const text = toText(full);
  const unsub = `<mailto:${cfg.sender.email}?subject=${encodeURIComponent("取消訂閱")}>`;
  const mime = buildMime({ from: cfg.sender, to, subject, text, html, messageId, inReplyTo, references, date: ctx.now(), listUnsubscribe: unsub });
  return { campaign, n, to, subject, body, full, text, html, htmlFragment: toHtml(full), mime, messageId, threadId, inReplyTo, references, topic, isLast };
}

function writeOutbox(ctx, r, mail) {
  const dir = ctx.paths.outbox;
  fs.mkdirSync(dir, { recursive: true });
  const stamp = ctx.now().toISOString().replace(/[-:]/g, "").slice(0, 15);
  const base = path.join(dir, `${stamp}-${r.id.replace(/[^\w.-]/g, "_")}-n${mail.n}`);
  fs.writeFileSync(base + ".eml", mail.mime);
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  fs.writeFileSync(base + ".html", `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(mail.subject)}</title></head><body style="max-width:720px;margin:24px auto">
<pre style="background:#f4f4f4;padding:8px;font-size:12px;white-space:pre-wrap">To: ${esc(mail.to)}  (school: ${esc(r.email)})
Subject: ${esc(mail.subject)}
School: ${esc(r.id)} ${esc(schoolName(r))} [${r.level}]  email #${mail.n}${mail.campaign ? `  campaign: ${esc(mail.campaign)}` : ""}${mail.topic ? `  topic: ${esc(mail.topic.id)}` : ""}${mail.threadId ? `\nThread: ${esc(mail.threadId)}  In-Reply-To: ${esc(mail.inReplyTo)}` : ""}</pre>
${mail.htmlFragment}</body></html>`);
  return base;
}

export function sentToday(ctx) {
  const today = localDate(ctx.now(), ctx.cfg.timezone);
  return ctx.db.prepare("SELECT sent_at FROM messages WHERE dry_run = 0").all().filter((m) => localDate(new Date(m.sent_at), ctx.cfg.timezone) === today).length;
}

function stillEnabled(ctx) {
  if (!ctx.paths?.config || !fs.existsSync(ctx.paths.config)) return ctx.cfg.enabled !== false;
  try { return loadConfig(ctx.paths.config).enabled !== false; } catch { return false; } // unreadable config (e.g. mid-edit): stop, fail safe
}

/** Send all due emails within limits. dryRun: write state/outbox only, no Gmail, no state change. */
export async function sendDue(ctx, { dryRun = false, limit, hold = new Set() } = {}) {
  const { db, cfg, log } = ctx;
  const stats = { sent: 0, errors: 0, skipped: 0, previews: [] };
  let budget = Math.min(cfg.maxPerRun, dryRun ? Infinity : Math.max(0, cfg.maxPerDay - sentToday(ctx)));
  if (cfg.testRecipient) budget = Math.min(budget, cfg.testMaxPerRun);
  if (limit) budget = Math.min(budget, limit);
  const { followups, firsts } = selectDue(ctx);
  const queue = [...followups, ...firsts].filter((r) => {
    if (hold.has(r.id)) { log.warn(`${r.id}: held this run (reply check incomplete for this school)`); return false; }
    return true;
  });
  log.info(`due: ${followups.length} follow-ups, ${firsts.length} first emails; budget this run: ${budget}${dryRun ? " (dry-run)" : ""}${cfg.testRecipient ? ` (TEST MODE -> ${cfg.testRecipient})` : ""}`);
  for (const r of queue) {
    if (stats.sent >= budget) break;
    if (!dryRun && !stillEnabled(ctx)) { log.warn("config.enabled=false: stopping sends (kill switch)"); break; }
    const nowIso = ctx.now().toISOString();
    let mail;
    try {
      mail = await compose(ctx, r);
    } catch (e) {
      stats.errors++;
      log.error(`compose ${r.id} (${schoolName(r)}) #${r.emails_sent + 1}: ${e.message}`);
      if (!dryRun) setSchoolStatus(db, r.id, "error", e.message.slice(0, 500), nowIso);
      continue;
    }
    if (mail.exhausted) {
      log.info(`${r.id}: no topics left, stopping`);
      if (!dryRun) setSchoolStatus(db, r.id, "no_response", "no topics left", nowIso);
      stats.skipped++;
      continue;
    }
    if (dryRun) {
      const base = writeOutbox(ctx, r, mail);
      db.prepare("INSERT INTO messages (school_id, campaign, n, topic_id, subject, sent_at, dry_run, to_addr, test, body_text, rfc822_message_id) VALUES (?,?,?,?,?,?,1,?,?,?,?)")
        .run(r.id, mail.campaign, mail.n, mail.topic?.id ?? null, mail.subject, nowIso, mail.to, cfg.testRecipient ? 1 : 0, mail.body, mail.messageId);
      log.info(`[dry-run] ${r.id} #${mail.n} -> ${mail.to}: ${mail.subject} (${base}.eml)`);
      stats.previews.push(base);
      stats.sent++;
      continue;
    }
    if (stats.sent > 0 && ctx.delay) await ctx.delay();
    if (!stillEnabled(ctx)) { log.warn("config.enabled=false: stopping sends (kill switch)"); break; } // re-check after the delay
    if (mail.threadId) {
      // A reply may have arrived since the reply check (runs can take hours): never follow up over it.
      try {
        if (await hasUnseenInbound(ctx, mail.threadId)) { log.info(`${r.id}: new inbound message in thread, follow-up skipped until it is classified`); stats.skipped++; continue; }
      } catch (e) {
        if (e.name === "AuthError") throw e;
        log.warn(`${r.id}: could not re-check thread (${e.message}); follow-up skipped this run`); stats.skipped++; continue;
      }
    }
    try {
      const res = await ctx.gmail.send(toBase64Url(mail.mime), mail.threadId || undefined);
      let rfcId = mail.messageId;
      try {
        const sent = await ctx.gmail.getMessage(res.id);
        if (sent.messageId) rfcId = sent.messageId;
      } catch (e) { if (e.name === "AuthError") throw e; }
      const sentIso = ctx.now().toISOString();
      const used = JSON.parse(r.topics_used || "[]");
      if (mail.topic) used.push(mail.topic.id);
      const emails = r.emails_sent + 1;
      const done = emails >= cfg.maxEmailsPerSchool || (mail.isLast && mail.n > 1);
      db.prepare("INSERT INTO messages (school_id, campaign, gmail_id, thread_id, rfc822_message_id, n, topic_id, subject, sent_at, dry_run, to_addr, test, body_text) VALUES (?,?,?,?,?,?,?,?,?,0,?,?,?)")
        .run(r.id, mail.campaign, res.id, res.threadId, rfcId, mail.n, mail.topic?.id ?? null, mail.subject, sentIso, mail.to, cfg.testRecipient ? 1 : 0, mail.body);
      db.prepare("UPDATE school_state SET status = ?, emails_sent = ?, last_sent_at = ?, next_due_at = ?, topics_used = ?, stop_reason = ?, updated_at = ? WHERE school_id = ?")
        .run(done ? "no_response" : "active", emails, sentIso, done ? null : addDaysDate(localDate(new Date(sentIso), cfg.timezone), cfg.minDaysBetween),
          JSON.stringify(used), done ? (emails >= cfg.maxEmailsPerSchool ? "cap reached" : "cap reached (topics used up)") : null, sentIso, r.id);
      stats.sent++;
      log.info(`sent ${r.id} #${mail.n} -> ${mail.to}: ${mail.subject} [gmail ${res.id}, thread ${res.threadId}]`);
    } catch (e) {
      if (e.name === "AuthError") throw e;
      stats.errors++;
      log.error(`send ${r.id} #${mail.n} failed: ${e.message}`);
      setSchoolStatus(db, r.id, "error", `send failed: ${e.message}`.slice(0, 500), nowIso);
    }
  }
  return stats;
}
