---
phase: 22-additive-engine-density-color-reducer-single-source-quote
plan: 03
subsystem: engine/color
tags: [color-science, ciede2000, reducer, determinism, engine-additive]
requires:
  - getColorDistance (CIEDE2000 via culori) in src/engine/color.ts
  - DmcColor / LabCoordinates shapes in src/engine/types.ts
provides:
  - reduceToColorCount (deterministic target-N color reducer)
  - MERGE_GUARD_DELTA_E (=10, provisional Delta-E merge veto)
  - compareDmcCode (numeric-then-lexical DMC-code total order)
affects:
  - 22-04 (useDiamondArtMatch gated reduce step feeds one merged count)
  - Phase 23 (color-count slider / legend / cart / quote consume mergedCount)
tech-stack:
  added: []
  patterns:
    - "Pure { codes, counts } transform mirroring substituteLowCountColors, with a stable total order"
    - "Immutable-key tie-break (compareDmcCode) — never count-based, never Object.keys order"
    - "Absolute-veto guard with skip-and-continue; targetN as a ceiling"
key-files:
  created: []
  modified:
    - src/engine/color.ts
    - src/engine/__tests__/color.test.ts
decisions:
  - "MERGE_GUARD_DELTA_E shipped as 10 (documented provisional; tunable in REFINE-06)"
  - "Equidistant tie-break implemented via identical-lab guarantee in tests for exact-equal distance"
  - "Returned counts are the grid tally of newCodes (authoritative), input counts drives rarity only"
metrics:
  duration: ~15m
  completed: 2026-07-14
  tasks: 2
  files: 2
  tests_added: 13
  test_total: 321
status: complete
---

# Phase 22 Plan 03: Additive Color Reducer (reduceToColorCount) Summary

Landed the pure, deterministic, Delta-E-guarded target-N color reducer `reduceToColorCount` (plus `MERGE_GUARD_DELTA_E` and `compareDmcCode`) as additive exports in `engine/color.ts`, with a 13-case reducer test suite — the engine keystone that feeds one authoritative merged color count to viewer/legend/cart/quote (REFINE-04 support, wired in later phases).

## What Was Built

**Task 1 — `reduceToColorCount` + `MERGE_GUARD_DELTA_E` + `compareDmcCode`** (commit `f34a394`)
- `MERGE_GUARD_DELTA_E = 10` — documented provisional CIEDE2000 absolute merge veto (D-03); tunable in REFINE-06, not a runtime UI knob.
- `compareDmcCode(a, b)` — numeric-then-lexical total order reused from App.tsx's code sort (parseInt both; numeric compare if both parse, else `localeCompare`). Exported so the tie-break is directly assertable (D-02, Pitfall 2).
- `reduceToColorCount(gridCodes, counts, activeCandidates, targetN, guard = MERGE_GUARD_DELTA_E) → { codes, counts, mergedCount }`:
  - Iterative-recompute (D-01): repeatedly picks the globally-rarest surviving color, merges it into the CIEDE2000-nearest already-used shade via `getColorDistance`, recomputes each pass.
  - Determinism (D-02): surviving list sorted by `compareDmcCode` every pass (never `Object.keys` order, Pitfall 1); rarest ties break on lowest DMC code; nearest ties break on EXACT distance equality (no epsilon) then lowest DMC code; counts never used as tie-break.
  - Guard veto (D-03): a rare color whose nearest neighbor is beyond `guard` is blocked and skipped; next-rarest tried; loop stops when all surviving are blocked. `targetN` is a ceiling — `mergedCount` may legitimately exceed it.
  - Degrade-not-crash: no-op when surviving ≤ targetN; empty grid/counts never throws; un-mappable codes treated as permanently surviving; `targetN < 1` coerced to 1; inputs never mutated; merge chains resolved.
- Fully additive: `git diff` shows 186 insertions, 0 deletions — no existing signature touched.

**Task 2 — reducer test suite** (commit `7efbb28`)
- `describe('reduceToColorCount (SC4 / REFINE-04 support)')` — 13 new tests: `compareDmcCode` ordering (numeric, numeric-vs-named, equal); determinism; shuffled-key-order independence; equidistant `310`-vs-`B5200` tie-break; guard-veto skip; target-ceiling exceed and exact-hit; no-op; empty-grid degrade; no-visible-change bound (max original→final per-cell CIEDE2000 shift ≤ `MERGE_GUARD_DELTA_E`); purity (grid length preserved, no invented codes, inputs unmutated).
- Fixtures use deliberately-spaced Lab coordinates (measured distances documented inline); the tie-break uses an identical-lab pair to guarantee exact-equal distance.

## Verification

- `npx tsc --noEmit` exits 0 (strict).
- `npx vitest run src/engine/__tests__/color.test.ts` — 23 passed (10 pre-existing + 13 new).
- `npm test` — 321 passed / 30 files (baseline was 308; only grew, SC5 honored).
- `git diff src/engine/color.ts` — additive only (no existing export modified).
- No new dependency in package.json (reuses culori via `getColorDistance`).

## Deviations from Plan

**None — plan executed as written.**

One implementation detail worth recording (not a deviation): the returned `counts` is the tally of the reduced grid (`newCodes`), per the plan's step 4/5, while the input `counts` dict drives rarity selection. Test fixtures keep `counts` consistent with the grid tally (as it always is in production, straight out of `matchPixelGrid`) so both the merge ranking and the returned counts are exact.

## Notes for Downstream

- 22-04 adds the gated (no-op-default) reduce step to `useDiamondArtMatch` in the `raw → smooth → reduce` order and exposes `detectedColorCount`.
- Phase 23 wires the color-count slider (max = `detectedColorCount`) and renders `mergedCount` to legend/cart/quote.
- The `MERGE_GUARD_DELTA_E = 10` value is provisional; the no-visible-change bound test caps worst-case shift at exactly this value. Empirical tuning is REFINE-06 (v4.x). If the bound test ever fails on a real image, the contained escalation is the Hybrid (map each color from its original Lab) on the same fn surface.

## Self-Check: PASSED
- src/engine/color.ts — reduceToColorCount, MERGE_GUARD_DELTA_E, compareDmcCode present (FOUND)
- src/engine/__tests__/color.test.ts — reducer describe block present (FOUND)
- Commit f34a394 (Task 1) — FOUND
- Commit 7efbb28 (Task 2) — FOUND
