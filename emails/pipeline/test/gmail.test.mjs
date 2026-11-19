import { test } from "node:test";
import assert from "node:assert/strict";
import { withBackoff, parseMessage, AuthError } from "../src/gmail.mjs";

const noSleep = async () => {};

test("withBackoff retries 429/5xx then succeeds", async () => {
  let n = 0;
  const r = await withBackoff(async () => { if (++n < 3) throw Object.assign(new Error("rate"), { response: { status: n === 1 ? 429 : 503 } }); return n; }, { sleepFn: noSleep });
  assert.equal(r, 3);
});
test("withBackoff gives up after tries and does not retry 400", async () => {
  let n = 0;
  await assert.rejects(withBackoff(async () => { n++; throw Object.assign(new Error("bad"), { response: { status: 400 } }); }, { sleepFn: noSleep }), /bad/);
  assert.equal(n, 1);
  n = 0;
  await assert.rejects(withBackoff(async () => { n++; throw Object.assign(new Error("x"), { response: { status: 500 } }); }, { tries: 3, sleepFn: noSleep }));
  assert.equal(n, 3);
});
test("auth failures become AuthError", async () => {
  await assert.rejects(withBackoff(async () => { throw Object.assign(new Error("invalid_grant"), { response: { status: 400, data: { error: "invalid_grant" } } }); }), (e) => e instanceof AuthError);
});
test("parseMessage extracts headers and text/plain body", () => {
  const m = parseMessage({ id: "1", threadId: "t", labelIds: ["INBOX"], internalDate: "1700000000000", payload: {
    mimeType: "multipart/alternative", headers: [{ name: "From", value: "A <a@b.hk>" }, { name: "Subject", value: "Re: 你好" }, { name: "Message-Id", value: "<x@y>" }],
    parts: [{ mimeType: "text/html", body: { data: Buffer.from("<p>html</p>").toString("base64url") } }, { mimeType: "text/plain", body: { data: Buffer.from("有興趣").toString("base64url") } }] } });
  assert.equal(m.from, "A <a@b.hk>");
  assert.equal(m.messageId, "<x@y>");
  assert.equal(m.text, "有興趣");
  assert.equal(m.date, 1700000000000);
});
