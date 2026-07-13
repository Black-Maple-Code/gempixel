---
phase: quick-260712-qa1
plan: 01
subsystem: supply-pricing
status: complete
tags: [pricing, WR-02, fixed-bag, estimate-vs-cart, regression-test]
requires:
  - hasVariantMapping (engine/variants.ts)
  - packColor / priceColorPack (engine/bagPlanner.ts)
provides:
  - calculateFixedBagCost (exported pure helper, src/App.tsx)
affects:
  - Fixed-bag supply total (sortedMatches else branch, src/App.tsx)
tech-stack:
  added: []
  patterns:
    - mapping-aware $0 line gating on hasVariantMapping (mirrors optimized branch + cart)
key-files:
  created: []
  modified:
    - src/App.tsx
    - src/__tests__/print.test.tsx
decisions:
  - "Preserve the +10% safety drill COUNT for unmapped colors (only zero bags/purchase/cost) to match the optimized branch's Safety Margin column."
  - "Extract a pure exported helper (calculateFixedBagCost) rather than inline the gate, so the branch is unit-testable from ../App alongside calculateSafetyPurchase."
metrics:
  duration: ~6min
  completed: 2026-07-12
  tasks: 2
  files: 2
requirements: [WR-02]
---

# Quick Task 260712-qa1: Fix WR-02 Estimate-vs-Cart Pricing Divergence Summary

Made the fixed-bag cost branch mapping-aware via a new pure helper `calculateFixedBagCost` gating on `hasVariantMapping`, so a grid color with no drill variant for the selected shape is a $0 line matching the Shopify cart — closing the last estimate-vs-cart divergence — and locked it with an estimate==cart regression test.

## What Was Built

**Task 1 — `calculateFixedBagCost` helper + rewired else branch (`src/App.tsx`)**
- New exported pure function `calculateFixedBagCost(code, shape, count, bagSize, packetCost)` placed immediately after `calculateSafetyPurchase`. It reuses `calculateSafetyPurchase` for the +10% math, then:
  - Unmapped shape (`!hasVariantMapping(code, shape)`): returns `{ safety: metrics.safety, packets: 0, purchase: 0, costExact: 0, costSafety: 0 }` — a $0 line that preserves the non-zero drill count, mirroring the optimized branch and the cart (checkout.ts drops the color, packColor returns an empty pack).
  - Mapped shape: returns exactly today's fixed-bag math (`costExact = (count/bagSize)*packetCost`, `costSafety = metrics.packets*packetCost`) — byte-for-byte unchanged.
- Rewired the fixed-bag `else` branch (~941-957) to call the helper and preserve the exact existing row shape (`code, count, name, hex, safety, packets, purchase, costExact, costSafety, bagsText, optimizedBags:null, hasUnpricedSize:false`). `bagsText` now reads `'None'` when `packets === 0` (the unmapped $0 line), otherwise `` `${packets} bag(s)` `` (mapped colors always have packets > 0, so their text is unchanged).
- The optimized branch, the reconciliation block (`safetyDrillCostCents`), and the WR-01/WR-02/DATA-01 banner derivation were left untouched.

**Task 2 — estimate==cart regression tests (`src/__tests__/print.test.tsx`)**
- New `describe('Fixed-bag cost is mapping-aware (WR-02)')` block with 4 cases:
  1. `471`/square is a $0 line (`costExact/costSafety/packets/purchase === 0`, `safety === 385`).
  2. Estimate reconciles to the cart: `priceColorPack(packColor('471','square',350,priceDb),priceDb) === 0` and equals the estimate's `costSafety`; `packColor(...).packets === 0` documents the drop.
  3. `798`/round is a $0 line.
  4. Mapped `310`/square is unchanged (`safety 385`, `packets 2`, `purchase 400`, `costSafety ≈ 0.5`, `costExact ≈ 0.4375`).

## Verification Results

- `npx tsc --noEmit` — **passes** (exit 0, no type errors).
- `npm test` — **passes**: 22 test files, **209 tests** (up from 205; +4 new WR-02 cases). `print.test.tsx` now runs 7 tests, all green. No regressions.
- Wiring greps confirmed: `calculateFixedBagCost` appears 2x in App.tsx (definition + call); `hasVariantMapping` usage count is 4 (unchanged imports plus new helper usage).
- Manual reasoning check: an unmapped-shape color's `row.costSafety` is 0, so it contributes 0 to `safetyDrillCostCents` (App.tsx) and the displayed `totalCostSafety` matches the cart, which already drops the color.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new security surface (pure client-side TS edit + Vitest test, no package installs).

## Commits

- `9feed49` fix(quick-260712-qa1): make fixed-bag cost mapping-aware (WR-02)
- `c1c3ff8` test(quick-260712-qa1): add estimate==cart regression for fixed-bag WR-02

## Self-Check: PASSED

- FOUND: src/App.tsx (calculateFixedBagCost exported, else branch rewired)
- FOUND: src/__tests__/print.test.tsx (WR-02 describe block, 209 tests green)
- FOUND: commit 9feed49
- FOUND: commit c1c3ff8
