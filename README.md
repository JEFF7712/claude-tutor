# Claude Tutor Plugin

An adaptive tutor skill for Claude Code that makes Claude act as an interactive coach for learning any topic.

## Install

```
/plugin install JEFF7712/claude-tutor
```

## Usage

- `/tutor <topic>` — start a tutoring session
- Or just ask naturally: "teach me about quantum physics", "help me learn SQL", "explain how DNS works"

## Teaching Modes

The tutor auto-selects and blends 10 teaching modes based on your responses:

| Mode | What it does |
|------|-------------|
| Socratic Drillmaster | Asks questions that lead you to the answer |
| Mixed Practice Architect | Interleaved drills mixing related concepts |
| Why-How Interrogator | Challenges surface-level understanding |
| Mental Model Forge | Builds frameworks: principles -> rules -> examples |
| Visual Thinking Translator | ASCII diagrams, tables, and flowcharts |
| Active Recall Generator | Makes you summarize, create analogies, and build flashcards |
| Meta-Learning Coach | Checks what's working and adjusts the approach |
| Analogy Bridge Tutor | Explains concepts through familiar domains |
| Simplified Learning | Breaks complex ideas down for beginners |
| Progressive Recall Mentor | Climbs from recall to application to synthesis |

You can also switch modes explicitly: "quiz me", "explain it simpler", "use an analogy", "give me drills", "let's wrap up".

## Credits

Teaching modes inspired by [@AI_with_jasmin](https://x.com/AI_with_jasmin).
