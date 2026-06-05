# KANBAN — Ruflo Project

## DONE THIS SESSION (2026-06-05)

1. **#G core (declaration-gate + agree-loop, wired, verified):** declaration-gate.sh (NEW, PreToolUse Write|Edit) blocks first build until DECLARATION.json complete+fresh; hybrid-enforcement-gate.sh FULL_COUNCIL branch now requires user-rep AGREE + critic PASS (verdict-LINE anchored, 2 rework rounds then escalate). Space-in-path bug fixed in hybrid-gate AND enforcement-classifier.sh. Dog-fooded + critic R2 PASS confirmed. Wired in settings.json.
2. **MCP secrets externalization (.env + loader + ${VAR} + SECRETS.md, verified GitHub MCP post-restart):** ~/.claude/.env (4 tokens, labeled, gitignored) + load-claude-env.ps1 loader bridge + ${VAR} in settings.json + SECRETS.md convention doc. Tokens scrubbed from 30 .bak files. Verified: GitHub MCP loaded after restart.
3. **/remote-control fix:** removed CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 from settings.json env block (root cause documented: bundles Remote Control eligibility). Remote Control re-enabled.
4. **Journal infra (reflection-write-gate + issue-recall-gate + ISSUES_LOG + session-journal Mode 1b):** reflection-write-gate.sh (Stop+PreCompact, blocks until today's entry filled, date==today check); issue-recall-gate.sh (PreToolUse, blocks building on logged issue without ledger read); ISSUES_LOG.md created with first entries; session-journal skill Mode 1b (full-coverage+aggregation) added today.

- [DONE 2026-06-05] **#G4 -- Journal skill comprehensive-capture + aggregation:** session-journal Mode 1b (full structured entry + CUMULATIVE_LOG.md) built and confirmed this session.
- [DONE 2026-06-05] **#J -- PreCompact auto-journal:** new `autojournal-offload.sh` (extract signals → Hermes glm writes entry → deterministic skeleton fallback → atomic write) + PreCompact-only branch in `reflection-write-gate.sh`. /compact now auto-writes the journal instead of blocking+asking. Critic REWORK→4 fixes (outer timeout, atomic write, EVENT match, redirect)→PASS. End-council COMPLETE.
- [DONE 2026-06-05] **#K -- Quota+routing enforcement (Sal explicit, "do all"):** (1) `declaration-gate.sh` now REJECTS free-text `quota_checked` — requires a real `%` from usage_cache.json (tested: real%→exit0, "not measured"→exit2). No more quota theater. (2) CLAUDE.md quota-gated routing rule: session≥70%→offload mechanical/bulk to Hermes, reserve Opus for judgment. (3) CLAUDE.md Hermes goal/kanban offload pattern. (4) CLAUDE.md 177/200 lines + model-menu pointer (hermes-model-routing/model-registry/evaluate-models/{kimi,minimax}-planner). End-council to confirm.

---

## IN PROGRESS

### #H — Fix issue-recall-gate.sh false positive (2026-06-05, Sal explicit)
**Status:** DONE 2026-06-05 — both parts fixed + smoke tested (T1 false-pos→PASS/exit0, T2 real-tag→BLOCK/exit2, T3 ledger-read→exit0, T4 escape→exit0). End-council COMPLETE.
**Bug:** The hook treated the session-journal skill's TEMPLATE placeholder (`## ISSUE: <short-title> [tags: keyword1, keyword2, ...]` inside the Entry Format doc code-fence) as a REAL open issue, because its skip-logic only matched the exact strings "(example)" + "delete once real entries". Compounded by the hook scanning the ENTIRE transcript user text — so when session-journal skill loaded, its template body containing "keyword1" matched, triggering a false BLOCK on the journal write (blocked 2x before auto-unlock).
**Fix (2 parts):**
1. Skip ledger blocks whose title contains `<...>` angle-bracket placeholders + skip blocks with the literal `Status: OPEN | RECURRING | RESOLVED` template line + drop placeholder tags (keyword1/keyword2).
2. Scan only the LAST user message (the genuine current ask), not the whole accumulated transcript (which includes skill bodies + tool output).
**Files:** `~/.claude/hooks/issue-recall-gate.sh`
**Verify:** smoke test — false-positive case (keyword1 in transcript) must PASS; true-positive case (real issue tag in last user msg, no ledger read) must BLOCK.

### #F — Memory-ranker (intelligence-ranker.cjs) REWORK before promotion (end-council 2026-06-04)
**Status:** 3 of 5 mandatory fixes done (INSTALL_LOG run cmd, PageRank limitation doc, SessionStart hook wired). Fixes 2 (de-drift) + 3 (vocab-bridge) DEFERRED - touch claudecowork project.
**Mandatory fixes (architect + critic converged):**
1. **It's an ORPHAN** — no hook calls it -> zero value. Wire a SessionStart hook that runs `route "<topic>"` + injects top-3. (Biggest issue.)
2. **De-drift** — move the .cjs to ONE shared path `~/.claude/helpers/`, point both project configs there; delete project-local copies.
3. **vocab-bridge.json** (~20 plain-trade->Chimera-vocab pairs) for claudecowork — fixes the vocab gap WITHOUT rewriting memory.
4. **Fix INSTALL_LOG run command** — logs show `route "prompt"` (positional) but code reads stdin; correct to `echo '{"prompt":"..."}' | node ... route` + paste real output.
5. **Document limitation** — PageRank near-uniform at <50 nodes; composite score is effectively Jaccard-only at current corpus size (honest limit, not a bug).
**Promote global only after** both projects pass checklists. Files: `{ruflo,claudecowork}/.claude/helpers/intelligence-ranker.cjs` + both `INSTALL_LOG_memory-ranker.md`.

### #G — Orchestration-DECLARATION gate + end-council agree-loop (Sal explicit 2026-06-04) — DONE (core), pending restart to activate
**Why:** advisory text gets skipped (the session's core finding). The CLAUDE.md "HOW TO REASON" section + Rule 22/24 routing are toothless without a gate that checks QUALITY (mechanism declared) not PRESENCE (a spawn happened).
**Build status (2026-06-05):**
1. **Declaration gate** — DONE. `~/.claude/hooks/declaration-gate.sh`. PreToolUse Write|Edit, structure-trigger (reuses enforcement-classifier is_meaningful on file_path, NOT keywords). Blocks first meaningful build until `~/.claude/orchestration-records/DECLARATION.json` is fresh (mtime>=last-user-msg, 6h-resumed-session fallback) + complete (mechanism+num_agents+agents[].model+quota_checked+alternatives_rejected). Per-event escape ("skip declaration"/"override"), MAXBLOCKS=3 auto-unlock, settings.json skipped (bootstrap fix), subagent-immune. WIRED into settings.json (index 3, Write|Edit). Backup: `.bak-20260604-225942`.
2. **End-council agree-loop** — DONE. `~/.claude/hooks/hybrid-enforcement-gate.sh` FULL_COUNCIL branch now requires user-rep AGREE + critic PASS (verdict-LINE anchored, not body-keyword), 2 rework rounds then ESCALATE+auto-unlock. Also fixed: space-in-path bug in hybrid-gate AND `enforcement-classifier.sh` (whole gate was non-functional on ruflo's spaced paths). Backups: `.bak-agreeloop-20260604`.
**Proof:** dog-fooded (DECLARATION.json written before building). Agree-loop CAUGHT 6 real defects in its own build (R1 REWORK), all fixed + critic R2 **PASS** with independent command output. Live-smoked as-wired.
**ACTIVATION:** restart Claude Code so declaration-gate loads (hybrid-gate edits are in-place, live now).

### #G3 — Rip keyword-matching out of routing/model hooks — DONE 2026-06-05
**Finding (evidence-based):** the feared "9 keyword-matching hooks" was an OVERESTIMATE. Grep proved the keyword-intent-classification "disease" (scanning user prose for `build`/`design`/`implement`) existed in **only `routing-gate.sh`** (`build_kw` tuple, line 139). The other named suspects were already structural: `agent-model-required.sh` triggers on `tool_name`, `delegation-enforce-gate.sh` on `tool_name in {Agent,Task}` + `tool_response`. Most `case "$LAST_USER"` hits across hooks were legitimate ESCAPE-phrase matching (override/skip), not intent classification.
**Fixed:** `routing-gate.sh` (was DEAD/unwired — superseded by hybrid-enforcement-gate.sh, but kept the bad pattern + a bug):
1. Replaced `build_kw` prose-keyword scan with a STRUCTURE trigger — delegates to `enforcement-classifier.sh` (single source of truth, artifact-based); skips if decision==NONE.
2. BONUS bug fix: killed the session-wide escape-flag (one "override" disarmed the gate for the whole session — same bug #E fixed elsewhere); now per-event only.
**Verify:** smoke tested — T1 no-artifact→exit 0, T2 artifact+no-spawns→exit 2, T3 escape→exit 0 + no persistent flag. Syntax OK.
**Also this turn — council retiering (Sal explicit: use council sparingly):** `enforcement-classifier.sh` FULL_COUNCIL trigger narrowed from "any hooks/agents/skills/routing file" to ENFORCEMENT-MUSCLE only (`*-gate.sh`, `*enforce*`, `*classifier*`, `/enforcement/`, settings.json + explicit MUSCLE_BASENAMES for off-pattern blocking gates). Everything else → single scoped FILE_CRITIC. Reviewers now told to read ONLY the diff (hybrid-gate messages + user-rep spec). 7-case smoke PASS; critic caught + fixed a 4-gate gap.

## BACKLOG (priority order)

### #L — Consolidate 13 model-routing skills (deferred from #K, 2026-06-05)
**Why:** there are 13 overlapping model skills (claude-code-model-router, hermes-model-routing, hermes-model-planner, model-cost-planner, model-registry, evaluate-models, kimi/minimax/opencowork-model-planner, trading-model-routing, etc.) — bloat + drift risk. **Deferred not done:** deleting/merging skills mid-session risks breaking references (Rule: don't gut working artifacts in a rushed pass). **Approach:** audit which are actually invoked (skill-performance log), pick ONE canonical router + ONE registry, merge the rest into references, update inbound pointers, test. Per-skill, not a rushed batch.

### #A — Rule 26b BLOCKING quality-gate hook (Tier 6) — **REWORK before wiring (2026-05-26 critic verdict)**
**Status:** built at `_staging/skill-quality-gate.sh`, NOT wired. Critic found 3 critical/high issues:
1. **Bash evasion** — hook fires on Write/Edit/MultiEdit only. Must add PostToolUse Bash hook that greps command for `> ~/.claude/skills/` redirects, OR document the gap in script header. (New Mode 39 captures this pattern.)
2. **Cold-start fail-closed** — first session of any new day has no trace → both gates fail → block. Fix: grace-period (<5 min old trace) OR document the cold-start block as intentional.
3. **Gate ② trivially satisfied** — searches `"name":"Skill"` OR skill-name. Remove the OR branch; require THIS skill name specifically.
4. (Lower priority) Expand jargon list with: `lifecycle|enforcer|refiner|analy[sz]|processor|handler|manager` per Sal's own audit.
**Rework effort:** ~2 hr. New smoke set MUST include Bash-path evasion test (per Mode 39).
**Original spec below preserved:**
**What:** PreToolUse hook on `Write|Edit` to `~/.claude/skills/*/SKILL.md`. Intercepts skill-file writes. Greps recent trace for evidence of all 7 Rule 26b gates (smoke test, critic spawn, rollback line, registry update, etc.). Exit 2 if any missing.
**Why:** Today Rule 26b is T1 advisory — I shipped 4 skills this session without running the 7 gates BEFORE. Blocking hook fixes that.
**Effort:** ~2 hr
**Files:** new `~/.claude/hooks/skill-quality-gate.sh` + settings.json `PreToolUse` entry + add jargon-name check (rejects `scaffold|orchestrate|bootstrap|dispatcher|transducer`).
**Smoke test:** try to create a test skill named `foo-orchestrator` → hook should block with clear error.
**Rollback:** `rm ~/.claude/hooks/skill-quality-gate.sh` + remove settings.json entry.

### #B — Routing-agent-as-hook prototype (UserPromptSubmit)
**What:** On UserPromptSubmit, IF prompt is non-trivial AND no clear skill match, spawn a haiku-tier agent that reads the prompt + skill catalog descriptions + returns the top-3 most-relevant skill names. Inject as system-reminder. Claude then picks.
**Why:** You have 200+ skills. Description-matching by Claude alone misses ~20% of triggers. A cheap routing agent on UPS could close that gap.
**Effort:** ~3 hr (hook + agent prompt + cost-cap logic)
**Token math:** routing agent ≈ 3K tokens/call. If fires on 30% of prompts (cheap classifier in bash gates first) → ~5% weekly quota burn. Tunable.
**Files:** new `~/.claude/hooks/skill-router-agent.sh` (bash classifier — only spawns agent if NL-match looks uncertain), settings.json `UserPromptSubmit` entry, prompt template.
**Smoke test:** type a vague ask ("help with the trading thing") → hook should spawn agent → agent returns 3 skill suggestions → Claude picks one.
**Rollback:** disable hook in settings.json (advisory-first, then enable).

### #C — Fix all 34 jargon-flagged skill names (from 2026-05-26 audit)
**What:** Rename per `shared/learnings/general/topics/skill-naming-audit-2026-05-26.md`. Apply Naming Convention in STANDARD.md.
**Effort:** ~2 hr (34 renames × ~3 min for mv + inbound grep + edits)
**Risk:** Low — skills are called by description match in NL, not hardcoded. Inbound refs in CLAUDE.md, other skills, docs need updating.
**Approach:** Do in 3 batches by domain prefix to keep changes scoped.

### #D — Hook hygiene cleanup (after registry build returns)
**What:** Remove 10+ `.bak` files from `~/.claude/hooks/`. Resolve naming drift (`research-capture.sh` vs `research_capture.sh`). Decide if `user-prompt-submit-enhanced.sh` is replacement for `user-prompt-submit.sh` or dead code.
**Effort:** ~30 min once registry shows what's wired.

### #1 — Fix `github-project-deep-dive` skill to honor `CLAUDE_PROJECT_DIR`
**Why first:** when this project is opened, the skill still writes to `~/claudecowork/research/...` (hardcoded). Should write to `../../shared/learnings/research/...` relative to project root.
**Effort:** ~30 min
**File:** `~/.claude/skills/github-project-deep-dive/SKILL.md` — Phase 1 categorize + Phase 3 synthesize

### #2 — Port intelligence.cjs (memory ranker) — DONE (project-local), PROMOTE-TO-GLOBAL PENDING
**Status (2026-06-04):** Ported as config-driven `intelligence-ranker.cjs` + per-project `intelligence.config.json`. Installed + TESTED in BOTH ruflo (20 nodes) and trading/claudecowork (68 nodes). Design = code-global/data-local. NOT wired to hooks yet (on-demand only). Living docs: `INSTALL_LOG_memory-ranker.md` in each project.
**Verified:** ruflo query "workflows" -> WORKFLOWS.md ranked #1 (0.18). trading query "current setup+tasks" -> relevant KANBAN/MEMORY headings. Weak on coin-specific prompts (memory vocab mismatch — see trading INSTALL_LOG success criterion #4).
**Skill created:** `install-document-evaluate` (global) governs this lifecycle.

### #2b — REMINDER: promote memory-ranker to GLOBAL after test window (REVIEW BY 2026-06-18)
**Trigger:** after ~2 weeks of project-local use. Gate (from INSTALL_LOG promotion checklist): (a) passes success criteria in BOTH projects, (b) hook-wiring tested, (c) no false-block incidents, (d) Sal sign-off.
**To promote:** move `intelligence-ranker.cjs` to `~/.claude/helpers/`, keep per-project `intelligence.config.json` + data local, wire UserPromptSubmit hook globally.
**Run:** invoke `install-document-evaluate` skill -> decision gate -> ai-stupidity-critic on the keep/promote/kill call BEFORE acting.
**Rollback (per project):** `rm -rf "<project>/.claude/helpers/intelligence-ranker.cjs" "<project>/.claude/intelligence.config.json" "<project>/.claude/intelligence/"`

### #3 — A/B test PageRank ranker vs smart-router patterns.md
**Follows #2b.** Once hooks wired, run both for 1 day, compare which patterns surface, decide permanent adoption.

### #4 — Adapt dossier-investigator to Chimera tools
**What:** Strip `mcp__claude-flow__*` refs from the YAML, replace with Notion/GitHub/Grep/WebSearch toolset.
**Source file:** `~/.claude/plugins/cache/ruflo/ruflo-goals/0.2.0/agents/dossier-investigator.md`
**Effort:** [UNANCHORED 2-4h]

### #5 — Add Ollama local-only lane to external-cli-offload
**Quick win.** Free quota for mundane scans.
**Effort:** ~30 min (assuming ollama installable on Linux PC)
**File:** `~/.claude/skills/external-cli-offload/SKILL.md`

### #6 — Add `_comment_<field>` to `~/.claude/settings.json` non-obvious values
**What:** Self-documenting config pattern from Ruflo. Apply to: defaultMode, worktreeEnabled, MCP server flags, hook timeouts.
**Effort:** [UNANCHORED ~2-3h for ~50 values]

### #7 — Decide: keep all 14 Ruflo plugins or trim
**Cost:** +3148 tok/session always-on. Real numbers via `claude plugin details`.
**Candidates for first cuts:** cost-tracker (576 tok), graph-intelligence (0 tok suggests packaging bug)
**Effort:** 5 min decision

## DEFERRED

### chimera-plugin-builder
**Why deferred:** Sal doesn't currently publish or distribute plugins. Build when there's a shipping need.

## DONE

- [x] **2026-05-24** Ruflo comprehensive deep-dive — 4 MDs + 14 plugins + 2 skills + 2 failure modes + Rule 22 + Notion mirror
- [x] **2026-05-25** Project scaffolded in correct location (`Ai workspaces/claude/ruflo/`) after initial mis-location in learnings/
- [x] **2026-06-02** github-project-deep-dive skill upgraded: standardized paths (raw/github/frameworks/), topics extraction (wiki/topics/), ingest.py indexing, parallel() thunk fix. Workflow at ~/.claude/workflows/github-deep-dive.workflow.js. Ruflo plugins re-enabled (were disabled — restart Claude Code to load).

- [DONE 2026-06-05] Enhanced global skill `coding-provider-config`: added `references/api-keys-and-testing.md` (key locations by name + verified provider/protocol matrix + per-protocol test recipes + any-platform setup + failure guard); broadened description + Core Rule 8. Critic PASS. Born from the Kimi wrong-endpoint deletion incident.
- [DONE 2026-06-05] #E Hybrid enforcement gate redesign - COMPLETE. Change 4: built irreversible-ops-gate.sh (exit-2 PreToolUse block for git push --force, rm -rf, DROP TABLE, live-trade commands). Wired Bash PreToolUse. Smoke tested.
- [DONE 2026-06-05] User-rep dual-mode: added CLARIFY mode (fires at task start, grills Sal via AskUserQuestion to 95% clarity). VERDICT mode (end gate) unchanged.
- [DONE 2026-06-05] KANBAN cleanup: removed 6 false-positive auto-captured tickets.


### #I — AI_FAILURE_MODES.md is drifted across 3 copies (NEEDS SAL DECISION, 2026-06-05)
**Problem:** Three copies exist, TWO both claim "Single source of truth":
- `claudecowork/.learnings/AI_FAILURE_MODES.md` -> last Mode 29 (THIS is what the ai-stupidity-critic agent reads)
- `Ai workspaces/claude/global/learnings/ai-failure-modes/AI_FAILURE_MODES.md` -> last Mode 64 (where Mode 63 FAIL_RE + 64 Deprecated-Copy were written this session)
- `Ai workspaces/shared/learnings/ai-failure-modes/AI_FAILURE_MODES.md` -> DEPRECATED/FROZEN, last Mode 63
**Impact:** new failure modes written to "canonical" global file are invisible to the critic agent (reads the Mode-29 copy). 35 modes of divergence.
**Needs Sal:** pick ONE canonical path; reconcile/merge the others; point the ai-stupidity-critic agent + all writers at it; delete or hard-freeze the rest. Do NOT auto-merge without sign-off (risk of losing modes).

**#I UPDATE (2026-06-05, Sal decided):** CANONICAL = `Ai workspaces/claude/global/learnings/ai-failure-modes/AI_FAILURE_MODES.md` (39 modes, under Sal's preferred location, NOT claudecowork). DONE: repointed ai-stupidity-critic agent (line 11) + CLAUDE.md (line 50) to canonical. Mode 63 (FAIL_RE) + 64 (Deprecated-Copy) already live there. REMAINING (safe, not blind-delete): audit `claudecowork/.learnings`(9 modes) + `shared/learnings`(25, deprecated) for any mode CONTENT not in canonical -> merge unique ones in -> then replace both with a one-line redirect stub. Different mode-number lineages, so compare by TITLE not number.

### #J — Cross-device agent coordination hub ("all agents work as one") — Sal 2026-06-05
**Hub:** `Ai workspaces/shared/coordination/` (decision: Sal). Messaging: git+live both (phased).
- **#J1 DONE:** foundation — README protocol + GLOBAL_KANBAN + AGENT_ACTIVITY.jsonl lane + DEVICE_REGISTRY + sync-hub.sh/log-activity.sh. Verified.
- **#J2 (next, needs Sal):** make `Ai workspaces/shared` a git repo + PRIVATE remote. GATE: run a secrets-scan FIRST (never push tokens — we just externalized secrets). Then wire sync-hub.sh to the remote.
- **#J3:** live device-to-device messaging (Hermes gateway / Discord MCP "doorbell") per DEVICE_REGISTRY.
- **#J4:** enforcement hooks — SessionStart pull-gate + Stop write-activity-lane gate + sub-agents read the lane (so the protocol is forced not optional).
**Reuses (Rule 19):** github-manager, session-handoff-prep, skill-sync, platform-update-promoter, multi-platform-agent-spawner, shared-context-and-research.

### auto-captured-20260605T164045
- **Status:** pending
- **Created:** 2026-06-05T16:40:45Z (auto-captured by task-capture-from-prompt.sh hook v2)
- **Source:** user prompt at 2026-06-05T16:40:45Z
- **Explicit markers (high confidence):**
  - need to make sure we re always ud
- **Action:** review on next session start; promote to a real ticket or delete if false-positive

**#J2 DONE (2026-06-05):** ai-coordination PRIVATE repo created (github.com/saloomad/ai-coordination), Ai workspaces/shared pushed (2801 files, secrets-scan VERIFIED clean), sync-hub.sh now live against remote, inbox/ seeded, AGENT_GUIDE.md written. Next: #J3 per-device sync cron + doorbell.
