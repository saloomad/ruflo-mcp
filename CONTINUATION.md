# CONTINUATION — Ruflo Project

**Last update:** 2026-05-25
**Last session:** Project scaffolded + moved into correct location (peer to computer Management/ and trading/).

## Where things stand

- Project lives at `C:\Users\becke\Ai workspaces\claude\ruflo\`
- Learning outputs at `C:\Users\becke\Ai workspaces\shared\learnings\research\` (separate from project shell)
- Ruflo deep-dive done 2026-05-24 — comprehensive + raw + design-patterns MDs all in `../../shared/learnings/research/github/frameworks/`
- 14 Ruflo plugins installed user-global (~3148 tok/session) — see `claude plugin list | grep @ruflo`
- Sandbox at `~/ruflo-sandbox/`, source clone at `~/ruflo-source-readonly/`
- 2 new global skills (in `~/.claude/skills/`): `github-project-deep-dive` + `research-build-test-iterate-decision`
- 2 new failure modes in `~/claudecowork/.learnings/AI_FAILURE_MODES.md` (#24, #25)
- Global CLAUDE.md Rule 22 added (capability=bundle pattern)
- Notion mirror in "Research Skills / GitHub" database

## Next session start

1. Read this file
2. Read `KANBAN.md` — pick from BACKLOG
3. First slice: fix `github-project-deep-dive` skill to honor `CLAUDE_PROJECT_DIR` — currently hardcodes `~/claudecowork/` paths

## Open decisions

1. **Skill path override:** `github-project-deep-dive` hardcodes `~/claudecowork/research/...`. When opened from THIS project, should it write to `../../shared/learnings/research/...` instead? Suggestion: detect `CLAUDE_PROJECT_DIR` env var and write relative to it.
2. **Keep all 14 Ruflo plugins?** Cost is +3148 tok/session. Consider disabling cost-tracker (576 tok) and graph-intelligence (0 tok — packaging issue) first.
3. **Port priority:** intelligence.cjs (4-8h, #1 value) vs dossier-investigator adapt (2-4h) vs Ollama lane (30min, quick win)

## Cross-platform state

| Platform | State |
|---|---|
| Windows (this machine) | Project + plugins + sandbox + clone all present |
| Linux PC | Not synced — could GitHub-mirror if cross-machine needed |
| Kimi VPS | Not synced |
