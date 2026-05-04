#!/usr/bin/env bash
set -e

echo "=== VoiceAgent Startup ==="

command -v python3 >/dev/null 2>&1 || { echo "[ERROR] python3 not found"; exit 1; }
command -v node    >/dev/null 2>&1 || { echo "[ERROR] node not found";     exit 1; }
command -v ffmpeg  >/dev/null 2>&1 || echo "[WARN] ffmpeg not found. Install with: brew install ffmpeg  or  sudo apt install ffmpeg"

echo "[1/3] Installing Python dependencies..."
cd backend
pip install -r requirements.txt -q

echo "[2/3] Starting backend on http://localhost:8000 ..."
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

cd ../frontend

echo "[3/3] Installing Node dependencies..."
[ -d node_modules ] || npm install

echo "Starting frontend on http://localhost:3000 ..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=== VoiceAgent running ==="
echo "  UI:   http://localhost:3000"
echo "  API:  http://localhost:8000"
echo "  Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" INT TERM
wait
