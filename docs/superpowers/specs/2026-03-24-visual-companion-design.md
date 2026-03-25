# Tutor Visual Companion — Design Spec

**Date:** 2026-03-24
**Status:** Draft
**Depends on:** Tutor v2 (Active Teaching Tools)

## Summary

A browser-based visual teaching companion for the tutor skill. The tutor pushes rich HTML content (rendered diagrams, interactive quizzes, visual walkthroughs) to a browser while the teaching conversation continues in the terminal. Opt-in only — activated when the learner explicitly asks for visual content.

Inspired by the superpowers Visual Companion architecture (file-watch → serve → events) but purpose-built for teaching. Self-contained, no external dependencies.

## Scope

- Rendered Mermaid diagrams (interactive SVG in browser)
- Click-based quizzes with instant visual feedback
- Step-through visual walkthroughs with CSS transitions
- Minimal Node.js server with zero npm dependencies
- Opt-in activation only (learner must explicitly request)

## 1. Architecture

The companion follows a terminal+browser loop:

1. Tutor writes an HTML fragment to `screen_dir`
2. Server detects the new file and serves it to the browser
3. Learner interacts (clicks quiz answers, steps through walkthrough)
4. Clicks are recorded to `screen_dir/.events` as JSON lines
5. Tutor reads `.events` on its next turn and responds accordingly

### Components

**Server** (`scripts/tutor-server.js`): ~100-150 lines of Node.js using only built-ins (`http`, `fs`, `path`). Watches `screen_dir` for new `.html` files by mtime, serves the newest one. Injects helper script into served pages. Provides `POST /events` endpoint for recording interactions. Auto-exits after 30 minutes of inactivity. Writes startup info to `screen_dir/.server-info`.

**Frame template** (`scripts/tutor-frame.html`): HTML wrapper for content fragments. Loads Mermaid.js from CDN for diagram rendering. Provides CSS theme and component styles for quizzes, walkthroughs, and diagrams. Injected around fragments that don't start with `<!DOCTYPE` or `<html>`.

**Helper script** (`scripts/tutor-helper.js`): Client-side JS injected into every page. Handles: click event posting to server, Mermaid rendering initialization, quiz answer checking with visual feedback, walkthrough step navigation with CSS transitions.

**Start script** (`scripts/start-server.sh`): Platform-aware launcher. Creates `screen_dir` at `<project>/.tutor/sessions/<timestamp>/`. Returns JSON with port, URL, and screen_dir path.

**Stop script** (`scripts/stop-server.sh`): Graceful shutdown and optional cleanup.

## 2. Activation Model

The companion is **opt-in only**. The tutor does not auto-start the server.

### Activation Triggers

The learner says one of:
- "show me in the browser"
- "open the visual companion"
- "open visuals"
- "I want to see it"

### Tutor Behavior on Activation

1. Start the server via `scripts/start-server.sh --project-dir <project>`
2. Tell the learner: "Opening the visual companion. Head to [URL] in your browser."
3. Push the first content screen
4. Continue teaching — browser for visuals, terminal for conversation
5. When returning to conversational-only teaching, push a waiting screen

### Two Paths for Visual Aids

The Visual Aids tool in SKILL.md has two paths:
- **Terminal path** (default): Mermaid code blocks + ASCII diagrams in the terminal
- **Browser path** (on explicit request): Start companion, render rich interactive content

The terminal path remains the default. The browser path is only used when the learner activates it.

### Explicit Mode Commands Update

Add to the existing Explicit Mode Commands:
- "show me in the browser" / "open visuals" → activate visual companion

## 3. Content Types

### 3a. Rendered Diagrams

Mermaid definitions wrapped in an HTML fragment. The frame template loads Mermaid.js and auto-renders to interactive SVG (zoomable, pannable).

```html
<h2>How Recursive Calls Stack Up</h2>
<p class="subtitle">Each call waits for its children to return</p>
<div class="diagram">
<pre class="mermaid">
graph TD
    A["fib(4)"] --> B["fib(3)"]
    A --> C["fib(2)"]
</pre>
</div>
```

### 3b. Interactive Quizzes

Click-based multiple choice with instant visual feedback. On click: correct answers highlight green, wrong answers highlight red and reveal the correct one. Events posted to `.events`.

```html
<h2>Quick Check</h2>
<p class="subtitle">What is the time complexity of binary search?</p>
<div class="quiz">
  <div class="quiz-option" data-choice="a" data-correct="false" onclick="checkAnswer(this)">
    <div class="letter">A</div>
    <div class="content">O(n)</div>
  </div>
  <div class="quiz-option" data-choice="b" data-correct="true" onclick="checkAnswer(this)">
    <div class="letter">B</div>
    <div class="content">O(log n)</div>
  </div>
</div>
```

`checkAnswer()` provides visual feedback and posts `{ type: "quiz-answer", choice, correct, text }` to `.events`.

### 3c. Visual Walkthroughs

A sequence of steps with CSS transitions (`opacity`, `transform`). Learner navigates with Previous/Next buttons. Each step has a visual state and an explanation.

```html
<h2>Bubble Sort: Step by Step</h2>
<div class="walkthrough" data-current="1">
  <div class="step" data-step="1">
    <div class="visual"><!-- visual state --></div>
    <p class="explanation">Compare 4 and 2. Since 4 > 2, swap them.</p>
  </div>
  <div class="step" data-step="2">
    <div class="visual"><!-- next state --></div>
    <p class="explanation">Now compare 4 and 7. No swap needed.</p>
  </div>
  <div class="walkthrough-nav">
    <button onclick="prevStep()">Previous</button>
    <span class="step-indicator">Step 1 of 6</span>
    <button onclick="nextStep()">Next</button>
  </div>
</div>
```

Step transitions use CSS for smooth visual changes. Step completion events posted to `.events`.

## 4. Server Details

### Startup

```bash
scripts/start-server.sh --project-dir /path/to/project
# Creates: <project>/.tutor/sessions/<timestamp>/
# Returns: {"type":"server-started","port":52342,"url":"http://localhost:52342","screen_dir":"..."}
```

### File Serving

- Polls `screen_dir` for newest `.html` file by mtime
- If file starts with `<!DOCTYPE` or `<html>`: serve as-is, inject helper script before `</body>`
- Otherwise: wrap in `tutor-frame.html`, inject helper script

### Event Recording

- `POST /events` endpoint accepts JSON body
- Appends to `screen_dir/.events` as JSON lines
- `.events` cleared when a new screen file is detected

### Platform Handling

Same pattern as Visual Companion:
- macOS/Linux: script backgrounds the server
- Windows: foreground mode, use `run_in_background: true` on Bash tool
- Codex: auto-detects, foreground mode
- Gemini CLI: `--foreground` flag with platform background execution

### Auto-Shutdown

Server exits after 30 minutes without HTTP requests. Writes `screen_dir/.server-stopped` on exit.

## 5. File Structure

```
tutor-plugin/
├── scripts/
│   ├── tutor-server.js         # File-watching HTTP server
│   ├── tutor-frame.html        # Frame template (Mermaid CDN, theme CSS, component styles)
│   ├── tutor-helper.js         # Client-side JS (events, quiz, walkthrough nav)
│   ├── start-server.sh         # Platform-aware launcher
│   └── stop-server.sh          # Cleanup script
├── skills/
│   └── tutor/
│       ├── SKILL.md            # Updated with companion activation triggers
│       └── visual-companion.md # Detailed guide for generating teaching content
├── .claude-plugin/
│   └── plugin.json             # Bump to 2.1.0
├── README.md                   # Updated with companion feature
└── ...existing files...
```

## 6. SKILL.md Changes

### Visual Aids Tool Update

Add browser path to the existing Visual Aids section:

```markdown
**Browser mode (opt-in):** If the learner asks to see visuals in the browser ("show me in the browser", "open visuals"), start the visual companion server and push rich content instead. See visual-companion.md for the full guide on generating diagrams, quizzes, and walkthroughs.
```

### Explicit Mode Commands Addition

Add to existing list:
```markdown
- "show me in the browser" / "open visuals" → activate visual companion
```

### visual-companion.md

A new file (not part of SKILL.md) that serves as the detailed reference for how to generate each content type. The tutor reads this when the companion is activated. Covers:
- Starting/stopping the server
- Writing diagram fragments
- Writing quiz fragments
- Writing walkthrough fragments
- Reading and responding to `.events`
- Pushing waiting screens when returning to terminal-only teaching

## Non-Goals

- Code playground / code editor in browser (future consideration)
- Flashcard/recall interface (future consideration)
- Progress dashboard (future consideration)
- Drag-and-drop or rich interactivity beyond clicks (future consideration)
- Auto-activation — companion is always opt-in
- npm dependencies — server uses Node.js built-ins only
