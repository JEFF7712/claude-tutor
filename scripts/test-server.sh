#!/usr/bin/env bash
# Integration tests for tutor-server.js

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_SCRIPT="$SCRIPT_DIR/tutor-server.js"
TEST_DIR="$(mktemp -d)"
SERVER_PID=""
PASS=0
FAIL=0

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

result() {
  local num="$1" desc="$2" ok="$3"
  if [[ "$ok" == "true" ]]; then
    echo "Test $num: $desc... PASS"
    PASS=$((PASS + 1))
  else
    echo "Test $num: $desc... FAIL"
    FAIL=$((FAIL + 1))
  fi
}

# ── Test 1: Server starts ────────────────────────────────────────────────────
node "$SERVER_SCRIPT" "$TEST_DIR" 127.0.0.1 0 &
SERVER_PID=$!
sleep 1

if [[ -f "$TEST_DIR/.server-info" ]]; then
  PORT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TEST_DIR/.server-info','utf-8')).port)")
  BASE_URL="http://127.0.0.1:$PORT"
  result 1 "Server starts and writes .server-info" "true"
else
  result 1 "Server starts and writes .server-info" "false"
  echo "FATAL: Cannot continue without server. Exiting."
  exit 1
fi

# ── Test 2: Waiting page ─────────────────────────────────────────────────────
BODY=$(curl -s "$BASE_URL")
if echo "$BODY" | grep -qi "waiting for content"; then
  result 2 "Waiting page shown when no HTML files exist" "true"
else
  result 2 "Waiting page shown when no HTML files exist" "false"
fi

# ── Test 3: Content fragment serving ──────────────────────────────────────────
echo '<h2>Test Diagram</h2>' > "$TEST_DIR/screen1.html"
sleep 1
BODY=$(curl -s "$BASE_URL")
if echo "$BODY" | grep -q "Test Diagram" && echo "$BODY" | grep -qi "mermaid"; then
  result 3 "HTML fragment wrapped in frame template with mermaid" "true"
else
  result 3 "HTML fragment wrapped in frame template with mermaid" "false"
fi

# ── Test 4: Event recording ──────────────────────────────────────────────────
curl -s -X POST "$BASE_URL/events" \
  -H "Content-Type: application/json" \
  -d '{"type":"quiz-answer","choice":"B"}' > /dev/null
sleep 0.5
if [[ -f "$TEST_DIR/.events" ]] && grep -q "quiz-answer" "$TEST_DIR/.events"; then
  result 4 "POST /events records quiz-answer to .events file" "true"
else
  result 4 "POST /events records quiz-answer to .events file" "false"
fi

# ── Test 5: New screen clears events ─────────────────────────────────────────
echo '<h2>Second Screen</h2>' > "$TEST_DIR/screen2.html"
sleep 1
EVENTS_CONTENT=$(cat "$TEST_DIR/.events" 2>/dev/null || echo "")
if [[ -z "$EVENTS_CONTENT" ]]; then
  result 5 "New screen file clears .events" "true"
else
  result 5 "New screen file clears .events" "false"
fi

# ── Test 6: Full HTML document served as-is ───────────────────────────────────
cat > "$TEST_DIR/screen3.html" <<'HTMLEOF'
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Full Doc</title></head>
<body><p>Full document content here</p></body></html>
HTMLEOF
sleep 1
BODY=$(curl -s "$BASE_URL")
if echo "$BODY" | grep -q "Full document content here"; then
  result 6 "Full HTML document served directly" "true"
else
  result 6 "Full HTML document served directly" "false"
fi

# ── Test 7: Graceful shutdown ─────────────────────────────────────────────────
kill "$SERVER_PID"
wait "$SERVER_PID" 2>/dev/null || true
sleep 1
if [[ -f "$TEST_DIR/.server-stopped" ]]; then
  result 7 "Graceful shutdown writes .server-stopped" "true"
else
  result 7 "Graceful shutdown writes .server-stopped" "false"
fi
# Clear PID so cleanup doesn't try to kill again
SERVER_PID=""

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "Results: $PASS passed, $FAIL failed (out of $((PASS + FAIL)))"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
exit 0
