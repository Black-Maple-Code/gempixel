# Task: Extract `Step3Canvas` as a pure step component

## Description
Extract the Step 3 ("Cost & Order") inline render block from `App.tsx` into a pure `src/features/wizard/steps/Step3Canvas.tsx`. Task 4 of 5 for **Step 5 (Candidate 5)**. **Corrected scope:** despite its component name, this block does not render the pixel canvas viewport or the color legend — verification against the live code shows those are persistent chrome rendered unconditionally (viewport HUD ~`App.tsx:2522-2708`, gated only by `image &&`; the interactive `sortedMatches` legend table in the right `<aside>` ~`App.tsx:2710-2916`), never inside a `wizardStep` gate. This task must NOT move or touch either of them. The actual `wizardStep === 3` block is the canvas-print vendor/pricing/order form: vendor select, canvas price/shipping, the optimize-bags checkbox, per-bag pricing, a cost breakdown, order/print/download actions, sizing advice, and affiliate settings. Depends on task 01; do after tasks 02–03.

## Background
The Step 3 block lives inline at `App.tsx:~1908` (`research/current-state.md` §Candidate 5, labelled "canvas/pricing" — "canvas" there means the physical canvas-print product, not the pixel-art `<canvas>` viewer). It renders: the Canvas Print Partner select, Canvas Price ($) / Est. Shipping ($) inputs, the Optimize Bag Combinations checkbox (`id="optimize-bags-checkbox"`, `App.tsx:1954`), the per-bag-size price grid (or the simple bag-size/price fields when unchecked), a Cost Estimate breakdown (`totalSafetyDrills`/`totalPackets`/`safetyDrillCost`/`totalCostSafety`), Order & Print Actions buttons (Shopify checkout, PNG downloads, print legend/report), a Sizing Advice card, canvas-printer vendor links (`VENDOR_REGISTRY`), and Affiliate & Partner settings (incl. the unmapped-colors log). It does **not** render the canvas viewport HUD (zoom/pan/view-mode segmented control) or the interactive color legend — both live outside any `wizardStep` gate and are out of scope for this task. It also gates on a match existing (`canEnter(3)`). Per design §4 Candidate 5 it becomes a pure props-in/JSX-out component rendered as `{wizard.step === 3 && <Step3Canvas .../>}`. No behavior change (design N1). **Note:** a second, small `wizardStep === 3 && matchResult` print-only checklist block also exists, separately, at `App.tsx:~3299-3318` (class `hidden`, shown only via `@media print`) — it is not part of the contiguous 1908 block; decide explicitly whether it moves into `Step3Canvas` too or stays inline in `App.tsx` (recommendation: leave it in `App.tsx` to keep this move mechanical, since design §4 only names the four `1370/1693/1908/2238` anchors).

## Reference Documentation
**Required:**
- Design: `.agents/planning/2026-07-10-architecture-deepening/design/detailed-design.md` (§4 Candidate 5 — note the legend supply source (§4 Candidate 1) is NOT part of this component; it lives in a persistent, non-wizard-gated render site)
- Plan: `.agents/planning/2026-07-10-architecture-deepening/implementation/plan.md` (Step 5)
- Rules: `CLAUDE.md`, `.agents/GEMINI.md`

**Additional References (if relevant to this task):**
- `.agents/planning/2026-07-10-architecture-deepening/research/current-state.md` (§Candidate 5 — Step 3 block anchor `~:1908`, labelled "canvas/pricing" = canvas-print product, not the pixel viewer; the legend `sortedMatches` data source under §Candidate 1 is a *different*, always-visible render site — not part of this block)

**Note:** You MUST read design §4 Candidate 5 first. Re-grep the Step 3 block (`wizardStep === 3` at `App.tsx:~1908`) and every vendor/pricing/order handler it closes over (anchors have drifted the most here). Do NOT look for viewer/HUD/legend markup inside this block — confirmed absent (see Background).

## Technical Requirements
1. Create `src/features/wizard/steps/Step3Canvas.tsx` — pure component; all data/handlers passed as typed props: `selectedVendor`/`setSelectedVendor`, `canvasBaseCost`/`setCanvasBaseCost`, `canvasShippingEstimate`/`setCanvasShippingEstimate`, `optimizeBagsCost`/`setOptimizeBagsCost`, `priceDb`/`updatePriceDb`, `drillBagSize`/`setDrillBagSize`, `drillPacketCost`/`setDrillPacketCost`, `totalSafetyDrills`/`totalPackets`/`safetyDrillCost`/`totalCostSafety`, `matchResult` (for disabled states), `handleShopifyCheckout`/`handleDownloadCanvasOnly`/`handleDownloadCombinedCanvasSheet`/`printLegendSheetOnly`/`printReport`, `sizingAdviceData`, `VENDOR_REGISTRY`, `affiliateTag`/`setAffiliateTag`, `affiliateApp`/`setAffiliateApp`, `unmappedLog`/`setUnmappedLog`. No `useState` mirroring app/engine state. This component has **no** dependency on `viewerRef`/`CanvasViewer` or the legend `sortedMatches` render — do not add props for them.
2. Move the JSX from `App.tsx:~1908` verbatim (locals → props). App renders `{wizard.step === 3 && <Step3Canvas {...props} />}`. This block never touches the viewer-feed effect (Candidate 2, `App.tsx:~651-669`) — leave that effect untouched in App; it feeds the always-visible viewport and is unrelated to this component.
3. Preserve every id/class/handler the tests/CSS rely on — re-grep test-queried selectors. Confirmed in-block: `#optimize-bags-checkbox` (`App.tsx:1954`; queried by `App.test.tsx:140,220,479`) and the order/print/download buttons (e.g. `handleShopifyCheckout`'s "🛒 Order Drills from Diamond Drills USA"). There is no `BUY SUPPLIES` text or HUD/legend markup anywhere in this block (verified via grep — zero hits in `App.tsx`).
4. Structural move only; no token/Tailwind changes. Preserve the Cost Estimate breakdown values (`totalSafetyDrills`/`totalPackets`/`safetyDrillCost`/`totalCostSafety`) exactly as computed today — this component only displays them (already reflecting Step 1's `planColorSupply` reconciliation upstream); it does not compute or render the legend itself.

## Dependencies
- Task 01 (`useWizard`).
- Candidate 1's `planColorSupply` reconciliation (Step 1 of the overall plan) affects the upstream cost totals (`totalSafetyDrills` etc.) this component displays, but this component does not render the legend.
- `src/__tests__/App.test.tsx` (`#optimize-bags-checkbox`) + `integration.test.tsx` — stay green.

## Implementation Approach
1. Re-grep the Step 3 block (`wizardStep === 3` at `App.tsx:~1908`) and every vendor/pricing/order-action handler it closes over → props interface. Confirm it excludes `viewerRef`, HUD controls, and `sortedMatches`/legend markup.
2. Create `Step3Canvas.tsx`; paste JSX; replace locals with `props.*`; type props.
3. Swap the inline block for `<Step3Canvas .../>`.
4. **Guardrail:** pure receiver only; do not relocate the viewer-feed effect or the legend (neither is in this block to begin with), and do not introduce mirrored state.
5. **Verify gate (Cardinal Rule 4) + UI pass:** `npx tsc --noEmit` && `npm test` (≥99) && `npm run build` && `npm run dev` — confirm the Step 3 cost/order form (vendor select, price fields, optimize-bags toggle, cost breakdown, order/print/download buttons) renders and behaves identically, and that the persistent viewport HUD + legend (untouched, outside this component) still work as before. Commit only when green: `refactor(wizard): extract Step3Canvas component`.

## Acceptance Criteria

1. **Pure receiver** — Given `Step3Canvas.tsx`, when inspected, then all Cost & Order data (vendor/pricing/cost-breakdown/order-actions/affiliate settings) arrive via typed props with no mirrored state and no `viewerRef`/`CanvasViewer`/legend dependency.
2. **Step 3 form unchanged** — Given step 3 (`npm run dev`) with a match, when interacting with the vendor select, price fields, optimize-bags toggle, and order/print/download buttons, then behavior/display is exactly as before; the persistent viewport HUD and legend (outside this component, untouched) continue to work unaffected.
3. **Selectors preserved** — Given `App.test.tsx`/`integration.test.tsx`, when they query `#optimize-bags-checkbox` and other Step 3 controls, then all ids/classes/text still resolve (green).
4. **Suite + build green** — When `npx tsc --noEmit`, `npm test` (≥99), `npm run build` run, then all pass.

## Metadata
- **Complexity**: High
- **Labels**: features, wizard, ui-extraction, canvas, candidate-5
- **Required Skills**: Preact/JSX, TypeScript, Vitest + jsdom
