// Reply detection + classification (SPEC "Reply detection").
import { fill } from "./content.mjs";
import { setSchoolStatus, suppress } from "./db.mjs";

export const CATEGORIES = ["interested", "question", "not_interested", "unsubscribe", "auto_reply", "bounce", "other"];
const HUMAN = new Set(["interested", "question", "not_interested", "other"]);

const addrOf = (from) => (String(from).match(/[^\s<>"]+@[^\s<>"]+/) || [""])[0].toLowerCase();
const domainOf = (email) => email.split("@")[1] || "";

export function isBounce(m) {
  const from = addrOf(m.from);
  return /^(mailer-daemon|postmaster)@/i.test(from) || /mailer-daemon/i.test(m.from) ||
    /multipart\/report/i.test(m.contentType) && /delivery-status/i.test(m.contentType) ||
    /^(Delivery Status Notification|Undeliver(able|ed)|Mail delivery failed|Returned mail|Delivery Failure|未能傳送|無法傳送)/i.test(m.subject || "");
}

export function validateClassification(o) {
  if (!o || !CATEGORIES.includes(o.category)) throw new Error(`invalid category: ${JSON.stringify(o?.category)}`);
  return { category: o.category, summary: String(o.summary ?? "").slice(0, 80), stop: o.category !== "auto_reply" };
}

function emailText(m) {
  const body = (m.text || m.snippet || "").replace(/\r\n/g, "\n");
  return `From: ${m.from}\nSubject: ${m.subject}\n\n${body}`.slice(0, 6000);
}

export async function classify(ctx, m, originalSubject) {
  if (isBounce(m)) return { category: "bounce", summary: "寄送失敗（退回郵件）", stop: true };
  const prompt = fill(ctx.content.classifyPrompt, { email_text: emailText(m), original_subject: originalSubject || "" });
  return ctx.claude(prompt, validateClassification);
}

export async function checkReplies(ctx) {
  const { db, gmail, cfg, log } = ctx;
  const stats = { checked: 0, newReplies: 0, errors: 0, replies: [] };
  if (!gmail) { log.info("reply check skipped (no Gmail client)"); return stats; }
  const me = cfg.sender.email.toLowerCase();
  const nowIso = ctx.now().toISOString();

  const tracked = db.prepare(`SELECT s.*, st.status, st.emails_sent FROM schools s JOIN school_state st ON st.school_id = s.id
    WHERE st.emails_sent > 0 AND st.status IN ('active','no_response','error')`).all();
  const byId = new Map(tracked.map((s) => [s.id, s]));
  const firstSent = new Map(db.prepare("SELECT school_id, MIN(sent_at) t FROM messages WHERE dry_run = 0 GROUP BY school_id").all().map((r) => [r.school_id, Date.parse(r.t)]));
  const subjectOf = new Map(db.prepare("SELECT school_id, subject FROM messages WHERE dry_run = 0 AND n = 1 ORDER BY id").all().map((r) => [r.school_id, r.subject]));
  const threadSchool = new Map();
  for (const r of db.prepare("SELECT DISTINCT thread_id, school_id FROM messages WHERE dry_run = 0 AND thread_id IS NOT NULL").all()) {
    if (byId.has(r.school_id)) threadSchool.set(r.thread_id, r.school_id);
  }
  const seenStmt = db.prepare("SELECT 1 FROM replies WHERE gmail_id = ? UNION SELECT 1 FROM seen_messages WHERE gmail_id = ?");
  const markSeen = db.prepare("INSERT OR IGNORE INTO seen_messages (gmail_id, note, seen_at) VALUES (?,?,?)");
  const seen = (id) => !!seenStmt.get(id, id);
  const inbound = (m) => !m.labelIds.includes("SENT") && addrOf(m.from) !== me;
  const candidates = new Map(); // gmail id -> { m, schoolId }

  // 1) our threads
  for (const [tid, sid] of threadSchool) {
    try {
      for (const m of await gmail.getThread(tid)) {
        stats.checked++;
        if (inbound(m) && !seen(m.id)) candidates.set(m.id, { m, schoolId: sid });
      }
    } catch (e) {
      if (e.name === "AuthError") throw e;
      stats.errors++; log.error(`thread ${tid} (${sid}): ${e.message}`);
    }
  }

  // 2) domain search (teacher's own address / new thread). Skip generic and shared domains.
  const generic = new Set(cfg.genericDomains.map((d) => d.toLowerCase()));
  const domainCount = new Map();
  for (const r of db.prepare("SELECT email FROM schools WHERE email <> ''").all()) {
    const d = domainOf(r.email); domainCount.set(d, (domainCount.get(d) || 0) + 1);
  }
  const emailSchool = new Map(tracked.map((s) => [s.email, s.id]));
  const domainSchool = new Map();
  for (const s of tracked) {
    const d = domainOf(s.email);
    if (d && !generic.has(d) && domainCount.get(d) === 1) domainSchool.set(d, s.id);
  }
  const domains = [...domainSchool.keys()];
  const days = cfg.replySearchDays || 30;
  const lookup = async (q, resolveSchool) => {
    let list = [];
    try { list = await gmail.search(q, 500); } catch (e) {
      if (e.name === "AuthError") throw e;
      stats.errors++; log.error(`search failed (${q.slice(0, 80)}…): ${e.message}`); return;
    }
    for (const { id } of list) {
      if (candidates.has(id) || seen(id)) continue;
      try {
        const m = await gmail.getMessage(id);
        stats.checked++;
        if (!inbound(m)) { markSeen.run(id, "outbound", nowIso); continue; }
        const sid = threadSchool.get(m.threadId) || resolveSchool(m);
        if (sid) candidates.set(id, { m, schoolId: sid });
        else markSeen.run(id, "unmatched", nowIso);
      } catch (e) {
        if (e.name === "AuthError") throw e;
        stats.errors++; log.error(`message ${id}: ${e.message}`);
      }
    }
  };
  for (let i = 0; i < domains.length; i += 15) {
    const chunk = domains.slice(i, i + 15);
    await lookup(`from:(${chunk.map((d) => "@" + d).join(" OR ")}) newer_than:${days}d`, (m) => {
      const a = addrOf(m.from);
      return emailSchool.get(a) || domainSchool.get(domainOf(a));
    });
  }
  // 3) bounces outside our threads
  if (tracked.length) {
    await lookup(`from:(mailer-daemon OR postmaster) newer_than:${days}d`, (m) => {
      const hay = `${m.failedRecipients}\n${m.text}`.toLowerCase();
      for (const s of tracked) if (s.email && hay.includes(s.email)) return s.id;
      return null;
    });
  }

  // classify + apply
  const insReply = db.prepare(`INSERT OR IGNORE INTO replies (school_id, gmail_id, thread_id, "from", received_at, category, summary, detected_at) VALUES (?,?,?,?,?,?,?,?)`);
  const sorted = [...candidates.values()].sort((a, b) => a.m.date - b.m.date);
  for (const { m, schoolId } of sorted) {
    const school = byId.get(schoolId);
    if (!school) continue;
    if (m.date && firstSent.has(schoolId) && m.date < firstSent.get(schoolId)) { markSeen.run(m.id, "before first email", nowIso); continue; }
    let c;
    try { c = await classify(ctx, m, subjectOf.get(schoolId)); } catch (e) {
      stats.errors++; log.error(`classify ${m.id} (${schoolId}) failed, will retry next run: ${e.message}`); continue;
    }
    insReply.run(schoolId, m.id, m.threadId, m.from, new Date(m.date || Date.now()).toISOString(), c.category, c.summary, nowIso);
    stats.newReplies++;
    stats.replies.push({ schoolId, name: school.name_zh || school.name_en, ...c });
    log.info(`reply ${schoolId} ${school.name_zh || ""}: ${c.category} — ${c.summary}`);
    const cur = db.prepare("SELECT status FROM school_state WHERE school_id = ?").get(schoolId)?.status;
    if (["unsubscribed", "bounced"].includes(cur)) continue;
    try {
      if (c.category === "unsubscribe") {
        setSchoolStatus(db, schoolId, "unsubscribed", c.summary || "unsubscribe", nowIso);
        suppress(db, school.email, "unsubscribe", schoolId, nowIso);
        await gmail.addLabelToThread(m.threadId, await gmail.ensureLabel(cfg.labels.unsubscribed));
      } else if (c.category === "bounce") {
        setSchoolStatus(db, schoolId, "bounced", c.summary || "bounce", nowIso);
        suppress(db, school.email, "bounce", schoolId, nowIso);
      } else if (HUMAN.has(c.category)) {
        if (cur !== "replied") setSchoolStatus(db, schoolId, "replied", `${c.category}: ${c.summary}`, nowIso);
        await gmail.addLabelToThread(m.threadId, await gmail.ensureLabel(cfg.labels.replied));
      }
    } catch (e) {
      if (e.name === "AuthError") throw e;
      stats.errors++; log.error(`label ${m.threadId}: ${e.message}`);
    }
  }
  return stats;
}
