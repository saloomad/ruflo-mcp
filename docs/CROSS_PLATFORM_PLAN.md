# Claude Flow MCP — Cross-Platform Activation Plan

**Status (2026-06-05):** LIVE on Windows dev box. Pending deployment to Linux PC and VPS for true global cross-device memory.

## What "globally active" means

For Claude Flow MCP to be globally available:

1. ✅ **MCP server installed and tested** — `ruflo/.claude/memory.db` has 15 entries
2. ✅ **Wired into Claude Code** — `~/.claude/settings.json` has `claudeflow-memory` MCP server + prewarm hook
3. ✅ **Wired into Hermes CLI** — `~/.hermes/config.yaml` has `mcp_servers.claudeflow-memory` + `hooks.on_session_start` prewarm
4. ✅ **Wired into Hermes Desktop** — `~/AppData/Local/hermes/config.yaml` has both
5. ✅ **Auto-prewarm hook** — every Claude Code + Hermes session auto-searches memory at boot (~1.5s cost)
6. ⏳ **Synced to GitHub** — `https://github.com/saloomad/ruflo-mcp` (public, all scripts + memory.db)
7. ⏳ **Deployed to Linux PC** — clone ruflo repo, run `npm install`, point Hermes there
8. ⏳ **Deployed to VPS** — same as Linux, but with HTTP transport exposure

## Linux PC (open-claw) — pending Sal approval

```bash
# 1. SSH into Linux PC
ssh open-claw

# 2. Clone ruflo repo
mkdir -p ~/ruflo
cd ~/ruflo
git clone https://github.com/saloomad/ruflo-mcp.git .   # includes memory.db

# 3. Install dependencies
npm install

# 4. Verify
node scripts/mcp-test-client.mjs --call memory_stats '{}'
# Expect: totalEntries: 15 (or higher if we sync more)

# 5. Wire Hermes on Linux (if Hermes runs there)
# Edit ~/.hermes/config.yaml → add mcp_servers.claudeflow-memory block
# (same YAML as in CLAUDE_FLOW_GUIDE.md §2.2)
```

## VPS (Kimi) — pending Sal approval

```bash
# On VPS
mkdir -p ~/ruflo
cd ~/ruflo
git clone https://github.com/saloomad/ruflo-mcp.git .

npm install

# Run via HTTP transport (works correctly on Linux unlike Windows)
# Use a process manager (pm2, systemd, or supervisord) for persistence
nohup npx claude-flow mcp start -t http -p 3000 -d > /var/log/claudeflow-mcp.log 2>&1 &

# OR: use systemd (recommended for production)
cat > /etc/systemd/system/claudeflow-mcp.service <<EOF
[Unit]
Description=Claude Flow MCP server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/ruflo
ExecStart=/usr/bin/npx claude-flow mcp start -t http -p 3000
Restart=always
RestartSec=5
Environment=MEMORY_PATH=/root/ruflo/.claude

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now claudeflow-mcp
systemctl status claudeflow-mcp    # should be active (running)
```

**Then from Windows or any other machine, connect via HTTP transport:**

```yaml
# In any agent's MCP config
mcpServers:
  claudeflow-memory-remote:
    type: http
    url: http://<VPS_IP>:3000/mcp
```

## Cross-machine conflict resolution

If two machines write the same `(namespace, key)` between syncs:

1. **Use machine-prefixed keys**: `windows-btc-2026-06-05-miss` vs `linux-btc-2026-06-05-miss`
2. **Or: implement a confidence timestamp** — newer-write-wins, but log the conflict
3. **Or: use per-machine databases** + a `merge_unified` nightly job that ranks by confidence

For Phase 1, **single-source-of-truth is the simplest**: pick one machine as canonical (Windows dev box for now), and treat other machines as read-only consumers with a daily sync from Windows.

## Sync scripts (to add to `ruflo-mcp/scripts/`)

```bash
# scripts/sync-push.sh — push local memory.db to git
#!/bin/bash
cd "$(dirname "$0")/.."
git add .claude/memory.db
git commit -m "memory: $(date +%Y-%m-%d) — $(npx claude-flow memory stats --json 2>/dev/null | jq -r '.totalEntries') entries"
git push origin master

# scripts/sync-pull.sh — pull latest memory.db from git
#!/bin/bash
cd "$(dirname "$0")/.."
git pull origin master
# Re-init to load any new schema
npx claude-flow memory init
```

## Status checklist

- [x] Windows dev box: MCP server + 3 runtimes wired + prewarm hook
- [x] Initial seed (15 entries, 100% embedded)
- [x] GitHub repo (public, ruflo-mcp)
- [x] Comprehensive guide (`docs/CLAUDE_FLOW_GUIDE.md`)
- [x] Cross-platform plan (this file)
- [ ] Linux PC deployment (awaiting Sal)
- [ ] VPS deployment + systemd service (awaiting Sal)
- [ ] HTTP transport verified cross-WAN
- [ ] Sync scripts (push/pull) added
- [ ] First week of organic use → auto-grow knowledge graph

*Last updated: 2026-06-05 by Sal's directive.*
