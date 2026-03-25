# Claude Tutor Plugin

An adaptive tutor skill for Claude Code that makes Claude act as an interactive coach for learning any topic.

## What's New in v2

- **Live Code Execution** — tutor writes and runs examples so you see real output
- **Interactive Exercises** — practice with real code challenges, get feedback on your solutions
- **Visual Aids** — Mermaid diagrams and ASCII visuals for abstract concepts
- **Web Research** — pulls in current docs and examples when topics need up-to-date info

## Visual Companion (v2.1)

Ask the tutor to "show me in the browser" or "open visuals" during any session to launch a browser-based visual companion. The tutor pushes rich content to your browser while the conversation continues in the terminal:

- **Rendered diagrams** — Mermaid diagrams rendered as interactive SVGs
- **Interactive quizzes** — click-based multiple choice with instant feedback
- **Visual walkthroughs** — step-through animations with CSS transitions

Requires Node.js. Start with any visual request during a tutoring session.

## Install

### As a plugin

```
/plugin marketplace add JEFF7712/claude-tutor
/plugin install tutor@claude-tutor
```

### Manual

```bash
git clone https://github.com/JEFF7712/claude-tutor.git ~/.claude/skills/claude-tutor
```

## Usage

- `/tutor <topic>` — start a tutoring session
- Or just ask naturally: "teach me about quantum physics", "help me learn SQL", "explain how DNS works"

## Teaching Modes

The tutor auto-selects and blends 10 teaching modes based on your responses:

| Mode | What it does | Tools |
|------|-------------|-------|
| Socratic Drillmaster | Asks questions that lead you to the answer | — |
| Mixed Practice Architect | Interleaved drills mixing related concepts | Exercises, Code |
| Why-How Interrogator | Challenges surface-level understanding | — |
| Mental Model Forge | Builds frameworks: principles -> rules -> examples | Visuals |
| Visual Thinking Translator | Diagrams, tables, and flowcharts | Visuals |
| Active Recall Generator | Makes you summarize, create analogies, and build flashcards | Exercises, Code |
| Meta-Learning Coach | Checks what's working and adjusts the approach | — |
| Analogy Bridge Tutor | Explains concepts through familiar domains | Visuals |
| Simplified Learning | Breaks complex ideas down for beginners | Visuals, Research |
| Progressive Recall Mentor | Climbs from recall to application to synthesis | Code |

You can also switch modes explicitly: "quiz me", "explain it simpler", "use an analogy", "give me drills", "let's wrap up".

## Credits

Teaching modes inspired by [@AI_with_jasmin](https://x.com/AI_with_jasmin).
Visual Companion inspired by the [Superpowers](https://github.com/anthropics/claude-code-plugins) Visual Companion pattern.
