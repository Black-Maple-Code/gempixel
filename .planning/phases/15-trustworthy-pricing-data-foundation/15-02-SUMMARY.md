---
phase: 15-trustworthy-pricing-data-foundation
plan: 02
subsystem: pricing
tags: [pricing, money, integer-cents, bag-planner, reconciliation, tdd, preact]

# Dependency graph
requires:
  - phase: 15-trustworthy-pricing-data-foundation
    plan: 01
    provides: Narrowed CanvasVendor union, calculateCanvasCost number | null null-guard
  - phase: 05-supply-partnerships-checkout
    provides: bagPlanner packColor/minCostBulk/priceColorPack, priceDb pricing table
provides:
  - engine/money.ts canonical integer-cents helper (toCents/fromCents/sumCents/formatUSD)
  - toCents EPSILON-safe round-half-up + non-finite guard (throws RangeError)
  - defaultPacketCost 500 tier from a single canonical PACKET_PRICES table (PRICE-01)
  - minCostBulk missing-price => Infinity (never $0-self-select) + hasUnpricedSize signal (PRICE-02)
  - ColorPack/ColorSupplyRow hasUnpricedSize + unpricedSizes fields
  - App.tsx cents-reconciled totalCostSafety + effect surfacing unpriced colors via actionError banner (PRICE-03)
affects: [16 optimized supply plan, 17 service fee + order packet]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Canonical integer-cents money module: all customer-facing money math routes through money.ts so line items reconcile exactly to the total (no IEEE-754 float drift)"
    - "EPSILON-safe round-half-up: Math.round(Number((dollars*100).toFixed(6))) absorbs representation error so toCents(1.005)===101, unlike the naive Math.round(dollars*100)"
    - "Fail-loud money guard: toCents throws RangeError on non-finite input so a bad/tampered price can never become a silent $0/NaN cent value"
    - "Missing price => Infinity (never $0): the cost minimizer excludes unpriced sizes from its candidate set so a phantom-free size can never win the bounded search"
    - "Unplannable-color signal: a color coverable only by an unpriced size is flagged hasUnpricedSize and surfaced via the existing banner, never emitted as a self-selected $0 line"
    - "Single canonical size table for tier pricing so a bag tier can never be half-added again (PRICE-01 root-cause fix)"

key-files:
  created:
    - src/engine/money.ts
    - src/engine/__tests__/money.test.ts
    - .planning/phases/15-trustworthy-pricing-data-foundation/15-02-SUMMARY.md
  modified:
    - src/engine/bagPlanner.ts
    - src/engine/__tests__/bagPlanner.test.ts
    - src/App.tsx

key-decisions:
  - "money.ts is the single canonical integer-cents authority (round-half-up), superseding the ad-hoc Math.round(x*100)/100 cents math in checkout.ts/bagPlanner.ts while fixing its representation-error edge cases"
  - "toCents uses Math.round(Number((dollars*100).toFixed(6))) so a true half-cent survives (1.005 -> 101, 0.005 -> 1); the naive Math.round(dollars*100) is explicitly banned"
  - "toCents throws RangeError on NaN/Infinity (fail loud) rather than silently producing a $0/NaN cent value (threat T-15-04)"
  - "minCostBulk excludes unpriced sizes from candidates and treats a missing price as Infinity (was ?? 0); a color with no priced coverage is flagged hasUnpricedSize and emits an empty bySize (no $0 line), never a self-selected free bag (threat T-15-03)"
  - "defaultPacketCost resolves from one PACKET_PRICES table keyed by the canonical BAG_SIZES list; the 500 tier is set strictly between each type's 200 and 1000 tier (PRICE-01)"
  - "Unpriced colors are surfaced from a useEffect keyed off the unpriced DMC codes (never setState during render), reusing the existing Phase 11 actionError banner as a plain JSX text child (T-11-07)"

patterns-established:
  - "Integer-cents reconciliation: sum every displayed line item via toCents/sumCents then fromCents once, so the displayed total is provably the sum of the visible lines (threat T-15-05)"
  - "Unpriced-size flag OR-combined across exact + safety packs onto the legend row, then surfaced by an effect"

requirements-completed: [PRICE-01, PRICE-02, PRICE-03]

coverage:
  - id: D1
    description: "defaultPacketCost(type, 500) is strictly between the 200 and 1000 tiers for every drill type, never the 5000 bulk tier (PRICE-01)"
    requirement: PRICE-01
    verification:
      - kind: unit
        ref: "src/engine/__tests__/bagPlanner.test.ts#PRICE-01: the 500 tier is strictly between the 200 and 1000 tiers for every type"
        status: pass
      - kind: unit
        ref: "src/engine/__tests__/bagPlanner.test.ts#PRICE-01: a 500 bag is never priced at the 5000 bulk tier"
        status: pass
    human_judgment: false
  - id: D2
    description: "The cost minimizer never self-selects an unpriced size (missing price => Infinity, not $0); a priced plan is preferred when one exists (PRICE-02)"
    requirement: PRICE-02
    verification:
      - kind: unit
        ref: "src/engine/__tests__/bagPlanner.test.ts#never self-selects the unpriced 2000 size; covers with priced sizes only"
        status: pass
    human_judgment: false
  - id: D3
    description: "A color coverable only by an unpriced size is flagged hasUnpricedSize and never reported at $0; surfaced via the existing actionError banner by DMC code (PRICE-02)"
    requirement: PRICE-02
    verification:
      - kind: unit
        ref: "src/engine/__tests__/bagPlanner.test.ts#flags a color coverable ONLY by an unpriced size and never reports it at $0"
        status: pass
      - kind: integration
        ref: "src/App.tsx useEffect surfaces unpricedColorCodes via setActionError (plain text) — covered by npm test (198 passing)"
        status: pass
    human_judgment: false
  - id: D4
    description: "All money math routes through integer-cents helpers; displayed line items sum exactly to the displayed total, with no float drift (PRICE-03)"
    requirement: PRICE-03
    verification:
      - kind: unit
        ref: "src/engine/__tests__/money.test.ts#sum of per-line cents equals the grand-total cents — no float drift"
        status: pass
      - kind: unit
        ref: "src/engine/__tests__/money.test.ts#uses EPSILON-safe round-half-up (not naive Math.round(x*100))"
        status: pass
      - kind: unit
        ref: "src/engine/__tests__/money.test.ts#THROWS (RangeError) on non-finite input"
        status: pass
      - kind: integration
        ref: "src/App.tsx totalCostSafety summed in cents via toCents/sumCents/fromCents — covered by npx tsc --noEmit + npm test (198 passing)"
        status: pass
    human_judgment: false

# Metrics
duration: 10min
completed: 2026-07-12
status: complete
---

# Phase 15 Plan 02: Trustworthy Pricing (Money Helper, 500 Tier, No $0-as-Free) Summary

**Introduced `engine/money.ts` as the single canonical integer-cents money authority (EPSILON-safe round-half-up, fail-loud on non-finite input); fixed the missing 500 bag tier so a 500 bag prices at its own tier instead of the 5000 bulk tier; killed the `$0-as-free` bug so the cost minimizer treats a missing price as `Infinity` (never self-selected) and flags colors coverable only by an unpriced size (`hasUnpricedSize`), surfaced through the existing banner; and reconciled the displayed total to the sum of its itemized line items in integer cents.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 3 (Tasks 1 & 2 TDD: RED test -> GREEN implementation)
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

### Task 1 — `engine/money.ts` canonical integer-cents helper (PRICE-03)
- `toCents(dollars)`: EPSILON-safe round-half-up via `Math.round(Number((dollars * 100).toFixed(6)))` — `toCents(1.005) === 101`, `toCents(0.005) === 1`, and `toCents(0.1) + toCents(0.2) === toCents(0.3)`. The naive `Math.round(dollars * 100)` (which returns 100/0 for those cases) is explicitly banned in a code comment.
- `toCents` **throws `RangeError`** on non-finite input (`NaN`, `±Infinity`) so a bad/tampered price fails loud instead of silently becoming a `$0`/`NaN` cent value (threat T-15-04).
- `fromCents`, `sumCents`, `formatUSD` complete the module. `money.test.ts` (12 tests) proves round-half-up on the float-edge cases, the NaN/Infinity guard, and a multi-line **reconciliation** assertion (`sumCents(lineItemCents) === totalCents`) with drift-free summation.

### Task 2 — 500 tier, no $0-as-free, `hasUnpricedSize` in `bagPlanner.ts` (PRICE-01 + PRICE-02)
- **PRICE-01:** `defaultPacketCost` now resolves from a single canonical `PACKET_PRICES` table keyed by the exported `BAG_SIZES` list, with an explicit 500 tier set strictly between each type's 200 and 1000 tier (standard 0.55, ab 0.70, glow 0.90, crystal 1.00). Sizes outside the list (e.g. 5000) use the explicit `BULK_5000_PRICE` fallback. A tier can no longer be half-added.
- **PRICE-02 (never $0-self-select):** `minCostBulk` now excludes unpriced sizes from the candidate set and its `priceOf` returns `Infinity` for a missing price (was `?? 0`), so a phantom-free size can never win the **preserved bounded search**. With `2000` unpriced, `packColor('150','square',2100)` covers with `{ 1000: 2, 500: 1 }` (finite cost), never the free `2000`.
- **PRICE-02 (surface unplannable):** `ColorPack` and `ColorSupplyRow` gained `hasUnpricedSize: boolean` + `unpricedSizes: number[]`, populated on every return path. A color whose only coverage is an unpriced size (empty priced candidate set, or an unpriced 200 in `pack200`) is flagged and emits an **empty `bySize`** — never a self-selected `$0` line. An empty/zero-count color stays `hasUnpricedSize: false`.
- `priceColorPack` now computes in integer cents via `money.ts` (`toCents`/`sumCents`/`fromCents`) and no longer uses `|| 0`; an unpriced size is skipped rather than billed at `$0`.

### Task 3 — cents-reconciled total + unpriced surfacing in `App.tsx` (PRICE-03 + PRICE-02)
- `safetyDrillCost` and `totalCostSafety` are now summed in integer cents (`toCents` on each `row.costSafety`, `canvasBaseCost`, `canvasShippingEstimate`; `sumCents`; a single `fromCents`), so the itemized line items reconcile **exactly** to the displayed total (threat T-15-05).
- Added a `useEffect` keyed off the unpriced DMC codes (derived, never `setState` during render) that calls `setActionError` with a plain-text message naming the affected DMC code(s), reusing the existing Phase 11 `actionError` banner as a plain JSX text child (T-11-07). `hasUnpricedSize` is threaded onto the legend rows in both the optimized and fixed-size branches.

## Task Commits

Each task was committed atomically (Tasks 1 & 2 followed the plan's TDD intent — failing behavior test first, then implementation to green):

1. **Task 1: canonical integer-cents money helper (money.ts + tests)** — `6e8c3fa` (feat)
2. **Task 2: 500 tier, kill $0-as-free bug, thread hasUnpricedSize** — `ada9fb6` (feat)
3. **Task 3: reconcile total in cents, surface unpriced colors via banner** — `d141116` (feat)

**Plan metadata:** committed with this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md (docs).

## Files Created/Modified

- `src/engine/money.ts` — **created.** `toCents` (EPSILON-safe round-half-up, throws on non-finite), `fromCents`, `sumCents`, `formatUSD`. Canonical integer-cents authority.
- `src/engine/__tests__/money.test.ts` — **created.** 12 tests: round-half-up float edges, NaN/Infinity guard, reconciliation + drift-free summation.
- `src/engine/bagPlanner.ts` — 500 tier via canonical `PACKET_PRICES`/`BAG_SIZES`; `minCostBulk` Infinity-not-$0 + `hasUnpricedSize`; `pack200` unpriced-200 guard; `priceColorPack` on integer cents; `ColorPack`/`ColorSupplyRow` new fields; bounded search preserved.
- `src/engine/__tests__/bagPlanner.test.ts` — empty-pack shape updated with new fields; new PRICE-01 strictly-between + PRICE-02 (never-$0-self-select, unpriced-only flag, empty-not-flagged) tests; `priceColorPack` empty-pack literal updated.
- `src/App.tsx` — imports `money.ts`; cents-reconciled `safetyDrillCost`/`totalCostSafety`; `hasUnpricedSize` on legend rows; effect surfacing unpriced colors via the existing banner.

## Verification Results

- `npx vitest run src/engine/__tests__/money.test.ts` — 12 tests pass (reconciliation + NaN guard + drift-free).
- `npx vitest run src/engine/__tests__/bagPlanner.test.ts` — 18 tests pass (500 tier strictly between, unpriced never self-selected, hasUnpricedSize flagged; existing dye-lot / cost-min / cart==estimate tests still green).
- `npx tsc --noEmit` — clean, exit 0.
- `npm test` — 198 tests pass across 21 files (baseline was 181; +12 money, +5 net new bagPlanner assertions).
- Grep confidence: no `?? 0` or `|| 0` price fallback remains in `bagPlanner.ts` (the only `?? 0`/`|| 0` occurrences are comments documenting the removed bug).

## Decisions Made

- `money.ts` supersedes ad-hoc `Math.round(x*100)/100` cents math (kept round-half-up, fixed representation-error edges). No new dependency — first-party code.
- A missing price is a first-class "unpriced" condition, not a `$0` price: excluded from the minimizer's candidate set (=> `Infinity`), flagged via `hasUnpricedSize`, and emitted as an empty `bySize` so no `$0` billable line reaches a quote.
- Unpriced colors are surfaced from an effect (not during render), reusing the existing banner rather than adding new UI — a minimal wiring change per the plan.

## Deviations from Plan

None — plan executed as written. The exact 500-tier figures (standard 0.55, ab 0.70, glow 0.90, crystal 1.00) were chosen within the plan's explicitly-allowed discretion, preserving the strictly-between invariant for all four types.

## Threat Flags

None — no new security surface beyond the planned trust-boundary mitigations: T-15-03 (missing price => Infinity + hasUnpricedSize, never $0), T-15-04 (`toCents` throws on non-finite), T-15-05 (total summed from the same integer-cents line items). All implemented. No new packages (T-15-SC accept holds).

## Known Stubs

None — no placeholder/empty-value stubs introduced. A color flagged `hasUnpricedSize` deliberately emits an empty pack and is surfaced to the user; this is a fail-safe signal, not a stub.

## Issues Encountered

- `npx tsc --noEmit` initially failed on the existing `priceColorPack` empty-pack test literal (missing the new `hasUnpricedSize`/`unpricedSizes` fields on the inline `ColorPack`); updated the literal. This was a compile-driven test fix within the plan's scope (Task 2 explicitly updates existing bagPlanner tests for the new shape).
- The account safety classifier was intermittently unavailable during execution; affected Bash commands were retried per the environment note and completed cleanly.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 15-03 (the phase's third plan) is unblocked; the canonical `money.ts` helper and the `hasUnpricedSize` signal are the trusted foundation the downstream optimizer (Phase 16) and service-fee / order-packet (Phase 17) phases compound on.
- Every displayed drill/canvas figure now reconciles in integer cents, so later fee and packet math can build on drift-free totals.

## Self-Check: PASSED

- FOUND: `src/engine/money.ts`
- FOUND: `src/engine/__tests__/money.test.ts`
- FOUND: `src/engine/bagPlanner.ts`
- FOUND: `src/engine/__tests__/bagPlanner.test.ts`
- FOUND: `src/App.tsx`
- FOUND: `.planning/phases/15-trustworthy-pricing-data-foundation/15-02-SUMMARY.md`
- FOUND: commit `6e8c3fa` (Task 1)
- FOUND: commit `ada9fb6` (Task 2)
- FOUND: commit `d141116` (Task 3)

---
*Phase: 15-trustworthy-pricing-data-foundation*
*Completed: 2026-07-12*
