import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { recipientName, parseTemplate, fill, nextTopic, loadContent } from "../src/content.mjs";
import { factsForLevel, factIdsForLevel } from "../src/sender.mjs";
import { validateEmail } from "../src/validate.mjs";
import { loadConfig } from "../src/config.mjs";
import { here, FIXTURE } from "./helpers.mjs";

test("recipientName", () => {
  assert.equal(recipientName("陳大文"), "陳校長");
  assert.equal(recipientName("歐陽小明"), "歐陽校長");
  assert.equal(recipientName("李校長"), "李校長");
  assert.equal(recipientName("李大文博士"), "李校長");
  assert.equal(recipientName(""), "校長");
  assert.equal(recipientName("Mr Chan Tai Man"), "校長");
});

test("parseTemplate + fill", () => {
  const t = parseTemplate(fill("主旨：你好 {{school_name}}\n\n{{recipient_name}}：\n內容", { school_name: "甲校", recipient_name: "陳校長" }));
  assert.deepEqual(t, { subject: "你好 甲校", body: "陳校長：\n內容" });
  assert.throws(() => parseTemplate("no subject"));
});

const topics = [
  { id: "a", levels: ["PRI"] }, { id: "final-close", levels: ["PRI", "KG"], final: true }, { id: "b", levels: ["KG", "PRI"] },
  { id: "c", levels: ["PRI"] }, { id: "d", levels: ["PRI"] },
];
test("nextTopic: file order, level filter, final topic held for the last email", () => {
  assert.equal(nextTopic(topics, "PRI", [], 2, 10).topic.id, "a");
  assert.equal(nextTopic(topics, "PRI", ["a"], 3, 10).topic.id, "b");
  assert.equal(nextTopic(topics, "KG", [], 2, 10).topic.id, "b");
  const last = nextTopic(topics, "PRI", ["a"], 10, 10);
  assert.equal(last.topic.id, "final-close");
  assert.equal(last.isLast, true);
  // regular topics exhausted early -> final now
  const early = nextTopic(topics, "KG", ["b"], 3, 10);
  assert.equal(early.topic.id, "final-close");
  assert.equal(early.isLast, true);
  assert.equal(nextTopic(topics, "KG", ["b", "final-close"], 4, 10), null);
});

test("facts filtered by level", () => {
  const facts = fs.readFileSync(path.join(FIXTURE, "content/facts.md"), "utf8");
  const kg = factsForLevel(facts, "KG");
  assert.ok(kg.includes("F-KGONLY") && kg.includes("F-PRODUCT") && !kg.includes("F-DRIBBLE") && kg.includes("只可使用本表事實"));
  assert.ok(!factsForLevel(facts, "PRI").includes("F-KGONLY"));
  assert.deepEqual([...factIdsForLevel(facts, "SEC")].sort(), ["F-DRIBBLE", "F-MVPA60", "F-PRODUCT"]);
});

// The real content team files (emails/content) must load and every first email must validate.
const REAL = path.resolve(here, "../../content");
test("real content files load and first templates validate for every level", (t) => {
  if (!fs.existsSync(path.join(REAL, "topics.json"))) return t.skip("emails/content not present");
  const content = loadContent(REAL);
  const cfg = loadConfig(path.resolve(here, "../../config.json"));
  for (const lv of ["KG", "PRI", "SEC", "SPE"]) {
    const { subject, body } = parseTemplate(fill(content.templates[lv], { recipient_name: "陳校長", school_name: "測試學校" }));
    const errs = validateEmail({ subject, body, full: `${body}\n\n${content.signature}`, isFollowup: false, to: "a@b.hk" }, cfg);
    assert.deepEqual(errs, [], `first-${lv}: ${errs.join("; ")}`);
    const usable = content.topics.filter((x) => x.levels.includes(lv));
    assert.ok(usable.length >= 10, `${lv} has ${usable.length} topics`);
    // follow-up #9 (email 10) is the final topic
    const used = [];
    for (let n = 2; n <= 10; n++) { const p = nextTopic(content.topics, lv, used, n, 10); used.push(p.topic.id); }
    assert.ok(content.topics.find((x) => x.id === used.at(-1)).final, `${lv}: last topic is final`);
    assert.ok(used.slice(0, -1).every((id) => !content.topics.find((x) => x.id === id).final));
  }
});
