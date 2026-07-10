# Task: Route the legend estimate through `planColorSupply` and delete the cost-minimizer (`App.tsx`)

## Description
Rewire the `App.tsx` legend cost estimate to call `bagPlanner.planColorSupply(...)` per color, **delete** App's brute-force cost-minimizer `optimizeBags`, and move `getDefaultPacketCost` out of `App.tsx` (it now lives in `bagPlanner.ts` from task 01 as `defaultPacketCost`). **`calculateSafetyPurchase` stays in `App.tsx`** — it powers the separate manual/checkbox-off legend branch, which has no `bagPlanner` equivalent (see Background). This is task 3 of 3 and the payoff of **Step 1 (Candidate 1)**: it closes the estimate-vs-cart divergence bug and adds the **key regression test** proving `estimate == cart`. Depends on tasks 01 and 02.

## Background
The legend estimate (`App.tsx:1130-1180`, `sortedMatches`) currently calls the **cost-minimizer** `App.tsx:169` `optimizeBags(count, priceDb)` per DMC row. That minimizer ignores the ≤800 dye-lot rule and assumes all bag sizes exist for every color — so it can disagree with the cart (`compileShopifyCartLink`, now packing via `packColor` after task 02). Per idea-honing Q1 the cart is the source of truth, so the estimate must re-run the cart's per-color packer and price it — exactly what `bagPlanner.planColorSupply` does.

`print.test.tsx` imports `calculateSafetyPurchase, optimizeBags` **from `../App`** (`current-state.md` §Test inventory). **Re-verified against the live file: only the `optimizeBags` half of that import breaks.** `print.test.tsx` has two `describe` blocks: "Safety margin calculations" (tests `calculateSafetyPurchase` directly, including arbitrary custom bag sizes like 1000 — `:19-31`) and "Adaptive bulk bags optimization" (tests `optimizeBags`'s brute-force combination behavior directly — `:34-60`). Since `calculateSafetyPurchase` is NOT moving (see below), its describe block and import need **no change**. Only the `optimizeBags` import and its describe block need removing, because the cost-minimizer algorithm itself is deleted with no like-for-like port (dye-lot-correct `packColor`/`planColorSupply` coverage already lives in task 01's `bagPlanner.test.ts`). This is a UI-touching step (legend numbers change to the correct cart-matching values), so a `npm run dev` visual pass is required in addition to the test gate.

**Confirmed by re-grep: the `sortedMatches` legend loop is actually two branches gated by `optimizeBagsCost`** (the `#optimize-bags-checkbox` state), not one. The `if (optimizeBagsCost)` branch (`App.tsx:1137-1165`) calls the cost-minimizer `optimizeBags` being deleted — that's the branch this task rewires to `planColorSupply`. The `else` branch (`App.tsx:1166-1180`, taken when the checkbox is unchecked) calls `calculateSafetyPurchase(count, drillBagSize)` to compute a **manual, user-chosen uniform bag size applied to every color** (`drillBagSize` is a plain dropdown, independent of any color's `DRILL_VARIANTS` availability). `bagPlanner`'s API (task 01) is entirely per-color/`DRILL_VARIANTS`-driven — `withSafetyMargin(requiredCount): number` takes no `bagSize`/`dmcCode` argument and cannot reproduce `calculateSafetyPurchase(count, bagSize)`'s arbitrary-size division. Per design N1 ("no user-facing change except R1's reconciliation"), the manual branch must keep working unchanged, so `calculateSafetyPurchase` stays local to `App.tsx` — see the corrected Requirement 2 below. `App.test.tsx` lines ~139-144 and ~219-224 explicitly **uncheck** `#optimize-bags-checkbox` to exercise this manual branch and assert literal values (`packetCostInput.value` of `'0.25'`/`'0.35'`, total `$23.00`); these must keep passing unmodified.

## Reference Documentation
**Required:**
- Design: `.agents/planning/2026-07-10-architecture-deepening/design/detailed-design.md` (§4 Candidate 1, §7 Testing — the estimate==cart regression, §C Risks)
- Plan: `.agents/planning/2026-07-10-architecture-deepening/implementation/plan.md` (Step 1, guidance 3 + Tests)
- Rules: `CLAUDE.md`, `.agents/GEMINI.md`

**Additional References (if relevant to this task):**
- `.agents/planning/2026-07-10-architecture-deepening/research/current-state.md` (§Candidate 1 divergence, §Test inventory — `print.test.tsx` imports, `App.test.tsx` `#optimize-bags-checkbox`)

**Note:** You MUST read design §4 Candidate 1 + §7 (regression) and confirm the `bagPlanner` (task 01) and `checkout.ts` (task 02) APIs before starting. Re-grep every anchor (`sortedMatches`, `optimizeBags`, `calculateSafetyPurchase`, `getDefaultPacketCost`, `#optimize-bags-checkbox`) in `App.tsx` — after tasks 01–02 landed, line numbers have drifted substantially.

## Technical Requirements
1. In `App.tsx`, inside the `sortedMatches` legend loop's **`if (optimizeBagsCost)` branch only** (`:1137-1165`), replace the `optimizeBags(count, priceDb)` calls (`:1142-1143` — confirmed current, not drifted) with `planColorSupply(dmcCode, shape, count, priceDb)`. **`ColorSupplyRow`'s shape (`exact`/`safety`: `ColorPack` objects, plus `costExact`/`costSafety`/`bagsText`) does not match the flat scalar fields the rest of `sortedMatches` already depends on** — do not spread `ColorSupplyRow` directly as the row. Map its fields onto the existing flat row shape so both branches keep producing objects with the same field names: `safety` (number — used at `:1204` `totalSafetyDrills` reduce and rendered at `:1887`/`:2890`/`:2956`), `packets` (number — used at `:1205` reduce and rendered at `:1889`/`:2899`/`:2961`), `purchase` (number, total drills bought — rendered at `:2895`/`:2959`), `costExact`, `costSafety` (used at `:1207` reduce), `bagsText`. Derive these from the `ColorSupplyRow.safety`/`.exact` `ColorPack`s (e.g. `.totalDrills`/`.packets`) — do not leave `row.safety`/`row.packets` as objects or the `:1204-1207` `reduce` aggregations will break (NaN / type error under `tsc --noEmit`). The per-color "Bags" column must now equal what the cart packs **when the checkbox is ON** — leave the loop's `else` branch (`:1166-1180`) untouched; see Requirement 2.
2. **Delete** App's cost-minimizer `optimizeBags` (`:169`) entirely — its only caller is the `if (optimizeBagsCost)` branch removed in Requirement 1. **Move only `getDefaultPacketCost` (`:143`)**: delete it from `App.tsx` and import `defaultPacketCost` from `bagPlanner.ts` (identical `(type, bagSize) => number` signature); update its sole caller at `App.tsx:729` (`setDrillPacketCost(getDefaultPacketCost(drillType, drillBagSize))`) to call `defaultPacketCost(drillType, drillBagSize)`. **Do NOT delete or move `calculateSafetyPurchase` (`:136`)** — it has no `bagPlanner` equivalent (`withSafetyMargin` takes no `bagSize`, is per-color/`DRILL_VARIANTS`-driven, and cannot replicate an arbitrary manually-chosen uniform bag size). Leave it defined locally in `App.tsx`, still powering the `else` branch's manual mode exactly as today.
3. In `src/__tests__/print.test.tsx`, remove only `optimizeBags` from the `import { calculateSafetyPurchase, optimizeBags } from '../App';` line (keep `calculateSafetyPurchase` importing from `../App` — it isn't moving) and delete the `describe('Adaptive bulk bags optimization', ...)` block (`:34-60`) that exercises the deleted cost-minimizer's brute-force combinations; that coverage is superseded by task 01's `bagPlanner.test.ts`. Leave the `describe('Safety margin calculations', ...)` block (`:4-32`) completely untouched.
4. Add the **key regression test** (design §7): for a fixture color set, assert that the summed `planColorSupply` bag counts equal the bags `compileShopifyCartLink` builds — i.e. **estimate == cart**. Place it where the supply/cart seam is naturally tested (e.g. alongside `checkout.test.ts` or a new `bagPlanner.test.ts` regression `describe`); it must exercise both real functions, not mocks.
5. Preserve all other legend/HUD behavior. `App.test.tsx` (`#optimize-bags-checkbox`, wizard nav, project fixtures) and `integration.test.tsx` must stay green. **Confirmed (not hypothetical): `#optimize-bags-checkbox` toggles `optimizeBagsCost`, which selects between the two `sortedMatches` branches (Requirement 2) — it is not a cosmetic label.** `App.test.tsx` ~139-144 and ~219-224 uncheck it to exercise the manual (`else`) branch and assert literal costing values (`'0.25'`/`'0.35'`, `$23.00` total); ~479 asserts the checkbox renders on Step 3. All three must keep passing with the manual branch's math untouched (design N1: no user-facing change except the R1 reconciliation).

## Dependencies
- **Task 01** — `bagPlanner.planColorSupply` / `defaultPacketCost` (this task does not call `withSafetyMargin` directly — `planColorSupply` uses it internally; `calculateSafetyPurchase` stays local to `App.tsx` for the manual branch, see Requirement 2).
- **Task 02** — `checkout.ts::compileShopifyCartLink` already packing via `packColor` (so estimate and cart share the primitive; the regression test asserts their equality).
- `src/__tests__/print.test.tsx` — must stay green; only its `optimizeBags` import/describe block is removed in this increment, `calculateSafetyPurchase` import is untouched.
- `src/__tests__/App.test.tsx`, `src/__tests__/integration.test.tsx` — must stay green with no changes.

## Implementation Approach
1. Re-grep the drifted anchors in `App.tsx`: `sortedMatches` legend loop, the cost-minimizer `optimizeBags`, `calculateSafetyPurchase`, `getDefaultPacketCost` (+ its `:729`-era caller), and the `#optimize-bags-checkbox` handler.
2. **Write the failing regression test first (RED→GREEN):** add the estimate==cart assertion over a fixture color set; watch it fail against today's cost-minimizer estimate, then make it pass by the rewire. This is the tracer bullet for the whole step.
3. Swap only the `if (optimizeBagsCost)` branch of the legend loop to `planColorSupply(...)`; render from `ColorSupplyRow`. Delete the App cost-minimizer `optimizeBags`. Move only `getDefaultPacketCost` to `bagPlanner.defaultPacketCost`, updating its `:729` caller. Leave `calculateSafetyPurchase` and the loop's `else` branch (manual/checkbox-off mode) untouched — it has no `bagPlanner` equivalent.
4. Remove `optimizeBags` from `print.test.tsx`'s import and delete its now-dead describe block in the **same** increment (never leave a red import); leave the `calculateSafetyPurchase` import/tests as-is.
5. **Guardrail — UI-touching step:** run `npm run dev` (http://localhost:5173) and visually confirm the Step 3 legend "Bags"/cost column matches the "Add to cart" packing for several colors, and that the `#optimize-bags-checkbox` toggle still behaves as before. Do not mirror engine state into new local `useState` — App stays a thin consumer of `bagPlanner`.
6. **Verify gate (Cardinal Rule 4):** `npx tsc --noEmit` && `npm test` (all green, ≥99) && `npm run build` && `npm run dev` visual pass. Commit only when green: `fix(supply): legend estimate matches cart via bagPlanner; remove cost-minimizer`.

## Acceptance Criteria

1. **Estimate == cart (the bug fix)**
   - Given a fixture set of matched colors with a `priceDb`
   - When summing `planColorSupply(...)` bag counts and comparing to what `compileShopifyCartLink(...)` builds
   - Then the per-color bag counts (and totals) are equal — the regression test passes exercising both real functions.

2. **Legend reads from `bagPlanner`**
   - Given Step 3 (canvas/pricing) rendered with a match
   - When the legend rows draw
   - Then each row's bags + cost come from `planColorSupply(...)`, and the visual `npm run dev` pass shows them matching the "Add to cart" packing for the same colors.

3. **Cost-minimizer removed; manual mode preserved**
   - Given the refactored `App.tsx`
   - When grepping for `optimizeBags` and `getDefaultPacketCost`
   - Then the brute-force `optimizeBags` is gone entirely, and `getDefaultPacketCost`'s sole caller (`:729`) now calls `defaultPacketCost` imported from `bagPlanner.ts`
   - **And** `calculateSafetyPurchase` still exists locally in `App.tsx` (intentionally not deleted/moved — see Requirement 2), still powering the `optimizeBagsCost === false` manual branch unchanged.

4. **`optimizeBags` import removed, suite green**
   - Given `print.test.tsx` (the only importer of the deleted symbol)
   - When the suite runs
   - Then its `optimizeBags` import and dead describe block are gone, its `calculateSafetyPurchase` tests still import from `../App` and pass unchanged, and `App.test.tsx` (`#optimize-bags-checkbox`, wizard nav) and `integration.test.tsx` stay green.

5. **Full gate green**
   - Given the completed increment
   - When `npx tsc --noEmit`, `npm test` (≥99), `npm run build`, and a `npm run dev` visual pass run
   - Then all pass, the build compiles, and no user-facing behavior changed except the corrected (cart-matching) estimate numbers.

## Metadata
- **Complexity**: High
- **Labels**: app-shell, legend, supply-optimizer, bug-fix, candidate-1
- **Required Skills**: Preact, TypeScript, Vitest + jsdom, Vite dev-server visual verification
