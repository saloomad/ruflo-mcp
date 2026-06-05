# WORKFLOWS — Ruflo Project

Workflows used here. Skills live in `~/.claude/skills/` (user-global) unless noted.

---

## github-project-deep-dive

**Skill:** `~/.claude/skills/github-project-deep-dive/SKILL.md`
**Trigger:** any github.com URL, "analyze this repo", "research X", "what does Y do", "should we use Z"
**Output (per skill spec):** `research/github/<category>/<repo>-YYYY-MM-DD.md` — currently hardcoded under `~/claudecowork/`. **Needs fix to honor `CLAUDE_PROJECT_DIR`** so opening from this project writes to `../../shared/learnings/research/github/...` instead. (Tracked in KANBAN slice #1.)

**Phases:** Categorize → Clone-first → Parallel research swarm → Synthesize MD → Extract topic learnings → Notion mirror → ai-stupidity-critic on adoption section → Adoption report

**Companion:** `research-build-test-iterate-decision`

---

## research-build-test-iterate-decision

**Skill:** `~/.claude/skills/research-build-test-iterate-decision/SKILL.md`
**Trigger:** "should we add X", "where does this live", "skill or hook", any pattern-adoption decision
**5 phases:** RESEARCH → BUILD (smallest version) → TEST → ITERATE (critic) → IMPLEMENT (Q1-Q9 placement tree + Phase 5b bundle considerations)

---

## Test case results

**Ruflo deep-dive (2026-05-24)** — first test of `github-project-deep-dive`:
- ✅ All 6 phases executed
- ✅ Comprehensive MD: `../../shared/learnings/research/github/frameworks/ruflo-2026-05-24.md` (21 KB, 10 sections)
- ✅ Raw extraction + design-patterns extraction alongside
- ✅ Topic learnings extracted to cross-cutting/{memory-systems,agent-governance}/
- ✅ Notion mirror created
- ✅ Critic ran — 7 findings, 5 addressed
- ⚠️ Skill output path hardcoded to chimera — needs fix (KANBAN slice #1)

---

## Future workflows (queued)

- `intelligence-cjs-port` (when porting intelligence.cjs + auto-memory-hook)
- `plugin-bundle-builder` (deferred, only if Sal wants to ship Chimera as plugin)
