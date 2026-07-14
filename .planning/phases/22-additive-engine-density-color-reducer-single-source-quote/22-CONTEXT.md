# Phase 22: Additive Engine — Density, Color Reducer & Single-Source Quote - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 22 delivers **three additive, engine-only pieces** — landed in isolated `engine/*` commits with the 240+ Vitest suite green at every commit (the strangler rule). No UI wiring happens here; that is Phase 23.

1. **One density helper (2.5mm/dot, 10 dots/inch)** — every physical-size / inch figure in the app derives from grid dimensions through this single helper. No hard-coded mock inch labels survive. (QUOTE-01)
2. **`detectedColorCount` + a deterministic, Delta-E-guarded target-N `reduceToColorCount`** — `useDiamondArtMatch` exposes the real detected color count, and the reducer merges rare one-off drills into the CIEDE2000-nearest already-used shade with a stable tie-break, feeding **one merged count** to viewer, legend, cart, and quote. (SC4; underpins REFINE-04, wired in Phase 23)
3. **One integer-cents `engine/quote.ts` selector** — drills + canvas + shipping + tax, all through `money.ts`, producing exactly one total whose itemized line items always sum exactly to it. Supplies "Est. total" and the Order total both read from it so they can never diverge. (QUOTE-02, QUOTE-03; extends the existing `planOrderSupply` single-source pattern, consumed by Supplies + Order in Phase 23)

**Not in this phase:**
- Any UI: the Refine color-count slider, edge-cleanup control, size cards, Supplies table, Order screen → **Phase 23**.
- Mobile/touch → **Phase 24**; legacy Step1..4 deletion → **Phase 25**.
- Making the Delta-E merge guard **tunable** → **v4.x REFINE-06** (v4.0 ships a fixed conservative guard).
- Live tax / live vendor rate APIs, real payment, lab submission → **v5.0**.

</domain>

<decisions>
## Implementation Decisions

### Color reducer — `reduceToColorCount(targetN)` (SC4 / REFINE-04 support)
- **D-01: Iterative-recompute algorithm.** Repeatedly pick the **globally-rarest surviving color**, merge it into the CIEDE2000-nearest **already-used (surviving)** shade, recompute counts + the surviving set, and repeat until `distinct === targetN` (or the guard stops all further merges — see D-03). Operates over the **unique-color list + `Record<string,number>` counts** (tens–low hundreds of entries), **not** the ~40k-drill grid, so a full recompute per slider tick is trivially "live" — no worker re-run. Chosen over **one-shot to a frozen top-N survivor set** (deterministic and simplest, but forces orphans onto farther survivors → more guard blocks, less faithful to "merge into nearest *used*") and over the **Hybrid** (map each color from its *original* Lab; only needed to defend against chain-displacement). Chain displacement is naturally suppressed here because the absorbing shade's count grows, so a shade that just soaked up an orphan is very unlikely to become the globally-rarest pick again.
  - **Accepted trade-off + mitigation:** the theoretical chain-displacement edge (A→B then B→C, a shift no single in-guard check bounded) is covered by a reducer unit test asserting the max original→final CIEDE2000 shift stays within the guard. If that test ever fails on real images, the **Hybrid is the contained escalation** (same fn surface) — we do not pay for its extra bookkeeping until a test proves we need it (pragmatic-fast, no over-engineering).
- **D-02: Stable tie-break = lowest DMC code.** When two surviving shades are equidistant in CIEDE2000, break the tie on the **immutable DMC code (ascending)**, not on drill count. Counts *mutate* during iteration, so a count-based tie-break would resolve the same geometry differently depending on merge history — exactly the non-determinism SC4 forbids. Total order = `(distance ascending, dmcCode ascending)`, with ties decided on **exact** distance equality (no epsilon band).
- **D-03: Delta-E guard is an absolute veto; behavior = skip-that-color-and-continue; slider value is a target *ceiling*.** The fixed conservative guard is a hard per-merge veto — **never merge-anyway**. If the rarest color has no within-guard neighbor, **skip it and try the next-rarest**; stop only when *no* remaining color has a within-guard merge. So the guard is a **floor** and `targetN` is a **target ceiling** — the returned merged count may legitimately exceed `targetN`. This is locked so Phase 23 can trust `mergedCount === the count all consumers (viewer/legend/cart/quote) see`. Guard threshold *value* stays fixed-conservative (tunable = REFINE-06, v4.x).

### `detectedColorCount` + post-match pipeline order (SC4 / REFINE-03/04 support)
- **D-04: `detectedColorCount` = distinct DMC codes in the RAW matched grid** (the direct output of `matchPixelGrid`), measured **before** any smoothing or reduction. It recomputes **only when the worker re-runs** (image / canvas size / palette change), never on a post-process slider tick. This is what keeps the Refine color-slider **max stable** while the user drags edge-cleanup (REFINE-03) or the color slider (REFINE-04): both are pure main-thread post-processes over an unchanged raw grid, so the raw distinct count is invariant. A size change moving the max is legitimate (a real re-match), and is distinct from the confusing case of an unrelated control moving it. Chosen over **post-smoothing max** (max jumps every time smoothing changes — the coupled-controls anti-pattern) and **dynamic per-pass max** (jitter).
- **D-05: Canonical transform order = `raw match → smoothMatches(strength) → reduceToColorCount(target)`.** Smoothing is intentionally-visible edge-cleanup and runs first so reduction operates on the actual rendered grid; **reduction runs last** so the distinct count of its output is the single authoritative merged number fed to all consumers. Chosen over **reduce-before-smooth** (smoothing afterward can erase a survived color → the "one merged count" contract breaks, legend/cart/quote disagree with the slider).
  - **Accepted trade-off:** under heavy smoothing the *top* of the color slider can be an inert **stable dead-zone** (smoothing already dropped distinct below the raw max). A stable dead-zone is strictly preferable to a jumping max; Phase 23 may optionally show the live merged count beside the slider so the inert range reads as "already at N," not as a broken control.

### Single-source quote — `engine/quote.ts` (QUOTE-01/02/03)
- **D-06: One integer-cents quote selector, extending `planOrderSupply`.** `engine/quote.ts` composes drills (from the existing `OrderSupplyPlan`) + canvas base + shipping + tax into exactly one total, all through `money.ts` (`toCents`/`sumCents`), so the itemized line items always sum **exactly** to the displayed grand total (QUOTE-02). It does **not** re-implement drill packing — it consumes `planOrderSupply`'s reconciled cents. Supplies "Est. total" and the Order total both read this one selector (Phase 23 wiring).
- **D-07: Tax line = `$0`, labeled "calculated at vendor checkout."** No estimated tax percentage is shown. GemPixel is not the merchant of record and the Order step is a no-real-payment order-packet **download**, so an estimated tax figure would read as more finalized/authoritative than reality. The tax line still routes through `money.ts` (contributes **0 cents**, so QUOTE-02 line-sum equality holds) and carries an explicit "calculated at vendor checkout" label. Chosen over a **flat 7.5% US-average estimate** (defensible for budget realism, but overstates GemPixel's authority on a client-side handoff) and over a **region rate table** (over-scope; needs a UI selector + 50+ maintained rates — effectively v5.0 live-tax territory). *Design note:* keep a single `TAX_RATE_ESTIMATE = 0` (+ label) constant so flipping to a live/estimated rate later is a one-line change; the QUOTE-03 "rates as of" provenance therefore attaches to **shipping + any curated canvas rate**, not tax.
- **D-08: Shipping = one combined "Shipping (est.)" line = canvas `baseShipping` + a curated flat `$5.00` drills estimate.** Define `DRILLS_BASE_SHIPPING = 5.00` **in `checkout.ts` beside `VENDOR_REGISTRY`** (same curated cost layer as the per-vendor `baseShipping`); `quote.ts` sums `canvasBaseShipping + drillsBaseShipping` into one integer-cents `shipping` line so items still sum exactly to the total (QUOTE-02). Diamond Drills USA genuinely charges **$5 flat** (free over $30), so treating drills shipping as free is the one choice that reads more favorably than reality — rejected. Chosen over **two explicit lines** (busier UI, two provenance dates — the two-vendor detail belongs in a code comment / optional tooltip) and over **canvas-only** (dishonestly omits real drills shipping). The **"rates as of {date}" provenance** attaches once to this combined shipping line, dated to the newer of the two curated inputs (QUOTE-03).

### Claude's Discretion
- **Density-helper file/API + inch rounding.** Placement (e.g. new `engine/density.ts` vs colocated) and the exact inch rounding/formatting (decimal precision, display string) are the planner's call — follow existing `engine/` conventions and the `calculateCanvasCost` `grid → /10` precedent (already 10 dots/inch). Keep it one helper; no second density path.
- **`reduceToColorCount` signature shape** — whether it takes/returns `{ codes, counts }` like `substituteLowCountColors` or a slimmer shape; and whether it lives in `color.ts` (beside `substituteLowCountColors` + `getColorDistance`) or a new module. Keep it a pure engine fn reusing `getColorDistance` (CIEDE2000).
- **`OrderQuote` / line-item shape** exposed by `quote.ts` — exact interface, as long as line items reconcile exactly to the total in integer cents and every estimate carries its label + "rates as of" date.
- **Whether Phase 22 also removes the `viewer.ts`/`symbols.ts` `theme` param** (the Phase 20 D-07 quarantined branch, tagged `// PHASE 22: remove theme param`). It is an engine-signature change and therefore *may* land in this engine-only phase; do it only if it stays clean and keeps the suite green — do not force churn.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone grounding
- `.planning/ROADMAP.md` §"Phase 22" — goal, success criteria SC1–SC5, and the strangler build constraints (engine signatures change ONLY here; 240+ green each commit).
- `.planning/REQUIREMENTS.md` — QUOTE-01, QUOTE-02, QUOTE-03 (this phase's requirements) + the REFINE-03/04/05 language describing what the engine support (`detectedColorCount`, `reduceToColorCount`) must feed in Phase 23. See also the §Traceability notes on the smoothing/reducer reuse.
- `.planning/research/SUMMARY.md` — v4.0 research: browser-native only, zero new deps; engine work isolated to this phase.

### Live engine touchpoints (verify current line numbers at plan time)
- `src/engine/money.ts` — canonical integer-cents helpers (`toCents` EPSILON-safe round-half-up + throws on non-finite, `sanitizeMoney`, `sumCents`, `fromCents`, `formatUSD`). The quote selector routes ALL money math through this (QUOTE-02).
- `src/engine/bagPlanner.ts` — `planOrderSupply(counts, shape, priceDb) → OrderSupplyPlan` (optimized rows + `optimizedCostCents` + `totalPackets` + savings). `engine/quote.ts` consumes this; does not re-pack (D-06). `OrderSupplyPlan` shape is frozen (Phase 16).
- `src/engine/checkout.ts` — `VENDOR_REGISTRY` (per-vendor `baseShipping`: lumaprints 4.99 / finerworks 5.50), `calculateCanvasCost(w,h,unit,vendor) → number|null` (grid unit already divides by 10 = 10 dots/inch), `CanvasVendor` union, `normalizeVendor`. Add `DRILLS_BASE_SHIPPING = 5.00` here beside `VENDOR_REGISTRY` (D-08).
- `src/engine/color.ts` — `matchPixelGrid` (raw matched grid + counts; `detectedColorCount` is measured off its output — D-04), `getColorDistance(lab1,lab2)` (CIEDE2000 via culori) reused by the reducer, and `substituteLowCountColors` (the existing THRESHOLD merge — reference pattern, NOT reused as-is; the new reducer is target-N).
- `src/engine/smoothing.ts` — `smoothMatches` (edge-cleanup strength 0–3); runs BEFORE reduction in the canonical order (D-05).
- `src/features/match/useDiamondArtMatch.ts` — owns the match pipeline; the hook that will expose `detectedColorCount` and apply the `smooth → reduce` post-process order (D-04/D-05).
- `src/App.tsx` — current total assembly (`totalCostSafetyCents` ≈ drills + canvas base + single `canvasShippingEstimate`; **no tax today**). Shows what `quote.ts` supersedes; App stays the state owner (no engine logic moves *into* App).

### Codebase maps
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/TESTING.md` — pure-engine/thin-UI split, engine module conventions (pure, no Preact/DOM), and the Vitest baseline the new reducer + quote tests extend.

### Prior-phase decisions carried in
- `.planning/phases/20-atelier-design-system-canvas-first-shell/20-CONTEXT.md` — D-07 quarantined `theme` param (candidate removal here); strangler rule origin.
- `.planning/phases/16-optimized-supply-plan-savings/16-CONTEXT.md` — `planOrderSupply` / `OrderSupplyPlan` single-source pattern the quote selector extends.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`money.ts`** — the entire integer-cents contract (round-half-up, non-finite guards, exact `sumCents`) is done; `quote.ts` composes on top, never re-implements cents math (D-06).
- **`planOrderSupply` / `OrderSupplyPlan`** — the reconciled drill plan (rows + `optimizedCostCents` + `totalPackets`) is the drills half of the quote; consumed, not recomputed.
- **`getColorDistance` (CIEDE2000)** — the exact distance fn the reducer needs; the reducer is `substituteLowCountColors` re-shaped from threshold → target-N with a stable tie-break (D-01/D-02).
- **`calculateCanvasCost` grid→/10** — the 2.5mm/dot (10 dots/inch) density is already implicit here; the new density helper makes it the single explicit source (QUOTE-01).

### Established Patterns
- **Pure engine modules** (no Preact/DOM/persistence), co-located `__tests__/`, named exports, string-literal unions — the reducer, density helper, and quote selector all follow this.
- **Single-source aggregators can't diverge** (the `planOrderSupply` precedent, Phase 16) — `quote.ts` is the same pattern one level up (drills + canvas + shipping + tax).
- **Fail-loud on bad money, degrade-not-crash in the render path** — `toCents` throws on non-finite; the quote selector must never emit NaN/$0 phantoms (Phase 15 lineage).

### Integration Points
- `useDiamondArtMatch` exposes `detectedColorCount` and applies `smooth → reduce` post-process (D-04/D-05); Phase 23 wires the slider/segmented control to it.
- `engine/quote.ts` reads `planOrderSupply` + `calculateCanvasCost` + `VENDOR_REGISTRY.baseShipping` + `DRILLS_BASE_SHIPPING` + the `$0` tax constant; Phase 23 Supplies + Order both render from it.
- Density helper feeds SizeCard's derived-inches prop (built dumb in Phase 21) via Phase 23 wiring — seam is the props interface, no import coupling now.

</code_context>

<specifics>
## Specific Ideas

- **"No visible change" is the reducer's contract** — only rare orphan drills merge, into their CIEDE2000-nearest already-used shade; the guard is what makes this true, so it is a hard veto (D-03), and a unit test asserts the max original→final shift stays within it (D-01 mitigation).
- **The slider max must never move under the user** (design-conscious, regression-averse) — hence raw post-match `detectedColorCount` measured once per worker run (D-04); an inert stable dead-zone is acceptable, a jumping max is not.
- **No figure may read as more finalized than it is** — tax shows `$0`/"calculated at vendor checkout" (D-07); drills shipping is the honest `$5` not "free" (D-08); every curated rate carries a dated "rates as of" provenance (QUOTE-03).
- **Determinism everywhere** — stable DMC-code tie-break, exact (non-epsilon) distance ties, fixed CIEDE2000 weights, so the same slider value yields the same merged grid across runs.

</specifics>

<deferred>
## Deferred Ideas

- **All Phase 22 engine UI wiring** — the color-count slider (max = `detectedColorCount`, live merge), edge-cleanup segmented control, size cards' derived inches, Supplies table + order-summary, Order total — all read this phase's engine output → **Phase 23**.
- **Tunable Delta-E merge guard threshold** (v4.0 ships fixed-conservative) → **v4.x REFINE-06**.
- **Flat/estimated or live tax** — the `TAX_RATE_ESTIMATE = 0` constant is designed so a future non-zero rate (or live tax API) is a one-line/one-integration change → **v5.0** (live tax) / v4.x (if a labeled flat estimate is later wanted).
- **Live vendor rate APIs** replacing the curated `baseShipping` + `DRILLS_BASE_SHIPPING` constants → **v5.0** (the single combined shipping line splits into per-vendor lines cleanly when they arrive).
- **Removing the `viewer.ts`/`symbols.ts` `theme` param** (Phase 20 D-07 quarantine) — allowed here as an engine-signature change if clean, else carried forward; not a hard requirement of this phase.

None of the above were scope creep — all are already-mapped later phases / deferred requirements; captured so nothing is lost.

</deferred>

---

*Phase: 22-additive-engine-density-color-reducer-single-source-quote*
*Context gathered: 2026-07-14*
