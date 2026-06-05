# Orchestration Debug Report

**Date:** 2026-06-03
**Issue:** Orchestration hooks not firing, agent did Ruflo install + exploration in main loop instead of delegating

---

## Root Cause #1: Shell Hooks Not Registered

**Symptom:** `hermes hooks list` shows "No shell hooks configured"
**Diagnosis:** `hooks: {}` in `config.yaml` (empty block)
**Impact:** All shell hook files (`.sh`) in `~/.hermes/hooks/` are dead code

### Evidence

```bash
$ hermes hooks list
No shell hooks configured in ~/.hermes/config.yaml.
```

### Files Affected (3 dead hooks)

| File | Purpose | Should Fire On |
|---|---|---|
| `delegate_task_model_enforce.sh` | Block spawns without model= param | pre_tool_call:delegate_task |
| `adaptive-delegation-sync.sh` | Sync delegation before spawn | pre_tool_call:delegate_task |
| `orchestration-enforce.sh` | Nudge to delegate | (advisory) |

### Fix

Add to `config.yaml`:
```yaml
hooks:
  pre_tool_call:
    - command: "~/.hermes/hooks/delegate_task_model_enforce.sh"
      matcher: "delegate_task"
      timeout: 5
    - command: "~/.hermes/hooks/adaptive-delegation-sync.sh"
      matcher: "delegate_task"
      timeout: 10
```

---

## Root Cause #2: Three Hook Systems, Confusing Docs

Hermes has THREE separate hook systems:

1. **Plugin Hooks** (Python) — `~/.hermes/plugins/<name>/register(ctx)` with `pre_tool_call`, `post_tool_call`, `pre_llm_call`, `post_llm_call`, `on_session_*`
2. **Plugin Python Hooks** — `~/.hermes/hooks/<name>/HOOK.yaml + handler.py`
3. **Shell Script Hooks** — `hooks:` block in `config.yaml` pointing at `.sh` files

### Evidence

```bash
$ ls ~/.hermes/hooks/
adaptive-delegation-sync.sh          # Shell hook (WRONG format for plugin)
delegate_task_model_enforce.sh       # Shell hook (WRONG format)
model-routing-enforcer/              # Plugin format (CORRECT)
├── HOOK.yaml
└── handler.py
orchestration-enforce.sh              # Shell hook (WRONG format)
post-action-logger/                   # Plugin format (CORRECT)
├── HOOK.yaml
└── handler.py
self-introspection-guard/             # Plugin format (CORRECT)
session-continuity-gateway/           # Plugin format (CORRECT)
```

**4 out of 8 hook directories have the right format. 3 .sh files are in wrong format and never fire.**

---

## Root Cause #3: No "search before build" enforcement

I created a new `.sh` hook instead of converting it to a plugin or registering it properly. SOUL.md says to "search before build" but the rule is advisory — not enforced by hooks.

---

## Fix Plan

### Immediate (Do Now)

1. Register the 3 shell hooks in `config.yaml`:
   ```yaml
   hooks:
     pre_tool_call:
       - command: "~/.hermes/hooks/delegate_task_model_enforce.sh"
         matcher: "delegate_task"
         timeout: 5
       - command: "~/.hermes/hooks/adaptive-delegation-sync.sh"
         matcher: "delegate_task"
         timeout: 10
   ```

2. Restart gateway: `hermes gateway restart`

3. Verify: `hermes hooks list` should now show 2 hooks

### Long-term (Prevent Recurrence)

1. Add SOUL.md rule: "Any hook file must be registered in config.yaml or use HOOK.yaml format"
2. Create a hook-doctor skill that runs `hermes hooks doctor` on every session start
3. When creating new hooks, verify with `hermes hooks test <event>` before claiming done

---

## Test: Did Delegation Work in Last Ruflo Task?

**Answer: NO. Did everything in main loop.**

Main agent (M3) did:
1. `npm install ruflo@latest` (terminal call, ~50s)
2. `find node_modules/@claude-flow` (terminal call, multiple)
3. `cat node_modules/@claude-flow/cli/.claude/agents/core/planner.md` (read_file, 374 lines)
4. Counted agents/skills/commands (terminal calls)
5. Made recommendations (main loop reasoning)

**Should have:** Spawned 3-4 sub-agents (M2.7) in parallel for install + exploration + analysis.

**Why didn't I:** Hooks were dead. SOUL.md rule was advisory. No enforcement mechanism.
