#!/usr/bin/env bash
# One-command start: creates .venv if needed, installs deps, starts the game at http://127.0.0.1:8000
# Options: PORT=8080 ./run.sh (other port), NO_BROWSER=1 ./run.sh (don't auto-open), PYTHON=python3.12 ./run.sh
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ] && [ ! -f ../.env ]; then
  echo "No .env found. Run: cp .env.example .env   then paste your PORTKEY_API_KEY into .env"
  exit 1
fi

PY=${PYTHON:-python3}
if [ ! -d .venv ]; then
  "$PY" -m venv .venv
fi
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt

PORT=${PORT:-8000}
URL="http://127.0.0.1:$PORT"
echo "GTiA running at $URL  (Ctrl+C to stop)"
if [ -z "${NO_BROWSER:-}" ]; then
  ( sleep 2 && (open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null || true) ) &
fi
exec .venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port "$PORT"
