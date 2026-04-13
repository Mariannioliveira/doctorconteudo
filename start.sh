#!/usr/bin/env bash
# Opensquad — start backend + frontend dev server
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── Backend ──────────────────────────────────
echo "Starting backend (FastAPI)..."
cd "$ROOT/webapp"
if [ ! -d ".venv" ]; then
  echo "Creating virtualenv..."
  python3 -m venv .venv
  .venv/bin/pip install -q -r requirements.txt
fi
.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# ── Frontend ─────────────────────────────────
echo "Starting frontend (Vite)..."
cd "$ROOT/dashboard"
if [ ! -d "node_modules" ]; then
  echo "Installing npm deps..."
  npm install
fi
npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "✅  Opensquad running:"
echo "    Frontend → http://localhost:5173"
echo "    Backend  → http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop both servers."

# Wait and clean up on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
