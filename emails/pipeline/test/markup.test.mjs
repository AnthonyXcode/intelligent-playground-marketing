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

test("_build/mailer/send.mjs renders with this markup.mjs (no separate copy)", (t) => {
  const f = path.resolve(here, "../../../_build/mailer/send.mjs");
  if (!fs.existsSync(f)) return t.skip("send.mjs not present");
  const src = fs.readFileSync(f, "utf8");
  assert.match(src, /import \{ toHtml \} from "\.\.\/\.\.\/emails\/pipeline\/src\/markup\.mjs"/);
  assert.ok(!src.includes("function toHtml("), "send.mjs must not define its own toHtml");
});

test("toHtml links URLs; a tracking code stays in href only", () => {
  const h = toHtml("了解更多：**https://www.intelligent-playground.com/?r=Ab3dEf7hJk**。");
  assert.ok(h.includes('<b><a href="https://www.intelligent-playground.com/?r=Ab3dEf7hJk" style="color:#0b6b4f">https://www.intelligent-playground.com/</a></b>。'));
});

test("toText strips ** and the image line", () => {
  const t = toText(SAMPLE);
  assert.ok(t.includes("粗體 與 <tag> & 文字"));
  assert.ok(!t.includes("**"));
  assert.ok(!t.includes("![Ant-App]"));
  assert.ok(t.includes("NOTICE: x"));
});
