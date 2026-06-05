# RuFlo Memory System Guide
# Primary reader: AI agents. Purpose: exact reference for storing, querying, and maintaining shared memory across all platforms.

## 1. What Is This System

RuFlo v3.10.37 (Claude Flow V3 fork) provides a persistent, shared memory layer built on three stacked stores: a SQLite/AgentDB for raw key-value and vector storage, an HNSW index for high-speed semantic similarity search (150x-12,500x speedup over brute-force), and a neural/SONA layer for pattern learning and SmartRetrieval (query expansion, RRF fusion, MMR diversity, recency weighting). All agents on all platforms (Claude Code Windows, Hermes, OpenClaw Linux VPS) write to and read from the same memory pool via the MCP server, ensuring zero knowledge duplication and full cross-session recall.

---

## 2. Architecture

```
Agents (any platform)
        |
        v
  MCP Server (:3000, default)     <-- single entry point for all read/write
        |
        +---> SQLite (AgentDB)    <-- raw storage: key/value, namespace, tags, TTL, vectors
        |         DB at CLAUDE_FLOW_DB_PATH or ./.swarm/memory.db
        |
        +---> HNSW Index          <-- semantic vector search (cosine, 150x-12500x speedup)
        |         rebuilt with: ruflo memory search --build-hnsw
        |
        +---> Neural/SONA Layer   <-- SmartRetrieval: query expansion, RRF, MMR, recency
        |         activated with: ruflo memory search --smart
        |
        +---> Pattern Learning    <-- learns access patterns, boosts frequently-retrieved keys

Platform access:
  Claude Code (Windows)  --> MCP tools (mcp__ruflo__*) OR direct CLI
  Hermes agent           --> npx ruflo memory <cmd> OR MCP config
  OpenClaw (Linux VPS)   --> SSH tunnel to Windows OR VPS-local ruflo instance
  intelligence-ranker    --> SessionStart hook injects top-N memories as context
```

---

## 3. Memory Types and Namespaces

Ruflo uses --namespace (logical grouping) plus -k key (unique identifier within namespace).

| Namespace | Purpose | Example key pattern | Which agents use it |
|-----------|---------|---------------------|---------------------|
| trading | Trade decisions, missed setups, lessons | trading/btc/2026-06-05/missed-breakout | Deezoh, Chimera |
| build | Architecture decisions, rationale | build/ruflo/memory-layer/decision | Claude Code, Hermes build lane |
| debug | Recurring errors and verified fixes | debug/ruflo/econnrefused-3000 | All agents |
| mistakes | Agent errors, wrong calls, false claims | mistakes/quota/claimed-exhausted | All agents (cross-platform) |
| sessions | Session summaries | sessions/2026-06-05/ruflo-build | Claude Code session-journal hook |
| arch | System architecture facts | arch/platforms/linux-vps-ip | Planning agents, orchestrators |
| spec | Project specs and constraints | spec/ruflo/mcp-port | All agents during project work |

---

## 4. How to Store a Memory

Set DB path first (all commands must use the same path):

  Windows PowerShell:
    $env:CLAUDE_FLOW_DB_PATH = "C:\Users\becke\Ai workspaces\claude\ruflo\.claude\memory.db"

  Linux/bash:
    export CLAUDE_FLOW_DB_PATH="/path/to/ruflo/.claude/memory.db"

Basic text store:
  npx ruflo memory store -k "trading/btc/2026-06-05/lesson" --value "Missed BTC breakout. Waited for RSI that wasn't needed." -n trading --tags "btc,lesson"

Store with TTL (seconds - for time-bounded data):
  npx ruflo memory store -k "sessions/2026-06-05/ruflo-build" --value "Built MEMORY_GUIDE.md." -n sessions --ttl 2592000 --tags "session"

Store as vector embedding (required for semantic/smart search to find it):
  npx ruflo memory store -k "mistakes/quota/no-live-check" --value "MISTAKE: Stated quota exhausted without live check. ROOT CAUSE: Relied on stale hook banner. FIX: Read usage_cache.json. RULE: Never claim quota blocked without verifying this turn." -n mistakes --vector --tags "quota,mistake,hard-rule"

Upsert (update if key exists):
  npx ruflo memory store -k "arch/platforms/linux-vps-ip" --value "100.67.172.114, Tailscale only" -n arch --upsert

---

## 5. How to Query Memory

Semantic search (default):
  npx ruflo memory search -q "BTC divergence failure" -n trading -l 5

Keyword search:
  npx ruflo memory search -q "ECONNREFUSED" -t keyword -n debug -l 3

Hybrid search (semantic + keyword):
  npx ruflo memory search -q "missed trade BTC" -t hybrid -n trading -l 5

SmartRetrieval - best for broad vague recall (adds ~200ms):
  npx ruflo memory search -q "mistakes with quota" --smart -l 10

With HNSW rebuild (use when index is stale or after adding new vectors):
  npx ruflo memory search -q "architecture decision" --build-hnsw -n build -l 5

Retrieve exact key:
  npx ruflo memory retrieve -k "mistakes/quota/no-live-check" -n mistakes

List namespace entries:
  npx ruflo memory list -n mistakes -l 20

Show stats (DB path, entry count):
  npx ruflo memory stats

---

## 6. How to Use from Claude Code (Windows)

Start server:
  cd "C:\Users\becke\Ai workspaces\claude\ruflo"
  npx ruflo start --port 3000

Check health:
  Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing

MCP config (add to ~/.claude/settings.json or project .claude/settings.json):
  {
    "mcpServers": {
      "ruflo": {
        "command": "npx",
        "args": ["ruflo", "mcp", "--port", "3000"],
        "cwd": "C:\\Users\\becke\\Ai workspaces\\claude\\ruflo"
      }
    }
  }

MCP tool names available in Claude Code sessions:
  mcp__ruflo__memory__store
  mcp__ruflo__memory__search
  mcp__ruflo__memory__retrieve
  mcp__ruflo__memory__list
  mcp__ruflo__memory__stats

Natural language triggers:
  "Store this in ruflo memory under [namespace]"
  "Query ruflo mistakes namespace for [topic]"
  "What does ruflo memory say about [topic]?"

---

## 7. How to Use from Hermes

Direct CLI approach:
  export CLAUDE_FLOW_DB_PATH="/path/to/shared/memory.db"
  npx ruflo memory search -q "$TASK_TOPIC" -n mistakes -l 5 --smart
  npx ruflo memory store -k "sessions/$(date +%Y%m%d)/task-$TASK_ID" --value "$LESSON" -n sessions --vector

System prompt pattern to inject into Hermes agent instructions:
  Before starting any task:
    Run: npx ruflo memory search -q "<task_topic>" -n mistakes -l 5 --smart
    Entries tagged "hard-rule" are absolute constraints for this session.
  After completing:
    Store session summary: -n sessions --vector --tags "session"
    Store any mistake: -n mistakes --vector --tags "mistake,hard-rule"

---

## 8. Cross-Device Setup

Option A: Windows hosts server, VPS reads via Tailscale (quickest to set up):

  Windows:
    npx ruflo start --port 3000 --daemon
    netsh advfirewall firewall add rule name="RuFlo MCP" dir=in action=allow protocol=TCP localport=3000

  VPS (use Windows Tailscale IP):
    curl http://<windows-tailscale-ip>:3000/health
    export CLAUDE_FLOW_MCP_URL="http://<windows-tailscale-ip>:3000"

Option B: VPS hosts server (recommended for production - always available):

  VPS:
    npm install ruflo
    npx ruflo start --port 3000 --daemon

  Windows MCP config - change url to VPS IP:
    { "url": "http://100.67.172.114:3000", "transport": "http" }

  Hermes or any agent:
    export CLAUDE_FLOW_MCP_URL="http://100.67.172.114:3000"

DB sync (manual, when not running shared server):
  VPS to Windows: rsync -avz root@100.67.172.114:/root/ruflo/.claude/memory.db "C:/Users/becke/Ai workspaces/claude/ruflo/.claude/memory.db"
  Windows to VPS: rsync -avz "C:/Users/becke/Ai workspaces/claude/ruflo/.claude/memory.db" root@100.67.172.114:/root/ruflo/.claude/memory.db

---

## 9. Session-Start Injection (memory-ranker-inject.sh)

Flow:
  1. SessionStart hook fires
  2. memory-ranker-inject.sh calls intelligence-ranker.cjs
  3. Ranker queries ruflo DB, returns top-N by importance + recency
  4. Results printed to stdout and injected as Claude Code session preamble context

Hook wiring in .claude/settings.json:
  {
    "hooks": {
      "SessionStart": [
        { "command": "bash C:/Users/becke/Ai\\ workspaces/claude/ruflo/.claude/helpers/memory-ranker-inject.sh" }
      ]
    }
  }

To add a new namespace to injection - edit intelligence-ranker.cjs:
  const QUERY_NAMESPACES = ['mistakes', 'sessions', 'trading', 'your_new_namespace'];
  const TOP_N = 10;
  const MIN_IMPORTANCE = 0.6;

Test manually:
  bash "C:/Users/becke/Ai workspaces/claude/ruflo/.claude/helpers/memory-ranker-inject.sh"

Verify injection ran: look for a memory context block in the first lines of the Claude Code session. If missing, the server is down.

---

## 10. Common Issues and Fixes

Issue 1: Server not starting (port already in use)
  Diagnosis: netstat -ano | findstr :3000  (Windows)  or  fuser 3000/tcp  (Linux)
  Fix Windows: Get-Process | Where-Object {$_.Id -eq <PID>} | Stop-Process -Force; npx ruflo start --port 3000
  Fix Linux: fuser -k 3000/tcp && npx ruflo start --port 3000

Issue 2: Memory not persisting (store OK but retrieve empty)
  Diagnosis: npx ruflo memory stats  (shows DB path and entry count)
  Fix: Ensure CLAUDE_FLOW_DB_PATH is set identically on all commands. If DB missing: npx ruflo memory init

Issue 3: HNSW index stale (search returns wrong or 0 results)
  Fix: npx ruflo memory search -q "test" --build-hnsw -l 1

Issue 4: Cross-device connectivity failure
  Diagnosis: tailscale status on both machines; curl http://<target-ip>:3000/health
  Fix: Add Windows firewall rule (see Section 8); confirm ruflo daemon running on host

Issue 5: Memory bloat (slow search, large DB)
  Fix: npx ruflo memory cleanup  then  npx ruflo memory compress
  Backup first: npx ruflo memory export --path backup-$(date +%Y%m%d).json

---

## 11. Optimization Tips

HNSW Tuning (intelligence.config.json):
  { "hnsw": { "efConstruction": 400, "M": 32, "efSearch": 100 } }
  Defaults: efConstruction=200, M=16. Increase for trading/precision workloads.
  Always rebuild index after changing: npx ruflo memory search -q "test" --build-hnsw -l 1

SmartRetrieval (--smart flag):
  Use at session start for broad recall queries.
  Skip for real-time targeted retrieval (adds ~200ms latency).

What to STORE:
  - Mistakes and near-misses with --vector
  - Architecture decisions with rationale
  - Trade lessons with ticker and outcome
  - Daily session summaries (not per-turn)
  - Recurring error fixes with exact commands

What NOT to store:
  - Raw OHLCV candles (use time-series DB)
  - Full stack traces or log files (extract lesson only)
  - Transient session state
  - Raw API JSON responses
  - Data with TTL under 1 hour (live orderbook, funding rates)
  - Every assistant turn

Importance signaling via tags (no native importance float in ruflo):
  "hard-rule"    -> permanent, never prune
  "mistake"      -> high recall priority
  "lesson"       -> medium recall priority
  "session-only" -> candidate for cleanup after 30 days

---

## 12. Learning from Mistakes (Exact Pattern)

STORE pattern (run immediately after a mistake or at session end):

  export CLAUDE_FLOW_DB_PATH="C:/Users/becke/Ai workspaces/claude/ruflo/.claude/memory.db"

  npx ruflo memory store \
    -k "mistakes/<category>/<slug>-$(date +%Y%m%d)" \
    --value "MISTAKE: [what happened]. ROOT CAUSE: [why]. FIX: [exact commands]. RULE: [always/never statement for the future]." \
    -n mistakes --vector --tags "mistake,<category>,<platform>,hard-rule" --upsert

Example:
  npx ruflo memory store \
    -k "mistakes/quota/claimed-exhausted-without-check-20260605" \
    --value "MISTAKE: Stated Anthropic quota exhausted without reading usage_cache.json this turn. ROOT CAUSE: Relied on stale hook banner from earlier in session. FIX: Get-Content C:/Users/becke/.claude/usage_cache.json | Select-String 'session_pct|weekly_pct'. RULE: NEVER state quota/capability/resource is blocked as FACT unless verified THIS turn." \
    -n mistakes --vector --tags "mistake,quota,verification,claude-code,hard-rule" --upsert

RETRIEVE pattern (at session start, or before repeating any non-trivial task):

  npx ruflo memory search -q "<task topic in plain words>" -n mistakes -l 5 --smart

  Entries tagged "hard-rule" = absolute constraints for this session.
  If you hit the same mistake again, add a recurrence entry:

  npx ruflo memory store \
    -k "mistakes/<original-slug>-recurrence-$(date +%Y%m%d)" \
    --value "RECURRENCE: [original mistake] happened again. Context: [what was different]. Rule reinforced." \
    -n mistakes --vector --tags "mistake,recurrence,hard-rule" --upsert

AUTOMATED: memory-ranker-inject.sh runs this retrieval at session start automatically when the SessionStart hook is wired and the server is running.
If injection is missing from session preamble: npx ruflo start --port 3000

---

Generated: 2026-06-05
CLI: ruflo v3.10.37 via npx ruflo
DB default: ./.swarm/memory.db (override via CLAUDE_FLOW_DB_PATH env var)
MCP default port: 3000
Update this guide when CLI flags, port, or namespace schema change.
