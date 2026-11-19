import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeWord, buildMime, formatAddress, toBase64Url, makeMessageId } from "../src/mime.mjs";
import { headerOf, decodeWords, mimeParts, decodeRaw } from "./helpers.mjs";

test("encodeWord: ASCII untouched, UTF-8 RFC 2047 B-words <= 75 chars, round-trips", () => {
  assert.equal(encodeWord("Hello"), "Hello");
  const s = "Re: 【智能運動場】善用 MVPA60 津貼，將運動變成有趣的學習體驗（測試一二三四五六七八九十）";
  const enc = encodeWord(s);
  for (const w of enc.split("\r\n ")) {
    assert.match(w, /^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
    assert.ok(w.length <= 75, `word too long: ${w.length}`);
  }
  assert.equal(decodeWords(enc.replace(/\r\n /g, " ")), s);
});

test("formatAddress", () => {
  assert.equal(formatAddress("Anthony Chan", "a@b.com"), "Anthony Chan <a@b.com>");
  assert.match(formatAddress("陳先生", "a@b.com"), /^=\?UTF-8\?B\?.+\?= <a@b\.com>$/);
});

test("buildMime: multipart/alternative, UTF-8 base64 parts, threading headers", () => {
  const mid = makeMessageId("antapp.ai");
  assert.match(mid, /^<[\w.]+@antapp\.ai>$/);
  const raw = buildMime({ from: { name: "Anthony Chan", email: "anthonychan@antapp.ai" }, to: "x@y.edu.hk", subject: "Re: 【測試】主旨",
    text: "純文字\n", html: "<div><b>粗</b></div>", messageId: mid, inReplyTo: "<a@b>", references: "<0@b> <a@b>", listUnsubscribe: "<mailto:a@b>" });
  assert.ok(!/[^\x00-\x7f]/.test(raw), "raw message must be 7-bit");
  assert.ok(raw.split("\r\n").every((l) => l.length <= 998));
  assert.equal(headerOf(raw, "From"), "Anthony Chan <anthonychan@antapp.ai>");
  assert.equal(decodeWords(headerOf(raw, "Subject")), "Re: 【測試】主旨");
  assert.equal(headerOf(raw, "In-Reply-To"), "<a@b>");
  assert.equal(headerOf(raw, "References"), "<0@b> <a@b>");
  assert.equal(headerOf(raw, "Message-ID"), mid);
  assert.equal(headerOf(raw, "MIME-Version"), "1.0");
  assert.match(headerOf(raw, "Content-Type"), /^multipart\/alternative; boundary="/);
  const parts = mimeParts(raw);
  assert.deepEqual(parts.map((p) => p.type), ["text/plain", "text/html"]);
  assert.equal(parts[0].body, "純文字\n");
  assert.equal(parts[1].body, "<div><b>粗</b></div>");
  assert.ok(raw.includes("charset=UTF-8"));
  assert.equal(decodeRaw(toBase64Url(raw)), raw);
  assert.ok(!toBase64Url(raw).includes("+") && !toBase64Url(raw).includes("/"));
});
