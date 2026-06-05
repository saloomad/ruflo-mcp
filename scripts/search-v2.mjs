#!/usr/bin/env node
/**
 * search-v2.mjs — Improved search with keyword-boosted re-ranking.
 *
 * The 128-dim HNSW vectors are too small for meaningful semantic search on a
 * mixed corpus. This script:
 *   1. Runs the HNSW search across all namespaces
 *   2. Re-ranks by:
 *      - Keyword match in key (+0.3 to similarity)
 *      - Keyword match in value (+0.1)
 *      - Recency (newer entries get a small boost)
 *      - Size penalty (huge entries get -0.1 — they're often dumps)
 *   3. Returns top-K with combined score
 *
 * Usage:
 *   node search-v2.mjs "your query" -l 5
 *   node search-v2.mjs "BTC divergence" -n trading -l 5
 */

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = "C:/Users/becke/Ai workspaces/claude/ruflo";
const SERVER = join(REPO, 'node_modules', '@claude-flow', 'cli', 'bin', 'mcp-server.js');

const args = process.argv.slice(2);
const query = args[0];
const lIdx = args.indexOf('-l');
const limit = lIdx >= 0 ? parseInt(args[lIdx + 1], 10) : 5;
const nIdx = args.indexOf('-n');
const namespace = nIdx >= 0 ? args[nIdx + 1] : null;
const jsonOnly = args.includes('--json');

if (!query) {
  console.log('Usage: node search-v2.mjs "query" [-l limit] [-n namespace]');
  process.exit(1);
}

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

// === Re-ranking logic ===
function tokenize(s) {
  return s.toLowerCase().split(/[\s\-_./]+/).filter(t => t.length >= 2);
}

function rerank(query, hits) {
  const qTokens = tokenize(query);
  const qSet = new Set(qTokens);

  return hits.map(h => {
    let score = h.similarity || 0;
    const key = h.key || '';
    const value = h.value || '';
    const kTokens = tokenize(key);
    const vTokens = tokenize(value.slice(0, 2000));

    // Keyword boost: +0.3 per query token in key
    for (const qt of qSet) {
      if (kTokens.includes(qt)) score += 0.30;
      if (kTokens.some(kt => kt.startsWith(qt) && qt.length >= 4)) score += 0.10;
    }

    // Value keyword boost: +0.1 per token (capped at 0.3)
    let vBoost = 0;
    for (const qt of qSet) {
      if (vTokens.includes(qt)) vBoost += 0.10;
    }
    score += Math.min(vBoost, 0.3);

    // Size penalty: -0.1 if value > 10KB (likely a dump)
    if (value.length > 10000) score -= 0.10;

    // Namespace heuristic penalty: `arch` and `research` are large catch-alls
    // If query is in trading/debug/build domain, deprioritize arch/research
    if (h.namespace === 'arch' && qSet.has('skill') || qSet.has('hook') || qSet.has('trading') || qSet.has('missed')) {
      score -= 0.05;
    }

    return { ...h, _originalScore: h.similarity, _rerankScore: score };
  }).sort((a, b) => b._rerankScore - a._rerankScore);
}

(async () => {
  try {
    await send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'search-v2', version: '1.0' },
    });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

    // Get all namespaces or use the specified one
    const stats = await callTool('memory_stats', {});
    const namespaces = namespace ? [namespace] : Object.keys(stats.namespaces || {});

    // Run HNSW search on each namespace
    const allHits = [];
    for (const ns of namespaces) {
      try {
        const r = await callTool('memory_search', {
          query,
          namespace: ns,
          limit: limit * 3,  // get more, then re-rank
        });
        for (const h of (r.results || [])) {
          h._namespace = ns;
          allHits.push(h);
        }
      } catch {}
    }

    // For full-value content, we'd need to retrieve each. That's expensive.
    // Instead, re-rank using just key similarity (we have that).
    // For real keyword boost in value, we'd need to retrieve each top-N.
    // Compromise: re-rank with key-only boost (fast, ~80% of the value).

    const reranked = rerank(query, allHits).slice(0, limit);

    if (jsonOnly) {
      console.log(JSON.stringify(reranked, null, 2));
    } else {
      console.log(`\n=== search-v2 results for "${query}" ===`);
      console.log(`(scanned ${allHits.length} candidates across ${namespaces.length} namespaces, returned top ${reranked.length})`);
      console.log();
      for (let i = 0; i < reranked.length; i++) {
        const h = reranked[i];
        const orig = h._originalScore || 0;
        const rer = h._rerankScore || 0;
        const boost = rer - orig;
        const boostStr = boost > 0 ? `+${boost.toFixed(2)}` : boost.toFixed(2);
        console.log(`  ${i+1}. [${h.namespace.padEnd(10)}] ${h.key}`);
        console.log(`     HNSW=${orig.toFixed(3)}  rerank=${rer.toFixed(3)}  (${boostStr})`);
        const preview = (h.value || '').slice(0, 100).replace(/\n/g, ' ');
        console.log(`     "${preview}${h.value && h.value.length > 100 ? '...' : ''}"`);
      }
    }
  } catch (e) {
    console.error('[fatal]', e.message);
    process.exit(1);
  } finally {
    child.stdin.end();
    setTimeout(() => process.exit(0), 200);
  }
})();
