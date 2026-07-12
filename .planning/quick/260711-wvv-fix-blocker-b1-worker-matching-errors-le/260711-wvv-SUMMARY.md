---
phase: quick-260711-wvv
plan: 01
subsystem: match
tags: [worker, error-handling, ux, B1, W5]
status: complete
requires: []
provides:
  - MatcherClient.match onError seam
  - useDiamondArtMatch error state
  - App.tsx match-error banner
affects:
  - src/engine/worker-client.ts
  - src/features/match/useDiamondArtMatch.ts
  - src/App.tsx
tech-stack:
  added: []
  patterns:
    - "optional onError callback threaded worker-client -> hook -> UI banner"
key-files:
  created: []
  modified:
    - src/engine/worker-client.ts
    - src/features/match/useDiamondArtMatch.ts
    - src/App.tsx
    - src/features/match/__tests__/useDiamondArtMatch.test.tsx
    - src/engine/__tests__/worker.test.ts
decisions:
  - "onError placed as 5th positional param (after onComplete, before cols) per plan contract."
  - "worker.onerror registered inside match() to close over the per-call onError."
  - "Error banner renders JSX text only (no dangerouslySetInnerHTML) per threat T-quick-01."
metrics:
  duration: 203s
  completed: 2026-07-12
status_note: complete
---

# Phase quick-260711-wvv Plan 01: Fix Blocker B1 (worker matching errors) Summary

One-liner: Threaded an optional `onError` seam from `MatcherClient` through `useDiamondArtMatch` to an inline App banner so worker-side matching failures clear the loading overlay and surface a readable message instead of an infinite spinner.

## What Was Built

- **`worker-client.ts`** — `MatcherClient.match` now takes an optional `onError?: (message: string) => void` as its 5th parameter (before `cols`). The `{kind:'error'}` branch still `console.error`s but now also calls `onError?.(e.data.error)`. A `this.worker.onerror` handler is registered inside `match` to catch uncaught worker crashes and route them to `onError?.(ev.message || 'Worker crashed')`. No run-id/abort logic added (B2 out of scope).
- **`useDiamondArtMatch.ts`** — added `error: string | null` state, exposed on `MatchState` and the returned object. The match-trigger effect calls `setError(null)` on each new match (clears stale errors), passes an `onError` that does `setLoading(false) + setError(message)`, and the synchronous `catch` now also sets `error`.
- **`App.tsx`** — destructures the hook error as `matchError` and renders a text-only, absolutely-positioned danger banner ("Color matching failed: {matchError}") beside the loading overlay with `no-print` and a z-index above the HUD. Because loading clears on error, the spinner and banner never co-display; the banner auto-clears on the next match.
- **`useDiamondArtMatch.test.tsx`** — added a hoisted `control.mode` ('complete' | 'error'), reset in `beforeEach`, and a new test asserting the error path sets `loading === false` and `error === 'worker exploded'`. The mock `match` signature gained the `onError` param in its plan-defined position.

## Verification

- `npx tsc --noEmit`: PASS (after each code task).
- `npm run build` (`tsc && vite build`): PASS — `✓ built in 915ms`, 178 modules transformed, `dist/assets/index-y1E84bNb.js 239.55 kB │ gzip: 70.02 kB`.
- `npm test` (`vitest run`): PASS — `Test Files 17 passed (17)`, `Tests 141 passed (141)`. (Pre-existing jsdom `getContext()` stderr warnings in App.test.tsx are non-fatal noise, not failures.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated `worker.test.ts` call sites for the new signature**
- **Found during:** Task 1 (tsc gate)
- **Issue:** `src/engine/__tests__/worker.test.ts` (not listed in `files_modified`) called `client.match(...)` with `cols` in the old 5th position. Inserting `onError` at position 5 made those five calls pass a `number` where `(message: string) => void` was expected — `tsc` failed with TS2345.
- **Fix:** Inserted `undefined /* onError */` before the `cols` argument at all five call sites.
- **Files modified:** src/engine/__tests__/worker.test.ts
- **Commit:** 790bb21

## Threat Model Compliance

- **T-quick-01 (Information Disclosure / Tampering):** MITIGATED — the App banner renders `{matchError}` as JSX text content only, never `dangerouslySetInnerHTML`, so a crafted worker error string cannot inject markup/script.
- **T-quick-SC (package installs):** N/A — no new dependencies added.

## Scope Discipline

Only B1 + the W5 error surface for the worker-error path were touched. B2 (abort race), B3 (quota eviction), B4 (symbol overflow), and the App God-component refactor were left untouched. `matcher.worker.ts` was not modified (it already posts `{kind:'error'}` correctly).

## Known Stubs

None.

## Self-Check: PASSED

- Files modified exist: worker-client.ts, useDiamondArtMatch.ts, App.tsx, useDiamondArtMatch.test.tsx, worker.test.ts — all present.
- Commits exist: 790bb21, 3d26023, 19a2dfa — all in `git log`.

## Commits

- `790bb21` feat(quick-260711-wvv): add onError seam through MatcherClient and hook error state
- `3d26023` feat(quick-260711-wvv): surface match error as inline banner in App.tsx
- `19a2dfa` test(quick-260711-wvv): cover worker-error path in useDiamondArtMatch
