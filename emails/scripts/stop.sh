#!/bin/bash
# Unload + remove the launchd job.
set -uo pipefail
LABEL="com.antapp.ip-outreach"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
if launchctl print "gui/$UID/$LABEL" >/dev/null 2>&1; then
  launchctl bootout "gui/$UID/$LABEL" && echo "已停止排程 $LABEL"
else
  echo "排程 $LABEL 未載入"
fi
if [ -f "$PLIST" ]; then rm -f "$PLIST" && echo "已刪除 $PLIST"; fi
echo "（正在執行中的一次 run 會完成後才結束；如要立即停止寄出，把 emails/config.json 的 enabled 設為 false。）"
