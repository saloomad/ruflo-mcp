#!/usr/bin/env node
/**
 * Intelligence Ranker (config-driven port of intelligence.cjs / ADR-050)
 *
 * Drop-in rewrite that replaces the hard-coded .claude-flow/data/ paths and
 * ruflo-specific bootstrap logic with a per-project config file so the same
 * binary works in ANY project.
 *
 * Config: <cwd>/.claude/intelligence.config.json  (optional; falls back to defaults)
 * Shape:
 *   {
 *     "dataDir": ".claude/intelligence/data",
 *     "memorySources": ["memory", "CONTINUATION.md", "KANBAN.md"],
 *     "topK": 5,
 *     "scoreThreshold": 0.05
 *   }
 *
 * CLI:
 *   node intelligence-ranker.cjs init          -- build graph + rank, print JSON result
 *   node intelligence-ranker.cjs consolidate   -- process pending + recompute, print JSON
 *   node intelligence-ranker.cjs stats [--json]-- diagnostics
 *   echo '{"prompt":"..."}' | node intelligence-ranker.cjs route
 *                                              -- score against prompt, print ranked block
 *   node intelligence-ranker.cjs post-edit <file>  -- append to pending-insights.jsonl
 *
 * Original: .claude/helpers/intelligence.cjs
 * Port date: 2026-06-04
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ── Load config ───────────────────────────────────────────────────────────────

const CONFIG_PATH = path.join(process.cwd(), '.claude', 'intelligence.config.json');

function loadConfig() {
  const defaults = {
    dataDir:         '.claude/intelligence/data',
    memorySources:   ['memory'],
    topK:            5,
    scoreThreshold:  0.05,
  };
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      return Object.assign({}, defaults, raw);
    }
  } catch (e) {
    process.stderr.write('[INTELLIGENCE] WARN: Could not read config, using defaults: ' + e.message + '\n');
  }
  return defaults;
}

const CONFIG = loadConfig();

// ── Derived path constants ────────────────────────────────────────────────────

const DATA_DIR     = path.join(process.cwd(), CONFIG.dataDir);
const STORE_PATH   = path.join(DATA_DIR, 'auto-memory-store.json');
const GRAPH_PATH   = path.join(DATA_DIR, 'graph-state.json');
const RANKED_PATH  = path.join(DATA_DIR, 'ranked-context.json');
const PENDING_PATH = path.join(DATA_DIR, 'pending-insights.jsonl');
const SNAPSHOT_PATH = path.join(DATA_DIR, 'intelligence-snapshot.json');

const SESSION_DIR  = path.join(DATA_DIR, 'sessions');
const SESSION_FILE = path.join(SESSION_DIR, 'current.json');

// ── Safety limits ─────────────────────────────────────────────────────────────

const MAX_DATA_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_GRAPH_NODES    = 5000;

// ── Stop words ────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet',
  'both', 'either', 'neither', 'each', 'every', 'all', 'any', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'only', 'own', 'same',
  'than', 'too', 'very', 'just', 'because', 'if', 'when', 'which',
  'who', 'whom', 'this', 'that', 'these', 'those', 'it', 'its',
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJSON(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_DATA_FILE_SIZE) {
      process.stderr.write('[INTELLIGENCE] WARN: Skipping ' + path.basename(filePath) +
        ' (' + Math.round(stat.size / 1048576) + 'MB exceeds 10MB limit)\n');
      return null;
    }
  } catch { /* file may not exist yet */ }
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch { /* corrupt file -- start fresh */ }
  return null;
}

function writeJSON(filePath, data) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function tokenize(text) {
  if (!text) return [];
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function trigrams(words) {
  const t = new Set();
  for (const w of words) {
    for (let i = 0; i <= w.length - 3; i++) t.add(w.slice(i, i + 3));
  }
  return t;
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) { if (setB.has(item)) intersection++; }
  return intersection / (setA.size + setB.size - intersection);
}

// ── Deduplication ─────────────────────────────────────────────────────────────

function deduplicateById(entries) {
  if (!entries || !Array.isArray(entries)) return entries;
  const seen = new Map();
  for (const entry of entries) {
    const id = entry.id || entry.key;
    if (id) {
      seen.set(id, entry);
    } else {
      seen.set('__no_id_' + seen.size, entry);
    }
  }
  return Array.from(seen.values());
}

function fingerprintContent(text) {
  if (typeof text !== 'string' || text.length === 0) return '0';
  const norm = text.replace(/\s+/g, ' ').trim().toLowerCase();
  let h1 = 0x811c9dc5, h2 = 0xcbf29ce4;
  for (let i = 0; i < norm.length; i++) {
    const c = norm.charCodeAt(i);
    h1 ^= c; h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= c; h2 = Math.imul(h2, 0x100000001b3 & 0xffffffff) >>> 0;
  }
  return h1.toString(16) + '_' + h2.toString(16) + '_' + norm.length;
}

function deduplicateByContent(entries) {
  if (!entries || !Array.isArray(entries)) return entries;
  const seen = new Map();
  for (const entry of entries) {
    const content = entry.content || entry.summary || entry.value || '';
    const fp = fingerprintContent(typeof content === 'string' ? content : JSON.stringify(content));
    if (!seen.has(fp)) {
      seen.set(fp, entry);
    } else {
      const existing = seen.get(fp);
      if ((entry.accessCount || 0) > (existing.accessCount || 0)) seen.set(fp, entry);
    }
  }
  return Array.from(seen.values());
}

// ── Session state ─────────────────────────────────────────────────────────────

function sessionGet(key) {
  try {
    if (!fs.existsSync(SESSION_FILE)) return null;
    const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    return key ? (session.context || {})[key] : session.context;
  } catch { return null; }
}

function sessionSet(key, value) {
  try {
    if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
    let session = {};
    if (fs.existsSync(SESSION_FILE)) {
      session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    }
    if (!session.context) session.context = {};
    session.context[key] = value;
    session.updatedAt = new Date().toISOString();
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2), 'utf-8');
  } catch { /* best effort */ }
}

// ── PageRank ──────────────────────────────────────────────────────────────────

function computePageRank(nodes, edges, damping, maxIter) {
  damping  = damping  || 0.85;
  maxIter  = maxIter  || 30;

  const ids = Object.keys(nodes);
  const n   = ids.length;
  if (n === 0) return {};

  const outLinks = {};
  const inLinks  = {};
  for (const id of ids) { outLinks[id] = []; inLinks[id] = []; }
  for (const edge of edges) {
    if (outLinks[edge.sourceId]) outLinks[edge.sourceId].push(edge.targetId);
    if (inLinks[edge.targetId])  inLinks[edge.targetId].push(edge.sourceId);
  }

  const ranks = {};
  for (const id of ids) ranks[id] = 1 / n;

  for (let iter = 0; iter < maxIter; iter++) {
    const newRanks = {};
    let diff = 0;
    let danglingSum = 0;
    for (const id of ids) {
      if (outLinks[id].length === 0) danglingSum += ranks[id];
    }
    for (const id of ids) {
      let sum = 0;
      for (const src of inLinks[id]) {
        const outCount = outLinks[src].length;
        if (outCount > 0) sum += ranks[src] / outCount;
      }
      newRanks[id] = (1 - damping) / n + damping * (sum + danglingSum / n);
      diff += Math.abs(newRanks[id] - ranks[id]);
    }
    for (const id of ids) ranks[id] = newRanks[id];
    if (diff < 1e-6) break;
  }

  return ranks;
}

// ── Edge building ─────────────────────────────────────────────────────────────

function buildEdges(entries) {
  const edges      = [];
  const byCategory = {};

  for (const entry of entries) {
    const cat = entry.category || entry.namespace || 'default';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(entry);
  }

  // Temporal edges from same source file
  const byFile = {};
  for (const entry of entries) {
    const file = (entry.metadata && entry.metadata.sourceFile) || null;
    if (file) {
      if (!byFile[file]) byFile[file] = [];
      byFile[file].push(entry);
    }
  }
  for (const file of Object.keys(byFile)) {
    const group = byFile[file];
    for (let i = 0; i < group.length - 1; i++) {
      edges.push({ sourceId: group[i].id, targetId: group[i + 1].id, type: 'temporal', weight: 0.5 });
    }
  }

  // Similarity edges within categories (Jaccard > 0.3)
  for (const cat of Object.keys(byCategory)) {
    const group = byCategory[cat];
    if (group.length < 2) continue;
    const triCache = new Array(group.length);
    for (let i = 0; i < group.length; i++) {
      triCache[i] = trigrams(tokenize(group[i].content || group[i].summary || ''));
    }
    for (let i = 0; i < group.length; i++) {
      const triA = triCache[i];
      for (let j = i + 1; j < group.length; j++) {
        const sim = jaccardSimilarity(triA, triCache[j]);
        if (sim > 0.3) {
          edges.push({ sourceId: group[i].id, targetId: group[j].id, type: 'similar', weight: sim });
        }
      }
    }
  }

  return edges;
}

// ── Bootstrap from configured memory sources ──────────────────────────────────

/**
 * Scans config.memorySources (relative to cwd).
 *   - If the entry is a directory: scans all .md files inside it (one level).
 *   - If the entry is a file (.md): parses it directly.
 *   - Missing paths are silently skipped.
 *
 * Each .md file is split on ## headings into individual entries.
 */
function bootstrapFromMemoryFiles() {
  const entries = [];
  const cwd     = process.cwd();

  for (const src of (CONFIG.memorySources || [])) {
    const srcPath = path.join(cwd, src);
    if (!fs.existsSync(srcPath)) continue;

    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      parseMemoryDir(srcPath, entries);
    } else if (srcPath.endsWith('.md')) {
      parseMemoryFile(srcPath, entries);
    }
  }

  return entries;
}

function parseMemoryDir(dir, entries) {
  try {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      parseMemoryFile(path.join(dir, file), entries);
    }
  } catch { /* skip unreadable dirs */ }
}

function parseMemoryFile(filePath, entries) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content.trim()) return;

    const baseName = path.basename(filePath, '.md');
    const sections = content.split(/^##?\s+/m).filter(Boolean);

    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const section = sections[sIdx];
      const lines   = section.trim().split('\n');
      const title   = lines[0].trim();
      const body    = lines.slice(1).join('\n').trim();
      if (!body || body.length < 10) continue;

      const id = 'mem-' + baseName.replace(/[^a-z0-9]/gi, '-').toLowerCase() +
                 '-' + title.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 30) +
                 '-' + sIdx;
      entries.push({
        id,
        key:       title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50),
        content:   body.slice(0, 500),
        summary:   title,
        namespace: baseName === 'MEMORY' ? 'core' : baseName.toLowerCase(),
        type:      'semantic',
        metadata:  { sourceFile: filePath, bootstrapped: true },
        createdAt: Date.now(),
      });
    }
  } catch { /* skip unreadable files */ }
}

// ── Confidence boost ──────────────────────────────────────────────────────────

function boostConfidence(ids, amount) {
  const ranked = readJSON(RANKED_PATH);
  if (!ranked || !ranked.entries) return;
  let changed = false;
  for (const entry of ranked.entries) {
    if (ids.includes(entry.id)) {
      entry.confidence  = Math.max(0, Math.min(1, (entry.confidence || 0.5) + amount));
      entry.accessCount = (entry.accessCount || 0) + 1;
      changed = true;
    }
  }
  if (changed) writeJSON(RANKED_PATH, ranked);

  const graph = readJSON(GRAPH_PATH);
  if (graph && graph.nodes) {
    for (const id of ids) {
      if (graph.nodes[id]) {
        graph.nodes[id].confidence  = Math.max(0, Math.min(1, (graph.nodes[id].confidence || 0.5) + amount));
        graph.nodes[id].accessCount = (graph.nodes[id].accessCount || 0) + 1;
      }
    }
    writeJSON(GRAPH_PATH, graph);
  }
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

function saveSnapshot(graph, ranked) {
  const snap = {
    timestamp:    Date.now(),
    nodes:        graph  ? Object.keys(graph.nodes || {}).length : 0,
    edges:        graph  ? (graph.edges || []).length             : 0,
    pageRankSum:  0,
    confidences:  [],
    accessCounts: [],
    topPatterns:  [],
  };
  if (graph && graph.pageRanks) {
    for (const v of Object.values(graph.pageRanks)) snap.pageRankSum += v;
  }
  if (graph && graph.nodes) {
    for (const n of Object.values(graph.nodes)) {
      snap.confidences.push(n.confidence || 0.5);
      snap.accessCounts.push(n.accessCount || 0);
    }
  }
  if (ranked && ranked.entries) {
    snap.topPatterns = ranked.entries.slice(0, 10).map(e => ({
      id:          e.id,
      summary:     (e.summary || '').slice(0, 60),
      confidence:  e.confidence || 0.5,
      pageRank:    e.pageRank   || 0,
      accessCount: e.accessCount || 0,
    }));
  }
  let history = readJSON(SNAPSHOT_PATH);
  if (!Array.isArray(history)) history = [];
  history.push(snap);
  if (history.length > 50) history = history.slice(-50);
  writeJSON(SNAPSHOT_PATH, history);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * init() -- Build/refresh the graph from memory sources. <200ms budget.
 */
function init() {
  ensureDataDir();

  const graphState = readJSON(GRAPH_PATH);
  let store        = readJSON(STORE_PATH);

  if (!store || !Array.isArray(store) || store.length === 0) {
    const bootstrapped = bootstrapFromMemoryFiles();
    if (bootstrapped.length > 0) {
      store = bootstrapped;
      writeJSON(STORE_PATH, store);
    } else {
      return { nodes: 0, edges: 0, message: 'No memory entries to index' };
    }
  }

  let deduped = deduplicateById(store);
  const beforeContentDedup = deduped.length;
  deduped = deduplicateByContent(deduped);
  if (deduped.length < store.length) {
    process.stderr.write(
      '[INTELLIGENCE] Deduped store: ' + store.length + ' -> ' + deduped.length + ' entries ' +
      '(by-id: ' + (store.length - beforeContentDedup) + ' dropped, ' +
      'by-content: ' + (beforeContentDedup - deduped.length) + ' dropped)\n'
    );
    writeJSON(STORE_PATH, deduped);
  }

  // Cache hit: same node count and fresh within 60s
  if (graphState && graphState.nodeCount === deduped.length) {
    const age = Date.now() - (graphState.updatedAt || 0);
    if (age < 60000) {
      return {
        nodes:   graphState.nodeCount || Object.keys(graphState.nodes || {}).length,
        edges:   (graphState.edges || []).length,
        message: 'Graph cache hit',
      };
    }
  }

  const nodes = {};
  for (const entry of deduped) {
    const id = entry.id || entry.key || 'entry-' + Math.random().toString(36).slice(2, 8);
    nodes[id] = {
      id,
      category:    entry.namespace || entry.type || 'default',
      confidence:  (entry.metadata && entry.metadata.confidence)  || 0.5,
      accessCount: (entry.metadata && entry.metadata.accessCount) || 0,
      createdAt:   entry.createdAt || Date.now(),
    };
    entry.id = id;
  }

  const edges = buildEdges(deduped);

  const nodeCount = Object.keys(nodes).length;
  let pageRanks   = {};
  if (nodeCount > MAX_GRAPH_NODES) {
    process.stderr.write('[INTELLIGENCE] WARN: Graph has ' + nodeCount + ' nodes (>' + MAX_GRAPH_NODES + '), skipping PageRank\n');
    for (const id of Object.keys(nodes)) pageRanks[id] = 1 / nodeCount;
  } else {
    pageRanks = computePageRank(nodes, edges, 0.85, 30);
  }

  const graph = { version: 1, updatedAt: Date.now(), nodeCount: Object.keys(nodes).length, nodes, edges, pageRanks };
  writeJSON(GRAPH_PATH, graph);

  const rankedEntries = deduped.map(entry => {
    const id      = entry.id;
    const content = entry.content || entry.value || '';
    const summary = entry.summary || entry.key || '';
    return {
      id,
      content,
      summary,
      category:    entry.namespace || entry.type || 'default',
      confidence:  nodes[id] ? nodes[id].confidence  : 0.5,
      pageRank:    pageRanks[id] || 0,
      accessCount: nodes[id] ? nodes[id].accessCount : 0,
      words:       tokenize(content + ' ' + summary),
    };
  }).sort((a, b) => (0.6 * b.pageRank + 0.4 * b.confidence) - (0.6 * a.pageRank + 0.4 * a.confidence));

  writeJSON(RANKED_PATH, { version: 1, computedAt: Date.now(), entries: rankedEntries });

  return { nodes: Object.keys(nodes).length, edges: edges.length, message: 'Graph built and ranked' };
}

/**
 * getContext(prompt) -- Score and return top-K relevant entries. <15ms budget.
 */
function getContext(prompt) {
  if (!prompt) return null;

  const ranked = readJSON(RANKED_PATH);
  if (!ranked || !ranked.entries || ranked.entries.length === 0) return null;

  const promptWords    = tokenize(prompt);
  if (promptWords.length === 0) return null;
  const promptTrigrams = trigrams(promptWords);

  const ALPHA         = 0.6;
  const MIN_THRESHOLD = CONFIG.scoreThreshold || 0.05;
  const TOP_K         = CONFIG.topK || 5;

  const scored = [];
  for (const entry of ranked.entries) {
    const entryTrigrams = trigrams(entry.words || []);
    const contentMatch  = jaccardSimilarity(promptTrigrams, entryTrigrams);
    const score         = ALPHA * contentMatch + (1 - ALPHA) * (entry.pageRank || 0);
    if (score >= MIN_THRESHOLD) scored.push(Object.assign({}, entry, { score }));
  }
  if (scored.length === 0) return null;

  scored.sort((a, b) => b.score - a.score);
  const topEntries = scored.slice(0, TOP_K);

  const prevMatched = sessionGet('lastMatchedPatterns');
  const matchedIds  = topEntries.map(e => e.id);
  sessionSet('lastMatchedPatterns', matchedIds);

  if (prevMatched && Array.isArray(prevMatched)) {
    const newSet  = new Set(matchedIds);
    const toBoost = prevMatched.filter(id => !newSet.has(id));
    if (toBoost.length > 0) boostConfidence(toBoost, 0.03);
  }

  const lines = ['[INTELLIGENCE] Relevant patterns for this task:'];
  for (let i = 0; i < topEntries.length; i++) {
    const e       = topEntries[i];
    const display = (e.summary || e.content || '').slice(0, 80);
    const accessed = e.accessCount || 0;
    lines.push('  * (' + e.score.toFixed(2) + ') ' + display +
               ' [rank #' + (i + 1) + ', ' + accessed + 'x accessed]');
  }

  return lines.join('\n');
}

/**
 * recordEdit(file) -- Append to pending-insights.jsonl. <2ms budget.
 */
function recordEdit(file) {
  ensureDataDir();
  const entry = JSON.stringify({
    type:      'edit',
    file:      file || 'unknown',
    timestamp: Date.now(),
    sessionId: sessionGet('sessionId') || null,
  });
  fs.appendFileSync(PENDING_PATH, entry + '\n', 'utf-8');
}

/**
 * feedback(success) -- Boost or decay confidence for last matched patterns.
 */
function feedback(success) {
  const matchedIds = sessionGet('lastMatchedPatterns');
  if (!matchedIds || !Array.isArray(matchedIds)) return;
  boostConfidence(matchedIds, success ? 0.05 : -0.02);
}

/**
 * consolidate() -- Process pending insights, rebuild, recompute PageRank.
 */
function consolidate() {
  ensureDataDir();

  let store = readJSON(STORE_PATH);
  if (!store || !Array.isArray(store)) {
    return { entries: 0, edges: 0, newEntries: 0, message: 'No store to consolidate' };
  }

  const preDedupCount = store.length;
  store = deduplicateById(store);

  let newEntries = 0;
  if (fs.existsSync(PENDING_PATH)) {
    const lines      = fs.readFileSync(PENDING_PATH, 'utf-8').trim().split('\n').filter(Boolean);
    const editCounts = {};
    for (const line of lines) {
      try {
        const insight = JSON.parse(line);
        if (insight.file) editCounts[insight.file] = (editCounts[insight.file] || 0) + 1;
      } catch { /* skip malformed */ }
    }
    for (const [file, count] of Object.entries(editCounts)) {
      if (count >= 3) {
        const exists = store.some(e => e.metadata && e.metadata.sourceFile === file && e.metadata.autoGenerated);
        if (!exists) {
          store.push({
            id:        'insight-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            key:       'frequent-edit-' + path.basename(file),
            content:   'File ' + file + ' was edited ' + count + ' times this session -- likely a hot path worth monitoring.',
            summary:   'Frequently edited: ' + path.basename(file) + ' (' + count + 'x)',
            namespace: 'insights',
            type:      'procedural',
            metadata:  { sourceFile: file, editCount: count, autoGenerated: true },
            createdAt: Date.now(),
          });
          newEntries++;
        }
      }
    }
    fs.writeFileSync(PENDING_PATH, '', 'utf-8');
  }

  const graph = readJSON(GRAPH_PATH);
  if (graph && graph.nodes) {
    const now = Date.now();
    for (const id of Object.keys(graph.nodes)) {
      const node = graph.nodes[id];
      const hoursSinceCreation = (now - (node.createdAt || now)) / (1000 * 60 * 60);
      if (node.accessCount === 0 && hoursSinceCreation > 24) {
        node.confidence = Math.max(0.05, (node.confidence || 0.5) - 0.005 * Math.floor(hoursSinceCreation / 24));
      }
    }
  }

  for (const entry of store) {
    if (!entry.id) entry.id = 'entry-' + Math.random().toString(36).slice(2, 8);
  }
  const edges = buildEdges(store);

  const nodes = {};
  for (const entry of store) {
    nodes[entry.id] = {
      id:          entry.id,
      category:    entry.namespace || entry.type || 'default',
      confidence:  (graph && graph.nodes && graph.nodes[entry.id])
                    ? graph.nodes[entry.id].confidence
                    : (entry.metadata && entry.metadata.confidence) || 0.5,
      accessCount: (graph && graph.nodes && graph.nodes[entry.id])
                    ? graph.nodes[entry.id].accessCount
                    : (entry.metadata && entry.metadata.accessCount) || 0,
      createdAt:   entry.createdAt || Date.now(),
    };
  }

  const nodeCount = Object.keys(nodes).length;
  let pageRanks   = {};
  if (nodeCount > MAX_GRAPH_NODES) {
    process.stderr.write('[INTELLIGENCE] WARN: Graph has ' + nodeCount + ' nodes (>' + MAX_GRAPH_NODES + '), skipping PageRank in consolidate\n');
    for (const id of Object.keys(nodes)) pageRanks[id] = 1 / nodeCount;
  } else {
    pageRanks = computePageRank(nodes, edges, 0.85, 30);
  }

  writeJSON(GRAPH_PATH, {
    version:   1,
    updatedAt: Date.now(),
    nodeCount: Object.keys(nodes).length,
    nodes,
    edges,
    pageRanks,
  });

  const rankedEntries = store.map(entry => {
    const id      = entry.id;
    const content = entry.content || entry.value || '';
    const summary = entry.summary || entry.key || '';
    return {
      id,
      content,
      summary,
      category:    entry.namespace || entry.type || 'default',
      confidence:  nodes[id] ? nodes[id].confidence  : 0.5,
      pageRank:    pageRanks[id] || 0,
      accessCount: nodes[id] ? nodes[id].accessCount : 0,
      words:       tokenize(content + ' ' + summary),
    };
  }).sort((a, b) => (0.6 * b.pageRank + 0.4 * b.confidence) - (0.6 * a.pageRank + 0.4 * a.confidence));

  writeJSON(RANKED_PATH, { version: 1, computedAt: Date.now(), entries: rankedEntries });

  if (newEntries > 0 || store.length < preDedupCount) writeJSON(STORE_PATH, store);

  const updatedGraph  = readJSON(GRAPH_PATH);
  const updatedRanked = readJSON(RANKED_PATH);
  saveSnapshot(updatedGraph, updatedRanked);

  return { entries: store.length, edges: edges.length, newEntries, message: 'Consolidated' };
}

/**
 * stats() -- Diagnostic report.
 */
function stats(outputJson) {
  const graph   = readJSON(GRAPH_PATH);
  const ranked  = readJSON(RANKED_PATH);
  const history = readJSON(SNAPSHOT_PATH) || [];
  const pending = fs.existsSync(PENDING_PATH)
    ? fs.readFileSync(PENDING_PATH, 'utf-8').trim().split('\n').filter(Boolean).length
    : 0;

  const nodes   = graph ? Object.keys(graph.nodes || {}).length : 0;
  const edges   = graph ? (graph.edges || []).length            : 0;
  const density = nodes > 1 ? (2 * edges) / (nodes * (nodes - 1)) : 0;

  const confidences  = [];
  const accessCounts = [];
  if (graph && graph.nodes) {
    for (const n of Object.values(graph.nodes)) {
      confidences.push(n.confidence  || 0.5);
      accessCounts.push(n.accessCount || 0);
    }
  }
  confidences.sort((a, b) => a - b);
  const confMin    = confidences.length ? confidences[0]                                      : 0;
  const confMax    = confidences.length ? confidences[confidences.length - 1]                 : 0;
  const confMean   = confidences.length ? confidences.reduce((s, c) => s + c, 0) / confidences.length : 0;
  const confMedian = confidences.length ? confidences[Math.floor(confidences.length / 2)]     : 0;

  const totalAccess  = accessCounts.reduce((s, c) => s + c, 0);
  const accessedCount = accessCounts.filter(c => c > 0).length;

  let prSum = 0, prMax = 0, prMaxId = '';
  if (graph && graph.pageRanks) {
    for (const [id, pr] of Object.entries(graph.pageRanks)) {
      prSum += pr;
      if (pr > prMax) { prMax = pr; prMaxId = id; }
    }
  }

  const topPatterns = ((ranked && ranked.entries) || []).slice(0, 10).map((e, i) => ({
    rank:      i + 1,
    summary:   (e.summary || '').slice(0, 60),
    confidence: (e.confidence || 0.5).toFixed(3),
    pageRank:  (e.pageRank   || 0).toFixed(4),
    accessed:  e.accessCount || 0,
    score:     (0.6 * (e.pageRank || 0) + 0.4 * (e.confidence || 0.5)).toFixed(4),
  }));

  const edgeTypes = {};
  if (graph && graph.edges) {
    for (const e of graph.edges) {
      edgeTypes[e.type || 'unknown'] = (edgeTypes[e.type || 'unknown'] || 0) + 1;
    }
  }

  let delta = null;
  if (history.length >= 2) {
    const prev    = history[history.length - 2];
    const curr    = history[history.length - 1];
    const elapsed = (curr.timestamp - prev.timestamp) / 1000;
    const prevConfMean = prev.confidences.length ? prev.confidences.reduce((s, c) => s + c, 0) / prev.confidences.length : 0;
    const currConfMean = curr.confidences.length ? curr.confidences.reduce((s, c) => s + c, 0) / curr.confidences.length : 0;
    delta = {
      elapsed:        elapsed < 3600 ? Math.round(elapsed / 60) + 'm' : (elapsed / 3600).toFixed(1) + 'h',
      nodes:          curr.nodes - prev.nodes,
      edges:          curr.edges - prev.edges,
      confidenceMean: currConfMean - prevConfMean,
      totalAccess:    curr.accessCounts.reduce((s, c) => s + c, 0) - prev.accessCounts.reduce((s, c) => s + c, 0),
    };
  }

  let trend = null;
  if (history.length >= 3) {
    const first = history[0];
    const last  = history[history.length - 1];
    const firstConfMean = first.confidences.length ? first.confidences.reduce((s, c) => s + c, 0) / first.confidences.length : 0;
    const lastConfMean  = last.confidences.length  ? last.confidences.reduce((s, c)  => s + c, 0) / last.confidences.length  : 0;
    trend = {
      sessions:        history.length,
      nodeGrowth:      last.nodes - first.nodes,
      edgeGrowth:      last.edges - first.edges,
      confidenceDrift: lastConfMean - firstConfMean,
      direction:       lastConfMean > firstConfMean ? 'improving' : lastConfMean < firstConfMean ? 'declining' : 'stable',
    };
  }

  const report = {
    graph:      { nodes, edges, density: +density.toFixed(4) },
    confidence: { min: +confMin.toFixed(3), max: +confMax.toFixed(3), mean: +confMean.toFixed(3), median: +confMedian.toFixed(3) },
    access:     { total: totalAccess, patternsAccessed: accessedCount, patternsNeverAccessed: nodes - accessedCount },
    pageRank:   { sum: +prSum.toFixed(4), topNode: prMaxId, topNodeRank: +prMax.toFixed(4) },
    edgeTypes,
    pendingInsights: pending,
    snapshots:  history.length,
    topPatterns,
    delta,
    trend,
  };

  if (outputJson) { console.log(JSON.stringify(report, null, 2)); return report; }

  const bar = '+' + '-'.repeat(62) + '+';
  console.log(bar);
  console.log('|  Intelligence Diagnostics (config-driven ranker)             |');
  console.log(bar);
  console.log('');
  console.log('  Config: ' + CONFIG_PATH);
  console.log('  Data:   ' + DATA_DIR);
  console.log('  Sources: ' + (CONFIG.memorySources || []).join(', '));
  console.log('');
  console.log('  Graph');
  console.log('    Nodes:    ' + nodes);
  console.log('    Edges:    ' + edges + ' (' + Object.entries(edgeTypes).map(([t, c]) => c + ' ' + t).join(', ') + ')');
  console.log('    Density:  ' + (density * 100).toFixed(1) + '%');
  console.log('');
  console.log('  Confidence');
  console.log('    Min:      ' + confMin.toFixed(3));
  console.log('    Max:      ' + confMax.toFixed(3));
  console.log('    Mean:     ' + confMean.toFixed(3));
  console.log('    Median:   ' + confMedian.toFixed(3));
  console.log('');
  console.log('  Access');
  console.log('    Total accesses:   ' + totalAccess);
  console.log('    Patterns used:    ' + accessedCount + '/' + nodes);
  console.log('    Never accessed:   ' + (nodes - accessedCount));
  console.log('    Pending insights: ' + pending);
  console.log('');

  if (topPatterns.length > 0) {
    console.log('  Top Patterns (by composite score)');
    console.log('  ' + '-'.repeat(60));
    for (const p of topPatterns) {
      console.log('    #' + p.rank + '  ' + p.summary);
      console.log('         conf=' + p.confidence + '  pr=' + p.pageRank + '  score=' + p.score + '  accessed=' + p.accessed + 'x');
    }
    console.log('');
  }

  if (!delta && !trend) {
    console.log('  No history yet -- run more sessions to see deltas and trends.');
    console.log('');
  }

  console.log(bar);
  return report;
}

module.exports = { init, getContext, recordEdit, feedback, consolidate, stats };

// ── CLI entrypoint ─────────────────────────────────────────────────────────────

if (require.main === module) {
  const cmd      = process.argv[2];
  const jsonFlag = process.argv.includes('--json');

  if (cmd === 'init') {
    const r = init();
    console.log(JSON.stringify(r));
    process.exit(0);
  }

  if (cmd === 'consolidate') {
    const r = consolidate();
    console.log(JSON.stringify(r));
    process.exit(0);
  }

  if (cmd === 'stats') {
    stats(jsonFlag);
    process.exit(0);
  }

  if (cmd === 'post-edit') {
    const file = process.argv[3] || 'unknown';
    recordEdit(file);
    process.exit(0);
  }

  if (cmd === 'route') {
    // Read JSON from stdin, extract .prompt, print ranked context block
    let raw = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', chunk => { raw += chunk; });
    process.stdin.on('end', () => {
      let prompt = '';
      try {
        const input = JSON.parse(raw);
        prompt = input.prompt || input.message || input.content || '';
      } catch {
        prompt = raw.trim();
      }

      // Ensure graph is built
      const ranked = readJSON(RANKED_PATH);
      if (!ranked || !ranked.entries || ranked.entries.length === 0) {
        init();
      }

      const ctx = getContext(prompt);
      if (ctx) {
        process.stdout.write(ctx + '\n');
      } else {
        process.stdout.write('[INTELLIGENCE] No relevant patterns found for this prompt.\n');
      }
      process.exit(0);
    });
    return; // don't fall through
  }

  console.log('Usage: intelligence-ranker.cjs <route|stats|init|consolidate|post-edit> [options]');
  console.log('');
  console.log('  route          Read JSON from stdin (.prompt field), print ranked context');
  console.log('  stats          Show intelligence diagnostics');
  console.log('  stats --json   Output as JSON');
  console.log('  init           Build graph and rank entries from memory sources');
  console.log('  consolidate    Process pending insights and recompute');
  console.log('  post-edit <f>  Record a file edit in pending-insights.jsonl');
}
