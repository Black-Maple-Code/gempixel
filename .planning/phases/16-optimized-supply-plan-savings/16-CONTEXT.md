# Phase 16: Optimized Supply Plan & Savings - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the gem-bag supply plan **trustworthy, minimized, and self-explaining**, delivering BAG-01/02/03:

- **BAG-01** — the optimizer minimizes the **number of bags** (not cost) while respecting the dye-lot rule, with cost as the tiebreaker.
- **BAG-02** — surface the optimized plan (per-color bags, total bag count, total cost) computed from the **same shared engine** the cart and future order packet use, with a plain-language dye-lot "why".
- **BAG-03** — show how much the optimized plan saves versus a naive per-color purchase (the savings explainer / differentiator).

**In scope:** the optimizer objective change, a pure naive-baseline function, a pure plan aggregator, and augmenting the **existing** supply-plan panel in place.

**Out of scope (other phases):** the %-service fee and order packet (Phase 17); the viewport-native wizard rework (Phase 18); Customer/Artist mode gating and any "simple view" (Phase 19); backend/payments (v4.0). Phase 16 ships while the app is **still the familiar sidebar + page-flip wizard** and must stay mode-agnostic.
</domain>

<decisions>
## Implementation Decisions

### BAG-01 — Optimizer objective & overshoot (comparator change only)
- **D-01:** Change the objective to **fewest bags primary, cost as tiebreak** — but bounded by a **cost-premium cap**: accept a fewer-bags plan only when its cost ≤ `costMin + price of one smallest available bag` for that color. If the fewer-bags plan exceeds the cap, fall back toward the cost-minimizing plan. (Chosen over pure fewest-bags, which overshoots unboundedly, and over cost-min-primary, which inverts BAG-01's stated priority.)
- **D-02:** The change is a **comparator/filter change inside the existing exact bounded search** in `bagPlanner.ts::minCostBulk`. **Do NOT** downgrade to a greedy heuristic or add an ILP/LP solver — the bounded search already enumerates every viable combination; only the selection criterion changes.
- **D-03:** The comparator must produce a **total, deterministic order** (e.g. final tiebreaks: fewer total drills, then largest-size-first) so that the legend estimate and the Shopify cart — which call the same primitive — can **never diverge** on a tie. This invariant is non-negotiable.
- **D-04:** The **dye-lot ≤800 → 200-count path is untouched** (`DYE_LOT_CEILING = 800`, `pack200`). Fewest-bags applies only to the bulk (>800) search. The dye-lot constraint overrides fewest-bags for small colors by design.

### BAG-03 — Savings baseline
- **D-05:** The "naive per-color purchase" is a **new pure function**: for each color, buy the **smallest single bag size that covers** its required count, **inheriting the same dye-lot rule** (≤800 → 200-count bags, identical to the optimizer there → $0 savings on small colors, which is truthful). No size-combining in the baseline.
- **D-06:** Baseline must be **apples-to-apples and provably ≥0** — the optimizer's `minCostBulk` already searches single-size plans as a subset, so it can never lose to its own baseline. Reuse `DRILL_VARIANTS` availability, `DYE_LOT_CEILING`, and `priceColorPack`/`money.ts` (integer cents) so the savings figure is computed by the same shared engine.
- **D-07:** Define an explicit **no-cover fallback** for a color no single available size covers (e.g. required > largest available bulk size): ceil-fill the largest available size. Baseline must never inflate savings by comparing against an invalid/mutable purchase (rejected: fixed `drillBagSize×ceil` because it shifts with a mutable setting and ignores dye-lot; rejected: uniform 200/color because it violates dye-lot for >800 colors).

### BAG-02 / BAG-03 — Surfacing (augment existing panel in place)
- **D-08:** **Hybrid presentation.** An **always-on savings headline** next to the existing Est. total (e.g. "Save $X (Y%) vs per-color"), derived from a new naive-cost total — the payoff is never hidden.
- **D-09:** The **dye-lot "why"** lives behind a **discoverable, a11y-safe "Why these bags?" expander** (a persistent trigger, NOT a hover-only tooltip) that reveals one plain-language sentence. Rejected: per-color tooltips/columns (crowd the dense ~9px 6-column table, hover fails on touch, likely reworked in Phase 18).
- **D-10:** Keep new copy **static text** (no per-row computed tooltips) so the printable "GemPixel Supply Plan Report" path stays a trivial mirror. Do not anticipate the Phase 18 viewport rework — augment the current supply panel minimally.

### Toggle fate
- **D-11:** **Retire the user-facing `optimizeBagsCost` toggle**; the optimized fewest-bags plan becomes the **sole displayed plan**. Correction confirmed in code: `optimizeBagsCost` is ephemeral `useState(true)` at `App.tsx:175`, **absent from the save payload** — so there is **no persisted state to migrate**.
- **D-12:** **Do not delete** the fixed-size pure fn (`calculateSafetyPurchase`) — keep it in the codebase. Any user-facing "simple/single-size view" is **deferred to Phase 19** (Customer/Artist mode split), not decided here. (Note: the BAG-03 naive baseline is the **new** dye-lot-aware fn from D-05, NOT this fixed-size path.)

### Architecture (from milestone research — implementation guidance, not a user choice)
- **D-13:** Move the `App.tsx` `sortedMatches` reduction into a **pure engine aggregator** (research names it `planOrderSupply(counts, shape, priceDb)` → optimized bag list + totals + `hasUnpricedSize`), shared by the legend estimate, the cart, and the future order packet — extending the existing shared-primitive pattern so the numbers cannot diverge.

### Claude's Discretion
- Exact copy wording for the savings headline and the "Why these bags?" sentence (keep plain-language, static).
- Exact naming/signature of the new aggregator and naive-baseline functions (follow existing `bagPlanner.ts` conventions).
- Whether the savings headline shows both `$` and `%` or just `$` — planner/UI's call, but keep it one clean line.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 16: Optimized Supply Plan & Savings" — goal + 4 success criteria.
- `.planning/REQUIREMENTS.md` §"Supply Optimization" — BAG-01, BAG-02, BAG-03 (+ note that BAG-02/BAG-03 surfacing is UI-mapped to Phase 16).
- `.planning/research/SUMMARY.md` — milestone research; line ~145 explicitly flags the "fewest bags vs minCostBulk minimizes cost" objective ambiguity resolved here; §"Phase 4: Bag-Optimization Aggregator" (preserve exact bounded search; the `1×2000 beats 1×1000+2×500` test intuition).

### Engine (the code this phase changes)
- `src/engine/bagPlanner.ts` — `packColor`, `minCostBulk` (the comparator to change, D-01/02/03), `planColorSupply`, `priceColorPack`, `defaultPacketCost`, `BAG_SIZES`, `DYE_LOT_CEILING`, `isUnpriced`/`hasUnpricedSize`.
- `src/engine/money.ts` — integer-cents helpers (`toCents`, `fromCents`, `sumCents`); all Phase 16 money math must reconcile through these (PRICE-03 invariant).
- `src/engine/variants.ts` — `DRILL_VARIANTS` availability drives which sizes exist per color (baseline + optimizer both depend on it).
- `src/engine/checkout.ts` — `compileShopifyCartLink` calls the same packing primitive; the "cannot diverge" contract.

### UI integration points
- `src/App.tsx` ~905–990 — `sortedMatches` reduction + the `optimizeBagsCost` branch (D-11 retire; D-13 move to engine) and the `totalCostSafety` reconciliation.
- `src/App.tsx` ~1850–2055 — the collapsible "DMC Supply List" panel, per-color `bagsText` rows, `totalCostSafety` footer / Est. total, and the print "GemPixel Supply Plan Report" path (where D-08/D-09 surface).
- `src/features/wizard/steps/Step3Canvas.tsx` — where the `optimizeBagsCost` checkbox is toggled (D-11).

### Tests (existing harnesses to extend)
- `src/engine/__tests__/bagPlanner.test.ts`, `src/engine/__tests__/checkout.test.ts`, `src/__tests__/print.test.tsx`.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `bagPlanner.ts::minCostBulk` — exact bounded search; the objective change is a one-spot comparator/filter edit (~line 153), keep the enumeration.
- `priceColorPack` + `money.ts` — integer-cents pricing reused verbatim by the new naive baseline so savings reconciles.
- `calculateSafetyPurchase` (App.tsx) — kept as a pure fn (D-12), but NOT the naive baseline.
- The shared-primitive pattern: `packColor` already feeds both legend estimate and cart — extend it with the pure aggregator (D-13).

### Established Patterns
- Pure engine layer (`src/engine/`) has no Preact/DOM/persistence — new optimizer/baseline/aggregator logic stays pure and unit-testable.
- Phase 15 locked integer-cents money math + `hasUnpricedSize` flagging + the actionError banner for unpriced/unmapped colors — Phase 16 builds on correct numbers and reuses that surfacing channel.
- Progressive disclosure / collapsible panels already exist (`supplyListOpen`) — the "Why these bags?" expander follows the same idiom.

### Integration Points
- New aggregator replaces the inline `App.tsx` reduction; legend + cart + (future Phase 17) order packet all consume it.
- Savings headline + "Why these bags?" expander mount inside the existing supply panel footer/header; print report mirrors them statically.
</code_context>

<specifics>
## Specific Ideas

- Worked example that anchors the cap decision (standard prices, 1050 drills needed): `1×2000` = $1.40 (1 bag, wastes 950 drills) vs `1×1000+1×500` = $1.35 (2 bags, wastes 450). The cost-premium cap (≤ one smallest-bag price) is what prevents the optimizer from taking the wasteful single-2000 plan here.
- Small colors honestly showing **$0 savings** is a deliberate feature, not a bug — it tells the hobbyist that optimization only pays off at bulk volume.
</specifics>

<deferred>
## Deferred Ideas

- **User-facing "simple/single-size" view** — the retired toggle's behavior, if wanted, is reconsidered in **Phase 19** (Customer/Artist mode split), not Phase 16.
- **Per-color savings / per-row info icons** — richer per-color detail intentionally deferred; revisit only if users repeatedly ask "why is *this* color split," and after the **Phase 18** viewport rework (avoid building UI that gets torn out).
- **Side-by-side naive-vs-optimized comparison table** — a fuller "How this plan works" surface was considered but set aside in favor of the low-clutter hybrid; a Phase 18 candidate if the headline proves insufficient.

None of the above are scope creep into Phase 16 — discussion stayed within the BAG-01/02/03 boundary.
</deferred>

---

*Phase: 16-optimized-supply-plan-savings*
*Context gathered: 2026-07-12*
