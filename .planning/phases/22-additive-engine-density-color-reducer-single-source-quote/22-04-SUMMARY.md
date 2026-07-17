---
phase: 22-additive-engine-density-color-reducer-single-source-quote
plan: 04
subsystem: features/match
tags: [react-hook, color-reducer, detected-color-count, strangler-additive, determinism]
requires:
  - reduceToColorCount (deterministic target-N reducer) in src/engine/color.ts (22-03)
  - smoothMatches in src/engine/smoothing.ts
  - RawMatch / MatchInputs / MatchState in src/features/match/useDiamondArtMatch.ts
provides:
  - detectedColorCount (raw distinct DMC count) on MatchState
  - optional enableReduce / targetColorCount MatchInputs fields
  - gated raw -> smooth -> reduce post-process order in useDiamondArtMatch
affects:
  - Phase 23 (color-count slider max = detectedColorCount; REFINE-04 flips enableReduce on)
tech-stack:
  added: []
  patterns:
    - "Additive read-only signal on MatchState (detectedColorCount) keyed only on rawMatchResult"
    - "Optional gated post-process step defaulted to a byte-identical no-op (strangler)"
    - "useMemo dependency isolation: raw-keyed derivation vs post-process memo"
key-files:
  created: []
  modified:
    - src/features/match/useDiamondArtMatch.ts
    - src/features/match/__tests__/useDiamondArtMatch.test.tsx
decisions:
  - "detectedColorCount derived in a useMemo keyed ONLY on rawMatchResult (Pitfall 5 / D-04) — stable under smoothing/reduce"
  - "reduce step wired LAST (raw -> smooth -> reduce, D-05), gated behind enableReduce && Number.isFinite(targetColorCount) so App's path never calls reduceToColorCount (SC5 / Pitfall 6)"
  - "new MatchInputs fields (enableReduce/targetColorCount) OPTIONAL so App + every consumer compile byte-identical"
metrics:
  duration: ~8m
  completed: 2026-07-14
  tasks: 2
  files: 2
  tests_added: 3
  test_total: 324
status: complete
---

# Phase 22 Plan 04: useDiamondArtMatch — detectedColorCount + Gated Reduce Step Summary

Exposed `detectedColorCount` (the distinct DMC codes in the RAW matched grid) as a purely additive, raw-keyed read-only field on `MatchState`, and wired `reduceToColorCount` into the hook's post-process pipeline LAST in the canonical `raw → smooth → reduce` order — gated to a no-op default so App's `matchResult` is byte-identical this phase. This is the engine seam Phase 23's REFINE-04 color-count slider wires into; flipping it on is now a wiring change, not a pipeline change.

## What Was Built

**Task 1 — additive hook changes** (commit `ac5213d`)
- Imported `reduceToColorCount` alongside the existing `substituteLowCountColors` import from `engine/color`.
- `MatchInputs`: added two OPTIONAL fields — `enableReduce?: boolean` (off by default; Phase 23 REFINE-04 slider flips on) and `targetColorCount?: number` (slider target; ignored unless `enableReduce` and finite). Optional so App and every existing consumer compile unchanged (SC5).
- `MatchState`: added `detectedColorCount: number` (JSDoc: distinct raw DMC codes, measured before smoothing/reduction, recomputes only on a worker re-run — the stable slider max, D-04).
- Derived `detectedColorCount` in a NEW useMemo keyed ONLY on `rawMatchResult`: `Object.keys(rawMatchResult?.counts ?? {}).length` (Pitfall 5 — never off `matchResult`/post-process memo). Null-safe → 0 with no match (threat T-22-H1).
- Added the gated reduce step in the existing post-process useMemo AFTER the smoothing block (D-05 order): runs only when `enableReduce === true && typeof targetColorCount === 'number' && Number.isFinite(targetColorCount)`, then reassigns `matches`/`counts` from `reduceToColorCount(...)`'s `codes`/`counts`. Default path never calls it, so the `matches === rawMatchResult.matches` identity return is preserved and App's `matchResult`/`total` stay byte-identical (Pitfall 6, threat T-22-H2). Added `enableReduce`, `targetColorCount` to the memo dep array; returned `detectedColorCount`.

**Task 2 — hook test coverage** (commit `065a336`)
- New `describe('detectedColorCount (D-04)')` block reusing the existing `mount` harness + `settle` poller and the hoisted MatcherClient mock (completes with `{ A: 2, B: 1 }`). Three cases:
  1. `detectedColorCount === 2` after a match settles (distinct raw codes).
  2. `detectedColorCount === 0` before any match (image null → worker never runs).
  3. STABILITY — mount with `enableSmoothing: true, smoothingStrength: 3`, settle, then rerender with `smoothingStrength: 1` and assert `detectedColorCount` is UNCHANGED (still 2), proving it is keyed on the raw match, not the post-process (the coupled-controls guard).
- Default no-op reduce path exercised throughout (`baseInputs` omits the two optional fields).

## Verification

- `npx tsc --noEmit` exits 0 (strict; App.tsx compiles without passing the new optional inputs).
- `npx vitest run src/features/match/__tests__/useDiamondArtMatch.test.tsx` — 9 passed (6 pre-existing + 3 new).
- `npm test` — 324 passed / 30 files (baseline 321; only grew, SC5 honored).
- `git diff` shows only additive changes to the hook (worker effect / restore seam untouched); App.tsx unmodified → `matchResult` byte-identical on the default path.
- No new dependency in package.json (imports existing `engine/color`).

## Deviations from Plan

**None — plan executed as written.**

Task 1 carries `tdd="true"`; the plan intentionally splits it (implementation with a tsc gate) from Task 2 (the behavioral test suite), so the RED/GREEN cadence lands as a `feat` commit followed by a `test` commit. Followed the plan's task structure as authoritative.

## Threat Surface

All three registered threats mitigated as planned: T-22-H1 (null-safe `?? {}` → 0, never throws), T-22-H2 (reduce gated behind `enableReduce && Number.isFinite(targetColorCount)`; default path never calls the reducer → App byte-identical), T-22-H3 (zero new dependencies). No new security-relevant surface introduced.

## Notes for Downstream

- Phase 23 (REFINE-04): set `enableReduce: true` and bind `targetColorCount` to the color-count slider whose max is `detectedColorCount`. The reducer's `mergedCount` (returned by `reduceToColorCount`, not surfaced by the hook) is the count legend/cart/quote will render — Phase 23 can read it via the reduced grid's distinct count or extend the hook to pass it through if a live merged-count readout beside the slider is wanted.
- `detectedColorCount` is intentionally invariant under smoothing/reduce; a size/image/palette change is a legitimate worker re-run that moves it.

## Self-Check: PASSED
- src/features/match/useDiamondArtMatch.ts — detectedColorCount field + raw-keyed useMemo + gated reduce step present (FOUND)
- src/features/match/__tests__/useDiamondArtMatch.test.tsx — describe('detectedColorCount (D-04)') block present (FOUND)
- Commit ac5213d (Task 1) — FOUND
- Commit 065a336 (Task 2) — FOUND
