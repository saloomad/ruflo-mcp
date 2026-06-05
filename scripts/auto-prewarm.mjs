#!/usr/bin/env node
/**
 * Claude Flow auto-prewarm hook.
 *
 * Runs at session start (Hermes SessionStart, Claude Code SessionStart).
 * Performs a one-shot memory_search for "Sal correction" / "disease rule" / "preferences"
 * and returns the top hits as JSON the agent can read into context.
 *
 * Wire from:
 *   - Hermes:  ~/.hermes/agent-hooks/session-start-claudeflow.cmd
 *   - Claude:  ~/.claude/hooks/SessionStart (claudeflow-prewarm.cmd)
 *
 * Usage:  node scripts/auto-prewarm.mjs [--query "your boot query"]
 *         node scripts/auto-prewarm.mjs --json
 *         (the --json flag prints just the JSON for piping)
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const SERVER = join(REPO, 'node_modules', '@claude-flow', 'cli', 'bin', 'mcp-server.js');

const args = process.argv.slice(2);
const jsonOnly = args.includes('--json');
const queryArg = args.includes('--query') ? args[args.indexOf('--query') + 1] : null;

// Default boot query — the 3 things every session should surface
const QUERIES = queryArg
  ? [queryArg]
  : [
      'Sal correction disease rule',
      'how to operate Claude Flow',
      'ruflo wiring locations and paths',
    ];

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
        reject(new Error(`timeout: ${method}`));
      }
    }, 10000);
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
    } catch {}
  }
});

child.on('exit', () => process.exit(0));

async function callMCPTool(name, args) {
  const r = await send('tools/call', { name, arguments: args });
  const text = r.result?.content?.[0]?.text;
  if (!text) throw new Error(`empty result from ${name}`);
  return JSON.parse(text);
}

(async () => {
  try {
    await send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'auto-prewarm', version: '1.0' },
    });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

    const boot = { timestamp: new Date().toISOString(), queries: [], stats: null };
    for (const q of QUERIES) {
      try {
        const r = await callMCPTool('memory_search', { query: q, limit: 3 });
        boot.queries.push({ query: q, hits: r.results || [] });
      } catch (e) {
        boot.queries.push({ query: q, error: e.message });
      }
    }

    try {
      boot.stats = await callMCPTool('memory_stats', {});
    } catch {}

    if (jsonOnly) {
      console.log(JSON.stringify(boot, null, 2));
    } else {
      // Human-readable summary
      console.log(`\n=== Claude Flow prewarm @ ${boot.timestamp} ===`);
      console.log(`Memory: ${boot.stats?.totalEntries ?? '?'} entries (${boot.stats?.embeddingCoverage ?? '?'} embedded)`);
      console.log(`Namespaces: ${boot.stats ? Object.keys(boot.stats.namespaces || {}).join(', ') : '?'}\n`);
      for (const q of boot.queries) {
        console.log(`Q: ${q.query}`);
        if (q.error) {
          console.log(`  ERR: ${q.error}`);
        } else if (q.hits.length === 0) {
          console.log(`  (no hits)`);
        } else {
          for (const h of q.hits) {
            console.log(`  • [${h.namespace}/${h.key}] sim=${(h.similarity ?? 0).toFixed(3)}`);
            console.log(`    ${(h.value || '').slice(0, 120).replace(/\n/g, ' ')}${h.value?.length > 120 ? '...' : ''}`);
          }
        }
        console.log('');
      }
    }
  } catch (e) {
    if (jsonOnly) {
      console.log(JSON.stringify({ error: e.message, fatal: true }));
    } else {
      console.error(`[prewarm] fatal: ${e.message}`);
    }
    process.exit(1);
  } finally {
    child.stdin.end();
    setTimeout(() => process.exit(0), 200);
  }
})();
