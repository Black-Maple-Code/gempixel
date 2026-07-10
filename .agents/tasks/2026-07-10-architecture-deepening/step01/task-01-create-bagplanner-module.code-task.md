# Task: Create the Supply Bag Optimizer module (`bagPlanner.ts`)

## Description
Create a new deep engine module `src/engine/bagPlanner.ts` whose primitive is **per-color bag packing**. This is task 1 of 3 for **Step 1 (Candidate 1)** of the GemPixel Architecture Deepening effort — the "one packer for estimate and cart" bug fix. This task only *creates and unit-tests* the module; tasks 02 and 03 rewire the cart (`checkout.ts`) and the legend (`App.tsx`) to consume it. Delivering it standalone (fully green, imported by nobody yet) keeps the increment atomic and reviewable.

## Background
GemPixel currently has **two divergent bag-packing algorithms** (see `research/current-state.md` §Candidate 1):
- `src/App.tsx:169` `optimizeBags(target, prices)` — a brute-force **cost-minimizer** over bag sizes {200,500,1000,2000}. It ignores the ≤800 dye-lot rule and assumes every size exists for every color. This feeds the legend cost estimate (`App.tsx:1142-1143`).
- `src/engine/checkout.ts:35` `optimizeBags(count)` — the **dye-lot packer** (`≤800 → 200-bags only`), and `checkout.ts:70` `compileShopifyCartLink` packs **per-color against `DRILL_VARIANTS[dmcCode][shape]` availability** (`:80-104`). This is what the user actually buys.

Because the estimate and the cart use different math, they can report different bag counts and totals for the same color. Per idea-honing Q1, **the cart's per-color packing is the source of truth**; the estimate must re-run it. This module extracts that packing into one reusable primitive.

GemPixel's `src/engine/` layer holds pure logic (`color.ts`, `checkout.ts`, `variants.ts`, `palette.ts`, `symbols.ts`, …). `bagPlanner.ts` belongs there — no Preact, no DOM, plain TS. The static catalog `src/engine/variants.ts` (`DRILL_VARIANTS`, 5106 lines) is **data — DO NOT TOUCH**; read from it only.

## Reference Documentation
**Required:**
- Design: `.agents/planning/2026-07-10-architecture-deepening/design/detailed-design.md` (§4 Candidate 1, §5 Data Models, §6 Error Handling, §7 Testing)
- Plan: `.agents/planning/2026-07-10-architecture-deepening/implementation/plan.md` (Step 1)
- Rules: `CLAUDE.md`, `.agents/GEMINI.md` (stack, conventions, GSD workflow enforcement)

**Additional References (if relevant to this task):**
- `.agents/planning/2026-07-10-architecture-deepening/research/current-state.md` (§Candidate 1 — exact function anchors in `App.tsx` and `checkout.ts`; §Test inventory)

**Note:** You MUST read the detailed design (§4 Candidate 1) and `research/current-state.md` (§Candidate 1) before implementing. Line numbers in those docs are `master`-as-of-2026-07-10 anchors and **will have drifted** — re-grep each symbol (`optimizeBags`, `compileShopifyCartLink`, `calculateSafetyPurchase`, `getDefaultPacketCost`, `DRILL_VARIANTS`) before reading/editing.

## Technical Requirements
1. Create `src/engine/bagPlanner.ts` exporting exactly the interface from design §4:
   - `type Shape = 'square' | 'round';`
   - `interface ColorPack { bySize: Record<number, number>; totalDrills: number; packets: number; }`
   - `packColor(dmcCode: string, shape: Shape, requiredCount: number): ColorPack`
   - `withSafetyMargin(dmcCode: string, shape: Shape, requiredCount: number): number` — the color args are REQUIRED: rounding "to the smallest available bag size for the color" cannot be derived from a bare count (it needs `DRILL_VARIANTS[dmcCode][shape]`). Alternatively keep `withSafetyMargin(requiredCount)` a pure +10% count bump and do the per-color rounding inside `planColorSupply`; pick one and keep it consistent. (Design §4 Candidate 1 originally showed the bare-count signature — that was a design bug.)
   - `priceColorPack(pack: ColorPack, priceDb: Record<number, number>): number`
   - `interface ColorSupplyRow { exact: ColorPack; safety: ColorPack; costExact: number; costSafety: number; bagsText: string; }`
   - `planColorSupply(dmcCode: string, shape: Shape, count: number, priceDb: Record<number, number>): ColorSupplyRow`
   - `defaultPacketCost(type: 'standard'|'ab'|'glow'|'crystal', bagSize: number): number` (the price table moved out of `App.tsx:143` `getDefaultPacketCost`)
2. `packColor` MUST honor **both** constraints: (a) the ≤800 dye-lot rule (a color whose `requiredCount ≤ 800` packs into 200-bags only), **and** (b) only pack into bag sizes actually present for that color in `DRILL_VARIANTS[dmcCode][shape]` — mirror the availability logic in `checkout.ts:80-104` (re-grep). A color missing a given size is never packed into it.
3. `withSafetyMargin` applies +10% safety margin then rounds up to the smallest available bag size for the color — which requires the color's `DRILL_VARIANTS[dmcCode][shape]` sizes (hence the `dmcCode`+`shape` args in requirement 1), OR split it: a pure +10% count bump here, per-color rounding in `planColorSupply`. Note this is the *cost-minimizer/optimize-bags* safety concept, distinct from App's manual-uniform-bag `calculateSafetyPurchase(count, bagSize)`, which is NOT moving (it stays in `App.tsx` for the unchecked-`#optimize-bags-checkbox` branch — see step01/task-03). Keep the module pure — no `localStorage`, no DOM, no Preact imports (design §8A: lightweight/browser-native, no new deps).
4. Error handling per design §6: `packColor` on an unknown DMC code or a color with no available sizes returns an empty pack `{ bySize: {}, totalDrills: 0, packets: 0 }` — never throw (this runs in the render path).

## Dependencies
- `src/engine/variants.ts` — `DRILL_VARIANTS[dmcCode][shape]` (read-only; do not modify).
- The dye-lot / per-color packing logic currently inside `checkout.ts:35` `optimizeBags` and `checkout.ts:80-104` (`compileShopifyCartLink`) — this task *reimplements the primitive*; task 02 makes `checkout.ts` consume it.
- No new npm dependencies (design N4/§8A).

## Implementation Approach
1. Re-grep the current anchors first: `optimizeBags`, `compileShopifyCartLink` (esp. the `:80-104` availability loop), `calculateSafetyPurchase`, `getDefaultPacketCost` in `App.tsx` and `checkout.ts`. Confirm the exact `DRILL_VARIANTS[dmcCode][shape]` access shape and the packet-cost table values.
2. **Write the failing tests first (TDD, RED→GREEN per behavior — never all-tests-first):** create `src/engine/__tests__/bagPlanner.test.ts` and add ONE behavior at a time, watching it go red then green:
   - dye-lot boundary: `requiredCount ≤ 800` packs into 200-bags only.
   - variant availability: a color missing the 1000 size is never packed into 1000; an unknown code yields the empty pack.
   - `withSafetyMargin`: +10% rounded up to the smallest available bag size.
   - `priceColorPack` / `planColorSupply`: pack × `priceDb` size prices produce the expected `costExact`/`costSafety` and `bagsText`.
3. Implement `bagPlanner.ts` to satisfy each behavior. Extract `packColor` as the single primitive; build `planColorSupply` on top of it (`exact` = `packColor(dmcCode, shape, count)`, `safety` = `packColor(dmcCode, shape, withSafetyMargin(dmcCode, shape, count))` — or `packColor(dmcCode, shape, count*1.1-rounded-inside)` if you keep `withSafetyMargin` a bare count bump; then price both).
4. **Do not** yet import `bagPlanner` from `App.tsx` or `checkout.ts` — leave the existing `optimizeBags` paths untouched so the full suite stays green. Wiring happens in tasks 02–03.
5. Add the module's CIELAB/engine header comment consistent with sibling files in `src/engine/` (match the surrounding file style; do not invent a new convention).
6. **Guardrail — verify gate (run before considering this done, per plan + Cardinal Rule 4):** `npx tsc --noEmit` && `npm test` (all green, ≥99 including the new file) && `npm run build`. Commit only when green: `refactor(supply): add bagPlanner per-color packing primitive + tests`.

## Acceptance Criteria

1. **Dye-lot rule enforced**
   - Given a color with `requiredCount = 800` (≤ the dye-lot ceiling)
   - When `packColor(dmcCode, shape, 800)` runs
   - Then the returned `ColorPack.bySize` uses **200-bags only** (no 500/1000/2000 entries), and `totalDrills`/`packets` reflect that packing.

2. **Per-color variant availability respected**
   - Given a DMC code + shape whose `DRILL_VARIANTS` entry lacks the 1000 size
   - When `packColor(...)` packs a large `requiredCount`
   - Then no drills are packed into the 1000 size; packing uses only sizes present for that color.

3. **Unknown / unavailable color is safe**
   - Given a DMC code absent from `DRILL_VARIANTS` (or with no available sizes)
   - When `packColor(...)` is called
   - Then it returns `{ bySize: {}, totalDrills: 0, packets: 0 }` and does not throw.

4. **Safety margin + pricing**
   - Given an exact count and a `priceDb` mapping bag size → unit price
   - When `planColorSupply(dmcCode, shape, count, priceDb)` runs
   - Then `safety` reflects +10% rounded up to the smallest available bag size, and `costExact`/`costSafety` equal the summed size prices for `exact`/`safety`.

5. **No regressions, suite still green**
   - Given the new module is not yet imported by `App.tsx` or `checkout.ts`
   - When `npx tsc --noEmit`, `npm test`, and `npm run build` run
   - Then all pre-existing tests (≥99) plus the new `bagPlanner.test.ts` pass, and the build compiles.

## Metadata
- **Complexity**: Medium
- **Labels**: engine, supply-optimizer, bug-fix-prep, candidate-1
- **Required Skills**: TypeScript, Vitest (TDD), diamond-art supply/dye-lot domain logic
