#!/usr/bin/env python
"""
ingest-youtube-research.py — Re-ingest YouTube transcript analyses with proper
namespace + keys.

Per the 3-agent council (2026-06-05):
  - Use a NEW `research` namespace (not `arch`)
  - Use key = `youtube/{video_id}` (stable, unique, derivable from file)
  - Parse the file to extract: title, channel, url, summary, key insights
  - Add structured tags: ['youtube', 'research', channel_slug]
  - Truncate content to 4KB max (HNSW search quality suffers on huge chunks)
  - Pre-write the analysis in a structured format for better embedding

Source: C:/Users/becke/Ai workspaces/shared/learnings/research/analyses/*.md
        C:/Users/becke/Ai workspaces/shared/learnings/youtube/analyses/*.md
        (these are duplicates of the above)

Total to ingest: ~250-500 files.
"""
import sqlite3
import re
from pathlib import Path
from datetime import datetime

DB = Path(r"C:\Users\becke\Ai workspaces\claude\ruflo\.swarm\memory.db")
RESEARCH_DIRS = [
    Path(r"C:\Users\becke\Ai workspaces\shared\learnings\research\analyses"),
    Path(r"C:\Users\becke\Ai workspaces\shared\learnings\youtube\analyses"),
]
MAX_CONTENT_BYTES = 4000  # HNSW search quality sweet spot

# === Connect ===
conn = sqlite3.connect(str(DB))
cur = conn.cursor()

def extract_metadata(content: str) -> dict:
    """Parse the analysis markdown for structured fields."""
    meta = {}
    # Video ID
    m = re.search(r'\*\*Video ID:\*\*\s*([\w-]+)', content)
    if m: meta['video_id'] = m.group(1)
    # Channel
    m = re.search(r'\*\*Channel:\*\*\s*([^\n*]+)', content)
    if m: meta['channel'] = m.group(1).strip()
    # URL
    m = re.search(r'\*\*URL:\*\*\s*(\S+)', content)
    if m: meta['url'] = m.group(1)
    # Title
    lines = content.split('\n')
    if lines and lines[0].startswith('# '):
        meta['title'] = lines[0][2:].strip()
    return meta

def extract_summary(content: str) -> str:
    """Get the ## Summary section."""
    m = re.search(r'## Summary\s*\n(.*?)(?=\n## |\Z)', content, re.DOTALL)
    if m:
        return m.group(1).strip()[:MAX_CONTENT_BYTES]
    return content[:MAX_CONTENT_BYTES]

def slugify_channel(channel: str) -> str:
    """Convert 'Jack Roberts (@Itssssss_Jack)' to 'jack-roberts'."""
    s = re.sub(r'\([^)]*\)', '', channel).strip()
    s = re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
    return s or 'unknown'

# === Collect all files ===
files = []
for d in RESEARCH_DIRS:
    if d.exists():
        for f in d.glob("*.md"):
            files.append(f)
print(f"[scan] found {len(files)} files across {len(RESEARCH_DIRS)} dirs")

# === Dedupe by video_id (research/analyses and youtube/analyses are duplicates) ===
seen = {}
for f in files:
    content = f.read_text(encoding="utf-8")
    meta = extract_metadata(content)
    vid = meta.get('video_id')
    if not vid:
        # Try filename as video ID
        vid = f.stem
    if vid not in seen:
        seen[vid] = (f, content, meta)
    # else: duplicate, skip

print(f"[dedup] {len(seen)} unique videos (from {len(files)} files)")

# === Ingest ===
# We'll write directly to sqlite. The MCP server's embedding model would normally
# be invoked via memory_store, but we need to ensure embeddings are generated.
# Strategy: insert with content but no embedding, then trigger HNSW rebuild.
# For now, store with NULL embedding - the system will lazy-load.

# Actually - we need the HNSW vectors to be generated. The MCP server does that
# at write time. Without it, search will be broken.
# Solution: use the MCP server for writes (slower, but proper embeddings).

# Use the MCP CLI for writes
import subprocess

MCP_CLIENT = r"C:\Users\becke\Ai workspaces\claude\ruflo\scripts\mcp-test-client.mjs"
MCP_DIR = r"C:\Users\becke\Ai workspaces\claude\ruflo"

def store_via_mcp(key, value, namespace, tags):
    """Store via MCP using the test client."""
    import json
    args_json = json.dumps({
        "key": key,
        "value": value,
        "namespace": namespace,
        "tags": tags,
    })
    r = subprocess.run(
        ["node", MCP_CLIENT, "--call", "memory_store", args_json],
        capture_output=True, text=True, timeout=30,
        cwd=MCP_DIR
    )
    return '"success": true' in r.stdout

# === Process each video ===
ok = 0
skip = 0
fail = 0
video_keys = []
for i, (vid, (f, content, meta)) in enumerate(seen.items()):
    summary = extract_summary(content)
    channel_slug = slugify_channel(meta.get('channel', 'unknown'))
    title = meta.get('title', f.stem)
    url = meta.get('url', '')

    # Build the stored value: structured format
    stored = f"""# {title}

**Source:** YouTube research analysis
**Video ID:** {vid}
**Channel:** {meta.get('channel', 'unknown')}
**URL:** {url}
**Ingested:** {datetime.now().strftime('%Y-%m-%d')}

## Summary

{summary}

## Key Tags

- youtube-research
- channel: {channel_slug}
- searchable-by: {title[:80]}
"""
    # Truncate
    stored = stored[:MAX_CONTENT_BYTES]
    key = f"youtube/{vid}"
    tags = ['youtube', 'research', channel_slug, '2026-06-05']

    try:
        if store_via_mcp(key, stored, 'research', tags):
            ok += 1
            video_keys.append(key)
        else:
            skip += 1
    except Exception as e:
        fail += 1
        if fail < 3:
            print(f"  ERR: {vid}: {e}")

    if (i + 1) % 25 == 0:
        print(f"  [{i+1}/{len(seen)}] ok={ok} skip={skip} fail={fail}")

print(f"\n[done] {len(seen)} videos: ok={ok} skip={skip} fail={fail}")
print(f"[ok] new `research` namespace, {ok} entries with `youtube/{{video_id}}` keys")

# === Final stats ===
r = subprocess.run(
    ["node", MCP_CLIENT, "--call", "memory_stats", "{}"],
    capture_output=True, text=True, timeout=30, cwd=MCP_DIR
)
import re
m = re.search(r'totalEntries\\?":\s*(\d+).*?embeddingCoverage\\?":\s*"([^"]+)"', r.stdout, re.DOTALL)
if m:
    print(f"\n[stats] {m.group(1)} total, {m.group(2)} embedded")
