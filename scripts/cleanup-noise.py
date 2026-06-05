#!/usr/bin/env python
"""
cleanup-noise.py — Hard-delete noise entries from Claude Flow memory.

The MCP server's memory_delete is a SOFT delete (sets status='deleted' but leaves
the row). The DB still has 404 entries even after "deleting" 53. This script
does a proper SQL DELETE.

Per the 3-agent council review (2026-06-05):
  - Delete all entries in test/ and default/ namespaces
  - Delete all entries in system/ namespace
  - Delete the 6 largest raw research dumps
  - Delete the 43 YouTube video-ID keys in arch (re-ingest properly)

Backup created before any changes.
"""
import sqlite3
import re
import shutil
from datetime import datetime
from pathlib import Path

DB = Path(r"C:\Users\becke\Ai workspaces\claude\ruflo\.swarm\memory.db")
BACKUP = DB.with_suffix(f".db.bak-cleanup-{int(datetime.now().timestamp())}")

# Backup
shutil.copy2(DB, BACKUP)
print(f"[backup] {BACKUP}")

conn = sqlite3.connect(str(DB))
cur = conn.cursor()

# === Stats before ===
cur.execute("SELECT namespace, COUNT(*) FROM memory_entries GROUP BY namespace ORDER BY 2 DESC")
before = {ns: count for ns, count in cur.fetchall()}
print(f"\n[before] {sum(before.values())} entries: " + ", ".join(f"{k}={v}" for k, v in sorted(before.items(), key=lambda x: -x[1])))

# === Plan ===
# 1. Delete all entries in test/ default/ system/
print("\n[phase 1] deleting test/ default/ system/ entries...")
deleted = 0
for ns in ['test', 'default', 'system']:
    cur.execute("DELETE FROM memory_entries WHERE namespace = ?", (ns,))
    n = cur.rowcount
    deleted += n
    print(f"  {ns}: {n} deleted")

# 2. Delete the 6 large raw research dumps
print("\n[phase 2] deleting >20KB raw research dumps...")
LARGE_DUMPS = [
    ('debug', 'failure-modes-AI_FAILURE_MODES'),
    ('arch', 'research-VIDEOS_INDEX'),
    ('sessions', 'claude-journal'),
    ('arch', 'research-ruflo-extraction-raw-2026-05-24'),
    ('arch', 'research-ruflo-design-patterns-2026-05-24'),
    ('arch', 'research-ruflo-2026-05-24'),
]
for ns, k in LARGE_DUMPS:
    cur.execute("DELETE FROM memory_entries WHERE namespace = ? AND key = ?", (ns, k))
    n = cur.rowcount
    deleted += n
    print(f"  {ns}/{k}: {n} deleted")

# 3. Delete YouTube video-ID keys in arch (will re-ingest under research/youtube/)
print("\n[phase 3] deleting YouTube video-ID keys in arch (re-ingest later)...")
cur.execute("SELECT key FROM memory_entries WHERE namespace = 'arch' AND key LIKE 'research-%'")
arch_research_keys = [r[0] for r in cur.fetchall()]

# Filter to only YouTube-style IDs
yt_pattern = re.compile(r'^research-[A-Za-z0-9_-]{10,12}$')
video_keys = [k for k in arch_research_keys if yt_pattern.match(k)]
print(f"  Found {len(video_keys)} YouTube-style keys (out of {len(arch_research_keys)} research-* keys)")

if video_keys:
    placeholders = ','.join('?' * len(video_keys))
    cur.execute(f"DELETE FROM memory_entries WHERE namespace = 'arch' AND key IN ({placeholders})", video_keys)
    n = cur.rowcount
    deleted += n
    print(f"  Deleted {n} YouTube video keys")

# Also clean up soft-deleted records (where status='deleted')
print("\n[phase 4] cleaning up soft-deleted records (status='deleted')...")
cur.execute("DELETE FROM memory_entries WHERE status = 'deleted'")
soft_deleted = cur.rowcount
print(f"  Soft-deleted records removed: {soft_deleted}")

# Commit
conn.commit()

# === Stats after ===
cur.execute("SELECT namespace, COUNT(*) FROM memory_entries GROUP BY namespace ORDER BY 2 DESC")
after = {ns: count for ns, count in cur.fetchall()}
print(f"\n[after] {sum(after.values())} entries: " + ", ".join(f"{k}={v}" for k, v in sorted(after.items(), key=lambda x: -x[1])))

print(f"\n[summary]")
print(f"  hard-deleted:  {deleted}")
print(f"  soft-deleted:  {soft_deleted}")
print(f"  total removed: {deleted + soft_deleted}")
print(f"  before: {sum(before.values())}, after: {sum(after.values())}")
print(f"  reduction: {sum(before.values()) - sum(after.values())} entries ({(sum(before.values()) - sum(after.values())) * 100 / sum(before.values()):.0f}%)")

# Vacuum to reclaim space
print(f"\n[vacuum] reclaiming space...")
cur.execute("VACUUM")
print("  done")

conn.close()
print(f"\n[ok] backup at: {BACKUP}")
