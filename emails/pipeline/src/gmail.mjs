// Gmail API (googleapis) with OAuth Desktop-app loopback flow, token refresh and backoff.
import fs from "node:fs";
import http from "node:http";
import { spawn } from "node:child_process";
import { google } from "googleapis";

export const SCOPES = ["https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.modify"];

export class AuthError extends Error {
  constructor(msg) { super(msg); this.name = "AuthError"; }
}

function readClientSecret(file) {
  if (!fs.existsSync(file)) throw new AuthError(`OAuth client file not found: ${file} (see README: Google Cloud 設定)`);
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  const c = j.installed || j.web;
  if (!c?.client_id) throw new AuthError(`${file} is not an OAuth client JSON`);
  if (!j.installed) throw new AuthError(`${file} is not a "Desktop app" OAuth client (expected "installed" key)`);
  return c;
}

function saveToken(file, tokens) {
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
  const merged = { ...prev, ...tokens };
  if (!merged.refresh_token && prev.refresh_token) merged.refresh_token = prev.refresh_token;
  fs.writeFileSync(file, JSON.stringify(merged, null, 2), { mode: 0o600 });
  fs.chmodSync(file, 0o600);
}

/** Interactive login: loopback redirect on 127.0.0.1, opens the browser, saves token.json (600). */
export async function login(paths, { log = console, openBrowser = true } = {}) {
  const c = readClientSecret(paths.clientSecret);
  fs.mkdirSync(paths.secrets, { recursive: true, mode: 0o700 });
  const server = http.createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const redirect = `http://127.0.0.1:${server.address().port}`;
  const client = new google.auth.OAuth2(c.client_id, c.client_secret, redirect);
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
  const state = Math.random().toString(36).slice(2);
  const url = client.generateAuthUrl({
    access_type: "offline", prompt: "consent", scope: SCOPES, state,
    code_challenge: codeChallenge, code_challenge_method: "S256",
  });
  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new AuthError("OAuth login timed out (10 min)")), 10 * 60_000);
    server.on("request", (req, res) => {
      const u = new URL(req.url, redirect);
      if (u.pathname !== "/") { res.writeHead(404).end(); return; }
      const err = u.searchParams.get("error");
      const ok = !err && u.searchParams.get("state") === state && u.searchParams.get("code");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(ok ? "<h2>登入成功，可以關閉此視窗。</h2>" : `<h2>登入失敗：${err || "state mismatch"}</h2>`);
      clearTimeout(timer);
      ok ? resolve(u.searchParams.get("code")) : reject(new AuthError(`OAuth error: ${err || "state mismatch"}`));
    });
    log.info?.(`Opening browser for Google login. If it does not open, visit:\n${url}`);
    if (openBrowser) spawn("open", [url], { stdio: "ignore", detached: true }).on("error", () => {}).unref();
  }).finally(() => server.close());
  const { tokens } = await client.getToken({ code, codeVerifier, redirect_uri: redirect });
  if (!tokens.refresh_token) throw new AuthError("Google did not return a refresh token; revoke access at myaccount.google.com/permissions and retry.");
  saveToken(paths.token, tokens);
  return tokens;
}

export function authClient(paths) {
  const c = readClientSecret(paths.clientSecret);
  if (!fs.existsSync(paths.token)) throw new AuthError(`Not logged in: ${paths.token} missing. Run ./emails/scripts/setup.sh`);
  const tokens = JSON.parse(fs.readFileSync(paths.token, "utf8"));
  if (!tokens.refresh_token) throw new AuthError("token.json has no refresh_token. Run ./emails/scripts/setup.sh again.");
  const client = new google.auth.OAuth2(c.client_id, c.client_secret);
  client.setCredentials(tokens);
  client.on("tokens", (t) => { try { saveToken(paths.token, t); } catch {} });
  return client;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isAuthErr(e) {
  const s = e?.response?.status ?? e?.code;
  const msg = String(e?.response?.data?.error || e?.message || "");
  return s === 401 || /invalid_grant|unauthorized_client|invalid_client|Invalid Credentials|insufficient.*scope/i.test(msg);
}
function isRetryable(e) {
  const s = Number(e?.response?.status ?? e?.code);
  const reason = JSON.stringify(e?.response?.data?.error?.errors || e?.errors || "");
  return s === 429 || s >= 500 || /rateLimitExceeded|userRateLimitExceeded|backendError/.test(reason) ||
    ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED"].includes(e?.code);
}

/** Exponential backoff on 429/5xx/network errors; auth errors become AuthError. */
export async function withBackoff(fn, { tries = 6, baseMs = 1000, log, sleepFn = sleep } = {}) {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (isAuthErr(e)) throw new AuthError(`Gmail authentication failed (${e.message}). Run ./emails/scripts/setup.sh to log in again.`);
      if (!isRetryable(e) || i >= tries - 1) throw e;
      const wait = baseMs * 2 ** i + Math.floor(Math.random() * baseMs);
      log?.warn(`Gmail API ${e?.response?.status ?? e?.code}: retry ${i + 1}/${tries - 1} in ${wait} ms`);
      await sleepFn(wait);
    }
  }
}

const header = (payload, name) => payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

function decodePart(data) { return data ? Buffer.from(data, "base64url").toString("utf8") : ""; }
function bodyText(payload) {
  if (!payload) return "";
  const walk = (p, type) => {
    if (p.mimeType === type && p.body?.data) return decodePart(p.body.data);
    for (const c of p.parts || []) { const r = walk(c, type); if (r) return r; }
    return "";
  };
  const plain = walk(payload, "text/plain");
  if (plain) return plain;
  const html = walk(payload, "text/html");
  return html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export function parseMessage(m) {
  const p = m.payload || {};
  return {
    id: m.id, threadId: m.threadId, labelIds: m.labelIds || [],
    from: header(p, "From"), to: header(p, "To"), subject: header(p, "Subject"),
    messageId: header(p, "Message-ID") || header(p, "Message-Id"),
    failedRecipients: header(p, "X-Failed-Recipients"),
    contentType: header(p, "Content-Type"),
    autoSubmitted: header(p, "Auto-Submitted"),
    date: Number(m.internalDate || 0),
    text: bodyText(p), snippet: m.snippet || "",
  };
}

/** Thin Gmail client with the interface the pipeline uses (tests provide a fake). */
export function makeGmail(auth, { log } = {}) {
  const g = google.gmail({ version: "v1", auth });
  const call = (fn) => withBackoff(fn, { log });
  const labelCache = new Map();
  return {
    async profileEmail() { return (await call(() => g.users.getProfile({ userId: "me" }))).data.emailAddress; },
    async send(raw, threadId) {
      const res = await call(() => g.users.messages.send({ userId: "me", requestBody: threadId ? { raw, threadId } : { raw } }));
      return { id: res.data.id, threadId: res.data.threadId };
    },
    async getMessage(id) { return parseMessage((await call(() => g.users.messages.get({ userId: "me", id, format: "full" }))).data); },
    async getThread(id) {
      const res = await call(() => g.users.threads.get({ userId: "me", id, format: "full" }));
      return (res.data.messages || []).map(parseMessage);
    },
    async search(q, max = 200) {
      const out = [];
      let pageToken;
      do {
        const res = await call(() => g.users.messages.list({ userId: "me", q, maxResults: Math.min(100, max), pageToken }));
        out.push(...(res.data.messages || []));
        pageToken = res.data.nextPageToken;
      } while (pageToken && out.length < max);
      return out;
    },
    async ensureLabel(name) {
      if (labelCache.has(name)) return labelCache.get(name);
      const list = (await call(() => g.users.labels.list({ userId: "me" }))).data.labels || [];
      const parts = name.split("/");
      let id;
      for (let i = 1; i <= parts.length; i++) {
        const n = parts.slice(0, i).join("/");
        const found = list.find((l) => l.name === n);
        if (found) { id = found.id; continue; }
        const created = await call(() => g.users.labels.create({ userId: "me", requestBody: { name: n, labelListVisibility: "labelShow", messageListVisibility: "show" } }));
        list.push(created.data);
        id = created.data.id;
      }
      labelCache.set(name, id);
      return id;
    },
    async addLabelToThread(threadId, labelId) {
      await call(() => g.users.threads.modify({ userId: "me", id: threadId, requestBody: { addLabelIds: [labelId] } }));
    },
  };
}
