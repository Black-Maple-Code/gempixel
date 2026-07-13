---
phase: 15-trustworthy-pricing-data-foundation
reviewed: 2026-07-12T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/App.tsx
  - src/engine/checkout.ts
  - src/engine/projectStore.ts
  - src/features/wizard/steps/Step3Canvas.tsx
  - src/engine/money.ts
  - src/engine/bagPlanner.ts
  - src/engine/variants.ts
  - src/engine/__tests__/checkout.test.ts
  - src/engine/__tests__/money.test.ts
  - src/engine/__tests__/bagPlanner.test.ts
  - src/engine/__tests__/variants.integrity.test.ts
findings:
  critical: 0
  blocker: 0
  warning: 2
  info: 2
  total: 4
status: resolved
resolution_commit: e13ddca
---

# Phase 15: Code Review Report

**Reviewed:** 2026-07-12
**Depth:** standard
**Files Reviewed:** 11
**Status:** resolved (warnings fixed in `e13ddca`; info items acknowledged)

## Summary

Reviewed the phase-15 pricing/data-integrity diff (base `5c1a0bd..HEAD`): the integer-cents
money module (`money.ts`), the bag cost-minimizer + unpriced-size guards (`bagPlanner.ts`),
the vendor-union narrowing + `normalizeVendor` migration + `calculateCanvasCost` null guard
(`checkout.ts`), the App-side cents reconciliation and the new unpriced/unmapped surfacing
effect (`App.tsx`), plus the data-integrity test suite.

The core money math is sound. `toCents` is EPSILON-safe and fails loud on non-finite input;
the render-path calls to `toCents(row.costSafety)` / `toCents(canvasBaseCost)` /
`toCents(canvasShippingEstimate)` are all fed values that are provably finite (state setters
use `parseFloat(...) || 0`; `priceColorPack` returns `fromCents(...)`; `calculateCanvasCost`
returns finite-or-null and the null branch is guarded), so the reconciliation cannot crash
the render. Line-item cents sum exactly to the total. The cost-minimizer's Infinity guard,
the `pricedSizes` exclusion, and the `normalizeVendor`/`$0`-hole guards are correct and
well-tested.

The defects found are in the new **surfacing effect** in `App.tsx`: it never clears the
banner once the condition resolves, and its "left out of the supply plan" message contradicts
what the fixed-bag pricing path actually bills. No security issues found (URL building uses
`URLSearchParams`/`encodeURIComponent`; ids use a CSPRNG).

## Warnings

### WR-01: Unpriced/unmapped banner effect never clears — stale, misleading error persists

**File:** `src/App.tsx:1009-1026`
**Issue:** The effect only ever *sets* `actionError`; it has no `else` branch. When the user
resolves the condition (prices the last unpriced bag size, or switches `drillStyle` so every
color is mapped), `unpricedColorsKey` / `unmappedShapeKey` go to `''`, the effect re-runs
(deps changed), `messages.length === 0`, and `setActionError` is never called — so the banner
keeps displaying a now-false warning that still names colors the user already fixed. Because
`actionError` is a *shared* channel (also used for storage-full and download failures at
lines 369/871/898), a resolved-but-uncleared pricing warning also masks/duplicates unrelated
errors. This directly undercuts the "trustworthy pricing" goal: the user sees "colors were
left out of the total" after the total is already correct.
**Fix:** Always drive the banner from the derived state, including the empty case:
```ts
useEffect(() => {
  const messages: string[] = [];
  if (unpricedColorsKey) { /* ...push... */ }
  if (unmappedShapeKey) { /* ...push... */ }
  setActionError(messages.length > 0 ? messages.join(' ') : null);
}, [unpricedColorsKey, unmappedShapeKey, drillStyle]);
```
If the shared channel must not stomp storage/download errors, gate those with a separate
state field rather than leaving this effect set-only.

### WR-02: "Left out of the supply plan" banner contradicts the fixed-bag total (estimate vs cart divergence)

**File:** `src/App.tsx:1000-1007, 941-957`
**Issue:** `unmappedShapeCodes` flags any grid color with no variant mapped for the current
`drillStyle` and the banner tells the user those colors "were left out of the supply plan."
But in **fixed-bag mode** (`optimizeBagsCost === false`) the row cost is
`metrics.packets * drillPacketCost` via `calculateSafetyPurchase`, which is entirely
mapping-agnostic — so an unmapped-shape color is still billed a non-zero cost into
`safetyDrillCost` / `totalCostSafety`. Meanwhile the Shopify cart (`compileShopifyCartLink` →
`packColor`, which *is* mapping-aware) drops that same color as unmapped. Result: the banner
says "excluded," the displayed total *includes* the cost, and the actual cart *excludes* the
color — the exact estimate-vs-cart divergence this phase exists to eliminate.
**Fix:** In the fixed-bag branch, treat an unmapped-shape color as a $0 line (mirror the
optimized path's empty-pack behavior) so the total matches the cart, or scope the
"left out of the supply plan" wording to the optimized path only. Prefer making the fixed
path mapping-aware so estimate and cart reconcile in both modes.

## Info

### IN-01: `generateUUID` fallback throws if `crypto` is entirely absent

**File:** `src/engine/projectStore.ts:75-84`
**Issue:** The guard at line 76 only enters the `randomUUID` branch when `crypto` exists *and*
exposes `randomUUID`. When `crypto` is wholly undefined, execution falls through to line 79
`crypto.getRandomValues(...)`, which throws `ReferenceError` rather than the "graceful
fallback" the docstring promises. Not reachable in any supported browser (all have
`crypto.getRandomValues`), hence Info.
**Fix:** Guard the whole function on `typeof crypto === 'undefined'` and surface a clear
error, or keep as-is and drop the "falling back" wording since the fallback presupposes
`crypto` exists.

### IN-02: Allow-listed duplicate variant IDs order the wrong physical SKU (pending adjudication)

**File:** `src/engine/variants.ts` (e.g. `731`/`732` ~lines 1806-1820, `781`/`782` ~lines 2107-2133); guard: `src/engine/__tests__/variants.integrity.test.ts:25-29`
**Issue:** The integrity test correctly ratchets against *new* drift, but the allow-listed
pairs (`731`/`732`, `781`/`782`, `776`/`3326`) are genuine latent data bugs: the paired DMC
codes share identical Shopify variant IDs across all sizes, so ordering one color actually
orders the other's physical drills. This is documented tech debt ("TODO adjudicate with data
owner"), not introduced by this phase, so Info — but it remains a real order-accuracy risk
until adjudicated.
**Fix:** Route the flagged pairs to the data owner for confirm-alias-vs-fix, then either
correct the IDs or convert the alias to an explicit, intentional mapping.

## Resolution (2026-07-12, commit `e13ddca`)

- **WR-01 — FIXED.** The surfacing effect now drives the banner reactively: it tracks the
  last derived warning it set (via a `useRef`) and clears/replaces only its own message, so a
  resolved pricing/mapping warning no longer persists — without clobbering an unrelated
  storage/download/checkout error on the shared `actionError` channel.
- **WR-02 — FIXED (wording).** The unmapped-color message no longer claims the colors "were
  left out of the supply plan"; it now states the fact ("no `{shape}` drills available — switch
  drill shape or exclude them"), removing the contradiction with the fixed-bag total. The
  deeper estimate-vs-cart cost divergence (making the fixed-bag path mapping-aware) is
  **pre-existing** (the cart already dropped unmapped items before this phase) and is left as a
  **follow-up** rather than a silent cost-behavior change in a correctness phase.
- **IN-01 — acknowledged, no change.** Not reachable in any supported browser (all expose
  `crypto.getRandomValues`); left as documented.
- **IN-02 — adjudicated.** The data owner confirmed the duplicate-ID pairs (731/732, 781/782,
  776/3326) as **intended aliases**; they stay allow-listed. The DATA-01 integrity test guards
  against any *new* duplicate.

Post-fix verification: `tsc --noEmit` clean; full suite 203/203 green.

---

_Reviewed: 2026-07-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
