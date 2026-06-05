# RUFLO — Project Identity

**Project purpose:** Testbed + durable home for Ruflo (claude-flow) evaluation and follow-on work. First test case for the `github-project-deep-dive` workflow.

**Project root:** `C:\Users\becke\Ai workspaces\claude\ruflo\`
**Learning outputs:** `C:\Users\becke\Ai workspaces\shared\learnings\research\` (separate dir — pure outputs, no project shell)
**Peer projects:** `../computer Management/`, `../trading/` (siblings under `Ai workspaces/claude/`)

---

## 🎯 Layout

| Here (`ruflo/`) | Output (`../../shared/learnings/research/`) |
|---|---|
| CLAUDE.md (this file) | github/frameworks/ — Ruflo deep-dive MDs |
| KANBAN.md | topics/cross-cutting/ — extracted learnings by topic |
| CONTINUATION.md | INDEX.md + LEARNINGS_INDEX.md |
| WORKFLOWS.md | |
| .claude/ (project-local skills/agents — empty for now) | |
| handoffs/, session-states/ | |

---

## 🚨 SESSION START

1. Read this CLAUDE.md
2. Read `KANBAN.md` for active slices
3. Read `CONTINUATION.md` for last session state
4. Use global skills from `~/.claude/skills/` — `github-project-deep-dive`, `research-build-test-iterate-decision`, etc.
5. **Heads up:** when this project opens, both global `~/CLAUDE.md` AND this file load. Token cost stacks.

---

## 📁 Where to read existing Ruflo work

- Comprehensive deep-dive: `../../shared/learnings/research/github/frameworks/ruflo-2026-05-24.md`
- Design patterns extracted: `../../shared/learnings/research/github/frameworks/ruflo-design-patterns-2026-05-24.md`
- Raw extraction notes: `../../shared/learnings/research/github/frameworks/ruflo-extraction-raw-2026-05-24.md`
- Topic learnings (PageRank ranker, dossier pattern, capability=bundle): `../../shared/learnings/research/topics/cross-cutting/{memory-systems,agent-governance}/insights.md`
- Sandbox install: `~/ruflo-sandbox/` (2 MB)
- Source clone: `~/ruflo-source-readonly/` (94 MB)
- 14 plugins installed user-global: `claude plugin list | grep @ruflo`

---

## 🚦 House rules for this project

1. **Output goes to `../../shared/learnings/research/`** — never to this `ruflo/` dir
2. **Always clone before installing** — per global CLAUDE.md Rule 22
3. **Measure plugin cost via `claude plugin details` before deciding to keep**
4. **Run `ai-stupidity-critic` on every adoption recommendation**
5. **One slice at a time** — don't try to port intelligence.cjs AND adapt dossier-investigator in the same session

---

## 🔗 Cross-project references

- Global Claude config: `~/.claude/` (always loads)
- Sister project Chimera trading: `~/claudecowork/` (live work)
- Failure mode KB: `~/claudecowork/.learnings/AI_FAILURE_MODES.md`
- Global Rule 22 (capability=bundle pattern, came from Ruflo work): `~/CLAUDE.md`

*Created 2026-05-25. First slice: fix `github-project-deep-dive` skill so it honors `CLAUDE_PROJECT_DIR` and writes output to this project's expected location.*
