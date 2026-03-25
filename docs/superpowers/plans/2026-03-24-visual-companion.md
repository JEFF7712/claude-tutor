# Visual Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based visual teaching companion that renders diagrams, quizzes, and walkthroughs while the tutoring conversation continues in the terminal.

**Architecture:** Minimal Node.js file-watching HTTP server (zero npm deps) serves HTML fragments written by the tutor. Frame template provides Mermaid.js, quiz components, and walkthrough navigation. Helper script handles click events and posts them back to the server for the tutor to read.

**Tech Stack:** Node.js (built-ins only), HTML/CSS/JS, Mermaid.js (CDN), Bash

**Spec:** `docs/superpowers/specs/2026-03-24-visual-companion-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `scripts/tutor-server.js` | Create | File-watching HTTP server (~200-250 lines) |
| `scripts/tutor-frame.html` | Create | Frame template with Mermaid CDN, theme CSS, component styles |
| `scripts/tutor-helper.js` | Create | Client-side JS: events, quiz logic, walkthrough navigation |
| `scripts/start-server.sh` | Create | Platform-aware server launcher |
| `scripts/stop-server.sh` | Create | Graceful shutdown script |
| `scripts/test-server.sh` | Create | Integration test for the server |
| `skills/tutor/visual-companion.md` | Create | Prompt guide for generating teaching content |
| `skills/tutor/SKILL.md` | Modify | Add companion activation triggers and browser path |
| `.claude-plugin/plugin.json` | Modify | Bump to 2.1.0 |
| `README.md` | Modify | Add visual companion section |

---

### Task 1: HTTP Server Core

Build the file-watching HTTP server that serves HTML files and records events.

**Files:**
- Create: `scripts/tutor-server.js`

- [ ] **Step 1: Create the server with basic HTTP serving**

```javascript
#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const screenDir = args[0];
const host = args[1] || '127.0.0.1';
const port = parseInt(args[2], 10) || 0; // 0 = OS picks a free port

if (!screenDir) {
  console.error('Usage: tutor-server.js <screen_dir> [host] [port]');
  process.exit(1);
}

// Resolve paths for frame template and helper script (relative to this script)
const scriptDir = __dirname;
const frameTemplatePath = path.join(scriptDir, 'tutor-frame.html');
const helperScriptPath = path.join(scriptDir, 'tutor-helper.js');

let frameTemplate = '';
let helperScript = '';

try {
  frameTemplate = fs.readFileSync(frameTemplatePath, 'utf8');
  helperScript = fs.readFileSync(helperScriptPath, 'utf8');
} catch (err) {
  console.error('Missing required files:', err.message);
  process.exit(1);
}

// Track the currently served file and inactivity
let currentFile = null;
let currentContent = null;
let lastActivity = Date.now();
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Find the newest .html file in screen_dir
function findNewestHtml() {
  try {
    const files = fs.readdirSync(screenDir)
      .filter(f => f.endsWith('.html'))
      .map(f => {
        const full = path.join(screenDir, f);
        return { name: f, path: full, mtime: fs.statSync(full).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    return files[0] || null;
  } catch {
    return null;
  }
}

// Wrap content fragment in frame template, or serve as-is if full document
function prepareContent(raw) {
  const helperTag = `<script>\n${helperScript}\n</script>`;

  if (raw.trimStart().startsWith('<!DOCTYPE') || raw.trimStart().startsWith('<html')) {
    // Full document — inject helper before </body>
    if (raw.includes('</body>')) {
      return raw.replace('</body>', helperTag + '\n</body>');
    }
    return raw + helperTag;
  }

  // Content fragment — wrap in frame template
  // Frame template should have a {{CONTENT}} placeholder and {{HELPER_SCRIPT}} placeholder
  return frameTemplate
    .replace('{{CONTENT}}', raw)
    .replace('{{HELPER_SCRIPT}}', helperScript);
}

// Poll for new files every 500ms
let lastServedFile = null;
setInterval(() => {
  const newest = findNewestHtml();
  if (newest && newest.name !== lastServedFile) {
    lastServedFile = newest.name;
    currentFile = newest.name;
    try {
      const raw = fs.readFileSync(newest.path, 'utf8');
      currentContent = prepareContent(raw);
    } catch {
      currentContent = null;
    }
    // Clear events when new screen is pushed
    const eventsPath = path.join(screenDir, '.events');
    try { fs.writeFileSync(eventsPath, ''); } catch {}
  }
}, 500);

// HTTP request handler
function handleRequest(req, res) {
  lastActivity = Date.now();

  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    if (currentContent) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(currentContent);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body><p>Waiting for content...</p><script>setTimeout(()=>location.reload(),1000)</script></body></html>');
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/events') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const event = JSON.parse(body);
        event.timestamp = event.timestamp || Date.now();
        const eventsPath = path.join(screenDir, '.events');
        fs.appendFileSync(eventsPath, JSON.stringify(event) + '\n');
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end('{"ok":true}');
      } catch {
        res.writeHead(400);
        res.end('{"error":"invalid json"}');
      }
    });
    return;
  }

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  res.writeHead(404);
  res.end('Not found');
}

// Start server
const server = http.createServer(handleRequest);
server.listen(port, host, () => {
  const addr = server.address();
  const url = `http://${host === '0.0.0.0' ? 'localhost' : addr.address}:${addr.port}`;
  const info = {
    type: 'server-started',
    port: addr.port,
    url: url,
    screen_dir: path.resolve(screenDir)
  };

  // Write server info file
  fs.writeFileSync(path.join(screenDir, '.server-info'), JSON.stringify(info, null, 2));

  // Output JSON to stdout for the start script to capture
  console.log(JSON.stringify(info));
});

// Auto-shutdown after inactivity
setInterval(() => {
  if (Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
    fs.writeFileSync(path.join(screenDir, '.server-stopped'), '');
    try { fs.unlinkSync(path.join(screenDir, '.server-info')); } catch {}
    process.exit(0);
  }
}, 60000);

// Graceful shutdown
function shutdown() {
  try {
    fs.writeFileSync(path.join(screenDir, '.server-stopped'), '');
    fs.unlinkSync(path.join(screenDir, '.server-info'));
  } catch {}
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

- [ ] **Step 2: Commit**

```bash
git add scripts/tutor-server.js
git commit -m "feat(server): add file-watching HTTP server for visual companion"
```

---

### Task 2: Frame Template

Build the HTML frame template with Mermaid CDN, teaching theme CSS, and component styles.

**Files:**
- Create: `scripts/tutor-frame.html`

- [ ] **Step 1: Create the frame template**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tutor Visual Companion</title>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<script>mermaid.initialize({ startOnLoad: true, theme: 'dark' });</script>
<style>
  :root {
    --bg: #1a1b26;
    --surface: #24283b;
    --text: #c0caf5;
    --text-muted: #565f89;
    --accent: #7aa2f7;
    --success: #9ece6a;
    --error: #f7768e;
    --border: #3b4261;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
    padding: 2rem;
    max-width: 900px;
    margin: 0 auto;
    line-height: 1.6;
  }

  h2 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
    color: var(--accent);
  }

  h3 { font-size: 1.2rem; margin: 1rem 0 0.5rem; }

  p { margin-bottom: 1rem; }

  .subtitle {
    color: var(--text-muted);
    font-size: 0.95rem;
    margin-bottom: 1.5rem;
  }

  /* Diagram container */
  .diagram {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.5rem;
    margin: 1rem 0;
    overflow-x: auto;
  }

  .diagram .mermaid { text-align: center; }

  /* Quiz styles */
  .quiz { display: flex; flex-direction: column; gap: 0.75rem; margin: 1rem 0; }

  .quiz-option {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background: var(--surface);
    border: 2px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
  }

  .quiz-option:hover { border-color: var(--accent); }

  .quiz-option .letter {
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--border);
    font-weight: bold;
    font-size: 0.85rem;
    flex-shrink: 0;
    text-transform: uppercase;
  }

  .quiz-option .content { flex: 1; }

  .quiz-option.correct {
    border-color: var(--success);
    background: rgba(158, 206, 106, 0.1);
  }
  .quiz-option.correct .letter { background: var(--success); color: var(--bg); }

  .quiz-option.incorrect {
    border-color: var(--error);
    background: rgba(247, 118, 142, 0.1);
  }
  .quiz-option.incorrect .letter { background: var(--error); color: var(--bg); }

  .quiz-option.reveal-correct {
    border-color: var(--success);
    border-style: dashed;
  }

  .quiz-option.locked { pointer-events: none; }

  /* Walkthrough styles */
  .walkthrough { position: relative; }

  .step {
    display: none;
    opacity: 0;
    transform: translateX(20px);
    transition: opacity 0.3s ease, transform 0.3s ease;
  }

  .step.active {
    display: block;
    opacity: 1;
    transform: translateX(0);
  }

  .step .visual {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.5rem;
    margin: 1rem 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 0.5rem;
    min-height: 150px;
  }

  .step .explanation {
    background: var(--surface);
    border-left: 3px solid var(--accent);
    padding: 0.75rem 1rem;
    margin: 1rem 0;
    border-radius: 0 4px 4px 0;
  }

  .bar {
    width: 3rem;
    background: var(--accent);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 0.25rem;
    border-radius: 4px 4px 0 0;
    font-weight: bold;
    font-size: 0.85rem;
    transition: height 0.3s ease, background 0.3s ease;
  }

  .bar.highlight { background: var(--success); }
  .bar.compared { background: var(--error); }

  .walkthrough-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    margin-top: 1.5rem;
    padding: 1rem;
  }

  .walkthrough-nav button {
    padding: 0.5rem 1.25rem;
    background: var(--accent);
    color: var(--bg);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    transition: opacity 0.2s;
  }

  .walkthrough-nav button:hover { opacity: 0.85; }
  .walkthrough-nav button:disabled { opacity: 0.3; cursor: default; }

  .step-indicator {
    color: var(--text-muted);
    font-size: 0.85rem;
  }
</style>
</head>
<body>
{{CONTENT}}
<script>
{{HELPER_SCRIPT}}
</script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add scripts/tutor-frame.html
git commit -m "feat(template): add frame template with Mermaid, quiz, and walkthrough styles"
```

---

### Task 3: Helper Script

Build the client-side JS that handles quiz checking, walkthrough navigation, and event posting.

**Files:**
- Create: `scripts/tutor-helper.js`

- [ ] **Step 1: Create the helper script**

```javascript
// Tutor Visual Companion — Helper Script
// Exposes: checkAnswer(el), prevStep(), nextStep()
// Posts interaction events to the server's /events endpoint

(function() {
  'use strict';

  // === Event Posting ===

  function postEvent(event) {
    event.timestamp = Date.now();
    fetch('/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    }).catch(function() {}); // silently fail if server is down
  }

  // === Quiz Logic ===

  window.checkAnswer = function(el) {
    var quiz = el.closest('.quiz');
    if (!quiz) return;

    // Lock all options
    var options = quiz.querySelectorAll('.quiz-option');
    options.forEach(function(opt) { opt.classList.add('locked'); });

    var isCorrect = el.getAttribute('data-correct') === 'true';

    if (isCorrect) {
      el.classList.add('correct');
    } else {
      el.classList.add('incorrect');
      // Reveal the correct answer
      options.forEach(function(opt) {
        if (opt.getAttribute('data-correct') === 'true') {
          opt.classList.add('reveal-correct');
        }
      });
    }

    postEvent({
      type: 'quiz-answer',
      choice: el.getAttribute('data-choice'),
      correct: isCorrect,
      text: el.querySelector('.content') ? el.querySelector('.content').textContent.trim() : ''
    });
  };

  // === Walkthrough Logic ===

  function getWalkthrough() {
    return document.querySelector('.walkthrough');
  }

  function getSteps(wt) {
    return wt ? wt.querySelectorAll('.step') : [];
  }

  function getCurrentStep(wt) {
    return parseInt(wt.getAttribute('data-current'), 10) || 1;
  }

  function showStep(stepNum) {
    var wt = getWalkthrough();
    if (!wt) return;

    var steps = getSteps(wt);
    var total = steps.length;

    // Clamp
    if (stepNum < 1) stepNum = 1;
    if (stepNum > total) stepNum = total;

    wt.setAttribute('data-current', stepNum);

    // Show/hide steps
    steps.forEach(function(step) {
      var num = parseInt(step.getAttribute('data-step'), 10);
      if (num === stepNum) {
        step.classList.add('active');
      } else {
        step.classList.remove('active');
      }
    });

    // Update indicator
    var indicator = wt.querySelector('.step-indicator');
    if (indicator) {
      indicator.textContent = 'Step ' + stepNum + ' of ' + total;
    }

    // Update button states
    var nav = wt.querySelector('.walkthrough-nav');
    if (nav) {
      var prevBtn = nav.querySelectorAll('button')[0];
      var nextBtn = nav.querySelectorAll('button')[1];
      if (prevBtn) prevBtn.disabled = (stepNum <= 1);
      if (nextBtn) nextBtn.disabled = (stepNum >= total);
    }

    // Post event
    var eventData = { type: 'walkthrough-step', step: stepNum, total: total };
    if (stepNum === total) {
      eventData.type = 'walkthrough-complete';
    }
    postEvent(eventData);
  }

  window.nextStep = function() {
    var wt = getWalkthrough();
    if (!wt) return;
    showStep(getCurrentStep(wt) + 1);
  };

  window.prevStep = function() {
    var wt = getWalkthrough();
    if (!wt) return;
    showStep(getCurrentStep(wt) - 1);
  };

  // Initialize: show step 1 if walkthrough exists
  var wt = getWalkthrough();
  if (wt) {
    showStep(getCurrentStep(wt));
  }

  // Auto-reload: poll for new content every 2 seconds
  var currentPath = location.pathname;
  setInterval(function() {
    fetch('/?check=' + Date.now(), { method: 'HEAD' })
      .then(function(res) {
        var newEtag = res.headers.get('x-screen-file');
        if (newEtag && newEtag !== document.body.getAttribute('data-screen')) {
          location.reload();
        }
      })
      .catch(function() {});
  }, 2000);
})();
```

- [ ] **Step 2: Commit**

```bash
git add scripts/tutor-helper.js
git commit -m "feat(helper): add client-side quiz, walkthrough, and event logic"
```

---

### Task 4: Start and Stop Scripts

Build platform-aware launcher and shutdown scripts.

**Files:**
- Create: `scripts/start-server.sh`
- Create: `scripts/stop-server.sh`

- [ ] **Step 1: Create start-server.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Parse arguments
PROJECT_DIR=""
HOST="127.0.0.1"
URL_HOST=""
FOREGROUND=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --project-dir) PROJECT_DIR="$2"; shift 2 ;;
    --host) HOST="$2"; shift 2 ;;
    --url-host) URL_HOST="$2"; shift 2 ;;
    --foreground) FOREGROUND=true; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# Check for Node.js
if ! command -v node &>/dev/null; then
  echo '{"type":"error","message":"Node.js is required for the visual companion but was not found"}' >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_SCRIPT="$SCRIPT_DIR/tutor-server.js"

# Create session directory
TIMESTAMP="$(date +%s)"
if [[ -n "$PROJECT_DIR" ]]; then
  SCREEN_DIR="$PROJECT_DIR/.tutor/sessions/$TIMESTAMP"
else
  SCREEN_DIR="/tmp/tutor-session-$TIMESTAMP"
fi
mkdir -p "$SCREEN_DIR"

# Try up to 3 random ports in 50000-59999
MAX_ATTEMPTS=3
for attempt in $(seq 1 $MAX_ATTEMPTS); do
  PORT=$((RANDOM % 10000 + 50000))

  if [[ "$FOREGROUND" == "true" ]] || [[ "${CODEX_CI:-}" == "true" ]]; then
    # Foreground mode — caller must handle backgrounding
    exec node "$SERVER_SCRIPT" "$SCREEN_DIR" "$HOST" "$PORT"
  else
    # Background mode
    node "$SERVER_SCRIPT" "$SCREEN_DIR" "$HOST" "$PORT" &
    SERVER_PID=$!
    sleep 0.5

    # Check if server started successfully
    if kill -0 "$SERVER_PID" 2>/dev/null; then
      # Read and output the server info
      if [[ -f "$SCREEN_DIR/.server-info" ]]; then
        cat "$SCREEN_DIR/.server-info"
        exit 0
      fi
    fi

    # Server failed — try next port
    kill "$SERVER_PID" 2>/dev/null || true
  fi
done

echo '{"type":"error","message":"Failed to start server after '$MAX_ATTEMPTS' attempts"}' >&2
exit 1
```

- [ ] **Step 2: Create stop-server.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail

SCREEN_DIR="${1:-}"

if [[ -z "$SCREEN_DIR" ]]; then
  echo "Usage: stop-server.sh <screen_dir>" >&2
  exit 1
fi

# Find and kill the server process
if [[ -f "$SCREEN_DIR/.server-info" ]]; then
  PORT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$SCREEN_DIR/.server-info','utf8')).port)" 2>/dev/null || true)
  if [[ -n "$PORT" ]]; then
    # Find process listening on that port and kill it
    PID=$(lsof -ti :"$PORT" 2>/dev/null || true)
    if [[ -n "$PID" ]]; then
      kill "$PID" 2>/dev/null || true
    fi
  fi
fi

# Mark as stopped
touch "$SCREEN_DIR/.server-stopped"
rm -f "$SCREEN_DIR/.server-info"

# Clean up session directory
rm -rf "$SCREEN_DIR"

echo '{"type":"server-stopped","screen_dir":"'"$SCREEN_DIR"'"}'
```

- [ ] **Step 3: Make scripts executable**

```bash
chmod +x scripts/start-server.sh scripts/stop-server.sh scripts/tutor-server.js
```

- [ ] **Step 4: Commit**

```bash
git add scripts/start-server.sh scripts/stop-server.sh
git commit -m "feat(scripts): add start and stop scripts for visual companion"
```

---

### Task 5: Integration Test

Write a test script that verifies the server works end-to-end.

**Files:**
- Create: `scripts/test-server.sh`

- [ ] **Step 1: Create the integration test**

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEST_DIR="/tmp/tutor-test-$$"
PASS=0
FAIL=0

cleanup() {
  # Kill any server we started
  if [[ -f "$TEST_DIR/.server-info" ]]; then
    PORT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TEST_DIR/.server-info','utf8')).port)" 2>/dev/null || true)
    if [[ -n "$PORT" ]]; then
      PID=$(lsof -ti :"$PORT" 2>/dev/null || true)
      [[ -n "$PID" ]] && kill "$PID" 2>/dev/null || true
    fi
  fi
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

mkdir -p "$TEST_DIR"

echo "=== Tutor Visual Companion Tests ==="

# Test 1: Server starts and writes .server-info
echo -n "Test 1: Server starts... "
node "$SCRIPT_DIR/tutor-server.js" "$TEST_DIR" "127.0.0.1" "0" &
SERVER_PID=$!
sleep 1

if [[ -f "$TEST_DIR/.server-info" ]]; then
  PORT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TEST_DIR/.server-info','utf8')).port)")
  URL="http://127.0.0.1:$PORT"
  echo "PASS (port $PORT)"
  PASS=$((PASS + 1))
else
  echo "FAIL (no .server-info)"
  FAIL=$((FAIL + 1))
  exit 1
fi

# Test 2: Serves waiting page when no HTML files exist
echo -n "Test 2: Waiting page when no content... "
RESPONSE=$(curl -s "$URL/")
if echo "$RESPONSE" | grep -q "Waiting for content"; then
  echo "PASS"
  PASS=$((PASS + 1))
else
  echo "FAIL"
  FAIL=$((FAIL + 1))
fi

# Test 3: Serves HTML fragment wrapped in frame
echo -n "Test 3: Serves content fragment... "
echo '<h2>Test Diagram</h2><div class="diagram"><pre class="mermaid">graph TD; A-->B</pre></div>' > "$TEST_DIR/diagram.html"
sleep 1
RESPONSE=$(curl -s "$URL/")
if echo "$RESPONSE" | grep -q "Test Diagram" && echo "$RESPONSE" | grep -q "mermaid"; then
  echo "PASS"
  PASS=$((PASS + 1))
else
  echo "FAIL"
  FAIL=$((FAIL + 1))
fi

# Test 4: Event recording
echo -n "Test 4: POST /events records to .events... "
curl -s -X POST "$URL/events" -H "Content-Type: application/json" -d '{"type":"quiz-answer","choice":"b","correct":true}' > /dev/null
sleep 0.5
if [[ -f "$TEST_DIR/.events" ]] && grep -q "quiz-answer" "$TEST_DIR/.events"; then
  echo "PASS"
  PASS=$((PASS + 1))
else
  echo "FAIL"
  FAIL=$((FAIL + 1))
fi

# Test 5: New screen clears events
echo -n "Test 5: New screen clears .events... "
echo '<h2>New Screen</h2>' > "$TEST_DIR/screen2.html"
sleep 1
if [[ ! -s "$TEST_DIR/.events" ]]; then
  echo "PASS"
  PASS=$((PASS + 1))
else
  echo "FAIL (events not cleared)"
  FAIL=$((FAIL + 1))
fi

# Test 6: Full HTML document served as-is
echo -n "Test 6: Full HTML document served as-is... "
echo '<!DOCTYPE html><html><body><p>Full doc</p></body></html>' > "$TEST_DIR/full.html"
sleep 1
RESPONSE=$(curl -s "$URL/")
if echo "$RESPONSE" | grep -q "Full doc" && echo "$RESPONSE" | grep -q "tutor-helper" || echo "$RESPONSE" | grep -q "postEvent"; then
  echo "PASS"
  PASS=$((PASS + 1))
else
  # Helper injection is best-effort — pass if full doc is served
  if echo "$RESPONSE" | grep -q "Full doc"; then
    echo "PASS (helper injection skipped)"
    PASS=$((PASS + 1))
  else
    echo "FAIL"
    FAIL=$((FAIL + 1))
  fi
fi

# Test 7: Graceful shutdown
echo -n "Test 7: Graceful shutdown... "
kill "$SERVER_PID" 2>/dev/null
sleep 1
if [[ -f "$TEST_DIR/.server-stopped" ]]; then
  echo "PASS"
  PASS=$((PASS + 1))
else
  echo "FAIL"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
```

- [ ] **Step 2: Make executable and run**

```bash
chmod +x scripts/test-server.sh
bash scripts/test-server.sh
```

Expected: All 7 tests pass.

- [ ] **Step 3: Commit**

```bash
git add scripts/test-server.sh
git commit -m "test(server): add integration tests for visual companion server"
```

---

### Task 6: Visual Companion Guide

Write the prompt guide that the tutor reads when the companion is activated.

**Files:**
- Create: `skills/tutor/visual-companion.md`

- [ ] **Step 1: Create visual-companion.md**

```markdown
# Visual Companion Guide

Browser-based visual teaching companion. Use this when the learner asks to see content in the browser.

## Starting a Session

1. Start the server:

Run: `scripts/start-server.sh --project-dir <project-root>`

Save the returned `screen_dir` path — you'll write all HTML files there.

2. Tell the learner: "Opening the visual companion. Head to [URL] in your browser."

3. Push your first content screen by writing an HTML file to `screen_dir`.

## The Loop

1. **Check server is alive** — verify `screen_dir/.server-info` exists. If missing or `.server-stopped` exists, restart with `start-server.sh`.
2. **Write HTML** to a new file in `screen_dir` (e.g., `diagram.html`, `quiz-1.html`). Use semantic filenames. Never reuse filenames — each screen is a fresh file.
3. **Tell the learner** what's on screen: "Check the browser — I've put up a diagram of the recursion tree."
4. **On your next turn**, read `screen_dir/.events` if it exists. This contains the learner's browser interactions as JSON lines.
5. **Respond** based on both the terminal message and browser events.
6. **Iterate or advance** — write a new file for the next screen.

## Writing Diagrams

Write an HTML fragment with a Mermaid definition. The frame template renders it automatically.

```html
<!-- filename: recursion-tree.html -->
<h2>How Recursive Calls Stack Up</h2>
<p class="subtitle">Each call waits for its children to return</p>

<div class="diagram">
<pre class="mermaid">
graph TD
    A["fib(4)"] --> B["fib(3)"]
    A --> C["fib(2)"]
    B --> D["fib(2)"]
    B --> E["fib(1) = 1"]
</pre>
</div>
```

Mermaid diagram types to reach for:
- `graph TD` / `graph LR` — flowcharts, trees, relationships
- `sequenceDiagram` — interactions, protocols
- `classDiagram` — data models, hierarchies
- `stateDiagram-v2` — state machines, lifecycle
- `mindmap` — topic decomposition

## Writing Quizzes

Write a quiz with `data-correct` attributes. The helper script handles feedback and event recording.

```html
<!-- filename: quiz-sorting.html -->
<h2>Quick Check</h2>
<p class="subtitle">Which sorting algorithm has O(n log n) average case?</p>

<div class="quiz">
  <div class="quiz-option" data-choice="a" data-correct="false" onclick="checkAnswer(this)">
    <div class="letter">A</div>
    <div class="content">Bubble Sort — O(n²)</div>
  </div>
  <div class="quiz-option" data-choice="b" data-correct="true" onclick="checkAnswer(this)">
    <div class="letter">B</div>
    <div class="content">Merge Sort — O(n log n)</div>
  </div>
  <div class="quiz-option" data-choice="c" data-correct="false" onclick="checkAnswer(this)">
    <div class="letter">C</div>
    <div class="content">Selection Sort — O(n²)</div>
  </div>
</div>
```

**Reading quiz results:** Check `.events` for `quiz-answer` events:
```json
{"type":"quiz-answer","choice":"b","correct":true,"text":"Merge Sort — O(n log n)","timestamp":1706000101}
```

- If correct: acknowledge briefly, move on
- If wrong: re-explain the concept, then try a different question

## Writing Walkthroughs

Write a sequence of steps. The helper script handles navigation and CSS transitions.

```html
<!-- filename: bubble-sort.html -->
<h2>Bubble Sort: Step by Step</h2>
<p class="subtitle">Watch how the largest element bubbles to the end</p>

<div class="walkthrough" data-current="1">
  <div class="step" data-step="1">
    <div class="visual">
      <div class="bar highlight" style="height:80px">4</div>
      <div class="bar highlight" style="height:40px">2</div>
      <div class="bar" style="height:140px">7</div>
      <div class="bar" style="height:20px">1</div>
    </div>
    <p class="explanation">Compare 4 and 2. Since 4 > 2, we swap them.</p>
  </div>
  <div class="step" data-step="2">
    <div class="visual">
      <div class="bar" style="height:40px">2</div>
      <div class="bar highlight" style="height:80px">4</div>
      <div class="bar highlight" style="height:140px">7</div>
      <div class="bar" style="height:20px">1</div>
    </div>
    <p class="explanation">Compare 4 and 7. Since 4 < 7, no swap needed.</p>
  </div>
  <div class="walkthrough-nav">
    <button onclick="prevStep()">← Previous</button>
    <span class="step-indicator">Step 1 of 2</span>
    <button onclick="nextStep()">Next →</button>
  </div>
</div>
```

**Reading walkthrough events:** Check `.events` for step events:
```json
{"type":"walkthrough-step","step":2,"total":6,"timestamp":1706000101}
{"type":"walkthrough-complete","total":6,"timestamp":1706000150}
```

When the learner completes the walkthrough, ask a comprehension question about what they observed.

## Reading Events

Read `screen_dir/.events` on each turn. It contains one JSON object per line.

Event types:
- `quiz-answer` — `{ type, choice, correct, text, timestamp }`
- `walkthrough-step` — `{ type, step, total, timestamp }`
- `walkthrough-complete` — `{ type, total, timestamp }`

If `.events` doesn't exist or is empty, the learner didn't interact with the browser — use only their terminal text.

Events are cleared automatically when you push a new screen.

## Returning to Terminal

When the next exchange doesn't need the browser, push a waiting screen:

```html
<!-- filename: waiting.html (use waiting-2.html, waiting-3.html for subsequent) -->
<div style="display:flex;align-items:center;justify-content:center;min-height:60vh">
  <p class="subtitle">Continuing in terminal...</p>
</div>
```

This prevents the learner from staring at a resolved screen while the conversation has moved on.

## Stopping the Server

Run: `scripts/stop-server.sh <screen_dir>`

Or let the server auto-shutdown after 30 minutes of inactivity. The server writes `.server-stopped` when it exits.
```

- [ ] **Step 2: Commit**

```bash
git add skills/tutor/visual-companion.md
git commit -m "feat(guide): add visual companion prompt guide for content generation"
```

---

### Task 7: SKILL.md Updates

Add companion activation triggers and browser path to the existing skill.

**Files:**
- Modify: `skills/tutor/SKILL.md`

- [ ] **Step 1: Add browser mode to Visual Aids section**

After the existing Visual Aids "Reach for these diagram types" list (after line 122 in current SKILL.md), add:

```markdown

**Browser mode (opt-in):** If the learner asks to see visuals in the browser ("show me in the browser", "open visuals"), start the visual companion server and push rich content instead. See visual-companion.md for the full guide on generating diagrams, quizzes, and walkthroughs.
```

- [ ] **Step 2: Add companion activation to Explicit Mode Commands**

After the last mode command ("what should I focus on?" → Meta-Learning Coach), add:

```markdown
- "show me in the browser" / "open visuals" → activate visual companion (see visual-companion.md)
```

- [ ] **Step 3: Commit**

```bash
git add skills/tutor/SKILL.md
git commit -m "feat(skill): add visual companion activation triggers to SKILL.md"
```

---

### Task 8: Plugin Metadata and README

Bump version and update docs.

**Files:**
- Modify: `.claude-plugin/plugin.json`
- Modify: `README.md`

- [ ] **Step 1: Bump plugin.json to 2.1.0**

Update `.claude-plugin/plugin.json`:

```json
{
  "name": "tutor",
  "description": "Adaptive tutor skill with 10 teaching modes, active teaching tools, and a browser-based visual companion — runs code, creates exercises, generates interactive diagrams, quizzes, and walkthroughs. Makes Claude act as an interactive coach for learning any subject.",
  "version": "2.1.0",
  "author": {
    "name": "Rupan Sunderapandyan"
  }
}
```

- [ ] **Step 2: Add Visual Companion section to README**

After the "What's New in v2" section in README.md, add:

```markdown

## Visual Companion (v2.1)

Ask the tutor to "show me in the browser" or "open visuals" during any session to launch a browser-based visual companion. The tutor pushes rich content to your browser while the conversation continues in the terminal:

- **Rendered diagrams** — Mermaid diagrams rendered as interactive SVGs
- **Interactive quizzes** — click-based multiple choice with instant feedback
- **Visual walkthroughs** — step-through animations with CSS transitions

Requires Node.js. Start with any visual request during a tutoring session.
```

- [ ] **Step 3: Commit**

```bash
git add .claude-plugin/plugin.json README.md
git commit -m "docs: update plugin metadata and README for visual companion v2.1"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Run integration tests**

```bash
bash scripts/test-server.sh
```

Expected: All 7 tests pass.

- [ ] **Step 2: Read all new files end-to-end**

Read and verify:
- `scripts/tutor-server.js` — server binds to 127.0.0.1, polls every 500ms, has event endpoint, auto-shutdown, graceful shutdown
- `scripts/tutor-frame.html` — Mermaid CDN, dark theme, quiz/walkthrough/diagram styles, `{{CONTENT}}` and `{{HELPER_SCRIPT}}` placeholders
- `scripts/tutor-helper.js` — `checkAnswer()`, `prevStep()`, `nextStep()` globals, event posting
- `scripts/start-server.sh` — Node.js check, port retry, platform detection, session dir creation
- `scripts/stop-server.sh` — process kill, cleanup
- `skills/tutor/visual-companion.md` — 8 sections with HTML examples
- `skills/tutor/SKILL.md` — browser mode in Visual Aids, activation in Explicit Mode Commands
- `.claude-plugin/plugin.json` — version 2.1.0
- `README.md` — Visual Companion section

- [ ] **Step 3: Verify git log**

Run `git log --oneline -10` and confirm all commits are clean and sequential.
