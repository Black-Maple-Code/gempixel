---
phase: 16-optimized-supply-plan-savings
plan: 02
type: execute
wave: 2
depends_on: ["16-01"]
files_modified:
  - src/engine/bagPlanner.ts
  - src/engine/__tests__/bagPlanner.test.ts
autonomous: true
requirements: [BAG-02, BAG-03]
must_haves:
  truths:
    - "naiveColorPack returns the smallest single covering bag for a >800 color, or ceil-fills the largest available size when no single size covers (D-07); for a <=800 color it returns the SAME 200-count pack the optimizer does (D-05)."
    - "planOrderSupply returns per-color optimized rows, total bag count, total drills, optimized cost, naive baseline cost, and savings — all reconciled in integer cents via money.ts (D-13, PRICE-03)."
    - "savings (naive - optimized) is >= 0 for every color and in aggregate across the fixture (D-06), and is $0 for <=800 colors (truthful)."
  artifacts:
    - "src/engine/bagPlanner.ts — new naiveColorPack, planOrderSupply, and OrderSupplyPlan interface"
    - "src/engine/__tests__/bagPlanner.test.ts — baseline + aggregator + savings>=0 + reconciliation tests"
  key_links:
    - "planOrderSupply consumes packColor (optimized, from 16-01), naiveColorPack (baseline), and priceColorPack/money.ts (pricing)."
  prohibitions:
    - "The naive baseline does NOT combine sizes (single-size-per-color) and does NOT compare against the mutable drillBagSize setting or a uniform 200/color (D-07 rejected alternatives)."
    - "Savings is never negative and is never fabricated for unpriced-only colors — such colors are excluded from BOTH totals (apples-to-apples, D-06)."
    - "No money math outside money.ts integer cents (PRICE-03)."
---

<objective>
Add the two pure engine pieces BAG-02/BAG-03 need, following existing
`bagPlanner.ts` conventions:
1. `naiveColorPack` (D-05/06/07) — the dye-lot-aware naive per-color baseline
   (smallest single covering bag; ceil-fill largest on no-cover) that the savings
   figure is measured against, reusing DRILL_VARIANTS availability, DYE_LOT_CEILING,
   and the priced-size filtering so it is apples-to-apples with the optimizer and
   provably never cheaper than it (D-06).
2. `planOrderSupply(counts, shape, priceDb)` (D-13) — the pure aggregator that
   replaces the inline `App.tsx` `sortedMatches` reduction, returning the optimized
   per-color rows + totals + naive baseline + savings, shared by the legend, the
   cart, and the future Phase 17 order packet so the numbers cannot diverge.

Purpose: BAG-03 savings baseline + BAG-02 shared-engine plan substrate.
Output: `naiveColorPack`, `planOrderSupply`, `OrderSupplyPlan`, and tests.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/16-optimized-supply-plan-savings/16-CONTEXT.md
@src/engine/bagPlanner.ts
@src/engine/money.ts
@src/engine/variants.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add the naive dye-lot-aware baseline (naiveColorPack)</name>
  <files>src/engine/bagPlanner.ts, src/engine/__tests__/bagPlanner.test.ts</files>
  <read_first>
    - src/engine/bagPlanner.ts (whole file — replicate ColorPack shape, the empty-pack guard, the <=800 pack200 dye-lot branch, the isUnpriced/priced-size filtering, and priceColorPack conventions; naiveColorPack must mirror these exactly)
    - src/engine/variants.ts (VariantMapping / DRILL_VARIANTS — availability drives which sizes exist per color; '150' square has all sizes, '150' round has only 200)
    - src/engine/money.ts (toCents/fromCents/sumCents — pricing the baseline reconciles here)
  </read_first>
  <behavior>
    - '150' square, 300 (<=800): {200:2} — identical to packColor (dye-lot, $0 savings vs optimizer).
    - '150' square, 1050 (>800): {2000:1} — the smallest single size that alone covers 1050 (1000 does not).
    - '150' square, 900 (>800): {1000:1} — smallest single covering size.
    - '150' square, 3000 (>800, exceeds largest 2000): {2000:2} — ceil-fill the largest available size (D-07 no-cover fallback).
    - '150' round, 3000 (only 200 available): {200:15} — dye-lot/availability keeps it on 200s.
    - unknown code / count 0: empty pack, hasUnpricedSize false (mirror packColor).
    - a color coverable only by an unpriced size: flagged empty pack (hasUnpricedSize true), NOT a $0 line — same exclusion the optimizer applies.
  </behavior>
  <action>
    Add `export function naiveColorPack(dmcCode: string, shape: Shape,
    requiredCount: number, priceDb: Record<number, number>): ColorPack`. Reuse the
    same guards packColor uses: empty pack for unknown code / empty mapping /
    requiredCount <= 0. Apply the SAME dye-lot rule — when requiredCount <=
    DYE_LOT_CEILING and 200 is available, return the identical pack200 result (so
    small colors match the optimizer and show $0 savings, D-05). For the bulk
    (>800) case, restrict to the color's PRICED bulk sizes (>200) via the existing
    isUnpriced helper (so the baseline never self-selects an unpriced size at $0,
    mirroring minCostBulk); if none are priced, return the flagged empty pack
    exactly as minCostBulk does. Among priced bulk sizes, pick the SMALLEST size
    whose single unit covers requiredCount (size >= requiredCount) and buy one of
    it (naive one-bag-per-color, NO size combining). If no available priced bulk
    size covers requiredCount in one bag, apply the D-07 no-cover fallback:
    ceil-fill the LARGEST available priced bulk size (qty = ceil(requiredCount /
    largest)). Populate bySize/totalDrills/packets/hasUnpricedSize/unpricedSizes
    consistently with ColorPack. Do NOT compare against drillBagSize or a uniform
    200/color (D-07 rejected). Add a docstring stating this is the BAG-03 naive
    baseline (distinct from calculateSafetyPurchase in App.tsx, D-12).
  </action>
  <acceptance_criteria>
    - `npx tsc --noEmit` exits 0.
    - `bagPlanner.ts` exports `naiveColorPack`.
    - naiveColorPack('150','square',300,priceDb).bySize === {200:2} (matches optimizer, D-05).
    - naiveColorPack('150','square',1050,...).bySize === {2000:1}; 900 -> {1000:1}.
    - naiveColorPack('150','square',3000,...).bySize === {2000:2} (D-07 ceil-fill largest).
    - An unpriced-only color returns a flagged empty pack (hasUnpricedSize true, bySize {}), never a $0 line.
  </acceptance_criteria>
  <verify>
    <automated>npx tsc --noEmit && npx vitest run src/engine/__tests__/bagPlanner.test.ts</automated>
  </verify>
  <done>
    tsc exits 0; a new describe block for naiveColorPack passes every case in
    behavior above, including the D-07 ceil-fill fallback (3000 -> {2000:2}) and the
    <=800 identical-to-optimizer case (300 -> {200:2}).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add the planOrderSupply aggregator with savings totals</name>
  <files>src/engine/bagPlanner.ts, src/engine/__tests__/bagPlanner.test.ts</files>
  <read_first>
    - src/engine/bagPlanner.ts (planColorSupply ~241-267 returns the per-color exact+safety+costExact+costSafety+bagsText+hasUnpricedSize row this aggregator sums; withSafetyMargin ~190-202 is the safety-count basis; naiveColorPack from Task 1)
    - src/engine/money.ts (toCents/fromCents/sumCents — totals + savings computed in integer cents)
    - src/App.tsx lines 942-1031 (the current inline sortedMatches reduction + totalPackets/safetyDrillCostCents/unpricedColorCodes derivations this aggregator will replace in 16-03 — replicate the SAFETY-count basis so the moved logic matches the displayed Est. total)
  </read_first>
  <behavior>
    - planOrderSupply over a mixed fixture (a <=800 color, a >800 bulk color, and an unpriced-only color) returns one row per input code with the optimized planColorSupply fields.
    - totalPackets and totalDrills equal the sums of the per-color safety packs; optimizedCostCents equals sumCents(per-color safety cost cents).
    - naiveCostCents equals sumCents(per-color naive safety cost cents); savingsCents === naiveCostCents - optimizedCostCents and is >= 0.
    - savingsPct is 0 when naiveCostCents is 0; otherwise round(savingsCents / naiveCostCents * 100).
    - hasUnpricedSize is the OR across colors; unpricedColorCodes lists the flagged codes; unpriced-only colors contribute $0 to BOTH totals (no phantom savings).
  </behavior>
  <action>
    Add `export interface OrderSupplyPlan` with fields: `rows` (Array of { code:
    string } intersected with the ColorSupplyRow returned by planColorSupply),
    `totalPackets`, `totalDrills`, `optimizedCostCents`, `naiveCostCents`,
    `savingsCents`, `savingsPct`, `hasUnpricedSize`, and `unpricedColorCodes:
    string[]`. Add `export function planOrderSupply(counts: Record<string, number>,
    shape: Shape, priceDb: Record<number, number>): OrderSupplyPlan`. For each
    [code, count] entry: compute the optimized row via planColorSupply (which packs
    exact + the +10% safety count and prices both through priceColorPack). Compute
    the naive baseline on the SAME safety count basis — safetyCount =
    withSafetyMargin(code, shape, count), then priceColorPack(naiveColorPack(code,
    shape, safetyCount, priceDb), priceDb) — so the savings reconciles with the
    displayed safety-based Est. total. Accumulate optimizedCostCents and
    naiveCostCents with toCents + sumCents (never raw float addition). Set
    savingsCents = Math.max(0, naiveCostCents - optimizedCostCents) as a defensive
    clamp (the value is provably >= 0 because naiveColorPack always uses the fewest
    possible bags, so the optimizer never spends its cap premium relative to it —
    the clamp is a NaN/precision guard, not a correctness crutch). Compute
    savingsPct from cents (0 when naiveCostCents is 0). Keep the aggregator pure —
    NO DMC_PALETTE name/hex lookup and NO sorting (those stay in the UI). Add a
    docstring: shared by the legend estimate, the Shopify cart, and the future
    Phase 17 order packet (D-13).
  </action>
  <acceptance_criteria>
    - `npx tsc --noEmit` exits 0.
    - `bagPlanner.ts` exports `planOrderSupply` and the `OrderSupplyPlan` interface.
    - For every fixture, savingsCents === max(0, naiveCostCents - optimizedCostCents) and is >= 0.
    - optimizedCostCents and naiveCostCents are computed via toCents+sumCents (integer cents).
    - A <=800-only fixture yields savingsCents === 0; savingsPct is 0 when naiveCostCents is 0.
    - An unpriced-only color contributes $0 to both totals and appears in unpricedColorCodes.
    - planOrderSupply performs no DMC_PALETTE lookup and no sorting (stays pure).
  </acceptance_criteria>
  <verify>
    <automated>npx tsc --noEmit && npx vitest run src/engine/__tests__/bagPlanner.test.ts</automated>
  </verify>
  <done>
    tsc exits 0; a planOrderSupply describe block asserts: per-color rows keyed by
    code; totals reconcile via money.ts; savingsCents >= 0 for every fixture and
    equals naive-minus-optimized; savingsPct is 0 when the naive total is 0; an
    unpriced-only color contributes $0 to both totals and appears in
    unpricedColorCodes; a <=800-only fixture yields savingsCents === 0 (truthful).
  </done>
</task>

</tasks>

<artifacts_produced>
## Artifacts this phase produces (Plan 16-02)

**New exported symbols (bagPlanner.ts):**
- `naiveColorPack(dmcCode, shape, requiredCount, priceDb): ColorPack` — BAG-03 dye-lot-aware naive baseline (smallest single covering bag; ceil-fill largest on no-cover, D-05/06/07).
- `planOrderSupply(counts, shape, priceDb): OrderSupplyPlan` — BAG-02/D-13 shared aggregator (optimized rows + totals + naive baseline + savings, integer-cents reconciled).
- `interface OrderSupplyPlan` — rows, totalPackets, totalDrills, optimizedCostCents, naiveCostCents, savingsCents, savingsPct, hasUnpricedSize, unpricedColorCodes.

**New tests:** naiveColorPack + planOrderSupply describe blocks in bagPlanner.test.ts.

**Removed symbols:** none. **Reused verbatim:** packColor, planColorSupply, withSafetyMargin, priceColorPack, isUnpriced, DYE_LOT_CEILING, money.ts helpers, DRILL_VARIANTS.
</artifacts_produced>

<threat_model>
## Trust Boundaries

Fully client-side app (no backend/server/auth/db/upload). Only outbound surface is
the Shopify cart deep-link (checkout.ts), unchanged here.

| Boundary | Description |
|----------|-------------|
| user image data -> aggregator | Large grids yield extreme per-color counts summed into totals/savings; in-process, no network. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-16-01 | Tampering | savings + baseline money math | low | mitigate | All totals/savings reconcile through money.ts integer cents (toCents throws on non-finite); savingsCents is clamped >= 0; naiveColorPack uses only priced sizes so a tampered/absent price cannot fabricate a misleading savings figure. |
| T-16-02 | Denial of Service | naiveColorPack size scan | low | mitigate | naiveColorPack is O(available sizes) per color (no recursion/loop over the count); extreme counts cannot blow it up. |

No package installs in this plan (no npm/pip/cargo) — no supply-chain threat. No
server/auth/injection surface in this client-only app. **No HIGH-severity threats
exist in this plan.**
</threat_model>

<verification>
- `npx tsc --noEmit` exits 0; `npm test` fully green.
- planOrderSupply totals reconcile in integer cents; savings is provably >= 0 and
  $0 for <=800-only fixtures.
- The aggregator is pure (no Preact/DOM/palette/sort) and reuses the same primitives
  the cart uses, satisfying D-13's "cannot diverge" contract.
</verification>

<success_criteria>
- BAG-03: a naive per-color baseline exists and the savings figure is computed by
  the same shared engine, apples-to-apples and provably >= 0 (D-05/06/07).
- BAG-02: planOrderSupply is the single shared plan substrate (D-13) for legend,
  cart, and the future order packet.
</success_criteria>

<output>
Create `.planning/phases/16-optimized-supply-plan-savings/16-02-SUMMARY.md` when done.
Record the OrderSupplyPlan field names so 16-03/16-04 wire the exact shape.
</output>
