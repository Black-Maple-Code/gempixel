---
phase: 16-optimized-supply-plan-savings
plan: 01
subsystem: engine
tags: [bag-planner, optimizer, pricing, money-cents, determinism, vitest, tdd]

# Dependency graph
requires:
  - phase: 15-trustworthy-pricing-data-foundation
    provides: "money.ts integer-cents helpers; bagPlanner unpriced-size Infinity handling + hasUnpricedSize flagging"
provides:
  - "minCostBulk now selects the FEWEST bulk bags within a LOCKED overshoot cap (BAG-01, D-01) instead of cost-min"
  - "A total, deterministic packColor order (fewest packets -> cost cents -> total drills -> largest-size-first) so legend and cart cannot diverge (D-03)"
  - "Overshoot semantics (wasted drills <= one smallest available bulk bag) that downstream 16-02 savings clamp must account for"
affects: [16-02-naive-baseline-and-order-aggregator, 16-03-wire-aggregator-retire-toggle, 16-04-savings-headline-and-why-expander]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Comparator/selection edit inside a preserved bounded enumeration (no solver/greedy, no new dependency — D-02)"
    - "Cap/tiebreak cost comparisons reconciled through money.ts integer cents, never a raw float threshold (T-16-02)"

key-files:
  created: []
  modified:
    - "src/engine/bagPlanner.ts — minCostBulk selection criterion changed from cost-min to fewest-bags-within-overshoot-cap"
    - "src/engine/__tests__/bagPlanner.test.ts — BAG-01 fewest-bags describe block (worked example, distinguishing, determinism/purity/key-order, dye-lot guard)"
    - "src/engine/__tests__/checkout.test.ts — packColor == cart no-divergence assertion incl. the 1050 overshoot-cap case"

key-decisions:
  - "Implemented the LOCKED overshoot cap (option-b): a fewer-bags plan is rejected when wasted drills exceed one smallest available bulk bag; cost is only a bounded tiebreak."
  - "The all-smallest ceil-fill plan always satisfies the cap, so an acceptable plan always exists; cost-min is retained only as an unreachable-in-practice fallback."
  - "Tiebreak order fewest packets -> lowest cost cents -> fewer total drills -> largest-size-first gives a total deterministic order; the largest-size-first rung is a harmless final tiebreak (never binds on the 3-bulk-size set, but keeps the order total)."

patterns-established:
  - "Fewest-bags-within-cap: enumerate the same candidates, keep only overshoot-acceptable ones, pick by a strict total order."
  - "Determinism guard tests assert double-call deep equality + key-order independence, not just output values."

requirements-completed: [BAG-01]

coverage:
  - id: D1
    description: "minCostBulk selects the fewest bulk bags within the LOCKED overshoot cap (rejects the wasteful 1×2000 for 1050); cost is only a bounded tiebreak (BAG-01, D-01)."
    requirement: "BAG-01"
    verification:
      - kind: unit
        ref: "src/engine/__tests__/bagPlanner.test.ts#WORKED EXAMPLE: 1050 @ standard prices -> {1000:1, 500:1}, never the wasteful 1×2000"
        status: pass
      - kind: unit
        ref: "src/engine/__tests__/bagPlanner.test.ts#prefers the fewer-bags plan even when it costs MORE, so long as it is within the cap"
        status: pass
      - kind: unit
        ref: "src/engine/__tests__/bagPlanner.test.ts#rejects a cost-cheaper single-2000 plan whose overshoot exceeds one smallest bulk bag"
        status: pass
    human_judgment: false
  - id: D2
    description: "packColor yields a total, deterministic order — pure function (deep-equal across calls), key-order independent, and identical to the Shopify cart (D-03)."
    requirement: "BAG-01"
    verification:
      - kind: unit
        ref: "src/engine/__tests__/bagPlanner.test.ts#breaks a bag-count + cost tie by a TOTAL deterministic order (never key-order/float wobble)"
        status: pass
      - kind: unit
        ref: "src/engine/__tests__/bagPlanner.test.ts#is a pure, deterministic function: identical inputs yield a deeply-equal ColorPack"
        status: pass
      - kind: unit
        ref: "src/engine/__tests__/checkout.test.ts#the cart emits exactly the bags packColor produces, including the 1050 overshoot-cap case"
        status: pass
    human_judgment: false
  - id: D3
    description: "The <=800 dye-lot pack200 path and DYE_LOT_CEILING are untouched — fewest-bags never leaks into the dye-lot range (D-04)."
    requirement: "BAG-01"
    verification:
      - kind: unit
        ref: "src/engine/__tests__/bagPlanner.test.ts#D-04 dye-lot path is untouched: <=800 stays on 200-count bags (no fewest-bags leak)"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-07-13
status: complete
---

# Phase 16 Plan 01: Optimizer Fewest-Bags Comparator Summary

**minCostBulk now packs a bulk color into the FEWEST bags within a LOCKED overshoot cap (wasted drills <= one smallest bulk bag) via a total, deterministic order — the cost-min objective is retired, and the legend/cart shared primitive can never diverge on a tie.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-13T02:01:00Z
- **Completed:** 2026-07-13T02:07:00Z
- **Tasks:** 2 (Task 1 via TDD RED→GREEN)
- **Files modified:** 3

## Accomplishments
- Changed `bagPlanner.ts::minCostBulk` selection from cost-minimization to fewest-bags-within-the-overshoot-cap (BAG-01, D-01), preserving the exact recursive bounded `search` (D-02 — no solver, no greedy, no new dependency).
- Implemented the LOCKED overshoot cap: a fewer-bags plan whose wasted drills exceed one smallest available bulk bag is rejected, so 1050 @ standard resolves to `{1000:1, 500:1}` and the wasteful `1×2000` is never selected.
- Made `packColor` a provably total, deterministic, pure function (fewest packets → lowest cost cents → fewer total drills → largest-size-first), reconciling all cost comparisons through `money.ts` integer cents (T-16-02).
- Extended the engine + checkout suites: worked example, a fewer-bags-costs-more distinguishing case, determinism/purity + key-order independence, a D-04 dye-lot guard, and a `packColor == cart` no-divergence assertion covering the 1050 overshoot-cap case.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing fewest-bags overshoot-cap test** - `65ded7a` (test)
2. **Task 1 (GREEN): fewest-bags within overshoot cap in minCostBulk** - `5c2e6dd` (feat)
3. **Task 2: fewest-bags, determinism, dye-lot, no-divergence tests** - `fb592e6` (test)

**Plan metadata:** committed separately (docs: complete plan)

_Note: Task 1 is a TDD task (test → feat)._

## Files Created/Modified
- `src/engine/bagPlanner.ts` - `minCostBulk` selection criterion + docstring changed to fewest-bags-within-overshoot-cap; bounded search preserved verbatim; cost via money.ts cents.
- `src/engine/__tests__/bagPlanner.test.ts` - New `BAG-01 fewest-bags within the overshoot cap` describe block (6 tests).
- `src/engine/__tests__/checkout.test.ts` - New `packColor == cart no-divergence` describe block; imports `packColor` + `DRILL_VARIANTS`.

## Decisions Made
- **Overshoot cap = one smallest available bulk bag's capacity (LOCKED option-b).** Reproduces the CONTEXT worked example (1050 → `{1000:1,500:1}`, `1×2000` rejected).
- **Acceptable set = overshoot-cap-acceptable candidates; cost-min kept only as a guaranteed fallback.** The all-smallest ceil-fill plan always satisfies the cap (overshoot < smallest bulk), so the fallback is unreachable in practice — this prevents a cheaper high-overshoot plan from bypassing the cap.
- **Total-order tiebreak** (packets → cost cents → total drills → largest-size-first). On the 3-bulk-size set two distinct plans can never tie on packets+cost+drills simultaneously, so the final largest-size-first rung never actually binds — it is retained purely to keep the order provably total (D-03).

## Deviations from Plan

None - plan executed exactly as written. (Task 1's TDD RED used a distinguishing "cheap 2000" fixture — where old cost-min buys `1×2000` but the new cap rejects it — so the RED test genuinely fails on the pre-change code; the plan's own 1050 @ standard example coincidentally matches cost-min and would not have failed RED on its own.)

## Issues Encountered
None. tsc clean; full suite green (216 tests, up from 205 — 11 new assertions across the two suites). Pre-existing jsdom "getContext not implemented" warnings in App/integration tests are unrelated and unchanged.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BAG-01 optimizer objective is in place and deterministic; 16-02 (naive baseline + order aggregator) can compute a cost baseline against the fewest-bags plan.
- **Note for 16-02:** the cap is the LOCKED overshoot cap (option-b), so savings are clamped-≥0 (not provable-positive) — the naive baseline must account for the overshoot semantics rather than a literal cost cap.

## Self-Check: PASSED

- `src/engine/bagPlanner.ts` - FOUND
- `src/engine/__tests__/bagPlanner.test.ts` - FOUND
- `src/engine/__tests__/checkout.test.ts` - FOUND
- Commit `65ded7a` - FOUND
- Commit `5c2e6dd` - FOUND
- Commit `fb592e6` - FOUND

---
*Phase: 16-optimized-supply-plan-savings*
*Completed: 2026-07-13*
