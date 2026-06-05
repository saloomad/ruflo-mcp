#!/usr/bin/env node
/**
 * scrape-to-claudeflow.mjs — Bulk-import existing knowledge into Claude Flow memory.
 *
 * Reads the existing learnings tree, journal, and shared research, and stores
 * each as a Claude Flow entry. Uses LOCAL file reading + MCP stdio — no LLM
 * calls. Cheap (just disk + MCP writes).
 *
 * Source → Namespace mapping:
 *   Ai workspaces/hermes/learnings/ai-agents/    → namespace: build (or agents)
 *   Ai workspaces/hermes/learnings/ai-memory/    → namespace: arch
 *   Ai workspaces/hermes/learnings/ai-claude/    → namespace: build
 *   Ai workspaces/hermes/learnings/ai-hermes/    → namespace: arch
 *   Ai workspaces/hermes/learnings/trading-XXXX/ → namespace: trading
 *   .claude/journal/ISSUES_LOG.md                → namespace: debug
 *   .claude/journal/JOURNAL.md                  → namespace: sessions
 *
 * Usage:
 *   node scrape-to-claudeflow.mjs              # scrape all
 *   node scrape-to-claudeflow.mjs --dry-run    # show what would be stored
 *   node scrape-to-claudeflow.mjs --limit 10   # only process first 10
 *
 * Idempotent: re-runs skip entries that already exist (UNIQUE constraint).
 */
import { spawn } from 'node:child_process';
import { dirname, join, basename, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = "C:/Users/becke/Ai workspaces/claude/ruflo";
const SERVER = join(REPO, 'node_modules', '@claude-flow', 'cli', 'bin', 'mcp-server.js');
const HOME = homedir();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;

// Map of source dir → namespace
const SOURCES = [
  { dir: "C:/Users/becke/Ai workspaces/shared/learnings/ai-agents", namespace: 'build', category: 'agent' },
  { dir: "C:/Users/becke/Ai workspaces/shared/learnings/ai-claude", namespace: 'build', category: 'claude' },
  { dir: "C:/Users/becke/Ai workspaces/shared/learnings/ai-codex", namespace: 'build', category: 'codex' },
  { dir: "C:/Users/becke/Ai workspaces/shared/learnings/ai-general", namespace: 'arch', category: 'ai' },
  { dir: "C:/Users/becke/Ai workspaces/shared/learnings/ai-hermes", namespace: 'arch', category: 'hermes' },
  { dir: "C:/Users/becke/Ai workspaces/shared/learnings/ai-memory", namespace: 'arch', category: 'memory' },
  { dir: "C:/Users/becke/Ai workspaces/shared/learnings/ai-openclaw", namespace: 'arch', category: 'openclaw' },
  { dir: "C:/Users/becke/Ai workspaces/shared/learnings/ai-security", namespace: 'debug', category: 'security' },
  { dir: "C:/Users/becke/Ai workspaces/shared/learnings/ai-tools", namespace: 'impl', category: 'tools' },
  { dir: "C:/Users/becke/Ai workspaces/shared/learnings/development", namespace: 'build', category: 'dev' },
  { dir: "C:/Users/becke/Ai workspaces/shared/learnings/infrastructure", namespace: 'arch', category: 'infra' },
  { dir: "C:/Users/becke/Ai workspaces/shared/learnings/productivity", namespace: 'arch', category: 'productivity' },
  { dir: "C:/Users/becke/Ai workspaces/shared/learnings/research", namespace: 'arch', category: 'research' },
  { dir: "C:/Users/becke/Ai workspaces/shared/learnings/tools", namespace: 'impl', category: 'tools' },
  { dir: "C:/Users/becke/Ai workspaces/shared/learnings/ai-failure-modes", namespace: 'debug', category: 'failure-modes' },
  { dir: "C:/Users/becke/Ai workspaces/shared/learnings/trading-ai", namespace: 'trading', category: 'trading-ai' },
  { dir: "C:/Users/becke/Ai workspaces/shared/learnings/trading-automation", namespace: 'trading', category: 'trading-auto' },
  { dir: "C:/Users/becke/Ai workspaces/shared/learnings/trading-psychology", namespace: 'trading', category: 'trading-psych' },
  { dir: "C:/Users/becke/Ai workspaces/shared/learnings/trading-risk", namespace: 'trading', category: 'trading-risk' },
  { dir: "C:/Users/becke/Ai workspaces/shared/learnings/trading-strategy", namespace: 'trading', category: 'trading-strat' },
  { dir: "C:/Users/becke/Ai workspaces/shared/learnings/trading-technical", namespace: 'trading', category: 'trading-tech' },
  { dir: "C:/Users/becke/Ai workspaces/shared/learnings/use-cases", namespace: 'sessions', category: 'usecase' },
];

const FILES = [
  { path: "C:/Users/becke/.claude/journal/ISSUES_LOG.md", namespace: 'debug', key: 'claude-issues-log' },
  { path: "C:/Users/becke/.claude/journal/CUMULATIVE_LOG.md", namespace: 'sessions', key: 'claude-cumulative-log' },
  { path: "C:/Users/becke/.claude/journal/JOURNAL.md", namespace: 'sessions', key: 'claude-journal' },
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

// === File discovery ===
function walk(dir, ext = '.md') {
  const results = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      try {
        const st = statSync(full);
        if (st.isFile() && full.endsWith(ext)) {
          results.push({ path: full, size: st.size });
        } else if (st.isDirectory()) {
          results.push(...walk(full, ext));
        }
      } catch {}
    }
  } catch {}
  return results;
}

// === Main ===
(async () => {
  await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'scrape-to-claudeflow', version: '1.0' },
  });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  // Collect all candidates
  const candidates = [];

  for (const src of SOURCES) {
    const files = walk(src.dir, '.md');
    for (const f of files) {
      const name = basename(f.path, '.md');
      candidates.push({
        path: f.path,
        key: `${src.category}-${name}`,
        namespace: src.namespace,
        size: f.size,
        source: relative(HOME, f.path),
      });
    }
  }

  for (const f of FILES) {
    try {
      const st = statSync(f.path);
      candidates.push({
        path: f.path,
        key: f.key,
        namespace: f.namespace,
        size: st.size,
        source: relative(HOME, f.path),
      });
    } catch {}
  }

  // Limit
  const todo = candidates.slice(0, LIMIT);
  console.log(`[scrape] ${candidates.length} candidates, processing ${todo.length}${dryRun ? ' (DRY RUN)' : ''}`);

  let ok = 0, fail = 0, skip = 0, total_bytes = 0;
  for (const c of todo) {
    let content;
    try {
      content = readFileSync(c.path, 'utf8');
    } catch (e) {
      console.log(`[ERR ] read ${c.path}: ${e.message}`);
      fail++;
      continue;
    }

    total_bytes += content.length;

    if (dryRun) {
      console.log(`[DRY ] ${c.namespace}/${c.key} (${content.length} chars) ← ${c.source}`);
      ok++;
      continue;
    }

    try {
      const r = await callTool('memory_store', {
        key: c.key,
        value: content,
        namespace: c.namespace,
        tags: ['scraped', '2026-06-05', c.namespace],
      });
      if (r.success) {
        console.log(`[OK  ] ${c.namespace}/${c.key} (${content.length}b → ${r.embeddingDimensions}d, ${r.storeTime})`);
        ok++;
      } else if (r.error && r.error.includes('UNIQUE')) {
        console.log(`[SKIP] ${c.namespace}/${c.key} (already exists)`);
        skip++;
      } else {
        console.log(`[FAIL] ${c.namespace}/${c.key}: ${r.error || JSON.stringify(r).slice(0, 100)}`);
        fail++;
      }
    } catch (e) {
      console.log(`[ERR ] ${c.namespace}/${c.key}: ${e.message.slice(0, 100)}`);
      fail++;
    }
  }

  // Final stats
  try {
    const stats = await callTool('memory_stats', {});
    console.log(`\n[stats] ${stats.totalEntries} entries, ${stats.embeddingCoverage} embedded, ${Object.keys(stats.namespaces).length} namespaces`);
  } catch {}

  console.log(`\n[done] ok=${ok} skip=${skip} fail=${fail}, total_bytes=${total_bytes}`);
  child.stdin.end();
  setTimeout(() => process.exit(fail > 0 ? 1 : 0), 200);
})().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
