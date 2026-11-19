// Safety behaviours added in review: flagged contacts, duplicate emails, fail-safe reply
// handling, exact-address reply search, level-banned terms, lock and kill-switch edge cases.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { makeCtx, stateOf, mockClaude, FakeGmail } from "./helpers.mjs";
import { runPipeline } from "../src/runner.mjs";
import { importSchools } from "../src/db.mjs";
import { acquireLock } from "../src/lock.mjs";
import { validateEmail } from "../src/validate.mjs";
import { DEFAULTS } from "../src/config.mjs";
import { nullLogger } from "../src/log.mjs";

const run = (ctx, o) => runPipeline(ctx, o);
const onlySchools = (ctx, ids) => ctx.db.exec(`UPDATE school_state SET status='skipped_no_email' WHERE school_id NOT IN (${ids.map((i) => `'${i}'`).join(",")})`);

test("flagged contacts (免費郵箱 / 可能為個人電郵 / 校長郵箱) are skipped by default, included with the switch", async () => {
  const ctx = makeCtx();
  fs.appendFileSync(ctx.paths.schoolsCsv, [
    "KG777,KG,免費郵箱幼稚園,,沙田,,abc@gmail.com,,,,fixture,時段:上午/下午; 免費郵箱",
    "KG778,KG,校長郵箱幼稚園,,沙田,,principal@k778.edu.hk,,,,fixture,校長郵箱",
    "KG779,KG,個人電郵幼稚園,,沙田,,my.hung@k779.org.hk,,,,fixture,可能為個人電郵",
  ].join("\n") + "\n");
  const c = importSchools(ctx.db, ctx.paths.schoolsCsv, nullLogger);
  assert.equal(c.flagged, 3);
  for (const id of ["KG777", "KG778", "KG779"]) assert.equal(stateOf(ctx, id).status, "skipped_flagged");
  await run(ctx, {});
  assert.ok(!ctx.gmail.sent.some((s) => /gmail\.com|k778|k779/.test(s.to)), "flagged rows never emailed");
  importSchools(ctx.db, ctx.paths.schoolsCsv, nullLogger, undefined, { includeFlagged: true });
  assert.equal(stateOf(ctx, "KG777").status, "pending");
  importSchools(ctx.db, ctx.paths.schoolsCsv, nullLogger);
  assert.equal(stateOf(ctx, "KG777").status, "skipped_flagged", "switching back off stops them again");
});

test("duplicate email across rows: only the first row is emailed", () => {
  const ctx = makeCtx();
  fs.appendFileSync(ctx.paths.schoolsCsv, "PRI888,PRI,重複電郵小學,,觀塘,,OFFICE@tpa.edu.hk,,,,fixture,\n");
  const c = importSchools(ctx.db, ctx.paths.schoolsCsv, nullLogger);
  assert.equal(c.duplicateEmail, 1);
  assert.equal(stateOf(ctx, "PRI888").status, "skipped_no_email");
  assert.equal(stateOf(ctx, "PRI001").status, "pending");
});

test("classification failure holds the school (no follow-up) until it is classified", async () => {
  const gmail = new FakeGmail();
  let failClassify = true;
  const claude = mockClaude({ classify: () => { if (failClassify) throw new Error("claude timed out"); return { category: "auto_reply", summary: "休假", stop: false }; } });
  const ctx = makeCtx({ gmail, claude });
  onlySchools(ctx, ["PRI001"]);
  await run(ctx, {});
  const t = gmail.sent[0].threadId;
  ctx.advanceDays(3);
  gmail.addInbound({ threadId: t, from: "office@tpa.edu.hk", text: "請勿再發" });
  const r = await run(ctx, {});
  assert.equal(r.sent, 0, "no follow-up over an unclassified reply");
  assert.equal(stateOf(ctx, "PRI001").status, "error");
  assert.match(stateOf(ctx, "PRI001").stop_reason, /reply not classified/);
  failClassify = false;
  ctx.advanceDays(1);
  await run(ctx, { checkOnly: true });
  assert.equal(stateOf(ctx, "PRI001").status, "active", "auto_reply on retry releases the hold");
  ctx.advanceDays(3);
  assert.equal((await run(ctx, {})).sent, 1);
});

test("reply arriving after the reply check (during a long run) blocks the follow-up", async () => {
  const gmail = new FakeGmail();
  const ctx = makeCtx({ gmail });
  onlySchools(ctx, ["PRI001"]);
  await run(ctx, {});
  const t = gmail.sent[0].threadId;
  ctx.advanceDays(3);
  const realThread = gmail.getThread.bind(gmail);
  let calls = 0;
  // 1st getThread = reply check (empty); the reply lands before the pre-send re-check
  gmail.getThread = async (tid) => { calls++; const r = await realThread(tid); if (calls === 1) gmail.addInbound({ threadId: t, from: "office@tpa.edu.hk", text: "有興趣" }); return r; };
  const r = await run(ctx, {});
  assert.equal(r.sent, 0);
  assert.equal(gmail.sent.length, 1);
  await run(ctx, { checkOnly: true });
  assert.equal(stateOf(ctx, "PRI001").status, "replied");
});

test("school on a generic/shared domain: reply from its exact address in a new thread is found", async () => {
  const gmail = new FakeGmail();
  const ctx = makeCtx({ gmail, cfgPatch: { includeFlaggedContacts: true } });
  fs.appendFileSync(ctx.paths.schoolsCsv, "SEC777,SEC,共用網域中學,,灣仔,,sec777@yahoo.com.hk,,,,fixture,\n");
  importSchools(ctx.db, ctx.paths.schoolsCsv, nullLogger);
  onlySchools(ctx, ["SEC777"]);
  ctx.cfg.genericDomains = ["yahoo.com.hk"];
  await run(ctx, {});
  ctx.advanceDays(1);
  gmail.addInbound({ from: "sec777@yahoo.com.hk", text: "有興趣，請聯絡" });
  await run(ctx, { checkOnly: true });
  assert.equal(stateOf(ctx, "SEC777").status, "replied");
  assert.ok(gmail.lastQueries.some((q) => q.includes("sec777@yahoo.com.hk")));
  assert.ok(!gmail.lastQueries.some((q) => q.includes("from:(@yahoo.com.hk")), "generic domain itself is never searched");
});

test("failed reply search holds the schools it covers", async () => {
  const gmail = new FakeGmail();
  const ctx = makeCtx({ gmail });
  onlySchools(ctx, ["PRI001"]);
  await run(ctx, {});
  ctx.advanceDays(3);
  gmail.search = async () => { throw Object.assign(new Error("backendError"), { code: 500 }); };
  const r = await run(ctx, {});
  assert.equal(r.sent, 0);
  assert.equal(stateOf(ctx, "PRI001").status, "active", "held, not errored");
});

test("KG emails may not mention MVPA60 / 智啟學教 / 升中 (code check, not only the prompt)", () => {
  const cfg = { ...DEFAULTS };
  const full = "x\n取消訂閱";
  const body = "校長：\n\n可善用 MVPA60 津貼添置設備，歡迎回覆此電郵。\n\nBest Regards";
  assert.ok(validateEmail({ subject: "s", body, full, isFollowup: true, to: "a@b.hk", level: "KG" }, cfg).some((e) => /not allowed for KG/.test(e)));
  assert.ok(!validateEmail({ subject: "s", body, full, isFollowup: true, to: "a@b.hk", level: "PRI" }, cfg).some((e) => /not allowed/.test(e)));
});

test("lock: a live run is never taken over; a lock from before the last boot is stale", () => {
  const ctx = makeCtx();
  fs.mkdirSync(ctx.paths.state, { recursive: true });
  fs.writeFileSync(ctx.paths.lock, JSON.stringify({ pid: process.pid, at: new Date(Date.now() - 48 * 3600_000).toISOString() }));
  assert.throws(() => acquireLock(ctx.paths.lock, Date.now() - 72 * 3600_000), /another run is in progress/, "48 h old but alive");
  const release = acquireLock(ctx.paths.lock, Date.now() - 3600_000); // lock older than boot -> pid reused
  release();
  assert.ok(!fs.existsSync(ctx.paths.lock));
});

test("kill switch: unreadable config mid-run stops sending (fail safe)", async () => {
  const gmail = new FakeGmail();
  const ctx = makeCtx({ gmail });
  let n = 0;
  ctx.delay = async () => { if (++n === 1) fs.writeFileSync(ctx.paths.config, "{ broken"); };
  const r = await run(ctx, {});
  assert.equal(r.sent, 1);
});
