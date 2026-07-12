---
cluster: engine-core
reviewed: 2026-07-11T00:00:00Z
depth: deep
files_reviewed: 8
files_reviewed_list:
  - src/engine/color.ts
  - src/engine/ingest.ts
  - src/engine/smoothing.ts
  - src/engine/candidates.ts
  - src/engine/bagPlanner.ts
  - src/engine/symbols.ts
  - src/engine/export.ts
  - src/engine/viewer.ts
findings:
  critical: 1
  warning: 3
  info: 6
  total: 10
status: issues_found
---

# Engine-Core Cluster: Code Review Report

**Reviewed:** 2026-07-11
**Depth:** deep (cross-file traced into `useDiamondArtMatch.ts`, `matcher.worker.ts`, `worker-client.ts`, `App.tsx`, `variants.ts`)
**Files Reviewed:** 8
**Status:** issues_found

## Summary

The engine cluster is generally sound. CIEDE2000/CIELAB math is delegated to culori correctly, box-sampling loop bounds are defensively clamped (no division-by-zero, no off-by-one overlap/gap — verified against a 4×4→2×2 trace and the existing `ingest.test.ts` cases), and the bag-planner cost-minimization search is **complete and correct** (the flagged "packing correctness" concern is refuted below — see WR-02 for the real defect, which is pricing, not packing).

One correctness BLOCKER stands out: the symbol pool is smaller than the color palettes it must serve, so the exported chart/legend assigns **duplicate symbols to distinct DMC colors** in ordinary use. Two verify/extend concerns from the codebase map were checked: main-thread decode+box-sampling is **confirmed** (WR-03), and bag-planner cost-minimization packing is **correct** (refuted as a bug; the real issue is missing-price handling and the `defaultPacketCost` 500-size gap).

## Critical Issues

### CR-01: Symbol allocation wraps at 82 → duplicate symbols for distinct colors

**File:** `src/engine/symbols.ts:75-77` (pool defined at `:32-36`)
**Issue:** `CURATED_SYMBOLS` has exactly 82 entries (26 letters + 10 digits + 46 glyphs). `generateSymbolAllocation` assigns `CURATED_SYMBOLS[index % CURATED_SYMBOLS.length]` to every active color ranked by frequency. When more than 82 distinct colors are active/used — which is the normal case for the **200-color kit** (`kit='200'` yields ~200 candidates) and `'all'` — the modulo silently wraps: the 83rd-ranked color gets `'A'` again, colliding with the most-frequent color. The exported symbol chart (`export.ts` `drawCanvasOnly`/`drawCombinedCanvasSheet`) and the viewer symbol overlay (`viewer.ts:386`) then show the same glyph for two different DMC codes, making the chart ambiguous and un-stitchable — a defect in the tool's core deliverable.

**Failure scenario:** Load any photo, select the 200-color kit, leave substitution off. If the matched grid uses >82 colors, the legend prints (e.g.) two different DMC codes both keyed to `'A'`; a builder cannot tell which drill goes where.

**Fix:** Detect palette overflow and degrade deterministically instead of silently colliding — e.g. cap the symbol-bearing colors to `CURATED_SYMBOLS.length`, or extend symbols to two-character combinations once the single-glyph pool is exhausted:
```ts
sortedColors.forEach((item, index) => {
  if (index < CURATED_SYMBOLS.length) {
    allocation[item.code] = CURATED_SYMBOLS[index];
  } else {
    // e.g. 'A1','A2'… — guarantees uniqueness beyond 82 colors
    const base = CURATED_SYMBOLS[index % CURATED_SYMBOLS.length];
    const suffix = Math.floor(index / CURATED_SYMBOLS.length);
    allocation[item.code] = `${base}${suffix}`;
  }
});
```
(Or enforce upstream that symbol view requires ≤82 colors and surface a warning.)

## Warnings

### WR-01: `defaultPacketCost` has no branch for bag size 500 → 500-count bags priced as the (nonexistent) 5000 tier

**File:** `src/engine/bagPlanner.ts:199-226`
**Issue:** `defaultPacketCost` branches on `bagSize === 200 / 1000 / 2000` and treats **everything else** as a "5000 drills bulk bag" (comment at `:221`). But the drill catalog (`variants.ts` `VariantMapping`) only ever contains sizes **200, 500, 1000, 2000** — there is no 5000 size, and 500 is common. So `defaultPacketCost(type, 500)` falls through to the 5000 branch and returns `3.0 / 4.0 / 5.0 / 6.0` — a 500-count bag is priced higher than a 2000-count bag (`2000` standard = `1.4`). This value seeds `drillPacketCost` in `App.tsx:559` (`setDrillPacketCost(defaultPacketCost(drillType, drillBagSize))`) whenever `drillBagSize === 500`, showing a grossly inflated per-packet cost. (The `priceDb` used for actual pack costing is hardcoded correctly in `App.tsx` with `500: 1.10`, so this is contained to the `drillBagSize`-driven display path — hence WARNING, not BLOCKER.)

**Failure scenario:** User selects a 500-count default bag; the per-packet cost field jumps to `$3.00` for standard drills instead of ~`$1.10`.

**Fix:** Add the 500 case and drop the dead 5000 branch:
```ts
if (bagSize === 500) {
  if (type === 'standard') return 1.10;
  if (type === 'ab') return 1.30;
  if (type === 'glow') return 1.50;
  return 1.70; // crystal
}
```

### WR-02: Missing price is treated as $0 (free) in cost-minimization and pricing

**File:** `src/engine/bagPlanner.ts:89` (`priceOf = size => priceDb[size] ?? 0`), also `:99`, `:150-155`
**Issue:** In `minCostBulk`, an available bag size whose price is absent from `priceDb` is scored as **cost 0**. The search then treats that size as free and selects it as the "cheapest" combination, producing a pack that covers the requirement at an apparent `$0` cost while the real price is unknown/nonzero. `priceColorPack` has the same `priceDb[Number(size)] || 0` fallback. Cost-minimization correctness therefore silently depends on `priceDb` being complete for every available size. (Note: the packing *search itself* is complete and correct — for each combination of the larger sizes the smallest ceil-fills the remainder, and each larger count is bounded by `ceil(required/size)`, so the true minimum over `>= requiredCount` is always found. The bug is purely the price lookup.)

**Failure scenario:** A color has a 5000-ish or otherwise-uncatalogued bulk size in `DRILL_VARIANTS` that `priceDb` lacks; `minCostBulk` packs it at `$0` and reports a wrong, too-cheap supply estimate (and the Shopify cart, which shares this primitive, mispacks identically).

**Fix:** Treat an unknown price as ineligible (skip the size) or `Infinity` so it is never chosen, and surface a data gap:
```ts
const priceOf = (size: number) =>
  priceDb[size] !== undefined ? priceDb[size] : Number.POSITIVE_INFINITY;
```
(and in `priceColorPack`, sum with a guard/warn rather than `|| 0`.)

### WR-03: Image decode + box-sampling run synchronously on the main thread (confirmed perf concern)

**File:** `src/features/match/useDiamondArtMatch.ts:108-109` (calls `src/engine/ingest.ts:75 boxSampleImage`)
**Issue:** Confirms the flagged concern. Only CIEDE2000 matching is offloaded to the worker. `getImagePixels` (`drawImage` + `getImageData`) and `boxSampleImage` execute **synchronously on the main thread** inside the match `useEffect`, before the worker handoff. `getImagePixels` caps the source at `maxDimension = 2000`, so `boxSampleImage` still iterates up to ~4M source pixels (`ingest.ts:101-110` inner loop) in one blocking pass. On large uploads this janks/freezes the UI during every match trigger (image, size, or palette change).

**Failure scenario:** User uploads a 4000×3000 photo; on each dimension/palette tweak the tab blocks for the decode+downsample before the worker even starts, defeating the worker's purpose of keeping the UI responsive.

**Fix:** Move `getImagePixels`/`boxSampleImage` into the worker (transfer the decoded `ImageBitmap` via `createImageBitmap` + `OffscreenCanvas`, or transfer the raw `ImageData` buffer), so the main thread only orchestrates. At minimum, gate re-runs behind a debounce so slider drags don't re-decode per frame.

## Info

### IN-01: Color match cache has no self-invalidation; correctness depends on external `paletteHash`

**File:** `src/engine/color.ts:15,55-93`
**Issue:** `matchCache` is keyed on quantized RGB only, never on the candidate-set identity. It is *not* wrong in the live path — `worker-client.ts:19` passes `clearCache = paletteHash !== currentPaletteHash` and `matcher.worker.ts:36-38` clears on palette change, and `matchPixelGrid` clears at start — so same-palette runs correctly reuse the cache and palette changes invalidate it (verified by `worker.test.ts`). The risk is fragile coupling: any future caller of the exported `matchColor` that changes candidates without clearing gets stale matches. A reordered-but-same-membership palette that hashes equal would also keep the old first-encountered tie-break. Consider folding a palette identity into the key or documenting the invariant at the export site.

### IN-02: `getContrastColor` silently accepts malformed hex

**File:** `src/engine/symbols.ts:86-106`
**Issue:** Only 3- and 6-char hex are handled; any other length leaves `r=g=b=0` → luminance 0 → returns `'#FFFFFF'`, and non-hex characters yield `NaN` luminance → `NaN > 0.55` is false → also white. No crash, but a bad `colorMap` entry silently produces white-on-unknown text. Consider validating and falling back explicitly.

### IN-03: `boxSampleImage` can drop ~1 edge pixel column/row from sampling

**File:** `src/engine/ingest.ts:82-93`
**Issue:** `calculateCropBounds` floors `cropWidth`/`cropHeight` and the offsets, and `boxSampleImage` derives `blockWidth`/`blockHeight` from the floored crop. The final cell's `xEnd = floor(cropWidth + xOffset)` can land up to ~1px short of `srcWidth`, so the rightmost/bottom-most source column/row may be excluded from any cell average. Purely a minor downscale-fidelity nit, not a correctness failure (count is always ≥1, no div-by-zero).

### IN-04: Export canvases have no dimension cap

**File:** `src/engine/export.ts:54-56,138-143`
**Issue:** `drawCanvasOnly` adds `FRAMER_MARGIN_CELLS(20) * cellScale` margin per side with no ceiling on `cols*cellScale`. Very large grids at the default `cellScale = 20` can exceed browser canvas max-dimension/area limits (Chrome ~16384px/side), yielding a blank or failed export with no error. Consider clamping `cellScale` for large grids the way `viewer.ts:270-272` already does.

### IN-05: Inconsistent zoom clamp floor between interactive and fit paths

**File:** `src/engine/viewer.ts:128` (`minScale = 0.5`) vs `:428` (`Math.max(newScale, 0.1)`)
**Issue:** `handleZoom` floors scale at 0.5 but `fitToContainer` floors at 0.1, so fit-to-container can drop below the interactive minimum and the next wheel-in snaps oddly. Cosmetic; unify the constant.

### IN-06: `withSafetyMargin` redundant double rounding

**File:** `src/engine/bagPlanner.ts:136`
**Issue:** `Math.ceil(Math.round(requiredCount * 110) / 100)` — `requiredCount` is an integer count so `requiredCount * 110` is already integral; the inner `Math.round` is a no-op. Harmless, but confusing. Simplify to `Math.ceil(requiredCount * 1.1)`.

---

_Reviewed: 2026-07-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
