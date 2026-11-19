#!/bin/sh
# Opens a normal Google Chrome window with a local debug port so send.mjs can
# drive it. Log in to Gmail in this window yourself (only needed once).
DIR="$(cd "$(dirname "$0")" && pwd)"
exec "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 \
  --user-data-dir="$DIR/.profile" --no-first-run \
  "https://mail.google.com/"
