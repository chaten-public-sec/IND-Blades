#!/usr/bin/env bash
set -euo pipefail

python3 -u bot.py &
BOT_PID=$!

node server/server.js &
API_PID=$!

shutdown() {
  kill -TERM "$BOT_PID" "$API_PID" 2>/dev/null || true
  wait "$BOT_PID" "$API_PID" 2>/dev/null || true
}

trap shutdown INT TERM

wait -n "$BOT_PID" "$API_PID"
STATUS=$?

shutdown
exit "$STATUS"
