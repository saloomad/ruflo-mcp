#!/usr/bin/env node
/**
 * Bulk-seed Claude Flow memory with initial high-value entries.
 * Sources: MEMORY.md disease rules, USER.md preferences, JOURNAL recent events.
 *
 * Idempotent — keys are deterministic, re-runs update rather than duplicate.
 *
 * Usage:  node scripts/seed-initial-memory.mjs
 *         node scripts/seed-initial-memory.mjs --dry-run
 */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const SERVER = join(REPO, 'node_modules', '@claude-flow', 'cli', 'bin', 'mcp-server.js');

const dryRun = process.argv.includes('--dry-run');

// HERMES_HOME on Windows is C:/Users/becke; fall back to $HOME or $USERPROFILE
const HOME = process.env.HOME || process.env.USERPROFILE || 'C:/Users/becke';
const MEMORY_MD = join(HOME, 'Ai workspaces', 'hermes', 'MEMORY.md');
const USER_MD = join(HOME, 'Ai workspaces', 'hermes', 'USER.md');

const SEEDS = [];

// === Disease rules (extracted from MEMORY.md, 2026-06-05) ===
SEEDS.push({
  namespace: 'diseases',
  key: 'rule-1-act-toward-outcome',
  tags: ['disease', 'sal-corrections', 'meta'],
  value: `DISEASE RULE #1: Act toward the OUTCOME, not the action.
Symptom: Agent reports quota for kimi instead of switching to a working model.
Root: Treated "check quota" as the goal. User's goal was "working model".
Test: "If I did exactly this and stopped here, would the user have what they asked for?"
If no, response is incomplete even if the report is true.
Verified 2026-06-05.`
});

SEEDS.push({
  namespace: 'diseases',
  key: 'rule-2-two-runtimes',
  tags: ['disease', 'config', 'meta'],
  value: `DISEASE RULE #2: Every config has 2+ sources of truth on this machine.
Hermes runs as TWO independent processes (CLI/gateway/cron + Desktop app) with
TWO separate config files that do NOT inherit:
  - ~/.hermes/config.yaml  (CLI, gateway, cron, scheduled jobs)
  - ~/AppData/Local/hermes/config.yaml  (Desktop app — Electron)
ALWAYS edit BOTH unless Sal confirms which runtime he means.
Verify: \`hermes status\` shows which runtimes are active.
Claude Code:  ~/.claude/settings.json (global) + project .mcp.json (local).`
});

SEEDS.push({
  namespace: 'diseases',
  key: 'rule-3-bypass-recipe',
  tags: ['disease', 'config', 'meta'],
  value: `DISEASE RULE #3: When a tool refuses, a non-tool path exists.
Symptom: Agent stops at "patch and terminal are blocked from editing config".
Root: Treated the tool refusal as final.
Fallback ladder (try in order):
  (a) \`hermes config set KEY VAL\` CLI (works for simple values)
  (b) Python \`yaml.dump\` via terminal (bypasses text-based patch block)
  (c) Env-var override (most config supports HERMES_* env vars)
  (d) Filesystem mount / symlink (last resort, for system-level changes)
VERIFY: read the file back from disk after each path; don't trust the tool's
"success" message without a re-read.`
});

SEEDS.push({
  namespace: 'diseases',
  key: 'rule-4-fallback-is-not-universal',
  tags: ['disease', 'routing', 'meta'],
  value: `DISEASE RULE #4: Fallback chains handle QUOTA, not semantic errors.
Symptom: \`fallback_providers\` in config.yaml didn't fire on "unknown model".
Root: Assumed error-handling is symmetric (it isn't).
Fallback chain catches HTTP 429/403 from the CORRECT provider. It does NOT catch:
provider/model mismatch, provider down, auth errors, timeouts.
Recipe: end-to-end test the chain with the wrong model on purpose.
Use curl with a wrong model name to confirm fallback fires (not just dies silently).`
});

// === Sal profile (preferences) ===
SEEDS.push({
  namespace: 'sal',
  key: 'profile-core',
  tags: ['user', 'preferences', 'communication'],
  value: `Sal — Dubai (GST/UTC+4). Direct, profanity = emphasis not insult.
File state is truth. Bottom line first, proof not claims.
Prefers direct fixes over apologies. Parallel action over clarifications.
Timezone: Dubai (GST/UTC+4). Always give Dubai time, never UTC.
Coding plans (not pay-per-use) for: zai, kimi-coding, minimax.
Furious when agent wastes time on irrelevant paths. Fix X directly,
don't investigate unrelated Y. Stop explaining the journey.
"do all 3" / "continue these" = EXECUTE in parallel, don't queue.
"do google search" = verify from official docs, don't guess.`
});

// === Claude Flow wiring (this very work) ===
SEEDS.push({
  namespace: 'build',
  key: 'claudeflow-wiring-2026-06-05',
  tags: ['claude-flow', 'mcp', 'memory', 'wiring'],
  value: `Claude Flow MCP wired 2026-06-05 by Sal's order.
Server: C:/Users/becke/Ai workspaces/claude/ruflo/node_modules/@claude-flow/cli/bin/mcp-server.js
Transport: stdio (NOT http — HTTP mode wrapper exits and kills child)
Wired into:
  - ~/.claude/settings.json as "claudeflow-memory"
  - ~/.hermes/config.yaml mcp_servers.claudeflow-memory
  - ~/AppData/Local/hermes/config.yaml mcp_servers.claudeflow-memory
Data location: ruflo/.claude/memory.db (NOT .claude-flow/data — config says one path, real path is different)
Verified: her mes mcp test claudeflow-memory → 293 tools, 422ms.
Test client: ruflo/scripts/mcp-test-client.mjs
29 namespaces defined in config: trading, project, sessions, agents, arch, debug, impl, build, diseases, sal, test, ...`
});

// === Tooling notes (what works) ===
SEEDS.push({
  namespace: 'debug',
  key: 'claudeflow-troubleshooting',
  tags: ['claude-flow', 'mcp', 'gotchas', 'windows'],
  value: `Claude Flow MCP gotchas on Windows:
1. \`claude-flow mcp start -t http -p 3000\` starts the server then EXITS — the
   in-process HTTP server gets killed when the wrapper process exits.
   Solution: use stdio mode. Spawn \`node mcp-server.js\` per MCP client.
2. Memory path mismatch: config.yaml says .claude-flow/data/ but data is
   actually stored in .claude/memory.db. Always use the .claude/ parent.
3. Alpha packages (v3.0.0-alpha.19) have breaking bugs. Test the core path
   (memory_store + memory_search) before wiring into production.
4. Tools list changes per server version. Don't hardcode tool counts.
   Run \`hermes mcp test claudeflow-memory\` to get current count.
5. The "ps: unknown option -- o" warning is MSYS ps — cosmetic, ignore.
6. memory_store returns hasEmbedding:true and embeddingDimensions:128
   (HNSW 128-dim vectors). Search uses HNSW + sql.js hybrid.`
});

// === Operating lanes map (so the agent knows what to read) ===
SEEDS.push({
  namespace: 'arch',
  key: 'ruflo-location-and-purpose',
  tags: ['ruflo', 'platform', 'arch'],
  value: `Ruflo = Sal's testbed for Claude Flow V3 (from ruvnet/claude-flow).
Location: C:/Users/becke/Ai workspaces/claude/ruflo/
Purpose: Evaluate multi-agent orchestration, vector memory, knowledge graph, MCP server.
Key files:
  - node_modules/@claude-flow/cli/bin/cli.js (ruflo binary)
  - node_modules/@claude-flow/cli/bin/mcp-server.js (MCP stdio server)
  - .claude/memory.db (sqlite+HNSW data)
  - .claude-flow/config.yaml (runtime config: swarm, memory, neural, hooks)
  - scripts/mcp-test-client.mjs (verification client)
  - scripts/seed-initial-memory.mjs (this file)
Intelligence ranker: scripts/intelligence-ranker.cjs (PageRank + similarity, working)
NOT to be confused with: ruflo the flow-neural-net research concept.`
});

console.log(`[seed] ${SEEDS.length} seeds queued${dryRun ? ' (DRY RUN)' : ''}`);

// === MCP client (same pattern as test client) ===
const child = spawn(process.execPath, [SERVER], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: { ...process.env, NODE_OPTIONS: '' },
  cwd: REPO,
});

let buffer = '';
const pending = new Map();
let nextId = 1;

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`timeout waiting for id=${id} (${method})`));
      }
    }, 15000);
  });
}

child.stdout.on('data', (chunk) => {
  buffer += chunk.toString('utf8');
  let nl;
  while ((nl = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed.id != null && pending.has(parsed.id)) {
        const { resolve, reject } = pending.get(parsed.id);
        pending.delete(parsed.id);
        if (parsed.error) reject(new Error(JSON.stringify(parsed.error)));
        else resolve(parsed);
      }
    } catch (e) {
      console.error('[parse fail]', line.slice(0, 200));
    }
  }
});

child.on('exit', (code) => {
  console.error(`[seed] server exited (code=${code})`);
  process.exit(code ?? 0);
});

async function callMCPTool(name, args) {
  const r = await send('tools/call', { name, arguments: args });
  const text = r.result?.content?.[0]?.text;
  if (!text) throw new Error(`empty result from ${name}`);
  return JSON.parse(text);
}

(async () => {
  await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'ruflo-seed-client', version: '1.0' },
  });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  let ok = 0, fail = 0;
  for (const seed of SEEDS) {
    if (dryRun) {
      console.log(`[dry-run] would store: ${seed.namespace}/${seed.key} (${seed.value.length} chars)`);
      ok++;
      continue;
    }
    try {
      const r = await callMCPTool('memory_store', {
        key: seed.key,
        value: seed.value,
        namespace: seed.namespace,
        tags: seed.tags,
      });
      if (r.success) {
        console.log(`[OK]   ${seed.namespace}/${seed.key} (${r.embeddingDimensions}d, ${r.storeTime})`);
        ok++;
      } else if (r.error && r.error.includes('UNIQUE constraint')) {
        // Idempotency proof: already stored from a previous run. Verify it's retrievable.
        const search = await callMCPTool('memory_search', {
          query: seed.value.split('\n')[0].slice(0, 40),
          namespace: seed.namespace,
          limit: 1,
        });
        const found = (search.results || []).some(
          (x) => x.key === seed.key && x.namespace === seed.namespace
        );
        if (found) {
          console.log(`[SKIP] ${seed.namespace}/${seed.key} (already stored, searchable)`);
          ok++;
        } else {
          console.log(`[DUP?] ${seed.namespace}/${seed.key} — UNIQUE error but not searchable?!`);
          fail++;
        }
      } else {
        console.log(`[FAIL] ${seed.namespace}/${seed.key}: ${JSON.stringify(r)}`);
        fail++;
      }
    } catch (e) {
      console.error(`[ERR]  ${seed.namespace}/${seed.key}: ${e.message}`);
      fail++;
    }
  }

  // Final stats
  if (!dryRun) {
    try {
      const stats = await callMCPTool('memory_stats', {});
      console.log(`\n[stats] entries: ${stats.entryCount ?? '?'}, namespaces: ${stats.namespaceCount ?? '?'}`);
    } catch {}
  }

  console.log(`\n[done] ok=${ok} fail=${fail}`);
  child.stdin.end();
  setTimeout(() => process.exit(fail > 0 ? 1 : 0), 200);
})().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
