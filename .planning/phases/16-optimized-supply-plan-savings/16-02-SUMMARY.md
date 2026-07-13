---
phase: 16-optimized-supply-plan-savings
plan: 02
subsystem: engine
tags: [bag-planner, naive-baseline, savings, order-aggregator, money-cents, tdd, vitest]

# Dependency graph
requires:
  - phase: 16-optimized-supply-plan-savings
    provides: "packColor fewest-bags-within-overshoot-cap optimizer + LOCKED overshoot semantics (16-01); money.ts integer cents; planColorSupply/withSafetyMargin/priceColorPack/isUnpriced (15-02)"
provides:
  - "naiveColorPack — dye-lot-aware naive per-color baseline (smallest single covering bag; ceil-fill largest on no-cover; D-05/06/07)"
  - "planOrderSupply — the single shared order aggregator (optimized rows + totals + naive baseline + savings, integer-cents reconciled; D-13, BAG-02)"
  - "OrderSupplyPlan interface — the exact shape 16-03/16-04 wire (field names below)"
affects: [16-03-wire-aggregator-retire-toggle, 16-04-savings-headline-and-why-expander]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Naive baseline mirrors packColor's guards + dye-lot + isUnpriced priced-size filtering exactly, so baseline and optimizer are apples-to-apples"
    - "Order-level totals accumulate through money.ts integer cents (toCents + sumCents), never raw float addition (PRICE-03)"
    - "Savings clamped >= 0 as a real correctness backstop under the LOCKED overshoot cap (not merely a precision guard)"

key-files:
  created: []
  modified:
    - "src/engine/bagPlanner.ts — new naiveColorPack, planOrderSupply, OrderSupplyPlan interface"
    - "src/engine/__tests__/bagPlanner.test.ts — naiveColorPack (8) + planOrderSupply (6) describe blocks"

key-decisions:
  - "naiveColorPack reuses packColor's empty-pack guards, the <=800 pack200 dye-lot branch (D-05), and priced-bulk filtering via isUnpriced (mirrors minCostBulk) so it never self-selects an unpriced size at $0."
  - "Bulk baseline = SMALLEST single priced bulk bag whose lone capacity covers the count; on no single-bag cover, D-07 ceil-fills the LARGEST priced bulk size (never combines sizes, never uses drillBagSize or uniform 200/color)."
  - "planOrderSupply prices the naive baseline on the SAME +10% safety count basis as the optimized row (withSafetyMargin -> naiveColorPack -> priceColorPack) so savings reconciles with the displayed safety-based Est. total."
  - "savingsCents = max(0, naiveCostCents - optimizedCostCents): a REAL backstop — under the locked overshoot cap the optimizer can be forced onto a pricier lower-overshoot multi-bag plan above the naive single bag, so the raw difference can go negative."
  - "Aggregator is pure — no DMC_PALETTE name/hex lookup and no sorting (those stay in the UI); rows follow the input's own key order (JS iterates integer-like DMC-code keys in ascending numeric order)."

patterns-established:
  - "Adversarial-pricing test proves the savings clamp: a cheap-but-capped single 2000 bag makes the optimizer pick the pricier {1000:1,500:1}, so optimized cost > naive cost and savingsCents === 0."

requirements-completed: [BAG-02, BAG-03]

# OrderSupplyPlan shape (for 16-03 / 16-04 wiring)
order-supply-plan-fields:
  - "rows: Array<{ code: string } & ColorSupplyRow>  // ColorSupplyRow = { exact, safety, costExact, costSafety, bagsText, hasUnpricedSize, unpricedSizes }; input key order, unsorted"
  - "totalPackets: number   // sum of per-color SAFETY packets"
  - "totalDrills: number     // sum of per-color SAFETY drills purchased"
  - "optimizedCostCents: number  // integer cents; sum(toCents(row.costSafety))"
  - "naiveCostCents: number       // integer cents; sum(toCents(naive safety cost))"
  - "savingsCents: number         // max(0, naiveCostCents - optimizedCostCents)"
  - "savingsPct: number           // round(savingsCents / naiveCostCents * 100); 0 when naive is 0"
  - "hasUnpricedSize: boolean     // OR across colors"
  - "unpricedColorCodes: string[] // flagged codes, input order"

coverage:
  - id: D1
    description: "naiveColorPack returns the smallest single covering bulk bag for a >800 color (1050->{2000:1}, 900->{1000:1}), ceil-fills the largest on no-cover (3000->{2000:2}, D-07), and matches the optimizer's 200-pack for a <=800 color (300->{200:2}, D-05)."
    requirement: "BAG-03"
    verification:
      - kind: unit
        ref: "src/engine/__tests__/bagPlanner.test.ts#naiveColorPack — BAG-03 dye-lot-aware naive baseline (D-05/06/07)"
        status: pass
    human_judgment: false
  - id: D2
    description: "naiveColorPack never self-selects an unpriced size at $0: an unpriced-only color is a flagged empty pack; a color with an unpriced bulk size falls to the smallest/ceil-filled PRICED bulk size."
    requirement: "BAG-03"
    verification:
      - kind: unit
        ref: "src/engine/__tests__/bagPlanner.test.ts#flags a color coverable only by an unpriced size (never a $0 baseline line)"
        status: pass
      - kind: unit
        ref: "src/engine/__tests__/bagPlanner.test.ts#never self-selects an unpriced bulk size at $0 (bulk restricted to priced sizes)"
        status: pass
    human_judgment: false
  - id: D3
    description: "planOrderSupply returns per-color optimized rows + totals + naive baseline + savings, all reconciled in integer cents; savingsCents === max(0, naive - optimized) and is never negative."
    requirement: "BAG-02"
    verification:
      - kind: unit
        ref: "src/engine/__tests__/bagPlanner.test.ts#returns one optimized row per code and reconciles totals in integer cents"
        status: pass
    human_judgment: false
  - id: D4
    description: "The savings clamp is a real backstop: when the overshoot cap forces optimized cost > naive cost, savingsCents === 0 (never overstated); a <=800-only fixture yields a truthful $0; savingsPct is 0 (no divide-by-zero) when naive is 0."
    requirement: "BAG-02, BAG-03"
    verification:
      - kind: unit
        ref: "src/engine/__tests__/bagPlanner.test.ts#ADVERSARIAL: the overshoot cap forces optimized cost > naive cost -> savingsCents === 0"
        status: pass
      - kind: unit
        ref: "src/engine/__tests__/bagPlanner.test.ts#a <=800-only fixture yields a truthful savingsCents === 0"
        status: pass
      - kind: unit
        ref: "src/engine/__tests__/bagPlanner.test.ts#savingsPct is 0 (no divide-by-zero) when naiveCostCents is 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "An unpriced-only color contributes $0 to BOTH totals and appears in unpricedColorCodes; the aggregator is pure (no palette lookup, no sorting)."
    requirement: "BAG-02"
    verification:
      - kind: unit
        ref: "src/engine/__tests__/bagPlanner.test.ts#excludes an unpriced-only color from BOTH totals and lists it in unpricedColorCodes"
        status: pass
      - kind: unit
        ref: "src/engine/__tests__/bagPlanner.test.ts#stays pure: applies no sort of its own and does no palette name/hex lookup"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-07-13
status: complete
---

# Phase 16 Plan 02: Naive Baseline & Order Aggregator Summary

**`naiveColorPack` gives the dye-lot-aware naive per-color baseline (smallest single covering bag; ceil-fill the largest on no-cover) and `planOrderSupply` aggregates the whole order into one shared plan — optimized rows + totals + naive baseline + a savings figure clamped >= 0, all reconciled in integer cents — so the legend, the cart, and the future order packet can never diverge.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-13T03:12:49Z
- **Completed:** 2026-07-13T03:18:23Z
- **Tasks:** 2 (both TDD RED -> GREEN)
- **Files modified:** 2

## Accomplishments
- Added `naiveColorPack(dmcCode, shape, requiredCount, priceDb): ColorPack` (BAG-03, D-05/06/07) — mirrors `packColor`'s empty-pack guards, the `<=800` `pack200` dye-lot branch, and `isUnpriced` priced-size filtering, so the baseline is apples-to-apples with the optimizer and never self-selects an unpriced size at $0. Bulk case buys the smallest single priced bulk bag that alone covers the count; on no single-bag cover it applies the D-07 fallback (ceil-fill the largest priced bulk size). No size combining, no `drillBagSize`/uniform-200 comparison (D-07 rejected).
- Added `planOrderSupply(counts, shape, priceDb): OrderSupplyPlan` (BAG-02, D-13) — the pure shared aggregator that replaces the inline `App.tsx` `sortedMatches` reduction. Per color it takes the optimized `planColorSupply` row and prices the naive baseline on the SAME `+10%` safety count basis, accumulates both totals through money.ts integer cents, and computes `savingsCents = max(0, naive - optimized)` plus a divide-by-zero-guarded `savingsPct`.
- Established the savings clamp as a REAL correctness backstop (not a precision guard): the adversarial-pricing test drives a cheap-but-capped single 2000 bag so the optimizer is forced onto the pricier `{1000:1,500:1}`, making optimized cost > naive cost and proving `savingsCents === 0` (never overstated).
- Recorded the exact `OrderSupplyPlan` field names in this summary's frontmatter so 16-03/16-04 wire the correct shape.

## Task Commits

Each task committed atomically (both TDD test -> feat):

1. **Task 1 (RED): failing naiveColorPack baseline tests** — `9e4d70f` (test)
2. **Task 1 (GREEN): naiveColorPack dye-lot-aware baseline** — `e0ef3aa` (feat)
3. **Task 2 (RED): failing planOrderSupply aggregator tests** — `92ffe75` (test)
4. **Task 2 (GREEN): planOrderSupply + OrderSupplyPlan** — `4584b77` (feat)

**Plan metadata:** committed separately (docs: complete plan).

## Files Created/Modified
- `src/engine/bagPlanner.ts` — new `naiveColorPack` (after `minCostBulk`), new `OrderSupplyPlan` interface + `planOrderSupply` (before `DrillType`). No existing symbols removed; `packColor`, `planColorSupply`, `withSafetyMargin`, `priceColorPack`, `isUnpriced`, `DYE_LOT_CEILING`, and money.ts helpers reused verbatim.
- `src/engine/__tests__/bagPlanner.test.ts` — new `naiveColorPack` describe (8 tests) and `planOrderSupply` describe (6 tests); added `toCents`/`sumCents` import for the integer-cents reconciliation assertion.

## Decisions Made
- **Naive bulk pick = smallest single priced bulk bag whose lone capacity covers the count; D-07 no-cover fallback ceil-fills the largest priced bulk size.** Never combines sizes; never compares against `drillBagSize` or a uniform 200/color (D-07 rejected alternatives).
- **Naive baseline priced on the SAME +10% safety count basis as the optimized row** (`withSafetyMargin -> naiveColorPack -> priceColorPack`), so savings reconciles with the displayed safety-based Est. total (D-06).
- **`savingsCents = max(0, naive - optimized)` is a real backstop.** Under the LOCKED overshoot cap the optimizer can be forced above the naive single bag, so the raw difference can be negative — the clamp keeps savings truthful (never overstated), proven by the adversarial test.
- **Aggregator stays pure** — no `DMC_PALETTE` name/hex lookup and no sorting (those stay in the UI). Rows follow the input object's own key order; note JS iterates integer-like DMC-code keys in ascending numeric order, so the aggregator's "no sort" is verified by asserting rows are NOT reordered by count.

## Deviations from Plan

None — plan executed exactly as written. One TDD adjustment: the Task 2 RED purity test initially asserted insertion order (`['151','150']`), but JavaScript iterates integer-like string keys in ascending numeric order, so `Object.entries` yields `['150','151']` regardless of insertion order. The test was corrected in the GREEN step to assert the aggregator applies **no sort of its own** (rows equal `Object.keys(counts)` and are NOT count-sorted) — the implementation was correct as written; only the test's expectation was fixed.

## Issues Encountered
None blocking. tsc clean; full suite green (230 tests, up from 216 — 14 new: 8 naiveColorPack + 6 planOrderSupply). Pre-existing jsdom "getContext not implemented" warnings in App/integration tests are unrelated and unchanged.

## Next Phase Readiness
- **16-03 (wire aggregator, retire toggle):** `planOrderSupply` is the drop-in replacement for the inline `App.tsx` `sortedMatches` reduction — consume `rows` (add DMC_PALETTE name/hex + sorting in the UI), `totalPackets`/`totalDrills`, `optimizedCostCents`, and `unpricedColorCodes` (feed the existing actionError banner).
- **16-04 (savings headline + why expander):** consume `savingsCents`, `savingsPct`, `naiveCostCents`, `optimizedCostCents` — all integer-cents reconciled and clamped >= 0.
- **OrderSupplyPlan field names are frozen** in this summary's `order-supply-plan-fields` frontmatter.

## Self-Check: PASSED

- `src/engine/bagPlanner.ts` — FOUND
- `src/engine/__tests__/bagPlanner.test.ts` — FOUND
- Commit `9e4d70f` — FOUND
- Commit `e0ef3aa` — FOUND
- Commit `92ffe75` — FOUND
- Commit `4584b77` — FOUND

---
*Phase: 16-optimized-supply-plan-savings*
*Completed: 2026-07-13*
