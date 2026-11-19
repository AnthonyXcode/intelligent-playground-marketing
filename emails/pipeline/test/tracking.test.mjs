import { test } from "node:test";
import assert from "node:assert/strict";
import { makeCtx, mimeParts } from "./helpers.mjs";
import { tokenFor, trackLinks, recordVisits, pullVisits, visitStats, TOKEN_RE } from "../src/tracking.mjs";
import { compose, selectDue, sendDue } from "../src/sender.mjs";
import { toHtml } from "../src/markup.mjs";
import { renderText, buildSummary, renderHtml } from "../src/report.mjs";

const cfg = { tracking: { enabled: true, siteUrl: "https://www.intelligent-playground.com/", param: "r" } };

test("tokenFor is stable per school and unique", () => {
  const ctx = makeCtx();
  const ids = ctx.db.prepare("SELECT id FROM schools").all().map((r) => r.id);
  const a = tokenFor(ctx.db, ids[0]);
  assert.match(a, TOKEN_RE);
  assert.equal(tokenFor(ctx.db, ids[0]), a);
  assert.notEqual(tokenFor(ctx.db, ids[1]), a);
});

test("trackLinks rewrites only product-site links", () => {
  const md = [
    "了解更多：**https://www.intelligent-playground.com/**",
    "或 www.intelligent-playground.com/#funding。",
    "也可 intelligent-playground.com",
    "www.antapp.ai",
    "電郵 someone@intelligent-playground.com",
  ].join("\n");
  const out = trackLinks(md, "Ab3dEf7hJk", cfg).split("\n");
  assert.equal(out[0], "了解更多：**https://www.intelligent-playground.com/?r=Ab3dEf7hJk**");
  assert.equal(out[1], "或 https://www.intelligent-playground.com/?r=Ab3dEf7hJk#funding。");
  assert.equal(out[2], "也可 https://www.intelligent-playground.com/?r=Ab3dEf7hJk");
  assert.equal(out[3], "www.antapp.ai");
  assert.equal(out[4], "電郵 someone@intelligent-playground.com");
  assert.equal(trackLinks(md, "Ab3dEf7hJk", { tracking: { ...cfg.tracking, enabled: false } }), md);
  assert.equal(trackLinks(out.join("\n"), "Ab3dEf7hJk", cfg), out.join("\n"), "idempotent");
});

test("HTML shows the clean URL but links with the code", () => {
  const html = toHtml("**https://www.intelligent-playground.com/?r=Ab3dEf7hJk**");
  assert.match(html, /<a href="https:\/\/www\.intelligent-playground\.com\/\?r=Ab3dEf7hJk"[^>]*>https:\/\/www\.intelligent-playground\.com\/<\/a>/);
});

test("composed email carries the school's code in text and HTML; stored body does not", async () => {
  const ctx = makeCtx();
  const sig = ctx.content.signature;
  ctx.content.signature = `${sig}\n了解更多 https://www.intelligent-playground.com/`;
  const r = selectDue(ctx).firsts[0];
  const mail = await compose(ctx, r);
  const token = tokenFor(ctx.db, r.id);
  assert.ok(mail.text.includes(`https://www.intelligent-playground.com/?r=${token}`));
  assert.ok(mail.html.includes(`href="https://www.intelligent-playground.com/?r=${token}"`));
  assert.ok(!mail.body.includes("?r="));
  const parts = mimeParts(mail.mime);
  assert.ok(parts.find((p) => p.type === "text/plain").body.includes(`?r=${token}`));
});

test("recordVisits: matches school, ignores unknown codes and scanner hits right after send", async () => {
  const ctx = makeCtx();
  ctx.content.signature += "\nhttps://www.intelligent-playground.com/";
  await sendDue(ctx, { limit: 1 });
  const sid = ctx.db.prepare("SELECT school_id FROM messages WHERE dry_run = 0").get().school_id;
  const token = tokenFor(ctx.db, sid);
  const sentAt = Date.parse(ctx.db.prepare("SELECT sent_at FROM messages").get().sent_at);
  const iso = (ms) => new Date(sentAt + ms).toISOString();
  const r = recordVisits(ctx, [
    { id: "1-0", token, event: "visit", ts: iso(10_000), device: "desktop" },
    { id: "2-0", token, event: "visit", ts: iso(3_600_000), device: "mobile" },
    { id: "3-0", token, event: "contact", ts: iso(3_700_000), device: "mobile" },
    { id: "4-0", token: "Zz9zZz9zZz", event: "visit", ts: iso(3_600_000) },
    { id: "5-0", token: "bad", event: "visit", ts: iso(1) },
  ]);
  assert.equal(r.counted, 2);
  assert.equal(recordVisits(ctx, [{ id: "2-0", token, event: "visit", ts: iso(3_600_000) }]).counted, 0, "dedupe by id");
  const notes = Object.fromEntries(ctx.db.prepare("SELECT id, counted, note FROM visits").all().map((v) => [v.id, v]));
  assert.equal(notes["1-0"].counted, 0);
  assert.match(notes["1-0"].note, /scanner/);
  assert.equal(notes["4-0"].note, "unknown code");
  assert.ok(!notes["5-0"]);
  const st = visitStats(ctx.db).get(sid);
  assert.equal(st.visits, 1);
  assert.equal(st.contacts, 1);
  const s = buildSummary(ctx);
  assert.equal(s.visitedSchools, 1);
  assert.match(renderText(s), /按預約示範/);
  assert.match(renderHtml(ctx, s), /曾瀏覽網站/);
});

test("pullVisits pages with the cursor, sends the key, and never throws", async () => {
  const ctx = makeCtx();
  process.env.IP_TRACKING_KEY = "k".repeat(40);
  try {
    const sid = ctx.db.prepare("SELECT id FROM schools").get().id;
    const token = tokenFor(ctx.db, sid);
    const seen = [];
    const pages = [
      { items: Array.from({ length: 500 }, (_, i) => ({ id: `${1000 + i}-0`, token, event: "visit", ts: "2026-12-05T03:00:00.000Z", device: "desktop" })) },
      { items: [{ id: "2000-0", token, event: "contact", ts: "2026-12-05T04:00:00.000Z", device: "desktop" }] },
    ];
    const fetchImpl = async (url, opts) => {
      seen.push({ after: url.searchParams.get("after"), auth: opts.headers.Authorization });
      return { ok: true, json: async () => pages.shift() || { items: [] } };
    };
    const r = await pullVisits(ctx, { fetchImpl });
    assert.equal(r.ok, true);
    assert.equal(r.counted, 501);
    assert.deepEqual(seen.map((s) => s.after), [null, "1499-0"]);
    assert.equal(seen[0].auth, `Bearer ${"k".repeat(40)}`);
    const again = await pullVisits(ctx, { fetchImpl: async (url) => { seen.push({ after: url.searchParams.get("after") }); return { ok: true, json: async () => ({ items: [] }) }; } });
    assert.equal(seen.at(-1).after, "2000-0", "cursor persisted");
    assert.equal(again.counted, 0);
    const bad = await pullVisits(ctx, { fetchImpl: async () => { throw new Error("offline"); } });
    assert.equal(bad.ok, false);
  } finally {
    delete process.env.IP_TRACKING_KEY;
  }
});

test("pullVisits without a key does nothing", async () => {
  const ctx = makeCtx();
  let called = false;
  const r = await pullVisits(ctx, { fetchImpl: async () => { called = true; } });
  assert.equal(called, false);
  assert.equal(r.ok, false);
});
