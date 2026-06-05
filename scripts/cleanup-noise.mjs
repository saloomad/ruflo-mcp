#!/usr/bin/env node
/**
 * cleanup-noise.mjs — Delete test/system noise + large raw dumps from Claude Flow memory.
 *
 * Per the 3-agent council review (2026-06-05):
 *  - Delete all entries in test/ and default/ namespaces
 *  - Delete all entries in system/ namespace (just activation metadata)
 *  - Delete the 6 largest entries (>20K bytes) that are raw research dumps
 *  - Delete the 43 YouTube video-ID entries from arch (re-adding them as
 *    a proper research namespace with better keys)
 *
 * Idempotent: UNIQUE constraint means deletes are safe to re-run.
 *
 * Usage:  node scripts/cleanup-noise.mjs [--dry-run]
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = "C:/Users/becke/Ai workspaces/claude/ruflo";
const SERVER = join(REPO, 'node_modules', '@claude-flow', 'cli', 'bin', 'mcp-server.js');

const dryRun = process.argv.includes('--dry-run');

// === Plan ===
// Direct deletions by exact (namespace, key) — confirmed by sqlite query
const DIRECT_DELETES = [
  // test/ — all 6 (verification artifacts)
  { namespace: 'test', key: 'smoke-test-1', reason: 'verification noise' },
  { namespace: 'test', key: 'skill-cli-test-2026-06-05', reason: 'verification noise' },
  { namespace: 'test', key: 'final-verify-2026-06-05', reason: 'verification noise' },
  { namespace: 'test', key: 'final-verify-round-2-2026-06-05', reason: 'verification noise' },
  { namespace: 'test', key: 'final-fix-verify-2026-06-05', reason: 'verification noise' },
  { namespace: 'test', key: 'final-postscrape-2026-06-05', reason: 'verification noise' },

  // default/ — all 1
  { namespace: 'default', key: 'test_key', reason: 'verification noise' },

  // system/ — all 3 (just activation metadata)
  { namespace: 'system', key: 'activation_confirmed', reason: 'activation metadata' },
  { namespace: 'system', key: 'claude-flow-v3-activation', reason: 'activation metadata' },
  { namespace: 'system', key: 'pinecone-chimera-journal', reason: 'stale, references removed service' },

  // Large raw research dumps (>20KB)
  { namespace: 'debug', key: 'failure-modes-AI_FAILURE_MODES', reason: '73K raw dump, search-unfriendly' },
  { namespace: 'arch', key: 'research-VIDEOS_INDEX', reason: '43K INDEX file, not a learning' },
  { namespace: 'sessions', key: 'claude-journal', reason: '38K raw journal, mostly session noise' },
  { namespace: 'arch', key: 'research-ruflo-extraction-raw-2026-05-24', reason: '38K raw extraction' },
  { namespace: 'arch', key: 'research-ruflo-design-patterns-2026-05-24', reason: '27K design patterns dump' },
  { namespace: 'arch', key: 'research-ruflo-2026-05-24', reason: '21K Ruflo deep-dive dump' },

  // 43 YouTube video-ID keys in arch (will re-ingest under proper research/youtube/ namespace)
  // These are listed in a separate query — populated at runtime
];

// === MCP client ===
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
    } catch {}
  }
});

child.on('exit', () => process.exit(0));

async function callTool(name, args) {
  const r = await send('tools/call', { name, arguments: args });
  const text = r.result?.content?.[0]?.text;
  if (!text) throw new Error(`empty result from ${name}`);
  return JSON.parse(text);
}

(async () => {
  await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'cleanup-noise', version: '1.0' },
  });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  // Find all YouTube video ID keys in arch
  console.log('[scan] finding YouTube video-ID keys in arch...');
  const archList = await callTool('memory_list', { namespace: 'arch' });
  const videoIdKeys = [];
  for (const e of (archList.entries || [])) {
    const k = e.key;
    // YouTube IDs are 11 chars, alphanumeric + - and _, typically
    if (k.startsWith('research-') && k.length > 11 && k.length < 30 &&
        /^[a-zA-Z0-9_-]+$/.test(k.replace('research-', ''))) {
      videoIdKeys.push({ namespace: 'arch', key: k, reason: 'YouTube video ID, re-ingest under research/youtube/' });
    }
  }
  console.log(`[scan] found ${videoIdKeys.length} YouTube video ID keys`);

  // Combine all deletes
  const allDeletes = [...DIRECT_DELETES, ...videoIdKeys];
  console.log(`\n[plan] ${allDeletes.length} deletes queued${dryRun ? ' (DRY RUN)' : ''}`);

  let ok = 0, fail = 0, missing = 0;
  for (const d of allDeletes) {
    if (dryRun) {
      console.log(`[DRY ] would delete ${d.namespace}/${d.key}  (${d.reason})`);
      ok++;
      continue;
    }

    try {
      const r = await callTool('memory_delete', { namespace: d.namespace, key: d.key });
      if (r.success || r.deleted || r.found === false) {
        console.log(`[OK  ] ${d.namespace}/${d.key}`);
        ok++;
      } else {
        console.log(`[FAIL] ${d.namespace}/${d.key}: ${JSON.stringify(r).slice(0, 200)}`);
        fail++;
      }
    } catch (e) {
      if (e.message.includes('not found') || e.message.includes('404')) {
        console.log(`[MISS] ${d.namespace}/${d.key} (not found, ok)`);
        missing++;
      } else {
        console.log(`[ERR ] ${d.namespace}/${d.key}: ${e.message.slice(0, 100)}`);
        fail++;
      }
    }
  }

  // Final stats
  try {
    const stats = await callTool('memory_stats', {});
    console.log(`\n[stats] ${stats.totalEntries} entries, ${stats.embeddingCoverage} embedded`);
    console.log(`        namespaces: ${Object.entries(stats.namespaces).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  } catch {}

  console.log(`\n[done] ok=${ok} missing=${missing} fail=${fail}, total attempted=${allDeletes.length}`);
  child.stdin.end();
  setTimeout(() => process.exit(fail > 0 ? 1 : 0), 200);
})().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
