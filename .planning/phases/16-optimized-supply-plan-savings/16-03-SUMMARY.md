---
phase: 16-optimized-supply-plan-savings
plan: 03
subsystem: ui
tags: [bag-planner, order-aggregator, wire-up, toggle-retirement, single-plan-ui, vitest]

# Dependency graph
requires:
  - phase: 16-optimized-supply-plan-savings
    provides: "planOrderSupply shared order aggregator + frozen OrderSupplyPlan shape (16-02); packColor optimizer (16-01); money.ts integer cents (15-02)"
provides:
  - "App.tsx legend/cost UI driven by planOrderSupply (D-13) — legend rows, totalPackets, drill cost, unpriced codes all sourced from the shared engine"
  - "Single-plan UI — the optimizeBagsCost toggle and the fixed-size bag controls are fully retired (D-11)"
  - "SC2/BAG-02 render coverage — the visible 'Drills ({n} bag(s))' line is asserted equal to planOrderSupply.totalPackets"
affects: [16-04-savings-headline-and-why-expander, 17-service-fee-and-order-packet]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The component owns the impure concerns the pure aggregator deliberately omits: the DMC_PALETTE name/hex join and the sortBy/sortAsc/hexToHue sort wrap planOrderSupply's unsorted rows"
    - "planOrderSupply called ONCE per render; totalPackets / optimizedCostCents / unpricedColorCodes read straight off the result rather than re-derived from the mapped rows"
    - "Displayed total still reconciles canvasBase + shipping + aggregator drill cost in integer cents (money.ts), preserving PRICE-03 across the toggle removal"

key-files:
  created: []
  modified:
    - "src/App.tsx — planOrderSupply wired in; optimizeBagsCost state + both child-prop passes + the legend/print table toggle branches removed"
    - "src/features/wizard/steps/Step2Palette.tsx — optimizeBagsCost prop removed; renders row.bagsText unconditionally"
    - "src/features/wizard/steps/Step3Canvas.tsx — optimizeBagsCost/setOptimizeBagsCost + drillBagSize/drillPacketCost props removed; checkbox + fixed-size control block deleted; per-bag-size price grid is the sole cost control"
    - "src/__tests__/App.test.tsx — single-plan UI updates + SC2/BAG-02 render test"

key-decisions:
  - "Moved the optimizeBagsCost useState removal + child-prop-pass removal from Task 1 into Task 2 (Rule 3 deviation) so every commit independently satisfies `tsc --noEmit == 0` — the App legend/print tables still referenced the token until Task 2 collapsed them, and the child interfaces still required the prop until Task 2 dropped it. End state is identical; only the intra-task boundary shifted."
  - "totalPackets is now `orderPlan.totalPackets` (SC2/BAG-02), feeding the existing 'Drills ({totalPackets} bag(s))' line in the Step3Canvas cost breakdown — user-visible, not merely derived."
  - "safetyDrillCost derives from `orderPlan.optimizedCostCents` via fromCents; the total reconciliation (canvasBase + shipping + drill cost) stays in integer cents (PRICE-03, threat T-16-03)."
  - "unpricedColorCodes now come straight from `orderPlan.unpricedColorCodes`, feeding the same actionError banner (PRICE-02) with no behavior change."
  - "drillBagSize/drillPacketCost App state + persistence kept intact (still used by the drill-type sync effect and the footer label); only their Step3Canvas prop passes were removed."
  - "calculateSafetyPurchase / calculateFixedBagCost kept exported (D-12) — no longer called from the render path but still exercised by print.test.tsx and reserved for Phase 19."

patterns-established:
  - "SC2 render test computes the expected total from planOrderSupply for a known {150,151} fixture and asserts the DOM shows `Drills ({expected} bag(s))`, so the display can never silently diverge from the aggregator."

requirements-completed: [BAG-02]

# Metrics
duration: 9min
completed: 2026-07-13
status: complete
---

# Phase 16 Plan 03: Wire Aggregator & Retire Toggle Summary

**The optimized fewest-bags plan is now the SOLE displayed plan: `App.tsx` derives the legend rows, total bag count, drill cost and unpriced codes from the shared `planOrderSupply` engine (D-13) instead of an inline reduction, and the user-facing `optimizeBagsCost` toggle plus the fixed-size bag controls are fully retired across App/Step2Palette/Step3Canvas (D-11) — with a render test proving the visible "Drills ({n} bag(s))" count equals the aggregator's `totalPackets` (SC2/BAG-02).**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-07-13T03:26:46Z
- **Completed:** 2026-07-13T03:36:16Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- **Task 1 — wired the aggregator (BAG-02, D-13):** Replaced the inline `sortedMatches` per-color packing reduction (and its `calculateFixedBagCost` else-branch) with a single `planOrderSupply(matchResult?.counts || {}, drillStyle, priceDb)` call. The component joins each aggregator row with its `DMC_PALETTE` name/hex and applies the existing `sortBy/sortAsc/hexToHue` sort — the aggregator is pure and does neither. `totalPackets`, the drill cost (`optimizedCostCents` → `fromCents`), and `unpricedColorCodes` now come straight off the plan; the displayed total still reconciles canvas base + shipping + drill cost in integer cents (PRICE-03). Dropped the now-unused `sumCents` import.
- **Task 2 — retired the toggle (D-11):** Collapsed both `optimizeBagsCost ? A : B` table branches (live legend + print report) to the optimized form; removed the `optimizeBagsCost` useState and its passes to Step2Palette and Step3Canvas (plus the now-unused `drillBagSize`/`drillPacketCost` passes). Step2Palette renders `row.bagsText` unconditionally with the prop gone; Step3Canvas drops the toggle props, deletes the "Optimize bag sizes" checkbox and the fixed-size `drillBagSize`/`drillPacketCost` control block, and keeps only the per-bag-size price grid. **HARD GATE met:** `rg 'optimizeBagsCost' src --glob '!**/__tests__/**'` returns no matches.
- **Task 3 — tests for the single-plan UI + SC2 (BAG-02):** Rewrote the two tests that unchecked the removed checkbox to assert the price grid (6 inputs) renders unconditionally; the drill-type test now asserts the AB 200-qty preset (`0.7`). Replaced the checkbox Step-3 marker with the `#canvas-print-partner` select, dropped the stray `optimizeBagsCost` keys from the mock ProjectData literals, and added the **SC2/BAG-02 render test** that computes `planOrderSupply({150:250,151:250},'square',priceDb).totalPackets` and asserts the DOM shows the matching `Drills ({n} bag(s))` line.

## Task Commits

Each task committed atomically:

1. **Task 1 (feat): wire planOrderSupply into App legend/totals** — `174283a`
2. **Task 2 (feat): retire optimizeBagsCost toggle UI** — `48d9c16`
3. **Task 3 (test): single-plan UI updates + SC2 render assert** — `de54136`

**Plan metadata:** committed separately (docs: complete plan).

## Files Created/Modified
- `src/App.tsx` — import switched to `planOrderSupply`; single aggregator call feeds `sortedMatches` (palette join + sort kept locally); `totalPackets`/`safetyDrillCost`/`unpricedColorCodes` sourced from the plan; `optimizeBagsCost` useState + reset call + both child-prop passes removed; legend + print table branches collapsed to the optimized form; `sumCents` import dropped; `calculateSafetyPurchase`/`calculateFixedBagCost` still exported.
- `src/features/wizard/steps/Step2Palette.tsx` — `optimizeBagsCost` prop removed (interface + destructure); the legend cell renders `row.bagsText` unconditionally.
- `src/features/wizard/steps/Step3Canvas.tsx` — `optimizeBagsCost`/`setOptimizeBagsCost` + `drillBagSize`/`setDrillBagSize`/`drillPacketCost`/`setDrillPacketCost` props removed; checkbox + fixed-size control block deleted; per-bag-size price grid is the sole cost control.
- `src/__tests__/App.test.tsx` — two toggle-dependent tests rewritten for the always-on price grid; Step-3 marker switched to the canvas-vendor select; mock `optimizeBagsCost` keys removed; new SC2/BAG-02 render test added.

## Decisions Made
- **Intra-task boundary shift (Rule 3):** the plan assigned the `optimizeBagsCost` useState + child-prop-pass removal to Task 1, but the App legend/print tables still referenced the token and the child interfaces still required the prop until Task 2. Removing the useState in Task 1 alone would have broken `tsc`. To honor "each task committed individually" **and** "tsc exits 0 per task", the removal moved into Task 2 (where the tables collapse and the child interfaces drop the prop). Identical end state; the PLAN-level acceptance criteria and the D-11 gate are all met.
- **totalPackets is the aggregator's, and it is rendered:** `orderPlan.totalPackets` feeds the visible "Drills ({totalPackets} bag(s))" line — SC2/BAG-02 is satisfied by display, not just derivation, and locked by a render test.
- **drillBagSize/drillPacketCost state kept, only unwired from Step3Canvas:** they remain in App state/persistence (drill-type sync effect + footer label) so no ProjectData migration is introduced; only the child prop passes were removed.
- **D-12 honored:** `calculateSafetyPurchase`/`calculateFixedBagCost` stay exported (still covered by print.test.tsx); the render path just no longer calls `calculateFixedBagCost`.

## Deviations from Plan

**1. [Rule 3 - Blocking issue] Moved the optimizeBagsCost useState + child-prop-pass removal from Task 1 into Task 2**
- **Found during:** Task 1
- **Issue:** The plan's Task 1 said to remove the `optimizeBagsCost` useState and its child-prop passes, but the App legend/print tables still referenced `optimizeBagsCost` and the Step2Palette/Step3Canvas interfaces still required the prop until Task 2 — so removing the useState in Task 1 alone would fail `tsc --noEmit` (TS2304 undefined name + missing required prop), violating Task 1's own "tsc exits 0" acceptance criterion.
- **Fix:** Task 1 kept the useState (still referenced by the not-yet-collapsed tables) and only rewired the data path (planOrderSupply + derivations). Task 2 then removed the useState, the reset call, both child-prop passes, collapsed the table branches, and dropped the child interface props — all atomically, keeping each commit tsc-green.
- **Files modified:** src/App.tsx (both tasks)
- **Commits:** 174283a (Task 1), 48d9c16 (Task 2)

**2. [Rule 1 - Bug] Removed the now-unused `sumCents` import**
- **Found during:** Task 1
- **Issue:** After sourcing the drill cost from `orderPlan.optimizedCostCents`, the `sumCents(...)` call in App.tsx was gone, leaving `sumCents` as an unused import → `tsc` TS6133 under noUnusedLocals.
- **Fix:** Narrowed the money.ts import to `{ toCents, fromCents }`.
- **Files modified:** src/App.tsx
- **Commit:** 174283a

**3. [Rule 1 - Bug] Rewrote two tests + one Step-3 marker that depended on the removed fixed-bag UI**
- **Found during:** Task 3
- **Issue:** Beyond the one flagged assertion, two tests ("calculates supply costing…" and "updates default drill packet cost…") unchecked `#optimize-bags-checkbox` and asserted the 3-input fixed-bag form (Bag Price = 0.25 / AB 0.35); a third test used the checkbox as a Step-3 marker. All would fail once the checkbox/fixed-bag path was removed.
- **Fix:** Rewrote both tests for the always-on 6-input price grid (AB 200-qty preset = 0.70) and switched the Step-3 marker to `#canvas-print-partner`.
- **Files modified:** src/__tests__/App.test.tsx
- **Commit:** de54136

## Issues Encountered
None blocking. `npx tsc --noEmit` exits 0; the full vitest suite is green (231 tests, up from 230 — net +1 for the SC2 render test). Pre-existing jsdom "getContext not implemented" warnings in App/integration tests are unrelated and unchanged.

Note: an earlier `npx rg ...` for the D-11 gate auto-installed the wrong npm package (`rg@0.0.2`, a placeholder) instead of ripgrep; it printed "README.md already exists" but did not modify any tracked file (verified via `git status`). The gate was re-run with the Grep tool and passed (0 matches in non-test src).

## Verification
- `npx tsc --noEmit` → exit 0.
- `npx vitest run` → 231 passed (22 files), including App.test.tsx, bagPlanner.test.ts, checkout.test.ts, and print.test.tsx.
- D-11 hard gate: `optimizeBagsCost` has **no** matches in non-test `src` (verified via Grep, glob `!**/__tests__/**`).
- D-12: print.test.tsx still imports and passes `calculateSafetyPurchase` / `calculateFixedBagCost`.
- SC2/BAG-02: the render test asserts the visible `Drills ({n} bag(s))` line equals `planOrderSupply.totalPackets` for the {150,151} fixture.

## Next Phase Readiness
- **16-04 (savings headline + why expander):** `planOrderSupply` is already the single call in App's render path — `orderPlan.savingsCents`, `savingsPct`, `naiveCostCents`, `optimizedCostCents` are all available on the same result for the headline/expander with no new engine work.
- **Phase 17 (order packet):** the legend, the cart, and the future packet all read from `planOrderSupply`, so the numbers cannot diverge.

## Self-Check: PASSED

- `src/App.tsx` — FOUND
- `src/features/wizard/steps/Step2Palette.tsx` — FOUND
- `src/features/wizard/steps/Step3Canvas.tsx` — FOUND
- `src/__tests__/App.test.tsx` — FOUND
- Commit `174283a` — FOUND
- Commit `48d9c16` — FOUND
- Commit `de54136` — FOUND

---
*Phase: 16-optimized-supply-plan-savings*
*Completed: 2026-07-13*
