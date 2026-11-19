// Claude CLI wrapper: pure text generation, no tools, JSON output.
// Flags verified with `claude --help` (Claude Code 2.1.x):
//   -p --output-format json --tools "" --strict-mcp-config --no-session-persistence
// The prompt goes in on stdin (no argv length limits, no shell). Output is the JSON
// envelope; its `.result` string holds the model text, which must itself be JSON.
import { spawn } from "node:child_process";
import fs from "node:fs";

export function claudeArgs(cfg) {
  const args = ["-p", "--output-format", "json", "--tools", "", "--strict-mcp-config", "--no-session-persistence"];
  if (cfg.claude?.model) args.push("--model", cfg.claude.model);
  return args;
}

/** Pull the first JSON object out of model text (tolerates ``` fences / stray prose). */
export function extractJson(text) {
  let t = String(text ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(t); } catch {}
  const start = t.indexOf("{");
  if (start < 0) throw new Error("no JSON object in Claude output");
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return JSON.parse(t.slice(start, i + 1));
  }
  throw new Error("unterminated JSON object in Claude output");
}

/** Parse the `claude -p --output-format json` envelope and return the parsed inner JSON. */
export function parseEnvelope(stdout) {
  let env;
  try { env = JSON.parse(stdout); } catch { return extractJson(stdout); }
  if (env && typeof env === "object" && "result" in env) {
    if (env.is_error) throw new Error(`claude error: ${String(env.result).slice(0, 200)}`);
    return extractJson(env.result);
  }
  return env;
}

function runOnce(bin, args, prompt, { timeoutMs, cwd }) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd, stdio: ["pipe", "pipe", "pipe"], env: process.env });
    let out = "", err = "", done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      child.kill("SIGKILL");
      reject(new Error(`claude timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => { if (!done) { done = true; clearTimeout(timer); reject(new Error(`cannot run ${bin}: ${e.message}`)); } });
    child.on("close", (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`claude exited ${code}: ${(err || out).trim().slice(0, 300)}`));
      resolve(out);
    });
    child.stdin.on("error", () => {});
    child.stdin.end(prompt);
  });
}

/**
 * Returns ask(prompt, validate) -> parsed JSON. validate(obj) may throw to force a retry.
 * Timeout 120 s (config), one retry (config), then throws.
 */
export function makeClaude(cfg, { log, cwd } = {}) {
  const bin = process.env.IP_CLAUDE_BIN || cfg.claude.bin || "claude";
  const args = claudeArgs(cfg);
  const timeoutMs = (cfg.claude.timeoutSeconds || 120) * 1000;
  const attempts = 1 + (cfg.claude.retries ?? 1);
  if (cwd) fs.mkdirSync(cwd, { recursive: true });
  return async function ask(prompt, validate = (x) => x) {
    let last;
    for (let i = 1; i <= attempts; i++) {
      try {
        const out = await runOnce(bin, args, prompt, { timeoutMs, cwd });
        return validate(parseEnvelope(out));
      } catch (e) {
        last = e;
        log?.warn(`claude attempt ${i}/${attempts} failed: ${e.message}`);
      }
    }
    throw last;
  };
}
