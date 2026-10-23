#!/usr/bin/env bash
# One-command start: creates .venv if needed, installs deps, starts the game at http://127.0.0.1:8000
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

echo "GTiA running at http://127.0.0.1:8000"
( sleep 2 && (open http://127.0.0.1:8000 2>/dev/null || xdg-open http://127.0.0.1:8000 2>/dev/null || true) ) &
exec .venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000
