#!/bin/bash
# What launchd calls; can also be run by hand.
#   ./emails/scripts/run.sh                 reply check + send due emails
#   ./emails/scripts/run.sh --dry-run       no Gmail sends / label changes; previews in emails/state/outbox/
#   ./emails/scripts/run.sh --check-only    reply check only
#   ./emails/scripts/run.sh --scheduled     (launchd) send on a send day after the send time, else check-only
#   ./emails/scripts/run.sh --limit N       send at most N emails this run
#   ./emails/scripts/run.sh --retry-errors  put schools in status "error" back in the queue
#   ./emails/scripts/run.sh --reset-test    undo state created by test-mode (testRecipient) sends
#   ./emails/scripts/run.sh --reactivate [--campaign NAME] [--level KG|PRI|SEC|SPE] [--include-replied] [--dry-run]
#                                   new campaign (fresh 10-email budget, new thread) for cap-reached schools
set -euo pipefail
SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EMAILS_DIR="$(cd "$SCRIPTS/.." && pwd)"

# launchd starts with a minimal PATH: add the usual node / claude locations.
PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$HOME/.claude/local:/usr/bin:/bin"
if ! command -v node >/dev/null 2>&1; then
  for d in "$HOME"/.nvm/versions/node/*/bin; do [ -x "$d/node" ] && PATH="$d:$PATH"; done
fi
export PATH

if ! command -v node >/dev/null 2>&1; then
  echo "run.sh: node not found in PATH ($PATH). Run ./emails/scripts/setup.sh" >&2
  exit 1
fi
if [ ! -d "$EMAILS_DIR/pipeline/node_modules" ]; then
  echo "run.sh: pipeline dependencies missing. Run ./emails/scripts/setup.sh" >&2
  exit 1
fi

cd "$EMAILS_DIR/pipeline"
NODE=(node --no-warnings=ExperimentalWarning src/cli.mjs)
case "${1:-}" in
  --retry-errors) exec "${NODE[@]}" retry-errors ;;
  --reset-test) exec "${NODE[@]}" reset-test ;;
  --reactivate) shift; exec "${NODE[@]}" reactivate "$@" ;;
  -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
esac
exec "${NODE[@]}" run "$@"
