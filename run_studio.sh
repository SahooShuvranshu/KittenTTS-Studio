#!/usr/bin/env bash
# ==============================================================================
# Kitten-TTS 2 Studio — Launch Script
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

VENV_PATH="$SCRIPT_DIR/.venv"
PORT=8765
HOST="127.0.0.1"

echo "==========================================================="
echo "   KITTEN-TTS 2 STUDIO — HARDWARE AUDIO CONSOLE"
echo "==========================================================="
echo " Directory: $SCRIPT_DIR"
echo " Host:      http://$HOST:$PORT"
echo " Memory:    Optimized for CPU inference (8GB RAM Envelope)"
echo "==========================================================="

if [ ! -d "$VENV_PATH" ]; then
    echo "[!] Virtual environment not found. Please create it first:"
    echo "    uv venv .venv --python 3.12 && uv pip install -e ."
    exit 1
fi

source "$VENV_PATH/bin/activate"

# Optional: Release port if occupied
if command -v fuser >/dev/null 2>&1; then
    fuser -k "$PORT/tcp" 2>/dev/null || true
fi

# Background browser opener
(
    sleep 1.5
    URL="http://$HOST:$PORT"
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$URL" >/dev/null 2>&1 || true
    elif command -v sensible-browser >/dev/null 2>&1; then
        sensible-browser "$URL" >/dev/null 2>&1 || true
    fi
) &

# Run FastAPI Server
exec uvicorn backend.app:app --host "$HOST" --port "$PORT" --log-level info
