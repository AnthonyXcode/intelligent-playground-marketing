#!/bin/bash
# Install + load the launchd job com.antapp.ip-outreach.
set -euo pipefail
SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EMAILS_DIR="$(cd "$SCRIPTS/.." && pwd)"
LABEL="com.antapp.ip-outreach"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin"
if ! command -v node >/dev/null 2>&1; then
  for d in "$HOME"/.nvm/versions/node/*/bin; do [ -x "$d/node" ] && PATH="$d:$PATH"; done
fi

[ "$(uname -s)" = "Darwin" ] || { echo "macOS only" >&2; exit 1; }
NODE_BIN="$(command -v node || true)"
CLAUDE_BIN="$(command -v claude || true)"
[ -n "$NODE_BIN" ] || { echo "node not found. Run ./emails/scripts/setup.sh first." >&2; exit 1; }
[ -n "$CLAUDE_BIN" ] || { echo "claude CLI not found. Run ./emails/scripts/setup.sh first." >&2; exit 1; }
[ -d "$EMAILS_DIR/pipeline/node_modules" ] || { echo "Dependencies missing. Run ./emails/scripts/setup.sh first." >&2; exit 1; }
[ -f "$EMAILS_DIR/secrets/token.json" ] || { echo "Not logged in to Gmail. Run ./emails/scripts/setup.sh first." >&2; exit 1; }

# Absolute PATH for launchd (it does not read your shell profile).
LAUNCH_PATH="$(dirname "$NODE_BIN"):$(dirname "$(readlink -f "$CLAUDE_BIN" 2>/dev/null || echo "$CLAUDE_BIN")"):$(dirname "$CLAUDE_BIN"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

mkdir -p "$HOME/Library/LaunchAgents" "$EMAILS_DIR/state/logs"
chmod +x "$SCRIPTS/run.sh"
TMP="$(mktemp)"
(cd "$EMAILS_DIR/pipeline" && node --no-warnings=ExperimentalWarning src/cli.mjs plist --run-sh "$SCRIPTS/run.sh" --path "$LAUNCH_PATH" --out "$TMP")
plutil -lint "$TMP" >/dev/null
mv "$TMP" "$PLIST"
chmod 644 "$PLIST"

launchctl bootout "gui/$UID/$LABEL" 2>/dev/null || true
# bootout finishes asynchronously; bootstrap can fail with "5: Input/output error" right after it.
for i in 1 2 3 4 5; do
  launchctl bootstrap "gui/$UID" "$PLIST" 2>/dev/null && break
  [ "$i" = 5 ] && { launchctl bootstrap "gui/$UID" "$PLIST"; exit 1; }
  sleep 1
done
launchctl enable "gui/$UID/$LABEL"

echo "已啟動排程：$LABEL"
echo "  plist: $PLIST"
echo "  PATH:  $LAUNCH_PATH"
CFG="$EMAILS_DIR/config.json"
node -e 'const c=require(process.argv[1]); if(c.enabled===false) console.log("  注意：config.json enabled=false（kill switch），排程會執行但不會寄出。"); if(c.testRecipient) console.log("  注意：測試模式，所有電郵寄往 "+c.testRecipient);' "$CFG"
echo "  查看狀態：./emails/scripts/status.sh    停止：./emails/scripts/stops.sh"
