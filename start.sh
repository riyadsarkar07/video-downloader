#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if ! command -v yt-dlp >/dev/null 2>&1; then
  echo "yt-dlp is required. Install it before starting."
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required. Install it before starting."
  exit 1
fi

if [ ! -d backend/node_modules ]; then
  npm install --prefix backend
fi

if [ ! -d node_modules ]; then
  npm install
fi

# Start backend API
npm --prefix backend start &
BACKEND_PID=$!

cleanup() {
  if [ -n "${BACKEND_PID:-}" ]; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

# Wait until the API is reachable
for _ in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:3001/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.4
done

export BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:3001}"

if [ "${NODE_ENV:-}" = "production" ]; then
  npm run start
else
  npm run dev
fi
