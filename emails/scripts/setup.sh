#!/bin/bash
# One-time (idempotent) setup on the pipeline Mac. See emails/README.md.
set -euo pipefail
SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EMAILS_DIR="$(cd "$SCRIPTS/.." && pwd)"
PIPE="$EMAILS_DIR/pipeline"
PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin"
export PATH

ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
cli()  { (cd "$PIPE" && node --no-warnings=ExperimentalWarning src/cli.mjs "$@"); }

step "1/9 macOS"
[ "$(uname -s)" = "Darwin" ] || die "This pipeline runs on macOS (launchd)."
ok "macOS $(sw_vers -productVersion 2>/dev/null || true)"

step "2/9 Node.js >= 22.13"
if ! command -v node >/dev/null 2>&1; then
  for d in "$HOME"/.nvm/versions/node/*/bin; do [ -x "$d/node" ] && PATH="$d:$PATH"; done
fi
if ! command -v node >/dev/null 2>&1; then
  die "Node.js not found. Install it with Homebrew:
    /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"
    brew install node@22 && brew link --overwrite node@22
  then run ./emails/scripts/setup.sh again."
fi
NODE_V="$(node -p 'process.versions.node')"
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=13)?0:1)' \
  || die "Node $NODE_V is too old (need >= 22.13 for built-in SQLite). Run: brew install node@22 && brew link --overwrite node@22"
ok "node $NODE_V ($(command -v node))"

step "3/9 npm packages (public registry only)"
grep -q '^registry=https://registry.npmjs.org/$' "$PIPE/.npmrc" || die "pipeline/.npmrc must set registry=https://registry.npmjs.org/"
(cd "$PIPE" && npm ci --registry=https://registry.npmjs.org/ --no-audit --no-fund --loglevel=error)
ok "npm ci done"

step "4/9 Claude CLI"
if ! command -v claude >/dev/null 2>&1; then
  die "Claude CLI not found. Install it:
    curl -fsSL https://claude.ai/install.sh | bash
  then run 'claude' once and log in, and run ./emails/scripts/setup.sh again."
fi
ok "claude $(claude --version 2>/dev/null | head -1) ($(command -v claude))"
# Prompt on stdin (--tools takes a list and would swallow a positional prompt). 120 s timeout via perl alarm.
SMOKE="$(cd /tmp && printf 'Reply with just: ok' | perl -e 'alarm shift; exec @ARGV' 120 claude -p --output-format json --tools "" --strict-mcp-config --no-session-persistence --setting-sources= 2>&1 || true)"
if printf '%s' "$SMOKE" | grep -q '"is_error":false'; then
  ok "claude -p works (logged in)"
else
  die "claude -p failed. Run 'claude' in Terminal and log in (/login), then rerun setup. Output:
$(printf '%s' "$SMOKE" | head -c 400)"
fi

step "5/9 Gmail OAuth client"
mkdir -p "$EMAILS_DIR/secrets" "$EMAILS_DIR/state/logs"
chmod 700 "$EMAILS_DIR/secrets" "$EMAILS_DIR/state"
if [ ! -f "$EMAILS_DIR/secrets/client_secret.json" ]; then
  cat <<MSG

  找不到 emails/secrets/client_secret.json。請按 emails/README.md「一、Google Cloud 設定」：
    1. https://console.cloud.google.com/ 建立專案（例如 ip-outreach）
    2. 「API 和服務」>「程式庫」> 啟用 Gmail API
    3. 「OAuth 同意畫面」> 使用者類型選「內部」(Internal)
    4. 「憑證」> 建立憑證 > OAuth 用戶端 ID > 應用程式類型「電腦版應用程式」(Desktop app)
    5. 下載 JSON，存成 $EMAILS_DIR/secrets/client_secret.json
  然後再執行 ./emails/scripts/setup.sh
MSG
  exit 1
fi
chmod 600 "$EMAILS_DIR/secrets/client_secret.json"
ok "client_secret.json found"

step "6/9 Gmail login"
if [ -f "$EMAILS_DIR/secrets/token.json" ] && ME="$(cli whoami 2>/dev/null)"; then
  ok "already logged in as $ME"
else
  echo "  A browser window will open: log in as the sender account (see config.json sender.email) and allow access."
  cli login || die "Gmail login failed (see message above)."
  ok "token saved to emails/secrets/token.json (chmod 600)"
fi
chmod 600 "$EMAILS_DIR/secrets/token.json"

step "7/9 Gmail labels"
cli labels
ok "labels ready"

step "8/9 State DB + import schools"
cli init
ok "DB at emails/state/outreach.db"

step "9/9 Dry-run (3 schools, nothing is sent)"
"$SCRIPTS/run.sh" --dry-run --limit 3 || warn "dry-run reported errors; see emails/state/logs/"
ok "previews in emails/state/outbox/ (open the .html files to check)"

cat <<MSG

設定完成。下一步：
  1. 打開 emails/state/outbox/ 的 .html 預覽，檢查內容。
  2. （建議）在 emails/config.json 設 "testRecipient": "你的電郵"，執行 ./emails/scripts/run.sh 試寄，
     收到後確認無誤，再執行 ./emails/scripts/run.sh --reset-test 並把 testRecipient 改回 ""。
  3. ./emails/scripts/start.sh    啟動排程（逢星期二、五 10:00 寄出；每日 18:00 檢查回覆）
  4. ./emails/scripts/status.sh   查看狀態及 emails/state/report.html
MSG
