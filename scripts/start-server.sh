#!/usr/bin/env bash
set -euo pipefail

# start-server.sh — Platform-aware launcher for the tutor companion server.
# Starts tutor-server.js, either foregrounded or backgrounded, and outputs
# the server-info JSON on success.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_JS="$SCRIPT_DIR/tutor-server.js"

# Defaults
PROJECT_DIR=""
HOST="127.0.0.1"
URL_HOST=""
FOREGROUND=false

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-dir)
      PROJECT_DIR="$2"
      shift 2
      ;;
    --host)
      HOST="$2"
      shift 2
      ;;
    --url-host)
      URL_HOST="$2"
      shift 2
      ;;
    --foreground)
      FOREGROUND=true
      shift
      ;;
    *)
      echo '{"type":"error","message":"Unknown argument: '"$1"'"}' >&2
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# 1. Check Node.js is available
# ---------------------------------------------------------------------------
if ! command -v node &>/dev/null; then
  echo '{"type":"error","message":"Node.js is not installed or not in PATH"}' >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 2. Create session directory
# ---------------------------------------------------------------------------
TIMESTAMP="$(date +%s)"

if [[ -n "$PROJECT_DIR" ]]; then
  SESSION_DIR="$PROJECT_DIR/.tutor/sessions/$TIMESTAMP"
else
  SESSION_DIR="/tmp/tutor-session-$TIMESTAMP"
fi

mkdir -p "$SESSION_DIR"

# ---------------------------------------------------------------------------
# 3. Try up to 3 random ports in 50000-59999
# ---------------------------------------------------------------------------
if [[ "${CODEX_CI:-}" == "true" || "$FOREGROUND" == true ]]; then
  RUN_FOREGROUND=true
else
  RUN_FOREGROUND=false
fi

MAX_ATTEMPTS=3

for attempt in $(seq 1 $MAX_ATTEMPTS); do
  PORT=$(( (RANDOM % 10000) + 50000 ))

  if [[ "$RUN_FOREGROUND" == true ]]; then
    # 4. Foreground mode — exec replaces the shell process
    exec node "$SERVER_JS" "$SESSION_DIR" "$HOST" "$PORT"
  fi

  # 5. Background mode
  node "$SERVER_JS" "$SESSION_DIR" "$HOST" "$PORT" &
  SERVER_PID=$!

  # Wait briefly for the server to start
  sleep 0.5

  # Check if process is still alive
  if kill -0 "$SERVER_PID" 2>/dev/null; then
    SERVER_INFO="$SESSION_DIR/.server-info"
    if [[ -f "$SERVER_INFO" ]]; then
      cat "$SERVER_INFO"
      exit 0
    fi
  fi

  # Server didn't start — kill if still running and try again
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
done

# 6. All attempts failed
echo '{"type":"error","message":"Failed to start server after '"$MAX_ATTEMPTS"' attempts"}' >&2
exit 1
