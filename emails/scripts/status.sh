#!/bin/bash
# Print status summary and regenerate emails/state/report.html.
set -euo pipefail
SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EMAILS_DIR="$(cd "$SCRIPTS/.." && pwd)"
LABEL="com.antapp.ip-outreach"
PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin"
if ! command -v node >/dev/null 2>&1; then
  for d in "$HOME"/.nvm/versions/node/*/bin; do [ -x "$d/node" ] && PATH="$d:$PATH"; done
fi
(cd "$EMAILS_DIR/pipeline" && node --no-warnings=ExperimentalWarning src/cli.mjs status)
echo
if launchctl print "gui/$UID/$LABEL" >/dev/null 2>&1; then
  echo "launchd 排程：已載入（$LABEL）"
  launchctl print "gui/$UID/$LABEL" 2>/dev/null | grep -E '^[[:space:]]*(state|last exit code|runs) ' | sed 's/^[[:space:]]*/  /' || true
else
  echo "launchd 排程：未載入（執行 ./emails/scripts/start.sh 啟動）"
fi
if [ -f "$EMAILS_DIR/state/run.lock" ]; then echo "目前有一次 run 正在執行：$(cat "$EMAILS_DIR/state/run.lock")"; fi
echo "日誌：$EMAILS_DIR/state/logs/"
