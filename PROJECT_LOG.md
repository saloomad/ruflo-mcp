# RUFLO PROJECT LOG -- living doc (keep adding)

Purpose: a running narrative of what we are building/learning/deciding in this project.
Distinct from: KANBAN.md (task board) and the install log (what was installed + tested).
Newest at top. Anyone (any session) appends; do NOT delete history.

---

## 2026-06-04 -- Enforcement redesign, issue-memory, coordination concept

### What we built / decided
- **Hybrid enforcement gate** (blast-radius: NONE / FILE_CRITIC / FULL_COUNCIL) replacing 4 overlapping Stop gates. Critic fires on real file writes; full council only on Claude-mods / build-finalization / planned-orchestration.
- **Re-armed orchestration + delegation gates as HARD blocks** (Sal: "FORCE it, not advisory") with ARTIFACT-BASED triggers (read tool_input.file_path, NOT user-text keywords). Hardened: fail-closed on missing transcript, default-armed if python3 fails, exact subagent_type match.
- **Issue-memory + reflection system**: ISSUES_LOG.md (grep-first recurring-problem ledger) + reflection-write-gate + issue-recall-gate + enhanced session-journal skill + CLAUDE.md Rule 34.

### Key learnings (full writeups in shared/learnings/)
1. **Keyword-matching is the disease.** Hooks classifying by words in free text false-fire ("analysis" blocked Haiku; "install"/"hybrid" missed; "hook"/"gate" matched everything). FIX: trigger on STRUCTURE (file_path, subagent_type, real action), never words.
2. **Gates must measure QUALITY not PRESENCE.** "Did a spawn happen?" is satisfied by one sequential Sonnet agent -> minimum-compliance == full-compliance -> agent always does the least. FIX: require a printed orchestration declaration + gate on THAT artifact.
3. **Orchestration shape must match task structure** (single / chain / parallel / orchestrator-workers / evaluator-optimizer); assign model tier PER node (Haiku=fetch, Sonnet=synthesis). Default-to-one-Sonnet is the failure.
4. **Anti-repeat memory** (Reflexion/ReasoningBank): distill failures, inject next session. Same-model generator-critic is cargo-cult.
5. **Hook organization** (claude-flow comparison): our 64 loose bash scripts have no registry / central log / debug harness -> undebuggable. Steal those three; skip claude-flow's runtime.

### Concept saved for reuse: shared-memory agent coordination
- claude-flow coordinates agents via a shared SQLite DB (`.swarm/memory.db`) + MCP; hooks auto-write namespaced keys; agents read each other's state.
- Recommendation: **ADOPT-LITE** -- a plain shared SQLite (WAL mode), no runtime. Would also fix concurrent-write corruption of JOURNAL/ISSUES_LOG when multiple sessions run.
- Full concept: `shared/learnings/research/topics/cross-cutting/agent-coordination/mcp-shared-memory-coordination.md`

### Open / next
- [ ] Hook registry + central log (`~/.claude/logs/hooks-<date>.log`) + validate/--debug harness -- the debuggability fix.
- [ ] Orchestration-QUALITY gate: replace presence-checks with a required orchestration-declaration artifact; rip keyword-matching out of model/routing hooks.
- [ ] ADOPT-LITE shared SQLite memory (decision pending) -- would fix concurrent-write corruption + enable agent coordination.
- [ ] Enforcement Change 4: hard PreToolUse gate for irreversible ops (git push / rm / live trades / money).
- [ ] Restart Claude Code to load all new hooks.
- [ ] (Other session) memory-ranker port + install-document-evaluate skill + install log -- do NOT duplicate here.

### Cost note
- This session ran very expensive (~600k+ tokens, 18+ agent spawns) partly BECAUSE the orchestration discipline being built was not yet in force. Future: declare mechanism + delegate at START; offload bulk research to Hermes when quota >65%.

---
