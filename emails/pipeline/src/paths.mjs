// Filesystem layout of emails/. IP_EMAILS_DIR overrides the root (used by tests).
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export function resolvePaths(root = process.env.IP_EMAILS_DIR || path.resolve(here, "../..")) {
  const state = path.join(root, "state");
  const secrets = path.join(root, "secrets");
  return {
    root,
    config: path.join(root, "config.json"),
    content: path.join(root, "content"),
    schoolsCsv: path.join(root, "data", "schools.csv"),
    secrets,
    clientSecret: path.join(secrets, "client_secret.json"),
    token: path.join(secrets, "token.json"),
    state,
    db: path.join(state, "outreach.db"),
    logs: path.join(state, "logs"),
    outbox: path.join(state, "outbox"),
    report: path.join(state, "report.html"),
    lock: path.join(state, "run.lock"),
    claudeWork: path.join(state, "claude-work"),
  };
}
