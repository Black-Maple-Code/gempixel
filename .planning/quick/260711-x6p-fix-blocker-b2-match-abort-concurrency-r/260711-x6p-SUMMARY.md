---
phase: quick-260711-x6p
plan: 01
subsystem: engine/worker
status: complete
tags: [concurrency, web-worker, bugfix, B2]
requirements: [B2, CR-01]
dependency_graph:
  requires:
    - "worker-client onError + worker.onerror error handling (260711-wvv)"
  provides:
    - "runId-guarded worker matching that supersedes stale overlapping runs"
  affects:
    - src/engine/matcher.worker.ts
    - src/engine/worker-client.ts
tech_stack:
  added: []
  patterns:
    - "Monotonic per-run id supersession across the postMessage boundary"
key_files:
  created: []
  modified:
    - src/engine/matcher.worker.ts
    - src/engine/worker-client.ts
    - src/engine/__tests__/worker.test.ts
decisions:
  - "Replace the reset-a-shared-boolean abort mechanism with a monotonic runId adopted by the worker and echoed on every reply; both sides drop anything that does not match the live runId."
  - "Keep the explicit {kind:'abort'} handler intact so the existing abort-signaling capability is retained alongside runId supersession."
metrics:
  duration_seconds: 300
  completed_date: 2026-07-12
  tasks: 2
  files: 3
---

# Phase quick-260711-x6p Plan 01: Fix Blocker B2 — Match-Abort Concurrency Race Summary

Replaced the shared-boolean abort flag with a monotonic per-run id so overlapping / rapid re-matches (grid-size slider drag, fast palette toggling) can never apply a stale, wrong-dimension worker result to the live grid.

## What Was Built

**Task 1 — runId supersession (worker + client):**
- `matcher.worker.ts`: added module-scope `currentRunId`, adopted from each incoming `match` message (supersedes any prior run). `runMatching` now takes `runId` as its first parameter; the row-loop guard and the post-loop final guard changed from `if (isAborted)` to `if (isAborted || runId !== currentRunId)`, so a superseded run returns at its next yield point and posts nothing further. Every reply (progress/result/error) is now stamped with its `runId`.
- `worker-client.ts`: added `private runSeq = 0`; each `match()` captures `const runId = ++this.runSeq` and includes it in the `match` payload. The `worker.postMessage({ kind: 'abort' })` line was removed (runId supersession replaces it). The first statement of the `onmessage` handler drops stale replies: `if (e.data.runId !== runId) return;`.

**Task 2 — regression test:**
- Added one `it(...)` to `worker.test.ts` reproducing the CR-01 race: run A (10 px, cols=1) yields after its first row, then a rapid overlapping run B (2 px, cols=2, a different grid dimension) supersedes it. Asserts exactly one delivered result sized for B (`matches.length === 2`), proving A's stale length-10 result is neither posted by the worker nor delivered by the client.

## Deviations from Plan

None — plan executed exactly as written.

## Preserved (scope discipline)

- B1/W5 error handling from 260711-wvv is intact: the `onError` parameter, the `onError?.(...)` calls, and the entire `worker.onerror` handler remain outside the runId message filter so uncaught crashes still surface.
- `paletteHash`-driven `clearCache` cache-invalidation semantics unchanged (RGBA/color cache still clears only on palette change) — verified green by the existing cache-persistence test.
- The explicit `{kind:'abort'}` handler and the abort-signaling test remain unchanged.
- No changes outside the three listed files. B3 (quota), B4 (symbols), and App.tsx were not touched.

## Verification

Both gates pass. Verbatim final result lines:

- `npm run build`: `✓ built in 774ms`
- `npm test` — `Test Files  17 passed (17)` / `Tests  142 passed (142)`

`npx tsc --noEmit` also passed clean after the code task (runId threaded through both files with no type errors). Test count went from 141 → 142 (one new regression test, no pre-existing test modified).

## Commits

- `6a3e563` fix(quick-260711-x6p): supersede stale worker runs via monotonic runId
- `43b267f` test(quick-260711-x6p): assert superseded overlapping run's result is ignored

## Self-Check: PASSED

- src/engine/matcher.worker.ts — FOUND (modified, committed in 6a3e563)
- src/engine/worker-client.ts — FOUND (modified, committed in 6a3e563)
- src/engine/__tests__/worker.test.ts — FOUND (modified, committed in 43b267f)
- Commit 6a3e563 — FOUND in git log
- Commit 43b267f — FOUND in git log
</content>
</invoke>
