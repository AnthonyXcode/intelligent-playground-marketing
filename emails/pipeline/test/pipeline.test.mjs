import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { makeCtx, stateOf, headerOf, decodeWords, mimeParts, mockClaude, FakeGmail } from "./helpers.mjs";
import { runPipeline, scheduledMode } from "../src/runner.mjs";
import { selectDue } from "../src/sender.mjs";
import { importSchools, reactivate, setSchoolStatus, suppress } from "../src/db.mjs";
import { loadContent } from "../src/content.mjs";
import { nullLogger } from "../src/log.mjs";
import { buildSummary, renderText } from "../src/report.mjs";

const run = (ctx, o) => runPipeline(ctx, o);

test("dry-run end-to-end: writes .eml + .html previews, no Gmail calls, no state change", async () => {
  const gmail = new FakeGmail();
  const ctx = makeCtx({ gmail });
  ctx.gmail = null; // dry-run needs no Gmail at all
  const res = await run(ctx, { dryRun: true, limit: 3 });
  assert.equal(res.code, 0);
  assert.equal(res.sent, 3);
  const files = fs.readdirSync(ctx.paths.outbox).sort();
  assert.equal(files.filter((f) => f.endsWith(".eml")).length, 3);
  assert.equal(files.filter((f) => f.endsWith(".html")).length, 3);
  assert.ok(files.some((f) => f.includes("PRI")) && !files.some((f) => f.includes("KG001")), "PRI first, KG last");
  const eml = fs.readFileSync(`${ctx.paths.outbox}/${files.find((f) => f.endsWith(".eml"))}`, "utf8");
  const html = mimeParts(eml)[1].body;
  assert.ok(html.includes("<b>Anthony Chan</b>") && html.includes("font-size:11px;color:#777777") && html.includes("取消訂閱"));
  assert.equal(gmail.sent.length, 0);
  for (const id of ["PRI001", "PRI002", "SEC001"]) assert.equal(stateOf(ctx, id).status, "pending");
  assert.equal(ctx.db.prepare("SELECT COUNT(*) c FROM messages WHERE dry_run = 0").get().c, 0);
  assert.ok(fs.existsSync(ctx.paths.report));
  assert.ok(!fs.existsSync(ctx.paths.lock), "lock released");
});

test("selection order: follow-ups first, then first emails PRI, SEC, SPE, KG by district", async () => {
  const ctx = makeCtx();
  const { firsts } = selectDue(ctx);
  assert.deepEqual(firsts.map((r) => r.level), ["PRI", "PRI", "SEC", "SPE", "KG"]);
  await run(ctx, { limit: 1 });
  ctx.advanceDays(3);
  const due = selectDue(ctx);
  assert.equal(due.followups.length, 1);
});

test("full lifecycle: first email, threaded follow-ups with topic order, cap at 10 emails", async () => {
  const gmail = new FakeGmail();
  const claude = mockClaude();
  const ctx = makeCtx({ gmail, claude });
  // only keep one school sendable to make the trace simple
  ctx.db.exec("UPDATE school_state SET status='skipped_no_email' WHERE school_id <> 'PRI001'");
  for (let i = 0; i < 14; i++) {
    const r = await run(ctx, {});
    assert.equal(r.code, 0, `run ${i}`);
    ctx.advanceDays(i % 2 ? 4 : 3); // Tue -> Fri -> Tue
  }
  const sent = gmail.sent.filter((s) => s.to === "office@tpa.edu.hk");
  assert.equal(sent.length, 10, "cap at 10 emails in total");
  const st = stateOf(ctx, "PRI001");
  assert.equal(st.status, "no_response");
  assert.equal(st.emails_sent, 10);
  // first email
  const first = sent[0];
  assert.equal(first.requestedThreadId, undefined);
  assert.equal(decodeWords(headerOf(first.mime, "Subject")), "【智能運動場】PRI 測試主旨");
  assert.ok(mimeParts(first.mime)[0].body.startsWith("陳校長："));
  assert.ok(mimeParts(first.mime)[0].body.includes("測試小學, 甲的同學"));
  // follow-ups: same thread, Re: subject, In-Reply-To = previous Message-ID, References chain
  for (let i = 1; i < 10; i++) {
    const m = sent[i].mime;
    assert.equal(sent[i].requestedThreadId, first.threadId);
    assert.equal(decodeWords(headerOf(m, "Subject")), "Re: 【智能運動場】PRI 測試主旨");
    assert.equal(headerOf(m, "In-Reply-To"), `<gmail-${sent[i - 1].id}@mail.gmail.com>`);
    assert.equal(headerOf(m, "References").split(" ").length, i);
    const text = mimeParts(m)[0].body;
    assert.ok(text.includes("NOTICE:") && text.includes("取消訂閱"), "signature appended by code");
    assert.equal((text.match(/NOTICE:/g) || []).length, 1);
  }
  const topics = ctx.db.prepare("SELECT topic_id FROM messages WHERE school_id='PRI001' AND dry_run=0 ORDER BY n").all().map((r) => r.topic_id);
  assert.deepEqual(topics, [null, "t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "final-close"]);
  // topic facts filtered by level in the prompt (F-KGONLY dropped for PRI)
  const p2 = claude.calls.find((c) => c.includes('"id": "t2"'));
  assert.ok(p2.includes("F-DRIBBLE") && !p2.includes("F-KGONLY"));
  // min days between emails respected
  const dates = ctx.db.prepare("SELECT sent_at FROM messages WHERE school_id='PRI001' AND dry_run=0 ORDER BY n").all().map((r) => Date.parse(r.sent_at));
  for (let i = 1; i < dates.length; i++) assert.ok(dates[i] - dates[i - 1] >= 3 * 86400000);
});

test("not due before minDaysBetween", async () => {
  const ctx = makeCtx();
  await run(ctx, {});
  const before = ctx.gmail.sent.length;
  ctx.advanceDays(2);
  await run(ctx, {});
  assert.equal(ctx.gmail.sent.length, before);
});

test("reply in thread -> replied + label; auto_reply does not stop; no more emails", async () => {
  const gmail = new FakeGmail();
  const ctx = makeCtx({ gmail });
  await run(ctx, {});
  const pri1 = gmail.sent.find((s) => s.to === "office@tpa.edu.hk");
  const sec = gmail.sent.find((s) => s.to === "info@tsec.edu.hk");
  ctx.advanceDays(1);
  gmail.addInbound({ threadId: pri1.threadId, from: "李老師 <teacher@tpa.edu.hk>", text: "我們有興趣，想預約示範" });
  gmail.addInbound({ threadId: sec.threadId, from: "info@tsec.edu.hk", text: "Automatic reply: I am out of office" });
  const r = await run(ctx, { checkOnly: true });
  assert.equal(r.replies, 2);
  assert.equal(stateOf(ctx, "PRI001").status, "replied");
  assert.equal(stateOf(ctx, "SEC001").status, "active");
  assert.ok(gmail.labeled.some((l) => l.threadId === pri1.threadId && l.name === "IP/已回覆"));
  assert.ok(!gmail.labeled.some((l) => l.threadId === sec.threadId));
  // re-running does not re-classify
  const again = await run(ctx, { checkOnly: true });
  assert.equal(again.replies, 0);
  ctx.advanceDays(3);
  const before = gmail.sent.filter((s) => s.to === "office@tpa.edu.hk").length;
  await run(ctx, {});
  assert.equal(gmail.sent.filter((s) => s.to === "office@tpa.edu.hk").length, before, "replied school gets no follow-up");
  assert.ok(gmail.sent.some((s) => s.to === "info@tsec.edu.hk" && s.requestedThreadId === sec.threadId), "auto_reply school continues");
  assert.ok(renderText(buildSummary(ctx)).includes("interested"));
});

test("reply from teacher's own address in a new thread is found by domain search", async () => {
  const gmail = new FakeGmail();
  const ctx = makeCtx({ gmail });
  await run(ctx, {});
  ctx.advanceDays(1);
  gmail.addInbound({ from: "Ms Wong <wong@tsec.edu.hk>", text: "請問價錢？有興趣" });
  await run(ctx, { checkOnly: true });
  assert.equal(stateOf(ctx, "SEC001").status, "replied");
  assert.ok(gmail.lastQueries.some((q) => q.includes("@tsec.edu.hk") && q.includes("newer_than:30d")));
});

test("unsubscribe is permanent: label, suppression, survives re-import, never emailed again", async () => {
  const gmail = new FakeGmail();
  const ctx = makeCtx({ gmail });
  await run(ctx, {});
  const t = gmail.sent.find((s) => s.to === "spe@tspe.edu.hk").threadId;
  gmail.addInbound({ threadId: t, from: "spe@tspe.edu.hk", text: "請勿再發，取消訂閱" });
  ctx.advanceDays(3);
  await run(ctx, {});
  assert.equal(stateOf(ctx, "SPE001").status, "unsubscribed");
  assert.ok(gmail.labeled.some((l) => l.threadId === t && l.name === "IP/取消訂閱"));
  importSchools(ctx.db, ctx.paths.schoolsCsv, nullLogger);
  assert.equal(stateOf(ctx, "SPE001").status, "unsubscribed");
  for (let i = 0; i < 5; i++) { ctx.advanceDays(4); await run(ctx, {}); }
  assert.equal(gmail.sent.filter((s) => s.to === "spe@tspe.edu.hk").length, 1);
});

test("bounce (mailer-daemon) -> bounced without calling Claude", async () => {
  const gmail = new FakeGmail();
  const claude = mockClaude();
  const ctx = makeCtx({ gmail, claude });
  await run(ctx, {});
  gmail.addInbound({ from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>", subject: "Delivery Status Notification (Failure)", text: "Address not found: info@happykg.edu.hk", failedRecipients: "info@happykg.edu.hk" });
  const calls = claude.calls.length;
  await run(ctx, { checkOnly: true });
  assert.equal(stateOf(ctx, "KG001").status, "bounced");
  assert.equal(claude.calls.length, calls);
});

test("limits: maxPerRun, maxPerDay, kill switch, testRecipient", async () => {
  let ctx = makeCtx({ cfgPatch: { maxPerRun: 2 } });
  assert.equal((await run(ctx, {})).sent, 2);
  ctx = makeCtx({ cfgPatch: { maxPerDay: 3 } });
  await run(ctx, { limit: 2 });
  assert.equal((await run(ctx, {})).sent, 1, "daily cap counts earlier runs today");
  ctx = makeCtx({ cfgPatch: { enabled: false } });
  const r = await run(ctx, {});
  assert.ok(r.skipped);
  assert.equal(ctx.gmail.sent.length, 0);
  ctx = makeCtx({ cfgPatch: { testRecipient: "me@antapp.ai", testMaxPerRun: 2 } });
  await run(ctx, {});
  assert.equal(ctx.gmail.sent.length, 2);
  for (const s of ctx.gmail.sent) {
    assert.equal(s.to, "me@antapp.ai");
    assert.ok(decodeWords(headerOf(s.mime, "Subject")).startsWith("【測試】"));
  }
});

test("errors: Claude failure marks only that school error; validation failure refuses send", async () => {
  const gmail = new FakeGmail();
  let n = 0;
  const claude = mockClaude({ followup: () => (++n === 1 ? { subject: "x", body: "{{bad}} Google 字字字字字字字字字字字字字字字字字字字字\n\nBest Regards" } : { subject: "x", body: "陳校長：\n\n早前曾來信，今次分享 **重點** 一則，請回覆此電郵。\n\nBest Regards" }) });
  const ctx = makeCtx({ gmail, claude });
  ctx.db.exec("UPDATE school_state SET status='skipped_no_email' WHERE school_id NOT IN ('PRI001','PRI002')");
  await run(ctx, {});
  ctx.advanceDays(3);
  const r = await run(ctx, {});
  assert.equal(r.sent, 1);
  assert.equal(r.errors, 1);
  const states = ["PRI001", "PRI002"].map((id) => stateOf(ctx, id));
  assert.equal(states.filter((s) => s.status === "error").length, 1);
  assert.match(states.find((s) => s.status === "error").stop_reason, /validation failed/);
});

test("Gmail auth failure stops the run with exit code 2", async () => {
  const gmail = new FakeGmail();
  gmail.profileEmail = async () => { throw Object.assign(new Error("Gmail authentication failed"), { name: "AuthError" }); };
  const ctx = makeCtx({ gmail });
  const r = await run(ctx, {});
  assert.equal(r.code, 2);
  assert.equal(r.status, "auth_error");
  assert.equal(gmail.sent.length, 0);
});

test("lock: a second concurrent run is refused", async () => {
  const ctx = makeCtx();
  fs.mkdirSync(ctx.paths.state, { recursive: true });
  fs.writeFileSync(ctx.paths.lock, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
  await assert.rejects(run(ctx, {}), /another run is in progress/);
  fs.writeFileSync(ctx.paths.lock, JSON.stringify({ pid: 999999, at: new Date().toISOString() }));
  assert.equal((await run(ctx, {})).code, 0, "stale lock removed");
});

test("--scheduled: send on Tue/Fri after 10:00 once per day, otherwise check-only", async () => {
  const ctx = makeCtx({ start: "2026-12-01T02:00:00Z" }); // Tue 10:00 HKT
  assert.equal(scheduledMode(ctx), "send");
  const r = await run(ctx, { scheduled: true });
  assert.equal(r.mode, "send");
  ctx.setTime("2026-12-01T10:00:00Z"); // Tue 18:00 HKT
  assert.equal(scheduledMode(ctx), "check-only");
  ctx.setTime("2026-12-02T10:00:00Z"); // Wed 18:00
  assert.equal(scheduledMode(ctx), "check-only");
  ctx.setTime("2026-12-04T02:00:00Z"); // Fri 10:00
  assert.equal(scheduledMode(ctx), "send");
});

test("reactivate: cap-reached schools get a new campaign (fresh budget, new thread, history kept)", async () => {
  const gmail = new FakeGmail();
  const ctx = makeCtx({ gmail });
  ctx.db.exec("UPDATE school_state SET status='skipped_no_email' WHERE school_id NOT IN ('PRI001','PRI002','SEC001','SPE001')");
  for (let i = 0; i < 12; i++) { await run(ctx, {}); ctx.advanceDays(i % 2 ? 4 : 3); }
  assert.equal(stateOf(ctx, "PRI001").status, "no_response");
  assert.equal(stateOf(ctx, "PRI001").stop_reason, "cap reached");
  // other outcomes that must never come back
  setSchoolStatus(ctx.db, "SEC001", "unsubscribed", "unsubscribe"); suppress(ctx.db, "info@tsec.edu.hk", "unsubscribe", "SEC001");
  setSchoolStatus(ctx.db, "SPE001", "bounced", "bounce");
  setSchoolStatus(ctx.db, "PRI002", "replied", "interested");
  // campaign-specific templates
  const cdir = `${ctx.paths.content}/campaigns/promo/templates`;
  fs.mkdirSync(cdir, { recursive: true });
  for (const lv of ["KG", "PRI", "SEC", "SPE"]) fs.writeFileSync(`${cdir}/first-${lv}.md`, fs.readFileSync(`${ctx.paths.content}/templates/first-${lv}.md`, "utf8").replace("測試主旨", "優惠主旨"));
  const campaigns = { promo: { templatesDir: "campaigns/promo/templates" } };
  const cache = new Map();
  ctx.contentFor = (c) => { if (!cache.has(c)) cache.set(c, loadContent(ctx.paths.content, campaigns[c] || {})); return cache.get(c); };

  assert.equal(reactivate(ctx.db, { campaign: "promo", dryRun: true }).length, 1);
  assert.equal(stateOf(ctx, "PRI001").status, "no_response", "dry-run changes nothing");
  const ids = reactivate(ctx.db, { campaign: "promo" }).map((r) => r.school_id);
  assert.deepEqual(ids, ["PRI001"]);
  assert.equal(stateOf(ctx, "PRI001").status, "active");
  assert.equal(stateOf(ctx, "PRI001").emails_sent, 0);
  for (const id of ["SEC001", "SPE001", "PRI002"]) assert.notEqual(stateOf(ctx, id).status, "active", id);
  assert.equal(reactivate(ctx.db, { campaign: "promo" }).length, 0, "idempotent for the same campaign");

  const before = gmail.sent.length;
  await run(ctx, {});
  const first = gmail.sent.slice(before).find((s) => s.to === "office@tpa.edu.hk");
  assert.ok(first, "new first email sent");
  assert.equal(first.requestedThreadId, undefined, "new thread");
  assert.equal(decodeWords(headerOf(first.mime, "Subject")), "【智能運動場】PRI 優惠主旨");
  ctx.advanceDays(3);
  await run(ctx, {});
  const fu = gmail.sent.filter((s) => s.to === "office@tpa.edu.hk").at(-1);
  assert.equal(fu.requestedThreadId, first.threadId, "follow-up threads to the new campaign's first email");
  assert.equal(headerOf(fu.mime, "References"), `<gmail-${first.id}@mail.gmail.com>`);
  assert.equal(ctx.db.prepare("SELECT COUNT(*) c FROM messages WHERE school_id='PRI001' AND dry_run=0").get().c, 12, "history kept");
  // replied only with includeReplied; unsubscribed/bounced never
  const r2 = reactivate(ctx.db, { campaign: "promo2", includeReplied: true }).map((r) => r.school_id);
  assert.deepEqual(r2, ["PRI002"]);
});
