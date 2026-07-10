# Task: Route the Shopify cart through `packColor` (`checkout.ts`)

## Description
Refactor `src/engine/checkout.ts::compileShopifyCartLink` to build its per-color cart tokens by calling `bagPlanner.packColor(...)` instead of its inline packing loop, so the cart and the (soon-to-be-rewired) legend estimate share **one** packing algorithm. This is task 2 of 3 for **Step 1 (Candidate 1)**. It depends on task 01 (`bagPlanner.ts` must exist). It does not touch `App.tsx` — that's task 03.

## Background
`checkout.ts:70` `compileShopifyCartLink(items, affiliateTag, affiliateApp)` currently packs each color **inline** against `DRILL_VARIANTS[dmcCode][shape]` availability + the ≤800 dye-lot rule (`:80-141`, from the mapping/availability lookup through the remainder-handling `else` block — not just `:80-104`; that sub-range only covers the availableSizes computation and the start of the bulk loop, not the remainder/fallback logic that must also be replaced). That inline block is exactly the logic task 01 extracted into `bagPlanner.packColor`. There is also a separate dye-lot aggregate `checkout.ts:35` `optimizeBags(count)` (no per-color variant availability), tested by `checkout.test.ts` under `describe('Dye Lot Bag Optimizer')`.

Per design §4 Candidate 1: `compileShopifyCartLink` should consume `packColor`, and the existing `optimizeBags(count)` should either become a **thin wrapper over `packColor`** (aggregate, no variant availability) or be **removed if unused** after the refactor — verify its consumers first. (Review-time grep found its only consumer is its own `checkout.test.ts` describe block — no production code imports `checkout.ts`'s `optimizeBags` today, so absent a new consumer introduced elsewhere in this refactor, expect removal rather than a wrapper.) The goal is a single packing primitive with no behavior change to the cart the user actually receives.

## Reference Documentation
**Required:**
- Design: `.agents/planning/2026-07-10-architecture-deepening/design/detailed-design.md` (§4 Candidate 1, §6 Error Handling C1)
- Plan: `.agents/planning/2026-07-10-architecture-deepening/implementation/plan.md` (Step 1, guidance 2)
- Rules: `CLAUDE.md`, `.agents/GEMINI.md`

**Additional References (if relevant to this task):**
- `.agents/planning/2026-07-10-architecture-deepening/research/current-state.md` (§Candidate 1 — `checkout.ts` anchors `:35`, `:70`, `:80-104`; §Test inventory — `checkout.test.ts`)

**Note:** You MUST read the design (§4 Candidate 1) and confirm task 01's `bagPlanner` API before starting. Re-grep `compileShopifyCartLink`, `optimizeBags`, and the `:80-141` availability/packing block in `checkout.ts` — anchors have drifted since the docs were written.

## Technical Requirements
1. Rewrite the per-color packing inside `compileShopifyCartLink` to delegate to `bagPlanner.packColor(dmcCode, shape, requiredCount)`; build the Shopify cart tokens from the returned `ColorPack.bySize`. The generated cart URL/tokens for a given input MUST be byte-for-byte equivalent to the pre-refactor output (no behavior change — the cart is the source of truth being preserved).
2. Resolve `checkout.ts:35` `optimizeBags(count)`: grep all consumers. If still used elsewhere, reduce it to a thin wrapper over `packColor` (aggregate over sizes, dropping variant availability where the aggregate form requires it); if it has no remaining consumers after this refactor, remove it and delete its now-dead tests, migrating any still-relevant assertions.
3. Preserve the `unmappedItems` / empty-pack fallback behavior (design §6 C1): a color that `packColor` returns empty for is still surfaced in the cart flow exactly as before, just with no purchasable bags — never throw.
4. Update `src/engine/__tests__/checkout.test.ts` for any signature change. The `describe('Dye Lot Bag Optimizer')` and cart/partner-URL assertions must stay green (adapt them if `optimizeBags` becomes a wrapper or is removed).

## Dependencies
- **Task 01** — `src/engine/bagPlanner.ts` (`packColor`) must be merged/available.
- `src/engine/variants.ts` — `DRILL_VARIANTS` (read-only).
- Existing `src/engine/__tests__/checkout.test.ts` (166 lines) — must remain green.

## Implementation Approach
1. Re-grep `compileShopifyCartLink` and its `:80-141` inline packing (mapping/availability lookup through the remainder-handling `else` block); map each piece of that block to `packColor`'s `ColorPack.bySize`, including the remainder/fallback-to-200 logic (`:114-140`) — don't stop at the `:104` bulk-loop start, or that fallback logic will survive as dead code duplicating `packColor`. Confirm the `shape` and `requiredCount` values the cart passes today so the delegation is 1:1.
2. **TDD guard (RED→GREEN per behavior):** before refactoring, add/strengthen a `checkout.test.ts` case that pins the *current* `compileShopifyCartLink` output for a fixture color set (characterization test). Keep it green across the refactor — it is the equivalence proof for the cart.
3. Replace the inline loop with `packColor(...)` calls. Then handle `optimizeBags(count)`: grep consumers → wrapper-or-remove per requirement 2, updating/removing tests in the **same** increment (per current-state §Test inventory: imports that move must move in-increment).
4. Keep the change confined to `checkout.ts` + `checkout.test.ts`. Do **not** modify `App.tsx` (task 03) or `bagPlanner.ts` (task 01) beyond what the delegation strictly needs; if you discover `packColor` needs a small signature tweak, make it in `bagPlanner.ts` **with** a matching `bagPlanner.test.ts` update.
5. **Guardrail — verify gate (Cardinal Rule 4):** `npx tsc --noEmit` && `npm test` (all green, ≥99) && `npm run build`. Commit only when green: `refactor(supply): route Shopify cart through bagPlanner.packColor`.

## Acceptance Criteria

1. **Cart output unchanged (equivalence)**
   - Given a fixture set of matched colors + shape
   - When `compileShopifyCartLink(...)` runs after the refactor
   - Then the produced cart tokens/URL are identical to the pre-refactor output (the characterization test passes), proving no behavior change to what the user buys.

2. **Single packing algorithm**
   - Given the refactored `checkout.ts`
   - When inspecting `compileShopifyCartLink`
   - Then its per-color packing is performed by `bagPlanner.packColor(...)`, with no surviving inline dye-lot/availability loop duplicating that logic.

3. **`optimizeBags` reconciled**
   - Given the codebase after refactor
   - When grepping consumers of `checkout.ts` `optimizeBags(count)`
   - Then it is either a thin wrapper over `packColor` (still-used) or removed (unused), and `checkout.test.ts` reflects that choice with all its assertions green.

4. **Empty-pack fallback preserved**
   - Given a color that `packColor` returns empty for
   - When `compileShopifyCartLink` builds the cart
   - Then that color is handled exactly as the previous `unmappedItems` path (no purchasable bags, no throw).

5. **Suite + build green**
   - Given the completed refactor
   - When `npx tsc --noEmit`, `npm test`, `npm run build` run
   - Then all tests (≥99) pass and the build compiles.

## Metadata
- **Complexity**: Medium
- **Labels**: engine, checkout, supply-optimizer, candidate-1
- **Required Skills**: TypeScript, Vitest (characterization/TDD), Shopify cart-link format
