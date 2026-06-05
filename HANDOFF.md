# HANDOFF -- resume point (2026-06-04, session c4bbe3ae, ruflo)

## FIRST ACTION NEXT SESSION (do this before anything)
```
grep -iA15 "orchestration-enforcement\|when-stuck" ~/.claude/journal/ISSUES_LOG.md
```
This is the anti-repeat memory. Read what was already tried so you do NOT re-diagnose from zero.
Then: **restart Claude Code** so the new hooks load.

## WHAT THIS SESSION DID (shipped + tested)
- **Hook enforcement rebuilt:** one blast-radius Stop gate (`hybrid-enforcement-gate.sh` + `enforcement-classifier.sh`) replaced 4 overlapping gates (NONE / FILE_CRITIC / FULL_COUNCIL). Re-armed `orchestration-start-gate.sh` + `delegation-enforce-gate.sh` as HARD blocks (exit 2) with ARTIFACT-based triggers (read `tool_input.file_path`, not keywords). Escape fixed: per-event, no session-wide disarm.
- **Issue-memory + reflection:** `~/.claude/journal/ISSUES_LOG.md` (grep-first recurring-problem ledger) + `reflection-write-gate.sh` + `issue-recall-gate.sh` + enhanced `session-journal` skill + CLAUDE.md **Rule 34**.
- **CLAUDE.md HOW TO REASON section** (advisory until #G ships).
- **Saved concept:** shared-DB agent coordination -> `shared/learnings/research/topics/cross-cutting/agent-coordination/mcp-shared-memory-coordination.md`. Session learnings -> `shared/learnings/ai-claude/` + `ai-agents/` + AI_FAILURE_MODES Mode 59/60.
- **Other session:** ported memory-ranker (`intelligence-ranker.cjs`) to ruflo + claudecowork + built `install-document-evaluate` skill. End-council found it's an ORPHAN.

## ROOT CAUSE ALREADY FOUND (do not re-research)
Enforcement gates measured PRESENCE ("did a spawn happen?") not QUALITY (right mechanism/models/quota/reasoning) -> one sequential Sonnet agent satisfied every gate -> agent always did the least. AND keyword-matching on free text is the disease (false-fires + misses). Fix = structure-based triggers + a required orchestration DECLARATION artifact. Full detail in ISSUES_LOG.md.

## PENDING WORK (KANBAN, priority order)
- **#G (BIG ONE, do first):** orchestration-DECLARATION gate (PreToolUse, structure-based) that blocks first build action until trace has `MECHANISM + #agents + model-per-agent + quota + alternatives-rejected`; + end-council AGREE-LOOP (user-rep + critic, 1-2 fix-rounds, complete only on agreement); + rip keyword-matching out of model/routing hooks. THIS makes the HOW TO REASON section + all routing actually bite.
- **#F:** memory-ranker is UNUSED (no hook calls it) -> wire a SessionStart hook + move .cjs to ONE shared `~/.claude/helpers/` (kill drift) + `vocab-bridge.json` for trading. INSTALL_LOG run-command was fixed this session.
- **#E slice 4:** hard PreToolUse gate for irreversible ops (git push / rm / live trades / money).
- **Adopt-lite shared SQLite memory** (decision pending) -- fixes concurrent JOURNAL/ISSUES_LOG corruption when 2 sessions run + enables coordination.
- CLAUDE.md drifted to ~174 lines (target 150) -- trim next session.

## KEY FILES
- Enforcement: `~/.claude/hooks/{hybrid-enforcement-gate,enforcement-classifier,orchestration-start-gate,delegation-enforce-gate,reflection-write-gate,issue-recall-gate}.sh`
- Memory: `~/.claude/journal/{ISSUES_LOG,JOURNAL}.md`
- Global: `~/CLAUDE.md` (Rule 34 + HOW TO REASON)
- Project: `ruflo/{PROJECT_LOG,KANBAN}.md`, both `INSTALL_LOG_memory-ranker.md`
- Backups: `~/.claude/_enforcement-redesign-backup-*`, `_gate-derigidify-backup-*`, `_gate-rearm-backup-*` (2026-06-04)

## BIG LESSON
I burned ~600k tokens partly because the orchestration discipline I was building was not yet in force. Next time: declare mechanism + delegate at task START; grep ISSUES_LOG before re-attempting; don't grind in a degraded session.
