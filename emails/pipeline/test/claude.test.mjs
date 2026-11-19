import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { extractJson, parseEnvelope, makeClaude, claudeArgs } from "../src/claude.mjs";
import { validateClassification } from "../src/replies.mjs";
import { DEFAULTS } from "../src/config.mjs";

test("extractJson handles fences and prose", () => {
  assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
  assert.deepEqual(extractJson('```json\n{"a":"}"}\n```'), { a: "}" });
  assert.deepEqual(extractJson('Here you go: {"a":{"b":2}} thanks'), { a: { b: 2 } });
  assert.throws(() => extractJson("nothing"));
});

test("parseEnvelope reads .result of claude --output-format json", () => {
  const env = JSON.stringify({ type: "result", subtype: "success", is_error: false, result: '```json\n{"category":"interested","summary":"想預約示範","stop":true}\n```' });
  assert.deepEqual(parseEnvelope(env), { category: "interested", summary: "想預約示範", stop: true });
  assert.throws(() => parseEnvelope(JSON.stringify({ is_error: true, result: "Not logged in" })), /claude error/);
});

test("validateClassification", () => {
  assert.deepEqual(validateClassification({ category: "auto_reply", summary: "休假", stop: true }), { category: "auto_reply", summary: "休假", stop: false });
  assert.equal(validateClassification({ category: "bounce", summary: "", stop: false }).stop, true);
  assert.throws(() => validateClassification({ category: "maybe" }));
  assert.throws(() => validateClassification(null));
});

test("claude args: print mode, JSON output, no tools", () => {
  const a = claudeArgs(DEFAULTS);
  assert.deepEqual(a.slice(0, 5), ["-p", "--output-format", "json", "--tools", ""]);
  assert.ok(a.includes("--no-session-persistence") && a.includes("--strict-mcp-config"));
  assert.ok(a.includes("--setting-sources="), "no user/project settings, hooks or CLAUDE.md");
});

function fakeBin(script) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fake-claude-"));
  const f = path.join(dir, "claude");
  fs.writeFileSync(f, `#!/bin/sh\n${script}\n`, { mode: 0o755 });
  return { f, dir };
}

test("makeClaude: prompt on stdin, retry once on bad output then succeed", async () => {
  const { f, dir } = fakeBin(`cat > /dev/null; c=$(cat "${"$"}(dirname "$0")/count" 2>/dev/null || echo 0); c=$((c+1)); echo $c > "$(dirname "$0")/count"
if [ "$c" = "1" ]; then echo 'garbage'; else echo '{"type":"result","is_error":false,"result":"{\\"subject\\":\\"s\\",\\"body\\":\\"b\\"}"}'; fi`);
  const ask = makeClaude({ ...DEFAULTS, claude: { ...DEFAULTS.claude, bin: f } }, { cwd: dir });
  assert.deepEqual(await ask("hi"), { subject: "s", body: "b" });
  assert.equal(fs.readFileSync(path.join(dir, "count"), "utf8").trim(), "2");
});

test("makeClaude: timeout, retried once, then throws", async () => {
  const { f, dir } = fakeBin(`echo x >> "$(dirname "$0")/calls"; sleep 5`);
  const ask = makeClaude({ ...DEFAULTS, claude: { ...DEFAULTS.claude, bin: f, timeoutSeconds: 1.5 } }, { cwd: dir });
  await assert.rejects(ask("hi"), /timed out/);
  assert.equal(fs.readFileSync(path.join(dir, "calls"), "utf8").trim().split("\n").length, 2);
});
