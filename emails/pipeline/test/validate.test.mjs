import { test } from "node:test";
import assert from "node:assert/strict";
import { validateEmail } from "../src/validate.mjs";
import { DEFAULTS } from "../src/config.mjs";

const cfg = { ...DEFAULTS, bannedClaims: ["徽章", "社交媒體"] };
const SIG = "**Anthony Chan**\n\n![Ant-App](https://x/y.png)\n\n請回覆「取消訂閱」\nNOTICE: x";
const body = "陳校長：\n\n早前曾來信介紹智能運動場，今次想分享 **運球高手**（Beta）。\n\nBest Regards";
const ok = (o) => validateEmail({ subject: "Re: 主旨", body, full: `${body}\n\n${SIG}`, isFollowup: true, to: "a@b.hk", ...o }, cfg);

test("valid follow-up passes", () => assert.deepEqual(ok({}), []));
test("empty subject", () => assert.ok(ok({ subject: " " }).some((e) => e.includes("empty subject"))));
test("unfilled placeholder", () => assert.ok(ok({ full: "{{school_name}} " + SIG }).some((e) => e.includes("placeholder"))));
test("unbalanced **", () => assert.ok(ok({ full: "a **b\n" + SIG }).some((e) => e.includes("unbalanced"))));
test("banned tech names (case-insensitive, word boundary)", () => {
  for (const t of ["使用 Google 技術", "MediaPipe", "ml kit", "RK3588 晶片", "android 平板", "Flutter", "Strapi"]) {
    const b = body.replace("運球高手", t);
    assert.ok(ok({ body: b, full: b + SIG }).some((e) => e.includes("banned term")), t);
  }
  assert.deepEqual(ok({ subject: "Re: Googlers" }).filter((e) => e.includes("banned")), []);
});
test("unverified claims", () => {
  const b = body.replace("運球高手", "徽章");
  assert.ok(ok({ body: b, full: b + SIG }).some((e) => e.includes("unverified claim")));
});
test("AI body must not contain signature or NOTICE", () => {
  const b = body + "\n\n**Anthony Chan**\nNOTICE: private";
  assert.ok(ok({ body: b, full: b + SIG }).some((e) => e.includes("signature")));
});
test("length and bullet limits", () => {
  const long = "字".repeat(700);
  assert.ok(ok({ body: long, full: long + SIG }).some((e) => e.includes("too long")));
  const bullets = "• a\n• b\n• c\n• d\n• e\n" + body;
  assert.ok(ok({ body: bullets, full: bullets + SIG }).some((e) => e.includes("bullets")));
});
test("missing unsubscribe line and bad recipient", () => {
  assert.ok(ok({ full: body }).some((e) => e.includes("unsubscribe")));
  assert.ok(ok({ to: "not-an-email" }).some((e) => e.includes("recipient")));
});
