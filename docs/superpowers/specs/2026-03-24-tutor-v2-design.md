# Tutor Plugin v2 — Active Teaching Tools

**Date:** 2026-03-24
**Status:** Draft
**Approach:** Capability Layer (Approach 3)

## Summary

Upgrade the tutor skill from a conversation-only teaching partner to one that leverages Claude Code's tooling — code execution, interactive exercises, visual diagrams, and web research — while preserving the existing 10-mode pedagogy unchanged.

The modes are the pedagogy. The tools are the toolkit. Same teacher, better classroom.

## Scope

- General-purpose tutor (not programming-only)
- Tools activate when context calls for them, not forced
- Light marketplace polish (organization, versioning, README)

## 1. Active Teaching Tools

Four new capabilities added as a section in SKILL.md, after the existing 10 modes. Any mode can use them when appropriate.

**Prompt format:** Each tool follows a `**Trigger:** / **Behavior:**` pattern (distinct from the modes' `**When:** / **How:**` format to make clear these are tools, not modes).

**Graceful degradation:** If any tool is unavailable (no internet for web research, Bash restricted, etc.), fall back to conversational teaching. Tools enhance — they're never required.

### 1.1 Live Code Execution

**Trigger:** Topic involves programming, math, data, or any concept demonstrable with runnable code.

**Behavior:**
- Write small examples (under 30 lines) and run them via Bash so the learner sees real output
- Use "predict then verify" — ask the learner what code will output before running it
- Support any language the learner is working in (detect from context or ask)
- Keep examples focused on one concept at a time

### 1.2 Interactive Exercises

**Trigger:** Learner is in a practice mode or the tutor decides they need hands-on practice.

**Behavior:**
- Create a temporary exercise file (e.g., `/tmp/tutor-exercise.<ext>` — use the appropriate extension for the learner's language) with a skeleton and clear instructions in comments
- Tell the learner to open and fill in the implementation
- When the learner is done, read their code and run it — provide feedback on correctness, style, and edge cases
- For test-driven exercises: write tests first, have the learner make them pass

### 1.3 Visual Aids

**Trigger:** Concept is abstract, involves relationships/hierarchies/flows, or learner is in Visual Thinking Translator mode.

**Behavior:**
- Generate Mermaid diagrams as fenced code blocks (rendered natively in supported terminals)
- Use ASCII diagrams and tables for simpler visuals
- Combine approaches: Mermaid for big picture, ASCII for zoomed-in details

**Diagram types to reach for:**
- `flowchart` — processes, decision trees, control flow
- `sequenceDiagram` — interactions, request/response, protocols
- `classDiagram` — relationships, hierarchies, data models
- `stateDiagram` — state machines, lifecycle
- `mindmap` — topic decomposition, brainstorming

### 1.4 Web Research

**Trigger:** Topic requires current information, training data may be outdated, or learner asks "what's the latest on X?"

**Behavior:**
- Use WebSearch/WebFetch to pull in current documentation, examples, or explanations
- Cite sources when presenting researched information
- Research supplements the tutor's explanation — the tutor still teaches, research feeds into teaching

## 2. Mode + Tool Integration

Tools are mapped only to modes where they genuinely help. 5 of 10 modes remain tool-free.

| Mode | Tools | Rationale |
|---|---|---|
| Socratic Drillmaster | — | Pure questioning. Tools interrupt the flow. |
| Mixed Practice Architect | Exercises, Code Execution | This mode IS practice — real exercises are a direct upgrade. |
| Why-How Interrogator | — | Verbal reasoning is the point. |
| Mental Model Forge | Visual Aids | Models are relationships — diagrams make them concrete. |
| Visual Thinking Translator | Visual Aids | Core upgrade. Mermaid for every abstract concept. |
| Active Recall Generator | Exercises, Code Execution | "Reproduce from memory" is stronger as real code. |
| Meta-Learning Coach | — | Conversational by nature. |
| Analogy Bridge Tutor | Visual Aids | Side-by-side comparison diagrams. Optional, not forced. |
| Simplified Learning Strategist | Visual Aids, Web Research | Beginners benefit from pictures and curated resources. |
| Progressive Recall Mentor | Code Execution | Synthesis questions become "build something" challenges. |

**Core rule:** Tools serve the pedagogy, not the other way around. If a diagram doesn't clarify, don't force one. If code execution interrupts the teaching flow, skip it.

## 3. Marketplace Polish

### 3.1 SKILL.md Reorganization

Restructure with clear section headers (no content rewrite):

1. **Opening Protocol** — assessment, topic scoping
2. **Teaching Modes** — the 10 modes
3. **Active Teaching Tools** — new capability layer
4. **Mode Switching** — adaptive signals table, explicit mode commands (moved after tools so it can reference them)
5. **Session Rules** — NEVER/ALWAYS lists, confusion escalation
6. **Session Closure** — consolidates existing session-ending behavior from the mode blending table and the ALWAYS rules into one named section

### 3.2 Plugin Metadata

- Bump version to `2.0.0` in `plugin.json`
- Update description to mention active tools

### 3.3 README Update

- Add "What's New in v2" section highlighting the 4 active teaching tools
- Update feature table to reflect tool-enhanced modes
- Keep concise — bullet points, not marketing copy

## Non-Goals

- Persistent progress tracking / memory across sessions (future consideration)
- Codebase-aware teaching ("teach me this repo's auth system") (future consideration)
- Splitting SKILL.md into multiple files (revisit if it grows too large)
- Rewriting existing mode definitions
