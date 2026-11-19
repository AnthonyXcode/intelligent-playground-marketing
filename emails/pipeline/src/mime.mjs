// RFC 5322 / 2045 / 2047 message building for the Gmail API (users.messages.send raw).
import crypto from "node:crypto";

const isAscii = (s) => /^[\x20-\x7e]*$/.test(s);

/** RFC 2047 B-encoding, split on code points so each encoded-word stays <= 75 chars. */
export function encodeWord(s) {
  s = String(s);
  if (isAscii(s)) return s;
  const words = [];
  let chunk = "";
  for (const ch of s) {
    if (Buffer.byteLength(chunk + ch, "utf8") > 45) { words.push(chunk); chunk = ""; }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${Buffer.from(w, "utf8").toString("base64")}?=`).join("\r\n ");
}

export function formatAddress(name, email) {
  if (!name) return `<${email}>`;
  if (isAscii(name)) return /^[A-Za-z0-9 !#$%&'*+\-/=?^_`{|}~.]*$/.test(name) ? `${name} <${email}>` : `"${name.replace(/(["\\])/g, "\\$1")}" <${email}>`;
  return `${encodeWord(name)} <${email}>`;
}

const wrap76 = (b64) => b64.replace(/.{1,76}/g, "$&\r\n");

export function makeMessageId(domain) {
  return `<${Date.now().toString(36)}.${crypto.randomBytes(8).toString("hex")}@${domain}>`;
}

export function buildMime({ from, to, subject, text, html, messageId, inReplyTo, references, date = new Date(), listUnsubscribe }) {
  const boundary = "=_ip_" + crypto.randomBytes(12).toString("hex");
  const h = [
    `From: ${formatAddress(from.name, from.email)}`,
    `To: ${to}`,
    `Subject: ${encodeWord(subject)}`,
    `Date: ${date.toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: ${messageId}`,
  ];
  if (inReplyTo) h.push(`In-Reply-To: ${inReplyTo}`);
  if (references) h.push(`References: ${references}`);
  if (listUnsubscribe) h.push(`List-Unsubscribe: ${listUnsubscribe}`);
  h.push("MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary="${boundary}"`);
  const part = (type, body) => [
    `--${boundary}`,
    `Content-Type: ${type}; charset=UTF-8`,
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(Buffer.from(body, "utf8").toString("base64")),
  ].join("\r\n");
  return h.join("\r\n") + "\r\n\r\n" + part("text/plain", text) + part("text/html", html) + `--${boundary}--\r\n`;
}

export const toBase64Url = (s) => Buffer.from(s, "utf8").toString("base64url");
