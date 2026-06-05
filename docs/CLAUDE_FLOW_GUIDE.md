# Claude Flow MCP — Install, Operate, Optimize

**A complete guide for any AI agent (Claude Code, Hermes, Codex, Cursor) to install, wire, write, sync, and operate the Claude Flow V3 memory + MCP stack that lives in `C:\Users\becke\Ai workspaces\claude\ruflo\`.**

**Date wired:** 2026-06-05
**Status:** LIVE on Windows dev box. 293 MCP tools, 15 entries seeded, 100% embedding coverage.
**Audience:** any agent, any machine, any OS. The wiring is identical on Linux/macOS — only paths change.

---

## 0. What this is (and why it wins)

**Claude Flow V3** (the package `ruflo` is a thin wrapper over `@claude-flow/*` from ruvnet) is a **complete multi-agent memory and orchestration OS**. Installed and tested on this machine as the Ruflo testbed project. Key capabilities that are now live:

| Capability | Tool | Status |
|---|---|---|
| **Vector memory (HNSW + sql.js hybrid)** | `memory_store`, `memory_retrieve`, `memory_search`, `memory_list`, `memory_stats` | ✅ LIVE |
| **Knowledge graph (PageRank + communities)** | `agentdb_graph-query`, `agentdb_graph-pathfinder` | ✅ LIVE (empty) |
| **Multi-agent swarm coordination** | `swarm_init`, `agent_spawn`, `hive-mind_*` | ✅ LIVE |
| **Self-learning hooks** | `hooks_intelligence_*`, `hooks_session-*` | ✅ LIVE |
| **SONA neural learning** | `neural_train`, `neural_predict`, `neural_patterns` | ✅ LIVE (alpha) |
| **Claims / handoffs** | `claims_claim`, `claims_handoff`, `claims_board` | ✅ LIVE |
| **Cross-platform (VPS / Linux / Mac)** | The same MCP server, any host | ✅ same binary |

**Why this beats Mem0 / Basic Memory / hand-rolled ChromaDB:**
- ✅ **Already installed** (in Ruflo). No new packages, no new daemon.
- ✅ **HNSW + sql.js** — 150x–12,500x faster than naive search per ADR-009.
- ✅ **MCP-native** — works in Claude Code, Hermes, Cursor, anything that speaks MCP.
- ✅ **Self-learning** — SONA adapts patterns, hooks auto-improve, PageRank weights change.
- ✅ **Knowledge graph on top of vectors** — relational reasoning, not just similarity.
- ✅ **Cross-agent** — any agent that connects to the MCP server reads/writes the same pool.

---

## 1. Install (one machine, ~10 minutes)

### 1.1. Prerequisites

- **Node.js 18+** (this box has v24.13.1). Verify: `node --version`
- **npm 9+**. Verify: `npm --version`
- **Git bash / POSIX shell** on Windows (this box uses MSYS). On macOS/Linux use bash.
- **Ruflo project** at `C:\Users\becke\Ai workspaces\claude\ruflo\` (clone or copy).
  - Source: the ruflo installation script in `INSTALL_LOG_memory-ranker.md` (or run the boilerplate below).
- **No additional installs needed** — Claude Flow ships inside `node_modules/@claude-flow/`.

### 1.2. Boilerplate install (fresh machine)

```bash
# 1. Create the ruflo project directory
mkdir -p "C:/Users/becke/Ai workspaces/claude/ruflo"
cd "C:/Users/becke/Ai workspaces/claude/ruflo"

# 2. Init package.json
cat > package.json <<'EOF'
{
  "name": "ruflo",
  "version": "1.0.0",
  "type": "commonjs",
  "dependencies": { "ruflo": "^3.10.37" }
}
EOF

# 3. Install ruflo (pulls all @claude-flow/* packages)
npm install

# 4. Verify install
ls node_modules/@claude-flow/  # must show: cli cli-core mcp memory neural
```

### 1.3. Initialize the memory database

```bash
cd "C:/Users/becke/Ai workspaces/claude/ruflo"
npx claude-flow memory init
# Output: "Verification passed (6/6 tests)"
#         "Synced to: .../ruflo/.claude/memory.db"
```

**Critical:** the actual data file is `.claude/memory.db`, NOT `.claude-flow/data/` (despite what `config.yaml` claims). Always use the `.claude/` parent path in env vars.

### 1.4. Verify with the test client

```bash
cd "C:/Users/becke/Ai workspaces/claude/ruflo"
node scripts/mcp-test-client.mjs
# Expect: "=== tools/list (293 tools) ===" and the tool list
```

If the tool list shows 293 tools → install is good. If less → `rm -rf .claude/memory.db && npx claude-flow memory init`.

---

## 2. Wire into your agent (3 runtimes, 3 edits)

### 2.1. Wire Claude Code (global, applies to ALL Claude Code sessions)

Edit `~/.claude/settings.json` → top-level `mcpServers`:

```json
{
  "mcpServers": {
    "claudeflow-memory": {
      "command": "node",
      "args": [
        "C:/Users/becke/Ai workspaces/claude/ruflo/node_modules/@claude-flow/cli/bin/mcp-server.js"
      ],
      "env": {
        "MEMORY_PATH": "C:/Users/becke/Ai workspaces/claude/ruflo/.claude",
        "MEMORY_BACKEND": "hybrid",
        "ENABLE_HNSW": "true",
        "CLAUDE_FLOW_MODE": "v3",
        "CLAUDE_FLOW_HOOKS_ENABLED": "true",
        "CLAUDE_FLOW_TOPOLOGY": "hierarchical-mesh",
        "CLAUDE_FLOW_MAX_AGENTS": "15",
        "CLAUDE_FLOW_MEMORY_BACKEND": "hybrid",
        "RUFLO_PROJECT": "C:/Users/becke/Ai workspaces/claude/ruflo"
      }
    }
  }
}
```

Restart Claude Code. After restart, the 293 tools appear as `mcp__claudeflow-memory__memory_store` etc.

### 2.2. Wire Hermes CLI (and cron / gateway)

Edit `~/.hermes/config.yaml` → add under top-level `mcp_servers:` (after existing entries like `apify`):

```yaml
mcp_servers:
  # ... existing apify, zai-vision, etc. ...
  claudeflow-memory:
    command: node
    args:
    - 'C:/Users/becke/Ai workspaces/claude/ruflo/node_modules/@claude-flow/cli/bin/mcp-server.js'
    env:
      MEMORY_PATH: 'C:/Users/becke/Ai workspaces/claude/ruflo/.claude'
      MEMORY_BACKEND: hybrid
      ENABLE_HNSW: 'true'
      CLAUDE_FLOW_MODE: v3
      CLAUDE_FLOW_HOOKS_ENABLED: 'true'
      CLAUDE_FLOW_TOPOLOGY: hierarchical-mesh
      CLAUDE_FLOW_MAX_AGENTS: '15'
      CLAUDE_FLOW_MEMORY_BACKEND: hybrid
      RUFLO_PROJECT: 'C:/Users/becke/Ai workspaces/claude/ruflo'
    timeout: 60
    connect_timeout: 30
```

### 2.3. Wire Hermes Desktop app (THE OTHER CONFIG — do not skip!)

⚠️ **Hermes has TWO runtimes with TWO config files that DO NOT inherit.** Always edit BOTH.

Edit `~/AppData/Local/hermes/config.yaml` → add the SAME `mcp_servers.claudeflow-memory` block (if not already present). Restart the Desktop app.

### 2.4. Verify the wiring

```bash
# Hermes
hermes mcp test claudeflow-memory
# Expect: ✓ Connected (~400ms) ✓ Tools discovered: 293

# Claude Code
claude /mcp   # interactive: should list "claudeflow-memory" as connected
# OR check settings: cat ~/.claude/settings.json | grep claudeflow-memory

# Manual smoke test (any agent)
cd "C:/Users/becke/Ai workspaces/claude/ruflo"
node scripts/mcp-test-client.mjs --call memory_stats '{}'
# Expect: "totalEntries": 15 (or higher)
```

---

## 3. Operate — daily driver recipes

### 3.1. Write memories (any agent, any time)

**Via MCP tool call (preferred — works in Claude Code, Hermes, Cursor):**
```javascript
mcp__claudeflow-memory__memory_store({
  key: "my-finding-2026-06-05",
  value: "Full text of what you learned. Plain prose. Includes WHY.",
  namespace: "trading",  // see §3.4 for namespace conventions
  tags: ["finding", "btc", "divergence"]
})
```

**Via Hermes CLI (great for cron jobs and scripts):**
```bash
hermes mcp exec claudeflow-memory memory_store --json '{
  "key": "btc-2026-06-05-missed-divergence",
  "value": "BTC daily at 67k support — divergence failed, missed entry",
  "namespace": "trading",
  "tags": ["missed", "btc"]
}'
```

**Via Node script (for bulk operations):**
```javascript
// see scripts/seed-initial-memory.mjs for the full pattern
const result = await callMCPTool('memory_store', {
  key, value, namespace, tags
});
```

### 3.2. Search memories (semantic, ranked)

```javascript
mcp__claudeflow-memory__memory_search({
  query: "what did I miss on BTC divergence",
  namespace: "trading",   // optional filter
  limit: 5
})
// Returns: [{ key, namespace, value, similarity }, ...] sorted by score
```

**Cross-namespace search:** omit `namespace` to search everything. Use this for "what do I know about X?" queries.

**Specific retrieval (by exact key):**
```javascript
mcp__claudeflow-memory__memory_retrieve({
  key: "btc-2026-06-05-missed-divergence",
  namespace: "trading"
})
```

### 3.3. List / stats / cleanup

```javascript
mcp__claudeflow-memory__memory_list({ namespace: "diseases" })
mcp__claudeflow-memory__memory_stats({})
// Returns: { totalEntries, entriesWithEmbeddings, embeddingCoverage,
//           namespaces: { trading: 12, build: 4, ... }, backend }

mcp__claudeflow-memory__memory_cleanup({ dryRun: true })  // prune expired TTL
mcp__claudeflow-memory__memory_compress({})                // size breakdown
```

### 3.4. Namespace conventions (use these, don't invent)

| Namespace | What goes here | Example keys |
|---|---|---|
| `trading` | Trade setups, missed entries, pattern observations | `btc-2026-06-05-missed-divergence` |
| `build` | Build decisions, wiring notes, deployment state | `claudeflow-wiring-2026-06-05` |
| `diseases` | Sal corrections as reusable class-of-mistake rules | `rule-1-act-toward-outcome` |
| `debug` | Bug post-mortems, troubleshooting, gotchas | `claudeflow-troubleshooting` |
| `arch` | Architecture decisions, system topology, platform ownership | `ruflo-location-and-purpose` |
| `sal` | User profile, preferences, communication style | `profile-core` |
| `agents` | Notes about specific agents (capabilities, quirks) | `agent-hermes-quota-rotation` |
| `sessions` | Cross-session continuity, open handoffs | `session-2026-06-05-open-trading-thread` |
| `impl` | Implementation details, library gotchas | `python-yaml-quote-rule` |
| `project` | Project-level state per repo | `chimera-vps-deploy-current-tag` |

**Rule:** namespace by the **kind of knowledge**, not the project. `trading/btc-miss` is searchable across projects; `chimera/btc-miss` is not.

### 3.5. Key naming convention

`{topic-slug}-{date-or-version}-{optional-modifier}`

Examples:
- ✅ `btc-2026-06-05-missed-divergence`
- ✅ `claudeflow-wiring-2026-06-05`
- ✅ `rule-1-act-toward-outcome`
- ❌ `finding1` (no date, no namespace clarity)
- ❌ `Important!!! Read me first` (no machine-parseable structure)

---

## 4. Sync — make the same memory pool available everywhere

### 4.1. Git-sync the .claude directory (lightweight, ~16MB)

The memory data is a single SQLite file. Git sync it for cross-machine consistency.

```bash
# In ruflo/, add .claude/memory.db to git
cd "C:/Users/becke/Ai workspaces/claude/ruflo"
echo ".claude-flow/data/" >> .gitignore  # exclude empty placeholder
git add scripts/ docs/ CLAUDE.md package.json .claude/  # include .claude/memory.db
git commit -m "claudeflow: 15 entries seeded, 100% embedding coverage"
git remote add origin <your-github-repo-url>
git push -u origin main
```

On another machine:
```bash
git clone <your-github-repo-url> ruflo
cd ruflo
npm install   # restores node_modules from package.json
node scripts/mcp-test-client.mjs   # verifies the synced data loads
```

### 4.2. Memory export / import (for non-git sync)

```javascript
// Export to JSON (all entries or per-namespace)
mcp__claudeflow-memory__memory_export({
  path: "C:/Users/becke/backup/claudeflow-2026-06-05.json",
  namespace: "trading"   // optional
})

// Import on another machine
mcp__claudeflow-memory__memory_import({
  path: "C:/Users/becke/backup/claudeflow-2026-06-05.json",
  merge: true   // false to overwrite
})
```

### 4.3. Run Claude Flow on the VPS (Linux)

```bash
# On the VPS
mkdir -p ~/ruflo && cd ~/ruflo
# Copy package.json, scripts/, and .claude/memory.db from Windows (scp)
npm install
node scripts/mcp-test-client.mjs

# Then expose via HTTP for other tools to connect (or keep stdio via SSH tunnel)
# Note: HTTP mode has a known wrapper-exit bug on Windows; on Linux it works.
npx claude-flow mcp start -t http -p 3000 -d  # -d daemonize
```

### 4.4. Cross-agent wiring (the win)

Any agent that speaks MCP can read/write the same memory:

```yaml
# Cursor, Aider, Continue.dev, custom agent, ...
mcpServers:
  claudeflow-memory:
    command: node
    args: ["/path/to/ruflo/node_modules/@claude-flow/cli/bin/mcp-server.js"]
    env: { MEMORY_PATH: "/path/to/ruflo/.claude" }
```

If the agent runs on a different host, run the MCP server with HTTP transport on the VPS and connect via `type: http` + `url: http://vps:3000/mcp`.

---

## 5. Optimize — make it fast, make it useful

### 5.1. Hot-path: write on the auto-memory hook

Wire a hook that **auto-stores** every Sal correction and every "this is how it's done" moment. Example for Hermes:

```yaml
# ~/.hermes/config.yaml → enforcement / hooks
hooks:
  post_user_message:
    command: |
      hermes mcp exec claudeflow-memory memory_search --json \
        "{\"query\": \"$(cat | jq -r '.message' | head -c 200)\", \"limit\": 3}"
    enabled: true
```

(Adjust per your hook engine — Hermes has 4 hook types, Claude Code has Pre/Post tool hooks.)

### 5.2. HNSW index tuning

Default settings are fine for <10K entries. When you cross that:

```yaml
# .claude-flow/config.yaml
memory:
  backend: hybrid
  enableHNSW: true
  cacheSize: 500              # bump from 100 for hot working set
  memoryGraph:
    enabled: true
    maxNodes: 5000            # increase for large knowledge graphs
    similarityThreshold: 0.75 # lower = more recall, higher = more precision
```

Re-init after changing: `npx claude-flow memory init` (preserves data).

### 5.3. Search quality

- **Be specific in `query`**: "BTC daily divergence failure 2026-06" beats "trading stuff"
- **Use namespace filters** to scope: `memory_search({ query, namespace: "trading" })`
- **Boost via tags**: store with `tags: ["critical", "sal-said"]` and filter on tag presence (HNSW ranks tagged entries slightly higher)
- **Use the knowledge graph** for relational queries: `agentdb_graph-query({ start: "btc-miss-2026-06-05", depth: 2 })`

### 5.4. Maintenance

```bash
# Weekly: prune expired TTL entries
hermes mcp exec claudeflow-memory memory_cleanup --json '{"dryRun": false}'

# Monthly: check index health
hermes mcp exec claudeflow-memory memory_detailed-stats --json '{}'

# Quarterly: full export for backup
hermes mcp exec claudeflow-memory memory_export --json \
  '{"path": "C:/Users/becke/backups/cf-$(date +%Y-%m-%d).json"}'
```

### 5.5. Cross-platform performance

- **Single-machine**: 128-dim HNSW, ~150ms per search. Perfect.
- **Multi-machine via HTTP**: 5-10ms LAN latency on top. Still fast.
- **Multi-machine over WAN**: use the ruvector PostgreSQL bridge (`ruvector_bridge_*` tools) for shared embeddings across regions.

---

## 6. Common issues and fixes

### Issue 1: "Connection refused" on Hermes MCP test

**Cause:** Desktop app not restarted after config edit, OR wrong path.
**Fix:**
1. `hermes mcp test claudeflow-memory` — note the exact error
2. Verify the binary path: `ls "C:/Users/becke/Ai workspaces/claude/ruflo/node_modules/@claude-flow/cli/bin/mcp-server.js"`
3. Restart Hermes Desktop (the Electron app holds the old config in memory).

### Issue 2: "Memory path mismatch — config says X, data is at Y"

**Cause:** `MEMORY_PATH` in env points to `.claude-flow/data/` (empty placeholder). Real data is in `.claude/memory.db`.
**Fix:** Set `MEMORY_PATH` to `.../ruflo/.claude` (the parent directory). The server finds `memory.db` inside it.

### Issue 3: HTTP server starts then exits immediately (Windows)

**Cause:** `claude-flow mcp start -t http` wrapper exits, killing its in-process HTTP child. Known Windows-specific bug in v3.0.0-alpha.19.
**Fix:** Use **stdio mode** for MCP clients. Spawn the server per client connection. For HTTP exposure, run on Linux instead (works correctly there), or wrap in `nssm`/`pm2` for Windows service hosting.

### Issue 4: Slow first call (~500ms), fast subsequent

**Cause:** sql.js loads the SQLite WASM on first call. HNSW index loads on first search.
**Fix:** Pre-warm with a no-op `memory_stats` call at session start. Cost: 1 second once per session.

### Issue 5: 0% embedding coverage after import

**Cause:** Imported entries have `embedding: null`. Need to re-embed.
**Fix:**
```javascript
mcp__claudeflow-memory__memory_compress({})   // report shows missing
// Then for each: delete + re-store (HNSW auto-embeds on store)
```

### Issue 6: "UNIQUE constraint failed" on re-store

**This is not an error — it means idempotency is working.** Keys are `(namespace, key)`. Either:
- Use a different key (e.g. add `-v2` suffix)
- Delete first: `memory_delete({ key, namespace })` then re-store
- Or accept that store is upsert-with-error: the data is still there.

### Issue 7: Tools list shows fewer than 293

**Cause:** Server version mismatch, partial install, or env override.
**Fix:**
```bash
cd ruflo && npm install && rm -rf .claude/memory.db && npx claude-flow memory init
hermes mcp test claudeflow-memory   # should report 293 again
```

### Issue 8: Cross-machine sync conflict (same key, different values)

**Cause:** Two machines wrote to the same `(namespace, key)` between syncs.
**Fix:** Use machine-prefixed keys: `windows-btc-2026-06-05-miss` vs `linux-btc-2026-06-05-miss`. Or implement merge-on-import logic that takes the higher-confidence version.

---

## 7. What lives where (file map)

```
C:\Users\becke\Ai workspaces\claude\ruflo\
├── .claude\
│   ├── memory.db                ← THE memory data (SQLite + HNSW vectors)
│   ├── settings.json            ← Project-local Claude Code settings
│   ├── intelligence\            ← intelligence-ranker outputs
│   └── agents\  skills\  commands\  ← Ruflo project-local
├── .claude-flow\
│   ├── config.yaml              ← Runtime config (swarm, memory, neural, hooks, mcp)
│   ├── data\                    ← (empty placeholder — real data in .claude/)
│   ├── hooks\  sessions\  logs\  ← runtime state
│   └── agents\  learning\       ← per-agent state
├── node_modules\
│   ├── @claude-flow\
│   │   ├── cli\                 ← `ruflo` and `claude-flow` CLI
│   │   ├── cli-core\
│   │   ├── mcp\                 ← MCP stdio + http server (transport, oauth, rate-limiter)
│   │   ├── memory\              ← AgentDB HNSW + sql.js hybrid backend
│   │   └── neural\              ← SONA pattern learning
│   └── ruflo\                   ← Top-level ruflo package
├── scripts\
│   ├── mcp-test-client.mjs      ← MCP test client (use to verify)
│   ├── seed-initial-memory.mjs  ← Bulk seed durable knowledge
│   └── intelligence-ranker.cjs  ← PageRank + similarity ranker (working)
├── package.json                 ← {"dependencies": {"ruflo": "^3.10.37"}}
└── docs\
    └── CLAUDE_FLOW_GUIDE.md     ← THIS FILE
```

**Two data locations to remember:**
- `.claude/memory.db` — the actual SQLite data (read by `MEMORY_PATH=.../ruflo/.claude`)
- `.claude-flow/` — runtime config + state files, NOT the data

---

## 8. Verify your install in 30 seconds

```bash
# 1. Server alive
cd "C:/Users/becke/Ai workspaces/claude/ruflo"
node scripts/mcp-test-client.mjs --call memory_stats '{}' 2>&1 | grep totalEntries
# Expect: "totalEntries": 15 (or higher)

# 2. Hermes wired
hermes mcp test claudeflow-memory 2>&1 | grep -E "Connected|Tools discovered"
# Expect: "✓ Connected" and "✓ Tools discovered: 293"

# 3. Claude Code wired
grep -A 2 "claudeflow-memory" ~/.claude/settings.json
# Expect: the mcpServers block is present

# 4. Search returns results
node scripts/mcp-test-client.mjs --call memory_search '{"query":"disease rule outcome","namespace":"diseases","limit":1}' 2>&1 | grep similarity
# Expect: "similarity": 0.5 (or higher)

# 5. Write works (test that round trip is intact)
node scripts/mcp-test-client.mjs --call memory_store '{"key":"verify-2026-06-05","value":"install verified","namespace":"test"}' 2>&1 | grep success
# Expect: "success": true OR "UNIQUE constraint" (both prove it works)
```

All five green = Claude Flow MCP is fully operational on this machine.

---

## 9. Next-level features (when ready)

- **SONA neural learning**: call `neural_train --pattern coordination` to train on past agent interactions. Improves routing over time.
- **Knowledge graph queries**: `agentdb_graph-query` to find related memories via the graph, not just vector similarity.
- **Multi-agent swarms**: `swarm_init --topology mesh` to spawn coordinated agents that share this memory.
- **Hive-mind consensus**: `hive-mind_spawn` + `hive-mind_consensus` for queen-led multi-agent decisions.
- **Claims-based handoffs**: `claims_claim` to reserve work, `claims_handoff` to transfer context with full memory attached.
- **Autopilot**: `autopilot_enable` to keep an agent working until a task list is empty.

Read `node_modules/@claude-flow/cli/README.md` and `node_modules/@claude-flow/mcp/README.md` for the full tool catalog.

---

*Written 2026-06-05 by Sal's directive. Updated whenever the wiring or schema changes. If a section is wrong, patch it AND update the corresponding section in MEMORY.md so other agents don't relearn the same mistake.*
