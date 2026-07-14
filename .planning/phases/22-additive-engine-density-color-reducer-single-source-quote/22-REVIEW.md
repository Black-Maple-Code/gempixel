---
phase: 22-additive-engine-density-color-reducer-single-source-quote
reviewed: 2026-07-14T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/engine/density.ts
  - src/engine/quote.ts
  - src/engine/color.ts
  - src/engine/checkout.ts
  - src/features/match/useDiamondArtMatch.ts
  - src/engine/export.ts
  - src/engine/viewer.ts
  - src/engine/__tests__/density.test.ts
  - src/engine/__tests__/quote.test.ts
  - src/engine/__tests__/color.test.ts
  - src/features/match/__tests__/useDiamondArtMatch.test.tsx
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 22: Code Review Report

**Reviewed:** 2026-07-14
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Engine-only, additive phase. Strangler discipline holds: `export.ts` and `viewer.ts`
changes are pure stray-comment deletions (no behavioral change), `checkout.ts` only adds
two exported constants, and no existing engine signature was altered or wired into `App.tsx`.

The money/quote path is strong: line items sum to the total by construction, canvas is
guarded before `toCents`, and the integer-cents contract holds across the test matrix.
`detectedColorCount` is correctly keyed on the raw match only, and the reduce step is a true
no-op on the default path (App byte-identical). Density is a single reconciled `/10` source.

The one material problem is in the color reducer: its **documented, test-"verified"
Delta-E bound is not actually enforced under merge chaining** — the guard is applied
per-step, but the reducer resolves multi-hop chains, so a cell's original→final shift can
reach ~2× (or more) the guard. This is the exact chain-displacement failure the phase
brief flags. It is dormant (reducer is off by default, not wired), so it is a latent defect
rather than a live regression — but it will surface the moment Phase 23 wires the slider.
Two robustness inconsistencies in `quote.ts` and minor fail-soft/total-order gaps round out
the findings.

## Critical Issues

### CR-01: Reducer chain displacement violates its documented Delta-E "no visible change" bound

**File:** `src/engine/color.ts:196-209, 331-371` (also `src/engine/__tests__/color.test.ts:385-399`)

**Issue:** `MERGE_GUARD_DELTA_E`'s contract is that it "bounds the worst-case
original→final per-cell color shift, so the reduction reads as 'no visible change'." The
implementation only enforces the guard **per merge step** (`if (bestDist > guard)` at line
344, comparing the *current* rarest color to its *current* nearest neighbor). But
`resolve()` (lines 363-371) deliberately follows multi-hop merge chains: a cell originally
matched to `A` that was merged `A→B`, where `B` was later merged `B→C`, resolves to `C`.

Nothing ever bounds the accumulated `A→C` distance. Because each hop may be up to `guard`,
`A→C` can be up to `N × guard` (≈2× with a single chain, more with longer chains) — well
beyond the "no visible change" bound the constant promises.

Reachable when wired: pick three near-collinear DMC shades with consecutive ΔE ≈ 9 and end-to-end
ΔE ≈ 18, counts ordered so `A` is rarest and `(A+B) < C`, and `targetN = 1`:
- Pass 1: rarest `A`; nearest is `B` (≈9 ≤ 10) → merge `A→B`.
- Pass 2: survivors `{B, C}`, still above target; rarest `B`; nearest is `C` (≈9 ≤ 10) → merge `B→C`.
- Result: every original-`A` cell now displays `C`, an ≈18 ΔE shift — visibly wrong, above `guard=10`.

The bound test at `color.test.ts:385-399` gives false confidence: its fixture (`'999'`
merges once into `'310'`, `mergedCount` 2) never chains, so it asserts the bound holds
while never exercising the path that breaks it.

The reducer is `enableReduce`-gated OFF this phase and not wired into `App.tsx`, so there is
no live user impact yet — this is a dormant defect. It is filed Critical because it is a
genuine correctness violation of a stated, test-claimed safety invariant in the core
algorithm this phase exists to deliver, and the misleading test will let it ship silently
into Phase 23.

**Fix:** Enforce the bound on the whole chain, not per step. Either (a) when evaluating a
merge of `rare`, reject it if merging would push ANY already-absorbed original color's
distance to the new target beyond `guard` (track each surviving shade's set/worst-case of
absorbed original Labs and test all of them against the candidate target), or (b) forbid a
color that has already absorbed others from being merged again (a shade, once a merge
target, becomes permanently `blocked` as a source). Then add a chaining fixture to the bound
test:

```ts
// A(≈0) — B(≈9) — C(≈18) collinear in Lab; counts force A→B then B→C at targetN=1.
const chain = [c('A',{l:50,a:0,b:0}), c('B',{l:50,a:9,b:0}), c('C',{l:50,a:18,b:0})];
const grid = ['A','B','B','C','C','C']; // A rarest, (A+B) < C
const r = reduceToColorCount(grid, {A:1,B:2,C:3}, chain, 1);
for (let i = 0; i < grid.length; i++) {
  expect(getColorDistance(labOf(chain, grid[i]), labOf(chain, r.codes[i])))
    .toBeLessThanOrEqual(MERGE_GUARD_DELTA_E); // currently FAILS for the A→C cell
}
```

## Warnings

### WR-01: `quote.ts` trusts `input.vendor` unguarded — a tampered vendor throws instead of failing soft

**File:** `src/engine/quote.ts:90-92`

**Issue:** `VENDOR_REGISTRY[input.vendor].baseShipping` assumes `input.vendor` is a valid
`CanvasVendor`. The module's whole design ethos is tamper resilience — canvas cost is
guarded (`canvasPriced`), and `checkout.ts` deliberately provides `normalizeVendor()` for
exactly this and guards `calculateCanvasCost` with `if (!config) return null`. But
`buildOrderQuote` neither normalizes nor guards the vendor. TypeScript prevents this at
compile time, yet a restored/tampered project value (the documented threat model, T-15-02)
reaching this path at runtime would `TypeError` on `undefined.baseShipping` — a hard throw
in the render/quote path, inconsistent with the surfaced-not-thrown posture used for canvas.

**Fix:** Normalize defensively at the boundary, mirroring the canvas guard:

```ts
import { normalizeVendor, VENDOR_REGISTRY, ... } from './checkout';
// ...
const vendor = normalizeVendor(input.vendor);
const shippingCents = toCents(VENDOR_REGISTRY[vendor].baseShipping + DRILLS_BASE_SHIPPING);
```

### WR-02: `quote.ts` tax line couples to unguarded `drillsCents`; a non-finite drills total throws in `toCents`

**File:** `src/engine/quote.ts:96-98`

**Issue:** `taxCents = toCents(((drillsCents + canvasCents + shippingCents) / 100) * TAX_RATE_ESTIMATE)`.
Canvas is explicitly guarded before `toCents` "which throws on non-finite," but `drillsCents`
(`supplyPlan.optimizedCostCents`, consumed raw at line 80) is **not**. If a tampered/hand-built
plan carries a non-finite `optimizedCostCents`, `Infinity * 0` / `NaN * 0` evaluates to `NaN`,
and `toCents(NaN)` throws `RangeError` — at the tax line, a confusing origin for a drills
problem. Under the normal engine flow `planOrderSupply` always yields a finite integer, so
real-world reachability is low; but the asymmetry (canvas guarded, drills not) undercuts the
module's stated fail-loud-not-crash contract. Separately, while `TAX_RATE_ESTIMATE === 0` the
entire drills/canvas/shipping sum is multiplied by 0 — dead coupling that only creates the
throw surface without contributing value today.

**Fix:** Guard drills consistently with canvas (surface via a flag or coerce), or short-circuit
tax while the rate is 0 so the throw surface disappears:

```ts
const taxCents = TAX_RATE_ESTIMATE === 0
  ? 0
  : toCents(((drillsCents + canvasCents + shippingCents) / 100) * TAX_RATE_ESTIMATE);
```

## Info

### IN-01: `formatInches` does not fail-soft on non-finite input (inconsistent with `gridToInches`)

**File:** `src/engine/density.ts:54-56`

**Issue:** The module docstring promises "never NaN, never throws," and `gridToInches`
degrades non-finite axes to 0. But `formatInches(NaN)` returns `"NaN"` and
`formatInches(Infinity)` returns `"Infinity"` — no guard. In the intended pipeline it only
ever receives already-sanitized values, so this is latent, but the fail-soft guarantee is
one-sided.

**Fix:** `return (Math.round((Number.isFinite(inches) ? inches : 0) * 10) / 10).toString();`

### IN-02: `compareDmcCode` is not a strict total order for arbitrary strings (parseInt leniency)

**File:** `src/engine/color.ts:223-230`

**Issue:** `parseInt('10x', 10) === 10`, so `compareDmcCode('10', '10x')` returns `0` for two
distinct strings. Two distinct codes that share a leading numeric parse compare "equal,"
making `Array.prototype.sort` fall back to insertion order for that pair — reintroducing the
very Object.keys-order dependence the reducer's determinism (D-02) is built to avoid. The real
DMC catalog uses clean, distinct numeric codes (or clearly non-numeric ones like `B5200`,
`Ecru`), so this cannot currently bite; it is a latent fragility in a function that is
otherwise the reducer's determinism backbone.

**Fix:** Treat a code as numeric only when it is fully numeric, e.g.
`const numA = /^\d+$/.test(a) ? Number(a) : NaN;` (same for `b`), so partial-numeric strings
fall through to `localeCompare` and the order stays antisymmetric.

---

_Reviewed: 2026-07-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
