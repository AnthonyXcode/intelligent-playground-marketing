import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { toHtml, toText, htmlDocument } from "../src/markup.mjs";
import { here } from "./helpers.mjs";

const SAMPLE = "{{x}}：\n\n**粗體** 與 <tag> & 文字\n• 項目 **重點**\n\nBest Regards\n\n**Anthony Chan**\n\n![Ant-App](https://www.antapp.ai/img/ant_app_icon.png)\n\n取消訂閱說明\nNOTICE: x";

test("toHtml: bold, escaping, image line, small grey after image", () => {
  const h = toHtml(SAMPLE);
  assert.match(h, /^<div style="font-family:Arial,'Microsoft JhengHei',sans-serif;font-size:14px;line-height:1.6;color:#222222">/);
  assert.ok(h.includes("<b>粗體</b> 與 &lt;tag&gt; &amp; 文字"));
  assert.ok(h.includes("• 項目 <b>重點</b>"));
  assert.ok(h.includes('<img src="https://www.antapp.ai/img/ant_app_icon.png" alt="Ant-App" width="64" height="64" style="display:block;margin:12px 0">'));
  assert.ok(h.includes('<span style="font-size:11px;color:#777777">取消訂閱說明</span>'));
  assert.ok(h.includes("<b>Anthony Chan</b><br>"), "before image: not small");
  assert.ok(!h.includes('<span style="font-size:11px;color:#777777"></span>'), "empty lines stay empty");
  assert.ok(htmlDocument(SAMPLE).startsWith("<!DOCTYPE html>"));
});

test("toHtml is identical to _build/mailer/send.mjs toHtml", (t) => {
  const f = path.resolve(here, "../../../_build/mailer/send.mjs");
  if (!fs.existsSync(f)) return t.skip("send.mjs not present");
  const src = fs.readFileSync(f, "utf8");
  const body = src.slice(src.indexOf("function toHtml(md)"));
  const fnSrc = body.slice(0, body.indexOf("\n}\n") + 2);
  const ref = new Function(`${fnSrc}; return toHtml;`)();
  for (const s of [SAMPLE, fs.readFileSync(path.resolve(here, "fixtures/emails/content/signature.md"), "utf8")]) assert.equal(toHtml(s), ref(s));
});

test("toText strips ** and the image line", () => {
  const t = toText(SAMPLE);
  assert.ok(t.includes("粗體 與 <tag> & 文字"));
  assert.ok(!t.includes("**"));
  assert.ok(!t.includes("![Ant-App]"));
  assert.ok(t.includes("NOTICE: x"));
});
