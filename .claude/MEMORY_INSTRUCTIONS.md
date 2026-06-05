# RuFlo Memory Instructions
# One-page card for every agent. Read this before operating in any session that has access to ruflo memory.

## When to STORE

Store after EVERY:
- Mistake or near-miss (immediately, before continuing)
- Build decision with rationale (why this approach, not another)
- Trade outcome with lesson (win or loss, with ticker and context)
- Session end (summary of what was built/decided/learned)
- Recurring error and its verified fix

## When to QUERY

Query BEFORE:
- Starting any non-trivial task: check namespace=mistakes for the task topic
- Repeating a task you have done before: check sessions + mistakes
- Making an architecture decision: check namespace=build + arch
- Making a trading decision: check namespace=trading + mistakes

Query AT:
- Session start (automated via memory-ranker-inject.sh if wired)
- Any time you are about to do something that feels risky or familiar

## Namespace Decision Table

| What you are storing | Namespace to use |
|---------------------|-----------------|
| Trade decision, missed setup, market lesson | trading |
| Why you chose this architecture / tool | build |
| Error + exact fix command | debug |
| Agent mistake, wrong claim, violated rule | mistakes |
| End-of-session summary | sessions |
| Platform topology, IP addresses, access paths | arch |
| Project requirement, constraint, spec | spec |

## What NOT to Store

- Raw price data (OHLCV, ticks, live quotes)
- Full stack traces or log dumps (extract the lesson only)
- Every assistant turn or response
- Transient state (open files, current task queue)
- Raw API JSON blobs
- Anything with effective TTL under 1 hour

## Exact MCP Tool Names (Claude Code)

When the ruflo MCP server is connected, these tools are available:
  mcp__ruflo__memory__store
  mcp__ruflo__memory__search
  mcp__ruflo__memory__retrieve
  mcp__ruflo__memory__list
  mcp__ruflo__memory__stats

## Exact CLI Commands

Set DB path first:
  Windows: $env:CLAUDE_FLOW_DB_PATH = "C:\Users\becke\Ai workspaces\claude\ruflo\.claude\memory.db"
  Linux:   export CLAUDE_FLOW_DB_PATH="/path/to/ruflo/.claude/memory.db"

Store a mistake (most important pattern):
  npx ruflo memory store -k "mistakes/<category>/<slug>-$(date +%Y%m%d)" --value "MISTAKE: ... ROOT CAUSE: ... FIX: ... RULE: ..." -n mistakes --vector --tags "mistake,<category>,hard-rule" --upsert

Query before a task:
  npx ruflo memory search -q "<task topic>" -n mistakes -l 5 --smart

Store a session summary:
  npx ruflo memory store -k "sessions/$(date +%Y%m%d)/<slug>" --value "<summary>" -n sessions --vector --tags "session" --upsert

## Server Commands

Start:   npx ruflo start --port 3000
Daemon:  npx ruflo start --port 3000 --daemon
Health:  Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing  (Windows)
         curl http://localhost:3000/health  (Linux)

If session-start memory injection is missing: server is down. Run start command above.

## Hard Rule for Every Agent

Entries tagged "hard-rule" retrieved from the mistakes namespace = ABSOLUTE CONSTRAINTS.
Do not override, rationalize around, or ignore them during the session.
If you violate one: store a recurrence entry immediately.

Full reference: docs/MEMORY_GUIDE.md
