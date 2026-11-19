// Test helpers: temp copy of the fixture emails/ dir, fake Gmail, mock Claude, fake clock.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePaths } from "../src/paths.mjs";
import { loadConfig } from "../src/config.mjs";
import { openDb, importSchools } from "../src/db.mjs";
import { loadContent } from "../src/content.mjs";
import { nullLogger } from "../src/log.mjs";

export const here = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURE = path.join(here, "fixtures", "emails");

export function tmpEmailsDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ip-outreach-test-"));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}

export function decodeRaw(rawB64url) { return Buffer.from(rawB64url, "base64url").toString("utf8"); }
export function headerOf(mime, name) {
  const head = mime.split("\r\n\r\n")[0].replace(/\r\n[ \t]+/g, " ");
  const m = head.match(new RegExp(`^${name}: (.*)$`, "mi"));
  return m ? m[1] : null;
}
export function decodeWords(s) {
  return s.replace(/=\?UTF-8\?B\?([^?]+)\?=\s*/g, (_, b) => Buffer.from(b, "base64").toString("utf8")).trim();
}
export function mimeParts(mime) {
  const boundary = mime.match(/boundary="([^"]+)"/)[1];
  return mime.split(`--${boundary}`).slice(1, -1).map((p) => {
    const [h, body] = p.split("\r\n\r\n");
    return { type: h.match(/Content-Type: ([^;]+)/)[1], body: Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8") };
  });
}

export class FakeGmail {
  constructor(me = "anthonychan@antapp.ai") {
    this.me = me; this.msgs = new Map(); this.sent = []; this.labels = new Map(); this.labeled = []; this.n = 0; this.clock = () => Date.now();
    this.failSendFor = new Set();
  }
  async profileEmail() { return this.me; }
  async send(raw, threadId) {
    const mime = decodeRaw(raw);
    const to = headerOf(mime, "To");
    if (this.failSendFor.has(to)) throw Object.assign(new Error("Invalid To header"), { code: 400 });
    const id = `m${++this.n}`;
    const tid = threadId || `t${this.n}`;
    const msg = { id, threadId: tid, labelIds: ["SENT"], from: `Anthony Chan <${this.me}>`, to, subject: decodeWords(headerOf(mime, "Subject")),
      messageId: `<gmail-${id}@mail.gmail.com>`, date: this.clock(), text: "", snippet: "", contentType: "", failedRecipients: "" };
    this.msgs.set(id, msg);
    this.sent.push({ id, threadId: tid, requestedThreadId: threadId, mime, to });
    return { id, threadId: tid };
  }
  addInbound({ threadId, from, subject = "Re: x", text = "", date = this.clock(), contentType = "", failedRecipients = "" }) {
    const id = `in${++this.n}`;
    this.msgs.set(id, { id, threadId: threadId || `t${id}`, labelIds: ["INBOX"], from, to: this.me, subject, messageId: `<${id}@x>`, date, text, snippet: text.slice(0, 50), contentType, failedRecipients });
    return id;
  }
  async getMessage(id) { const m = this.msgs.get(id); if (!m) throw new Error("not found"); return { ...m }; }
  async getThread(tid) { return [...this.msgs.values()].filter((m) => m.threadId === tid).map((m) => ({ ...m })); }
  async search(q) {
    this.lastQueries = [...(this.lastQueries || []), q];
    const doms = [...q.matchAll(/@([\w.-]+)/g)].map((m) => m[1].toLowerCase());
    const daemon = /mailer-daemon/.test(q);
    return [...this.msgs.values()].filter((m) => !m.labelIds.includes("SENT") &&
      (daemon ? /mailer-daemon|postmaster/i.test(m.from) : doms.some((d) => m.from.toLowerCase().includes("@" + d)))).map((m) => ({ id: m.id, threadId: m.threadId }));
  }
  async ensureLabel(name) { if (!this.labels.has(name)) this.labels.set(name, `L${this.labels.size + 1}`); return this.labels.get(name); }
  async addLabelToThread(threadId, labelId) { this.labeled.push({ threadId, labelId, name: [...this.labels].find(([, v]) => v === labelId)?.[0] }); }
}

/** Mock claude: follow-up prompts get a valid short body; classify prompts are keyword-classified. */
export function mockClaude({ followup, classify } = {}) {
  const calls = [];
  const fn = async (prompt, validate = (x) => x) => {
    calls.push(prompt);
    if (prompt.startsWith("FOLLOWUP")) {
      const topic = JSON.parse(prompt.match(/TOPIC:\n([\s\S]*?)\nFACTS:/)[1]);
      return validate(followup ? followup(prompt, topic) : { subject: `【智能運動場】${topic.title}`, body: `{{recipient_name}}：\n\n早前曾來信介紹智能運動場，今次想分享「**${topic.title}**」。\n\n• 重點一\n• 重點二\n\n如有興趣，**回覆此電郵**即可。\n\nBest Regards` });
    }
    if (prompt.startsWith("CLASSIFY")) {
      if (classify) return validate(classify(prompt));
      const cat = /取消訂閱|unsubscribe/i.test(prompt) ? "unsubscribe" : /out of office|休假/i.test(prompt) ? "auto_reply" : /興趣/.test(prompt) ? "interested" : "other";
      return validate({ category: cat, summary: `摘要:${cat}`, stop: cat !== "auto_reply" });
    }
    throw new Error("unexpected prompt");
  };
  fn.calls = calls;
  return fn;
}

export function makeCtx({ dir = tmpEmailsDir(), cfgPatch = {}, start = "2026-12-01T02:00:00Z", claude = mockClaude(), gmail = new FakeGmail() } = {}) {
  const paths = resolvePaths(dir);
  if (Object.keys(cfgPatch).length) {
    const raw = JSON.parse(fs.readFileSync(paths.config, "utf8"));
    fs.writeFileSync(paths.config, JSON.stringify({ ...raw, ...cfgPatch }, null, 2));
  }
  const cfg = loadConfig(paths.config);
  const db = openDb(paths.db);
  importSchools(db, paths.schoolsCsv, nullLogger);
  let t = Date.parse(start);
  const ctx = { paths, cfg, db, log: nullLogger, content: loadContent(paths.content), claude, gmail, now: () => new Date(t), delay: null };
  if (gmail) gmail.clock = () => t;
  ctx.advanceDays = (d) => { t += d * 86400000; };
  ctx.setTime = (iso) => { t = Date.parse(iso); };
  return ctx;
}

export const stateOf = (ctx, id) => ctx.db.prepare("SELECT * FROM school_state WHERE school_id = ?").get(id);
