#!/usr/bin/env node
/**
 * Claude Flow MCP test client.
 * Spawns the stdio MCP server, performs initialize + tools/list + tools/call,
 * and prints results. Use this to verify Claude Flow MCP is operational.
 *
 * Usage:  node scripts/mcp-test-client.mjs
 *         node scripts/mcp-test-client.mjs --call memory_store '{"key":"k","value":"v","namespace":"test"}'
 */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const SERVER = join(REPO, 'node_modules', '@claude-flow', 'cli', 'bin', 'mcp-server.js');

const args = process.argv.slice(2);
const callMode = args.includes('--call');
const toolName = callMode ? args[args.indexOf('--call') + 1] : null;
const toolArgs = callMode ? JSON.parse(args[args.indexOf('--call') + 2] || '{}') : {};

const child = spawn(process.execPath, [SERVER], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: { ...process.env, NODE_OPTIONS: '' },
  cwd: REPO,
});

let buffer = '';
const pending = new Map();

function send(msg) {
  return new Promise((resolve) => {
    pending.set(msg.id, resolve);
    child.stdin.write(JSON.stringify(msg) + '\n');
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
        pending.get(parsed.id)(parsed);
        pending.delete(parsed.id);
      } else if (parsed.id == null && parsed.error) {
        console.error('[server error]', parsed.error);
      }
    } catch (e) {
      console.error('[parse fail]', line.slice(0, 200));
    }
  }
});

child.on('exit', (code) => {
  console.error(`[client] server exited (code=${code})`);
  process.exit(code ?? 0);
});

(async () => {
  // 1. initialize
  const init = await send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'ruflo-mcp-test-client', version: '1.0' },
    },
  });
  console.log('=== initialize ===');
  console.log(JSON.stringify(init.result, null, 2));

  // 2. notifications/initialized (no response expected, but server needs it)
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  // 3. tools/list
  const list = await send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const toolNames = (list.result?.tools || []).map((t) => t.name);
  console.log(`\n=== tools/list (${toolNames.length} tools) ===`);
  console.log(toolNames.join(', '));

  // 4. optional tools/call
  if (callMode) {
    console.log(`\n=== tools/call ${toolName} ===`);
    const call = await send({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: toolName, arguments: toolArgs },
    });
    console.log(JSON.stringify(call, null, 2));
  }

  // shutdown
  child.stdin.end();
  setTimeout(() => process.exit(0), 200);
})().catch((e) => {
  console.error('[client] error:', e);
  process.exit(1);
});
