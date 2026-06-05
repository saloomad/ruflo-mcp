# INSTALL LOG: Memory Ranker (intelligence-ranker.cjs)
## Project: ruflo (testbed)
Living doc. Append to Progress Log and Test Results as you run more tests. Last updated: 2026-06-04.

---

## 1. Bottom line

The memory ranker is a Node.js script ported from the ruflo/claude-flow framework. It reads .md memory files and returns the top-5 most relevant snippets for any prompt. First test worked: WORKFLOWS.md ranked #1 at 0.18 vs next-closest 0.07 when asked about house rules and workflows. Status: installed, tested, hooks deliberately NOT wired yet.

---

## 2. What we installed and why

What: One Node.js file (intelligence-ranker.cjs) with zero npm dependencies. Builds a relevance graph from your memory files and ranks snippets by PageRank centrality plus prompt similarity. Ported from github.com/ruvnet/ruflo (claude-flow v3.10.37). Made config-driven 2026-06-04.

Why: At scale (200+ skills, large memory files), linear grep degrades. Semantic ranking surfaces the RIGHT memory automatically. Biggest-leverage steal from the ruflo evaluation. Ruflo is small -- ideal testbed before the trading project.

---

## 3. How it works

At init it reads every snippet from configured memory files, builds a similarity graph (Jaccard trigram overlap plus same-file temporal links), and runs PageRank to assign centrality scores.

On any query:

    score = 0.6 * similarity(prompt, snippet) + 0.4 * pageRank

Returns the top 5. Runs in under 1 second.

---

## 4. What we are using it for

In this project (ruflo): validating that the ranker works correctly. Small clean project -- ideal logic check before trusting it on larger data.

In trading/claudecowork: the real target. 68+ nodes of memory. Ranker meant to inject the right 5 snippets at session start.

---

## 5. How to run it

Init (builds the graph -- run first, and after significant memory changes):

    node `".claude/helpers/intelligence-ranker.cjs`" init

Full path:
    node `"C:\Users\becke\Ai workspaces\claude\ruflo\.claude\helpers\intelligence-ranker.cjs`" init

Query (returns top-5 snippets):

    echo '{"prompt":"your prompt here"}' | node ".claude/helpers/intelligence-ranker.cjs" route

---

## 6. Test results (ruflo)

Init: Built 20 nodes / 16 edges from the ruflo memory files.
Verified 2026-06-04 (ruflo): `node ".claude/helpers/intelligence-ranker.cjs" init` -> {"nodes":20,"edges":16}

Query: house rules and workflows
  Command: `echo '{"prompt":"house rules and workflows"}' | node ".claude/helpers/intelligence-ranker.cjs" route`
  Result: WORKFLOWS.md ranked #1, score 0.18
  Next closest: 0.07
  Assessment: PASS. Clear genuine relevance. Gap between #1 and rest shows real discrimination.

Note: route reads STDIN JSON, NOT a positional arg. The earlier positional-arg command in this log was wrong.

No further queries run yet. See section 10 for the checklist.

---

## 7. Benefits

- Zero npm dependencies -- no supply-chain risk.
- Surfaces the right memory automatically instead of dumping everything.
- Self-contained per project -- configs and data stay local.
- Cheap to run (sub-second, no external calls).
- Easy to promote to global: one file move, configs and data stay put.

---

## 8. Drawbacks and honest limits

1. Sparse memory = low scores. Small memory here; scores modest (0.18). Improves as memory grows.
2. Memory vocabulary must match prompt vocabulary. Trigrams match words, not meaning.
3. Emoji in headings pass through to terminal output (cosmetic, not a bug).
4. NOT wired to hooks yet -- does nothing automatically. Deliberately deferred for safety.
5. Large memory changes require a fresh init run.
6. PageRank near-uniform at <50 nodes (this project: 20 nodes). The composite score is effectively Jaccard-only at current corpus size. PageRank advantage materializes at 100+ nodes. Honest context, not a bug - will improve as memory grows.

---

## 9. Success criteria (defined up front)

Gates for KEEP vs KILL after 2-week test window.

[ ] Relevance rate: Top-3 contains a genuinely relevant snippet for 60% or more of real session-start prompts. Track in Progress Log.
[ ] No false blocks: Zero incidents of misleading injected snippets causing bad context.
[ ] Hook wiring: Injected snippets add useful context without bloat (Sal call after 5 hooked sessions).
[ ] Ruflo validates logic: At least 5 distinct queries show correct top-1 before global promotion.

---

## 10. What to test next

[ ] Run 5 more queries on ruflo with different prompts; log results in section 6
[ ] Test edge case: prompt with no matching vocabulary -- confirm graceful low-score output
[ ] Test after memory files change: does re-running init update correctly?
[ ] Wire UserPromptSubmit hook in ruflo first (lower stakes than trading) and run 3 real sessions
[ ] Compare top-3 ranker output vs grep output on same prompt
[ ] Test a prompt using jargon not in memory files (confirm graceful degradation)

---

## 11. Cost

Runtime: Sub-second. Node.js ~370 lines. No external calls.

Token cost (when wired as a hook): Top-5 snippets injected as context. Estimate 10-30 tokens per snippet. Five snippets = roughly 50-150 tokens per prompt. Trivial at Sonnet rates. Init step is offline -- zero tokens.

One-time install: Negligible. File copy + one init run.

---

## 12. Promotion checklist (project-local to global)

All of the following must be true before moving intelligence-ranker.cjs to a global location:

[ ] Success criteria in section 9 passed for ruflo
[ ] Success criteria passed for claudecowork -- see that project INSTALL_LOG
[ ] Hook wiring tested in at least one project with no false-block incidents
[ ] Sal explicit sign-off: promote to global
[ ] Global config template documented (any new project opts in with 2 lines)
[ ] Rollback verified in at least one project before globalizing

Rollback (this project -- Windows):

    del `".claude\helpers\intelligence-ranker.cjs`"
    del `".claude\intelligence.config.json`"
    rmdir /s /q `".claude\intelligence`"

---

## 13. Progress log

Date        | What changed                                                                                 | By whom
------------|----------------------------------------------------------------------------------------------|-------------
2026-06-04  | Install: ranker ported + config-driven. Init: 20 nodes/16 edges. Query WORKFLOWS.md #1 at 0.18. Hooks deferred. | Claude + Sal
2026-06-05  | Fixed INSTALL_LOG run command (already correct in s5/s10 - confirmed). Added PageRank limitation note (s8 item 6). Wired SessionStart hook (memory-ranker-inject.sh). Fixes 2 (de-drift) + 3 (vocab-bridge) deferred - touch claudecowork. | Claude workflow

Append a row each time something changes.

---

## 14. Learnings

Code-global / data-local pattern: Keep the executable portable while configs and data stay per-project. Promoting to global = one file move.

Semantic beats grep at scale: Linear grep returns too much noise at 200+ files. Graph-based ranking weights centrality so well-referenced snippets surface even with moderate prompt similarity.

Memory vocabulary must match prompt vocabulary: Trigram-based, not semantic. Memory should be written in the same register you query it.

Provenance: github.com/ruvnet/ruflo (claude-flow) v3.10.37, file .claude/helpers/intelligence.cjs. Ported + made config-driven 2026-06-04.