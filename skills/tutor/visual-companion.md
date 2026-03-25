# Visual Companion — Prompt Guide

When the visual companion is active, you generate HTML content that appears in the learner's browser alongside the terminal session. This guide defines exactly how to produce that content.

---

## 1. Starting a Session

Run the start script to launch the companion server:

```bash
scripts/start-server.sh --project-dir <project-root>
```

The script outputs JSON with a `screen_dir` and `url`. Save the `screen_dir` path — you will write all visual content there.

Tell the learner:

> Opening the visual companion. Head to http://127.0.0.1:<port> in your browser.

Example startup output:
```json
{"type":"tutor-server","port":52341,"url":"http://127.0.0.1:52341","screen_dir":"/home/user/project/.tutor/sessions/1711234567"}
```

---

## 2. The Loop

Every turn follows this cycle:

1. **Check server alive** — `.server-info` exists in `screen_dir` and `.server-stopped` does not.
2. **Write an HTML fragment** to a new file in `screen_dir`. Use semantic filenames (`recursion-diagram.html`, `sorting-quiz.html`). Never reuse a filename — the server picks up the newest `.html` file by mtime.
3. **Tell the learner** what is now on screen: "I've put a diagram of the recursion tree in the browser."
4. **On the next turn**, read `<screen_dir>/.events` if it exists. It contains one JSON object per line describing learner interactions.
5. **Respond** based on both the terminal message and any browser events.

Example: writing a file to screen_dir:

```bash
cat > /home/user/project/.tutor/sessions/1711234567/intro-diagram.html << 'HTMLEOF'
<h2>How Recursion Works</h2>
<p class="subtitle">Follow the call stack from top to bottom.</p>
<div class="diagram">
  <pre class="mermaid">
graph TD
    A["fib(4)"] --> B["fib(3)"]
    A --> C["fib(2)"]
    B --> D["fib(2)"]
    B --> E["fib(1)"]
  </pre>
</div>
HTMLEOF
```

---

## 3. Writing Diagrams

Write an HTML fragment containing a `<div class="diagram">` wrapping a `<pre class="mermaid">` block. The frame template loads Mermaid from CDN and initializes it with dark theme — you only supply the fragment.

### Complete example — Fibonacci recursion tree

```html
<h2>Fibonacci Recursion Tree</h2>
<p class="subtitle">Each node is a function call. Notice the repeated subproblems.</p>

<div class="diagram">
  <pre class="mermaid">
graph TD
    A["fib(5)"] --> B["fib(4)"]
    A --> C["fib(3)"]
    B --> D["fib(3)"]
    B --> E["fib(2)"]
    D --> F["fib(2)"]
    D --> G["fib(1) = 1"]
    C --> H["fib(2)"]
    C --> I["fib(1) = 1"]
    F --> J["fib(1) = 1"]
    F --> K["fib(0) = 0"]
    E --> L["fib(1) = 1"]
    E --> M["fib(0) = 0"]
    H --> N["fib(1) = 1"]
    H --> O["fib(0) = 0"]
    style A fill:#7aa2f7,color:#1a1b26
    style D fill:#f7768e,color:#1a1b26
    style C fill:#f7768e,color:#1a1b26
  </pre>
</div>
```

### Supported Mermaid diagram types

- `graph` (TD, LR, etc.) — flowcharts, dependency trees, call graphs
- `sequenceDiagram` — request/response flows, protocol exchanges
- `classDiagram` — OOP relationships, module structures
- `stateDiagram-v2` — state machines, lifecycle transitions
- `mindmap` — topic overviews, concept clustering

---

## 4. Writing Quizzes

Write an HTML fragment with a `.quiz` container holding `.quiz-option` elements. Each option needs `data-choice`, `data-correct`, and `onclick="checkAnswer(this)"`. The helper script handles click locking, color feedback, and event posting.

### Complete example — Sorting algorithm complexity

```html
<h2>Quick Check: Sorting Complexity</h2>
<p class="subtitle">What is the average-case time complexity of quicksort?</p>

<div class="quiz">
  <div class="quiz-option" data-choice="a" data-correct="false" onclick="checkAnswer(this)">
    <span class="letter">A</span>
    <span class="content">O(n)</span>
  </div>
  <div class="quiz-option" data-choice="b" data-correct="true" onclick="checkAnswer(this)">
    <span class="letter">B</span>
    <span class="content">O(n log n)</span>
  </div>
  <div class="quiz-option" data-choice="c" data-correct="false" onclick="checkAnswer(this)">
    <span class="letter">C</span>
    <span class="content">O(n²)</span>
  </div>
  <div class="quiz-option" data-choice="d" data-correct="false" onclick="checkAnswer(this)">
    <span class="letter">D</span>
    <span class="content">O(log n)</span>
  </div>
</div>
```

### Event format

When the learner clicks an answer, `.events` receives:

```json
{"type":"quiz-answer","choice":"b","correct":true,"text":"O(n log n)","timestamp":1711234599000}
```

### Teaching response

- **Correct** — Acknowledge briefly ("Right, quicksort averages O(n log n) due to balanced partitions.") and move to the next concept.
- **Wrong** — Do not just reveal the answer. Re-explain the concept that led to the mistake, then either re-quiz or ask a Socratic follow-up.

---

## 5. Writing Walkthroughs

Write an HTML fragment with a `.walkthrough` container holding `.step` elements (each with `data-step`) and a `.walkthrough-nav` bar. The helper script manages step visibility, prev/next buttons, and event posting. Only the `.active` step is shown.

### Complete example — Bubble sort with colored bars

```html
<h2>Bubble Sort Walkthrough</h2>
<p class="subtitle">Watch how the largest element bubbles to the end each pass.</p>

<div class="walkthrough" data-current="1">
  <div class="step active" data-step="1">
    <div class="visual">
      <div class="bar compared" style="height:80px">5</div>
      <div class="bar compared" style="height:48px">3</div>
      <div class="bar" style="height:16px">1</div>
      <div class="bar" style="height:64px">4</div>
      <div class="bar" style="height:32px">2</div>
    </div>
    <div class="explanation">Comparing 5 and 3. Since 5 &gt; 3, we swap them.</div>
  </div>

  <div class="step" data-step="2">
    <div class="visual">
      <div class="bar" style="height:48px">3</div>
      <div class="bar compared" style="height:80px">5</div>
      <div class="bar compared" style="height:16px">1</div>
      <div class="bar" style="height:64px">4</div>
      <div class="bar" style="height:32px">2</div>
    </div>
    <div class="explanation">Now comparing 5 and 1. Since 5 &gt; 1, swap again.</div>
  </div>

  <div class="step" data-step="3">
    <div class="visual">
      <div class="bar" style="height:48px">3</div>
      <div class="bar" style="height:16px">1</div>
      <div class="bar compared" style="height:80px">5</div>
      <div class="bar compared" style="height:64px">4</div>
      <div class="bar" style="height:32px">2</div>
    </div>
    <div class="explanation">Comparing 5 and 4. Since 5 &gt; 4, swap.</div>
  </div>

  <div class="step" data-step="4">
    <div class="visual">
      <div class="bar" style="height:48px">3</div>
      <div class="bar" style="height:16px">1</div>
      <div class="bar" style="height:64px">4</div>
      <div class="bar compared" style="height:80px">5</div>
      <div class="bar compared" style="height:32px">2</div>
    </div>
    <div class="explanation">Comparing 5 and 2. Since 5 &gt; 2, swap. End of pass 1.</div>
  </div>

  <div class="step" data-step="5">
    <div class="visual">
      <div class="bar" style="height:48px">3</div>
      <div class="bar" style="height:16px">1</div>
      <div class="bar" style="height:64px">4</div>
      <div class="bar" style="height:32px">2</div>
      <div class="bar highlight" style="height:80px">5</div>
    </div>
    <div class="explanation">5 has bubbled to its final position. The largest element is now sorted. Next pass will sort the remaining elements.</div>
  </div>

  <div class="walkthrough-nav">
    <button data-action="prev" onclick="prevStep()" disabled>Prev</button>
    <span class="step-indicator">Step 1 of 5</span>
    <button data-action="next" onclick="nextStep()">Next</button>
  </div>
</div>
```

### Event formats

Step navigation:
```json
{"type":"walkthrough-step","step":3,"total":5,"timestamp":1711234601000}
```

Reaching the last step:
```json
{"type":"walkthrough-complete","total":5,"timestamp":1711234610000}
```

### On completion

When you see a `walkthrough-complete` event, ask a comprehension question about the material: "Now that you've stepped through the full pass, what determines how many total passes bubble sort needs?"

---

## 6. Reading Events

Events live in `<screen_dir>/.events`, one JSON object per line.

### Event types

| Type | Fields | Meaning |
|---|---|---|
| `quiz-answer` | `choice`, `correct`, `text` | Learner selected a quiz option |
| `walkthrough-step` | `step`, `total` | Learner navigated to a step |
| `walkthrough-complete` | `total` | Learner reached the final step |

All events include a `timestamp` (milliseconds since epoch).

### Rules

- If `.events` does not exist or is empty, the learner did not interact with the browser. Respond using terminal text only.
- Events are cleared automatically when a new screen file is detected by the server (new `.html` written to `screen_dir`). You do not need to clear them manually.
- Read `.events` at the start of each turn before composing your response.

Example: reading events:

```bash
cat /home/user/project/.tutor/sessions/1711234567/.events
```

---

## 7. Returning to Terminal

When the next exchange does not need visuals, push a waiting screen so the browser shows a clean holding state. Always use a unique filename.

### Example — waiting screen

```html
<div style="display:flex;align-items:center;justify-content:center;min-height:60vh">
  <p class="subtitle">Continuing in terminal...</p>
</div>
```

Write it with a unique name:

```bash
cat > <screen_dir>/waiting.html << 'HTMLEOF'
<div style="display:flex;align-items:center;justify-content:center;min-height:60vh">
  <p class="subtitle">Continuing in terminal...</p>
</div>
HTMLEOF
```

For subsequent waiting screens, use `waiting-2.html`, `waiting-3.html`, etc. Never reuse a filename.

---

## 8. Stopping the Server

When the teaching session ends, stop the server:

```bash
scripts/stop-server.sh <screen_dir>
```

The script kills the process, writes `.server-stopped`, cleans up the session directory, and outputs confirmation JSON.

If you forget, the server auto-shuts down after 30 minutes of inactivity (no HTTP requests). The learner will see the browser stop updating.

Example stop output:
```json
{"type":"server-stopped","screen_dir":"/home/user/project/.tutor/sessions/1711234567"}
```
