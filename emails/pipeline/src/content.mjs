// Loads emails/content/* (written by the content team) and fills templates.
import fs from "node:fs";
import path from "node:path";
import { LEVELS } from "./db.mjs";

const read = (f) => {
  if (!fs.existsSync(f)) throw new Error(`Missing content file: ${f}`);
  return fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
};

/**
 * Load content. `campaign` (config.campaigns[name]) may override templatesDir and/or topics
 * (paths relative to emails/content/), e.g. { "templatesDir": "campaigns/2027-discount/templates" }.
 */
export function loadContent(dir, campaign = {}) {
  const templates = {};
  const tdir = path.resolve(dir, campaign.templatesDir || "templates");
  for (const lv of LEVELS) templates[lv] = read(path.join(tdir, `first-${lv}.md`));
  const topics = JSON.parse(read(path.resolve(dir, campaign.topics || "topics.json")));
  if (!Array.isArray(topics)) throw new Error("topics.json must be a JSON array");
  const signature = read(path.join(dir, "signature.md")).trim();
  for (const must of ["取消訂閱", "NOTICE", "![Ant-App]("]) {
    if (!signature.includes(must)) throw new Error(`signature.md is missing required part: ${must}`);
  }
  return {
    facts: read(path.join(dir, "facts.md")).trim(),
    signature,
    templates,
    topics,
    followupPrompt: read(path.join(dir, "prompts", "followup.md")),
    classifyPrompt: read(path.join(dir, "prompts", "classify.md")),
  };
}

export function fill(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
}

/** Template: line 1 「主旨：…」, blank line, body. */
export function parseTemplate(text) {
  const [first, ...rest] = text.replace(/\r\n/g, "\n").split("\n");
  if (!/^主旨[:：]/.test(first)) throw new Error("Template line 1 must start with 主旨：");
  return { subject: first.replace(/^主旨[:：]\s*/, "").trim(), body: rest.join("\n").trim() };
}

const COMPOUND = ["歐陽", "司徒", "上官", "諸葛", "司馬", "夏侯", "端木", "公孫", "皇甫", "尉遲", "長孫", "慕容", "鍾離", "令狐", "宇文", "東方", "西門", "南宮", "范姜", "張簡"];

/** 陳大文 -> 陳校長; empty/non-Chinese -> 校長. */
export function recipientName(principal) {
  let p = String(principal || "").trim().replace(/\s+/g, "");
  p = p.replace(/^(校長|Principal)/i, "").replace(/(校長|博士|修女|神父|女士|先生|太太|小姐|牧師|老師)+$/u, "");
  if (!/^\p{Script=Han}{1,4}$/u.test(p)) return "校長";
  const surname = COMPOUND.find((c) => p.startsWith(c) && p.length > 2) || p[0];
  return `${surname}校長`;
}

export const schoolName = (s) => s.name_zh || s.name_en || s.id;

export function topicApplies(t, level) {
  return !t.levels || t.levels.length === 0 || t.levels.includes(level) || t.levels.includes("ALL");
}

export const isFinalTopic = (t) => t.final === true || /^(final|last)([-_]|$)/i.test(t.id || "");

/**
 * Next topic for a follow-up: next unused topic in file order for that level; a "final"
 * topic (final:true or id starting with final-/last-) is held back for the last email.
 * Returns { topic, isLast } or null when none are left.
 */
export function nextTopic(topics, level, used, n, maxEmails) {
  const usable = topics.filter((t) => topicApplies(t, level) && !used.includes(t.id));
  const finals = usable.filter(isFinalTopic);
  const regular = usable.filter((t) => !isFinalTopic(t));
  if (n >= maxEmails) {
    const t = finals[0] || regular[0];
    return t ? { topic: t, isLast: true } : null;
  }
  if (regular.length) return { topic: regular[0], isLast: false };
  if (finals.length) return { topic: finals[0], isLast: true };
  return null;
}
