// Send an outreach email through Gmail web using Playwright.
//
// Usage:
//   node send.mjs --to someone@school.edu.hk --name 陳校長 --school 葵涌循道中學 [--test]
//
// Template: emails/school-outreach.md (first line 「主旨：...」 is the subject; **bold** and ![alt](url) images supported).
//
// Google blocks sign-in in a Chrome that Playwright launches, so this script
// connects to a Chrome you opened yourself:
//   1. ./open-chrome.sh      (opens Chrome with a debug port; log in to Gmail there)
//   2. node send.mjs --to ... (connects to that Chrome and sends)
// The login is kept in ./.profile so you only log in once.
// ./.profile holds your Gmail session cookies: never commit or share it.

import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const marketing = path.resolve(here, "../..");
const TEMPLATE = path.join(marketing, "emails/school-outreach.md");
const CDP = process.env.CDP_URL || "http://127.0.0.1:9222";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const to = opt("--to");
if (!to || !/^\S+@\S+\.\S+$/.test(to)) {
  console.error("Usage: node send.mjs --to someone@school.edu.hk --name 陳校長 --school 學校名稱 [--test]");
  process.exit(1);
}
const vars = { recipient_name: opt("--name"), school_name: opt("--school") };
for (const [k, v] of Object.entries(vars)) {
  if (!v) { console.error(`Missing --${k === "recipient_name" ? "name" : "school"} (fills {{${k}}} in the template).`); process.exit(1); }
}

const filled = readFileSync(TEMPLATE, "utf8").replace(/\{\{(\w+)\}\}/g, (m, k) => vars[k] ?? m);
const left = filled.match(/\{\{\w+\}\}/g);
if (left) { console.error("Unfilled placeholders:", [...new Set(left)].join(", ")); process.exit(1); }
const [first, ...lines] = filled.split("\n");
const subject = (flag("--test") ? "【測試】" : "") + first.replace(/^主旨[:：]\s*/, "").trim();
const html = toHtml(lines.join("\n").trim());

// Template markup: **bold**, ![alt](url) on its own line = image. Everything after
// the image (unsubscribe note, address, NOTICE) is rendered as small grey text.
function toHtml(md) {
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  const out = [];
  let small = false;
  for (const line of md.split("\n")) {
    const img = line.match(/^!\[([^\]]*)\]\((https?:[^)\s]+)\)\s*$/);
    if (img) {
      out.push(`<img src="${esc(img[2])}" alt="${esc(img[1])}" width="64" height="64" style="display:block;margin:12px 0">`);
      small = true;
      continue;
    }
    const text = line ? inline(line) : "";
    out.push(small && text ? `<span style="font-size:11px;color:#777777">${text}</span>` : text);
  }
  return `<div style="font-family:Arial,'Microsoft JhengHei',sans-serif;font-size:14px;line-height:1.6;color:#222222">${out.join("<br>")}</div>`;
}

let browser;
try {
  browser = await chromium.connectOverCDP(CDP);
} catch {
  console.error(`Could not reach Chrome at ${CDP}. Run ./open-chrome.sh first and log in to Gmail.`);
  process.exit(1);
}
const ctx = browser.contexts()[0];
const page = await ctx.newPage();

try {
  // 1. Make sure we're logged in.
  await page.goto("https://mail.google.com/mail/u/0/#inbox");
  console.log("Waiting for Gmail inbox (log in in the Chrome window if asked)...");
  await page.waitForURL(/mail\.google\.com\/mail\/u\/\d+\/#/, { timeout: 5 * 60_000 });
  await page.locator('div[role="navigation"]').first().waitFor({ timeout: 5 * 60_000 });

  // 2. Open a full-screen compose window with recipient and subject, then put the
  //    formatted body into the editor. Gmail also sends a plain-text copy.
  const url =
    "https://mail.google.com/mail/u/0/?view=cm&fs=1" +
    `&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}`;
  await page.goto(url);
  const editor = page.locator('div[role="textbox"][contenteditable="true"]').last();
  await editor.waitFor({ timeout: 60_000 });
  // Gmail enforces Trusted Types (no innerHTML), so insert the HTML like a paste.
  const how = await editor.evaluate((el, h) => {
    el.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(el); // replaces any auto-inserted Gmail signature too
    sel.addRange(range);
    try {
      if (document.execCommand("insertHTML", false, h) && el.querySelector("b")) return "insertHTML";
    } catch {}
    const dt = new DataTransfer();
    dt.setData("text/html", h);
    dt.setData("text/plain", h.replace(/<br>/g, "\n").replace(/<[^>]+>/g, ""));
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    return el.querySelector("b") ? "paste" : "failed";
  }, html);
  if (how === "failed") throw new Error("Could not insert the formatted body into Gmail.");
  await page.waitForTimeout(1500);
  const check = await editor.evaluate((el) => ({ bold: el.querySelectorAll("b").length, img: el.querySelectorAll("img").length }));
  console.log(`Body inserted via ${how}: ${check.bold} bold, ${check.img} image`);
  // Send button tooltip is "Send (⌘Enter)" / "傳送 (Ctrl-Enter)" etc. in any UI language.
  const sendBtn = page.locator('div[role="button"][data-tooltip*="Enter"]').first();
  await sendBtn.waitFor({ timeout: 60_000 });

  // 4. Send and confirm.
  await sendBtn.click();
  const sent = page.getByText(/Message sent|已傳送郵件|郵件已傳送|已送出郵件|訊息已傳送/).first();
  const ok = await sent.waitFor({ timeout: 60_000 }).then(() => true, () => false);
  if (!ok) throw new Error("Clicked Send but did not see a 'Message sent' confirmation; check the Sent folder.");
  console.log(`Sent: "${subject}" -> ${to}`);
  await page.waitForTimeout(3000);
} catch (e) {
  console.error("Failed:", e.message);
  await page.screenshot({ path: path.join(here, "error.png") }).catch(() => {});
  console.error("Screenshot saved to", path.join(here, "error.png"));
  process.exitCode = 1;
} finally {
  await page.close().catch(() => {});
  await browser.close(); // only disconnects; your Chrome window stays open
}
