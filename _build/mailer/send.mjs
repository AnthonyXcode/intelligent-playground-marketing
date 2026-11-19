// Send an outreach email through Gmail web using Playwright.
//
// Usage:
//   node send.mjs --to someone@example.com [--test] [--no-attach]
//
// Google blocks sign-in in a Chrome that Playwright launches, so this script
// connects to a Chrome you opened yourself:
//   1. ./open-chrome.sh      (opens Chrome with a debug port; log in to Gmail there)
//   2. node send.mjs --to ... (connects to that Chrome and sends)
// The login is kept in ./.profile so you only log in once.
// ./.profile holds your Gmail session cookies: never commit or share it.

import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const marketing = path.resolve(here, "../..");
const TEMPLATE = path.join(marketing, "outreach/email-principal.md");
const ATTACHMENT = path.join(marketing, "IntelligentPlayground_智能運動場.pptx");
const CDP = process.env.CDP_URL || "http://127.0.0.1:9222";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const to = opt("--to");
if (!to || !/^\S+@\S+\.\S+$/.test(to)) {
  console.error("Usage: node send.mjs --to someone@example.com [--test] [--no-attach]");
  process.exit(1);
}

const [subjectLine, ...rest] = readFileSync(TEMPLATE, "utf8").split("\n---\n");
const subject = (flag("--test") ? "【測試】" : "") + subjectLine.trim();
const body = rest.join("\n---\n").trim();
const attach = !flag("--no-attach");
if (attach && !existsSync(ATTACHMENT)) {
  console.error("Attachment not found:", ATTACHMENT);
  process.exit(1);
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

  // 2. Open a pre-filled full-screen compose window.
  const url =
    "https://mail.google.com/mail/u/0/?view=cm&fs=1" +
    `&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  await page.goto(url);
  // Send button tooltip is "Send (⌘Enter)" / "傳送 (Ctrl-Enter)" etc. in any UI language.
  const sendBtn = page.locator('div[role="button"][data-tooltip*="Enter"]').first();
  await sendBtn.waitFor({ timeout: 60_000 });

  // 3. Attach the deck and wait for the upload to finish.
  if (attach) {
    const name = path.basename(ATTACHMENT);
    console.log("Attaching", name, "...");
    await page.locator('input[type="file"][name="Filedata"]').first().setInputFiles(ATTACHMENT);
    await page.getByText(name.replace(/\.pptx$/, "")).first().waitFor({ timeout: 120_000 });
    // Upload progress bars disappear once the upload completes.
    await page.waitForTimeout(1500);
    await page.waitForFunction(() => !document.querySelector('div[role="progressbar"]'), null, { timeout: 300_000 });
  }

  // 4. Send and confirm.
  await sendBtn.click();
  const sent = page.getByText(/Message sent|已傳送郵件|郵件已傳送|已送出郵件|訊息已傳送/).first();
  const ok = await sent.waitFor({ timeout: 60_000 }).then(() => true, () => false);
  if (!ok) throw new Error("Clicked Send but did not see a 'Message sent' confirmation; check the Sent folder.");
  console.log(`Sent: "${subject}" -> ${to}${attach ? " (with PPT)" : ""}`);
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
