---
phase: 16-optimized-supply-plan-savings
plan: 03
type: execute
wave: 3
depends_on: ["16-02"]
files_modified:
  - src/App.tsx
  - src/features/wizard/steps/Step2Palette.tsx
  - src/features/wizard/steps/Step3Canvas.tsx
  - src/__tests__/App.test.tsx
autonomous: true
requirements: [BAG-02]
must_haves:
  truths:
    - "The supply legend, per-color bags, total bag count and total cost are computed by planOrderSupply (the shared engine), not an inline App.tsx reduction (D-13)."
    - "The optimized fewest-bags plan is the SOLE displayed plan; there is no user control to switch packing modes (D-11)."
    - "calculateSafetyPurchase and calculateFixedBagCost remain exported and covered by print.test.tsx (D-12)."
  artifacts:
    - "src/App.tsx — planOrderSupply wired in; optimizeBagsCost state/branches removed"
    - "src/features/wizard/steps/Step2Palette.tsx — optimizeBagsCost prop removed, always renders bagsText"
    - "src/features/wizard/steps/Step3Canvas.tsx — optimize checkbox + fixed-size UI removed"
    - "src/__tests__/App.test.tsx — updated for the single-plan UI"
  key_links:
    - "matchResult.counts -> planOrderSupply -> legend table + cost breakdown + unpriced banner; the Shopify cart still routes through compileShopifyCartLink (same primitive)."
  prohibitions:
    - "optimizeBagsCost / setOptimizeBagsCost no longer exist anywhere in non-test src (D-11)."
    - "calculateSafetyPurchase / calculateFixedBagCost are NOT deleted (D-12) — kept exported for print.test.tsx and Phase 19."
    - "No persisted-state migration is introduced — optimizeBagsCost was never a ProjectData field (confirmed at App.tsx:371-392)."
---

<objective>
Make the optimized fewest-bags plan the SOLE displayed plan by (a) replacing the
inline `App.tsx` `sortedMatches` reduction with the pure `planOrderSupply`
aggregator (D-13) and (b) retiring the user-facing `optimizeBagsCost` toggle
across `App.tsx`, `Step2Palette.tsx`, and `Step3Canvas.tsx` (D-11). Keep
`calculateSafetyPurchase` and `calculateFixedBagCost` exported (D-12). No
persisted-state migration is needed — the toggle is ephemeral `useState`, absent
from `ProjectData`.

Purpose: BAG-02 — the user sees the optimized plan (per-color bags, total bag
count, total cost) computed from the same shared engine the cart uses.
Output: aggregator-driven legend/cost UI with the toggle removed; green tests.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/16-optimized-supply-plan-savings/16-CONTEXT.md
@src/engine/bagPlanner.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace the inline sortedMatches reduction with planOrderSupply</name>
  <files>src/App.tsx</files>
  <read_first>
    - src/App.tsx lines 942-1067 (the sortedMatches reduction with the optimizeBagsCost branch at 949, the calculateFixedBagCost else-branch at 971-990, the sort at 992-1010, and the totalPackets / safetyDrillCostCents / totalCostSafety / unpricedColorCodes derivations at 1012-1067)
    - src/engine/bagPlanner.ts (planOrderSupply + OrderSupplyPlan field names from 16-02; planColorSupply row shape)
    - src/App.tsx lines 200-210 (optimizeBagsCost useState) and lines 371-392 (ProjectData construction — confirm optimizeBagsCost is absent, so no save migration)
  </read_first>
  <action>
    Call `planOrderSupply(matchResult?.counts || {}, drillStyle, priceDb)` once, then
    build the display rows by joining each aggregator row with its DMC name/hex
    (DMC_PALETTE lookup) and keeping the existing sort (sortBy/sortAsc/hexToHue) in
    the component — the aggregator is pure and does not sort. Replace the inline
    per-color packing so the ALWAYS-optimized branch is used (delete the
    `if (optimizeBagsCost) {...} else {...}` split; keep only the optimized mapping
    that produced code/count/name/hex/safety/packets/purchase/costExact/costSafety/
    bagsText/optimizedBags/hasUnpricedSize). Source totalPackets, the drill cost, and
    the unpriced color codes from the aggregator (totalPackets, optimizedCostCents ->
    fromCents for safetyDrillCost, unpricedColorCodes) rather than re-deriving them
    inline, while keeping the existing canvasBaseCost + canvasShippingEstimate
    reconciliation into totalCostSafety in integer cents. Do NOT call
    calculateFixedBagCost from the render path anymore (its export stays for tests
    and Phase 19, D-12). Remove the `optimizeBagsCost` useState (App.tsx ~205) and
    stop passing it to Step2Palette (App.tsx ~1314) and Step3Canvas (App.tsx
    ~1326-1327). Run tsc and resolve any now-unused-symbol errors caused by the
    removal (e.g. an unused import or an unused drillBagSize/drillPacketCost in the
    render path) WITHOUT deleting calculateSafetyPurchase/calculateFixedBagCost and
    WITHOUT removing any persisted ProjectData field.
  </action>
  <acceptance_criteria>
    - `npx tsc --noEmit` exits 0.
    - App.tsx calls `planOrderSupply(...)` and derives legend rows + totalPackets + drill cost + unpricedColorCodes from it (no inline per-color packing reduction remains).
    - The `optimizeBagsCost` useState and its passes to Step2Palette and Step3Canvas are removed from App.tsx.
    - `calculateSafetyPurchase` and `calculateFixedBagCost` remain exported from App.tsx.
    - No field is added to or removed from the ProjectData save payload (App.tsx:371-392).
  </acceptance_criteria>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>
    tsc exits 0; App.tsx computes the legend rows and totals from planOrderSupply;
    the optimizeBagsCost useState and its two child-prop passes are gone;
    calculateSafetyPurchase and calculateFixedBagCost are still exported.
  </done>
</task>

<task type="auto">
  <name>Task 2: Retire the toggle UI and collapse the branches in the child components</name>
  <files>src/App.tsx, src/features/wizard/steps/Step2Palette.tsx, src/features/wizard/steps/Step3Canvas.tsx</files>
  <read_first>
    - src/App.tsx lines 1943-1994 (live legend table: the Bags(Opt) header at 1944 and the optimizeBagsCost cell branch at 1984-1993) and lines 2029-2055 (print report: header at 2030 and cell branch at 2050-2054)
    - src/features/wizard/steps/Step2Palette.tsx (prop at 45, destructure at 73, ternary at 316 `{optimizeBagsCost ? row.bagsText : row.packets}`)
    - src/features/wizard/steps/Step3Canvas.tsx (prop at 31-32, destructure at 66-67, the checkbox at 135-147, and the optimizeBagsCost ternary at 149-226 that switches between the per-bag-size price grid and the drillBagSize/drillPacketCost fixed-size controls)
  </read_first>
  <action>
    In App.tsx, collapse both `optimizeBagsCost ? A : B` table branches to the
    optimized form only: the live legend header becomes the optimized-bags label
    with its optimized title, and the cell renders the bagsText + purchase-pcs form;
    the print report header/cell likewise render the optimized "Recommended Purchase
    Packs" form. In Step2Palette.tsx, remove the optimizeBagsCost prop (interface +
    destructure) and render `row.bagsText` unconditionally at the former ternary. In
    Step3Canvas.tsx, remove the optimizeBagsCost + setOptimizeBagsCost props
    (interface + destructure), delete the "Optimize bag sizes" checkbox block, and
    collapse the conditional so ONLY the per-bag-size price grid (the current
    optimized branch, 200/500/1k/2k inputs) remains — remove the fixed-size
    drillBagSize/drillPacketCost control block from the rendered form. If
    drillBagSize/drillPacketCost props become entirely unused by Step3Canvas after
    this, drop them from the Step3CanvasProps and the App call site too, but keep the
    underlying App state/persistence intact. Do not otherwise change layout, styles,
    or unrelated controls.
  </action>
  <acceptance_criteria>
    - `npx tsc --noEmit` exits 0.
    - `rg -n 'optimizeBagsCost' src --glob '!**/__tests__/**'` returns NO matches (D-11).
    - The live legend + print report tables render the optimized bags form unconditionally (no ternary on a toggle).
    - Step2Palette renders `row.bagsText` unconditionally; its optimizeBagsCost prop is gone.
    - Step3Canvas shows the per-bag-size price grid with no "Optimize bag sizes" checkbox and no fixed-size drillBagSize/drillPacketCost control block.
  </acceptance_criteria>
  <verify>
    <automated>npx tsc --noEmit && rg -n 'optimizeBagsCost' src --glob '!**/__tests__/**'</automated>
  </verify>
  <done>
    tsc exits 0; the ripgrep over non-test src returns NO matches for
    optimizeBagsCost (the token is fully removed from production code, D-11); the
    legend and print tables render the optimized plan unconditionally; Step3Canvas
    shows the per-bag-size price grid with no toggle and no fixed-size controls.
  </done>
</task>

<task type="auto">
  <name>Task 3: Update App.test.tsx for the single-plan UI</name>
  <files>src/__tests__/App.test.tsx</files>
  <read_first>
    - src/__tests__/App.test.tsx lines 285-295 (the "By default, optimizeBagsCost is true ... 6 number inputs" assertion) and the mock ProjectData objects that carry a stray `optimizeBagsCost: true` field (lines ~578, 658, 731, 816, 951)
    - src/App.tsx (the updated render from Tasks 1-2 — the price grid is now always shown, so the 6-input expectation should hold unconditionally)
  </read_first>
  <action>
    Update any App.test.tsx assertion that depended on the toggle: the "by default
    optimizeBagsCost is true -> 6 number inputs" expectation should now assert the
    six per-bag-size inputs render unconditionally (there is no toggle to flip). The
    stray `optimizeBagsCost: true` keys inside the mock ProjectData literals are
    harmless extra fields on load (ProjectData has no such key), so they may be left
    as-is OR removed for tidiness — either is acceptable; do NOT add an
    optimizeBagsCost field to the real save payload. Remove or rewrite any test that
    exercised the fixed-bag (non-optimized) UI path, since that UI no longer exists.
    Keep every unrelated App.test.tsx assertion passing.
  </action>
  <acceptance_criteria>
    - `npx tsc --noEmit` exits 0 and `npm test` (vitest run) is fully green.
    - No App.test.tsx assertion depends on toggling optimizeBagsCost or on the removed fixed-bag UI.
    - print.test.tsx still imports and passes calculateSafetyPurchase / calculateFixedBagCost (D-12 kept).
    - The real save payload gains no optimizeBagsCost field.
  </acceptance_criteria>
  <verify>
    <automated>npx tsc --noEmit && npm test</automated>
  </verify>
  <done>
    tsc exits 0; the full vitest suite is green, including App.test.tsx,
    bagPlanner.test.ts, checkout.test.ts, and print.test.tsx (calculateSafetyPurchase
    / calculateFixedBagCost still imported and passing there).
  </done>
</task>

</tasks>

<artifacts_produced>
## Artifacts this phase produces (Plan 16-03)

**Removed symbols / UI (D-11):**
- `optimizeBagsCost` / `setOptimizeBagsCost` React state in App.tsx and the props threaded to Step2Palette and Step3Canvas.
- The "Optimize bag sizes" checkbox and the fixed-size drillBagSize/drillPacketCost control block in Step3Canvas.
- The inline `sortedMatches` per-color packing reduction and its fixed-bag else-branch in App.tsx (replaced by planOrderSupply).

**New wiring (no new exported symbols):**
- App.tsx now derives legend rows + totals + unpriced codes from `planOrderSupply`.

**Kept by contract (D-12):** `calculateSafetyPurchase`, `calculateFixedBagCost` (still exported from App.tsx, still covered by print.test.tsx). No ProjectData field added or migrated.
</artifacts_produced>

<threat_model>
## Trust Boundaries

Fully client-side app (no backend/server/auth/db/upload). This plan is a UI-wiring
refactor; the only outbound surface (the Shopify cart deep-link via checkout.ts) is
untouched and still routes through the same packColor primitive.

| Boundary | Description |
|----------|-------------|
| user image data -> planOrderSupply -> displayed totals | Extreme grids reach the aggregator (mitigated in 16-01/16-02); this plan only renders its output. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-16-03 | Tampering | displayed total reconciliation | low | mitigate | App.tsx keeps summing displayed line items (canvas + shipping + drills) in integer cents via money.ts, so removing the toggle branch cannot reintroduce float drift between the lines and the total (PRICE-03). |

No package installs (no npm/pip/cargo) -> no supply-chain threat. No new network,
auth, or injection surface. **No HIGH-severity threats exist in this plan.**
</threat_model>

<verification>
- `npx tsc --noEmit` exits 0; `npm test` fully green.
- `rg 'optimizeBagsCost' src --glob '!**/__tests__/**'` returns no matches (D-11).
- `calculateSafetyPurchase` and `calculateFixedBagCost` still exported and exercised
  by print.test.tsx (D-12).
- The legend/cost UI is driven by planOrderSupply; the cart still uses
  compileShopifyCartLink (same primitive) — no divergence.
</verification>

<success_criteria>
- BAG-02: the user sees the optimized plan (per-color bags, total bag count, total
  cost) computed from the shared engine; the toggle is gone (D-11); no migration.
</success_criteria>

<output>
Create `.planning/phases/16-optimized-supply-plan-savings/16-03-SUMMARY.md` when done.
</output>
