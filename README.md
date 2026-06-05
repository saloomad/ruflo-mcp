# Ruflo Project — Claude Flow MCP Memory OS

**Location:** `C:\Users\becke\Ai workspaces\claude\ruflo\`
**Created:** 2026-05-25
**Wired (Claude Flow MCP):** 2026-06-05

## What this is

Dedicated Claude Code project for Ruflo (claude-flow) evaluation + follow-on work. Houses the **Claude Flow V3 memory + MCP stack** — a complete multi-agent memory OS that any agent (Claude Code, Hermes, Cursor, Codex) can connect to via MCP.

**🎯 Primary use case:** persistent cross-agent memory. 293 MCP tools, HNSW + sql.js hybrid vector store, knowledge graph, self-learning hooks, SONA neural learning, multi-agent swarms — all installed and working.

## How to open

```bash
cd "C:/Users/becke/Ai workspaces/claude/ruflo"
claude
# Then ask Claude to read KANBAN.md and pick the next slice
```

## Quick links

| What | Path |
|---|---|
| **📖 Claude Flow install/operate/optimize guide** | [`docs/CLAUDE_FLOW_GUIDE.md`](docs/CLAUDE_FLOW_GUIDE.md) |
| Project rules | `CLAUDE.md` |
| Active slices | `KANBAN.md` |
| Last session state | `CONTINUATION.md` |
| Workflows used | `WORKFLOWS.md` |
| MCP test client | `scripts/mcp-test-client.mjs` |
| Bulk memory seeder | `scripts/seed-initial-memory.mjs` |
| Install log | `INSTALL_LOG_memory-ranker.md` |
| Memory data | `.claude/memory.db` |
| Runtime config | `.claude-flow/config.yaml` |
| Learning outputs | `../../shared/learnings/research/` |

## Claude Flow wiring (TL;DR)

```bash
# Verify it's working (after install)
cd "C:/Users/becke/Ai workspaces/claude/ruflo"
node scripts/mcp-test-client.mjs --call memory_stats '{}'
hermes mcp test claudeflow-memory    # 293 tools, ~400ms

# Write a memory
node scripts/mcp-test-client.mjs --call memory_store '{
  "key":"my-finding","value":"What I learned","namespace":"trading","tags":["finding"]
}'

# Search memories (semantic, HNSW)
node scripts/mcp-test-client.mjs --call memory_search '{
  "query":"BTC divergence","namespace":"trading","limit":5
}'

# Bulk-seed durable knowledge (8 high-value entries)
node scripts/seed-initial-memory.mjs
```

**Read the full guide:** [`docs/CLAUDE_FLOW_GUIDE.md`](docs/CLAUDE_FLOW_GUIDE.md) — install, wire, write, sync, optimize, troubleshoot.

## Why Claude Flow beats Mem0 / Basic Memory / ChromaDB

1. **Already installed** — no new packages, no new daemons
2. **HNSW + sql.js** — 150x–12,500x faster than naive search
3. **MCP-native** — works in every modern agent
4. **Self-learning** — SONA + hooks auto-improve
5. **Knowledge graph + vectors** — relational + similarity
6. **Cross-agent** — one memory pool, every agent reads/writes it

## Status (as of 2026-06-05)

- ✅ 293 MCP tools discovered
- ✅ 15 memory entries seeded (8 namespaces, 100% embedding coverage)
- ✅ Wired into Claude Code (`~/.claude/settings.json`)
- ✅ Wired into Hermes CLI (`~/.hermes/config.yaml`)
- ✅ Wired into Hermes Desktop (`~/AppData/Local/hermes/config.yaml`)
- ⏳ Cross-platform sync (Linux PC, VPS) — pending user approval to deploy
- ⏳ Knowledge graph population — pending first organic use
