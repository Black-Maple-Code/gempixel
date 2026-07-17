# Phase 22: Additive Engine — Density, Color Reducer & Single-Source Quote - Research

**Researched:** 2026-07-14
**Domain:** Pure TypeScript engine modules — color science (CIEDE2000 reduction), integer-cents money composition, grid→inch density. No new dependencies, no UI, no network.
**Confidence:** HIGH (all findings verified by direct codebase read; one ASSUMED value — the Delta-E guard threshold)

## Summary

Phase 22 lands three **additive, pure-engine** pieces in isolated `engine/*` commits, keeping the existing Vitest suite green at every commit (the strangler rule). Every implementation question is already decided in `22-CONTEXT.md` (D-01..D-08) — this research nails the *concrete signatures, module placement, determinism mechanics, and test strategy* against the current code, so the planner writes tasks with no ambiguity.

The codebase is unusually well-suited to this phase: `money.ts` (integer-cents, fail-loud), `planOrderSupply`/`OrderSupplyPlan` (the reconciled drills half), `getColorDistance` (CIEDE2000 via `culori`), `substituteLowCountColors` (the exact reference shape for the new reducer), and `calculateCanvasCost`'s `grid → /10` (the implicit 10-dots/inch density) all already exist. The three new pieces are **compositions on top of proven primitives**, not new algorithms. Zero new packages: `culori/fn` is already the color engine and is the only dependency any of this needs.

The single genuine unknown is the **numeric value** of the fixed conservative Delta-E merge guard (`MERGE_GUARD_DELTA_E`). Its *mechanics* are locked (absolute veto, skip-and-continue, target-ceiling), only the constant is a judgment call — and it is explicitly declared tunable in a later phase (REFINE-06). Everything else is verified.

**Primary recommendation:** Add three files — `engine/density.ts`, `engine/quote.ts`, and `reduceToColorCount` inside the existing `engine/color.ts` (beside `substituteLowCountColors`) — plus the `DRILLS_BASE_SHIPPING`/`RATES_AS_OF` constants in `checkout.ts` and the `TAX_RATE_ESTIMATE` constant in `quote.ts`. Expose `detectedColorCount` from `useDiamondArtMatch` as a purely additive return field, and add the `reduce` step to the hook's post-process pipeline **defaulted OFF** so App's current behavior and total stay byte-identical until Phase 23 wires the UI. Do **not** touch App.tsx's `totalCostSafetyCents` assembly — the new quote selector is additive and unused until Phase 23.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Color reducer — `reduceToColorCount(targetN)`:**
- **D-01: Iterative-recompute algorithm.** Repeatedly pick the **globally-rarest surviving color**, merge it into the CIEDE2000-nearest **already-used (surviving)** shade, recompute counts + the surviving set, repeat until `distinct === targetN` (or the guard stops all further merges — D-03). Operates over the **unique-color list + `Record<string,number>` counts** (tens–low hundreds of entries), **not** the ~40k grid, so a full recompute per slider tick is trivially "live" — no worker re-run. Chain displacement is naturally suppressed because the absorbing shade's count grows. **Accepted trade-off + mitigation:** a reducer unit test asserts the max original→final CIEDE2000 shift stays within the guard; the Hybrid (map each color from its *original* Lab) is the contained escalation on the same fn surface if that test ever fails on real images — not paid for until proven needed.
- **D-02: Stable tie-break = lowest DMC code.** When two surviving shades are equidistant in CIEDE2000, break the tie on the **immutable DMC code (ascending)**, not on drill count (counts mutate during iteration → non-deterministic). Total order = `(distance ascending, dmcCode ascending)`, ties decided on **exact** distance equality (no epsilon band).
- **D-03: Delta-E guard is an absolute veto; behavior = skip-that-color-and-continue; `targetN` is a target *ceiling*.** Fixed conservative guard = a hard per-merge veto — **never merge-anyway**. If the rarest color has no within-guard neighbor, **skip it and try the next-rarest**; stop only when *no* remaining color has a within-guard merge. Returned merged count may legitimately **exceed** `targetN`. Guard threshold *value* stays fixed-conservative (tunable = REFINE-06, v4.x).

**`detectedColorCount` + post-match pipeline order:**
- **D-04: `detectedColorCount` = distinct DMC codes in the RAW matched grid** (direct output of `matchPixelGrid`), measured **before** any smoothing or reduction. Recomputes **only when the worker re-runs** (image / canvas size / palette change), never on a post-process slider tick. Keeps the Refine color-slider **max stable** while edge-cleanup (REFINE-03) or the color slider (REFINE-04) is dragged.
- **D-05: Canonical transform order = `raw match → smoothMatches(strength) → reduceToColorCount(target)`.** Smoothing runs first (operates on the actual rendered grid); **reduction runs last** so the distinct count of its output is the single authoritative merged number fed to all consumers. **Accepted trade-off:** under heavy smoothing the *top* of the color slider can be an inert **stable dead-zone** — strictly preferable to a jumping max.

**Single-source quote — `engine/quote.ts`:**
- **D-06: One integer-cents quote selector, extending `planOrderSupply`.** Composes drills (from the existing `OrderSupplyPlan`) + canvas base + shipping + tax into exactly one total, all through `money.ts` (`toCents`/`sumCents`), so itemized line items always sum **exactly** to the displayed grand total (QUOTE-02). Does **not** re-implement drill packing — consumes `planOrderSupply`'s reconciled cents.
- **D-07: Tax line = `$0`, labeled "calculated at vendor checkout."** No estimated tax percentage. Still routes through `money.ts` (contributes **0 cents**). Keep a single `TAX_RATE_ESTIMATE = 0` (+ label) constant so flipping to a live/estimated rate later is a one-line change; QUOTE-03 "rates as of" provenance attaches to **shipping + any curated canvas rate**, not tax.
- **D-08: Shipping = one combined "Shipping (est.)" line = canvas `baseShipping` + a curated flat `$5.00` drills estimate.** Define `DRILLS_BASE_SHIPPING = 5.00` **in `checkout.ts` beside `VENDOR_REGISTRY`**; `quote.ts` sums `canvasBaseShipping + drillsBaseShipping` into one integer-cents `shipping` line. The **"rates as of {date}" provenance** attaches once to this combined shipping line, dated to the newer of the two curated inputs (QUOTE-03).

### Claude's Discretion
- **Density-helper file/API + inch rounding.** Placement (e.g. new `engine/density.ts` vs colocated) and exact inch rounding/formatting are the planner's call — follow existing `engine/` conventions and the `calculateCanvasCost` `grid → /10` precedent (already 10 dots/inch). Keep it one helper; no second density path.
- **`reduceToColorCount` signature shape** — whether it takes/returns `{ codes, counts }` like `substituteLowCountColors` or a slimmer shape; and whether it lives in `color.ts` or a new module. Keep it a pure engine fn reusing `getColorDistance` (CIEDE2000).
- **`OrderQuote` / line-item shape** exposed by `quote.ts` — exact interface, as long as line items reconcile exactly to the total in integer cents and every estimate carries its label + "rates as of" date.
- **Whether Phase 22 also removes the `viewer.ts`/`symbols.ts` `theme` param** (Phase 20 D-07 quarantine, tagged `// PHASE 22: remove theme param`). Allowed here as an engine-signature change **if it stays clean and keeps the suite green** — do not force churn.

### Deferred Ideas (OUT OF SCOPE)
- **All Phase 22 engine UI wiring** — color-count slider, edge-cleanup segmented control, size cards' derived inches, Supplies table + order-summary, Order total → **Phase 23**.
- **Tunable Delta-E merge guard threshold** (v4.0 ships fixed-conservative) → **v4.x REFINE-06**.
- **Flat/estimated or live tax** → **v5.0** (live tax) / v4.x (labeled flat estimate).
- **Live vendor rate APIs** replacing curated `baseShipping` + `DRILLS_BASE_SHIPPING` → **v5.0**.
- **Removing the `viewer.ts`/`symbols.ts` `theme` param** — allowed here if clean, else carried forward; not a hard requirement.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QUOTE-01 | Every physical-size/inch figure derives from grid dimensions through one 2.5mm/dot density helper — no hard-coded mock inch labels. | `engine/density.ts` §Density Helper; reconciles with `calculateCanvasCost` `width/10` (checkout.ts:184-190) as the single density source. |
| QUOTE-02 | The quote is computed in exactly one place in integer cents (drills + canvas + shipping + tax) via `money.ts`; Supplies "Est. total", Order total, and the sum of line items are always exactly equal. | `engine/quote.ts` §Quote Selector — `buildOrderQuote` sums integer-cent line items via `sumCents`; `totalCents === sumCents(lineItems.map(li => li.cents))` by construction. |
| QUOTE-03 | Tax and any curated vendor/shipping rate are clearly labeled estimates with a dated "rates as of" provenance; no figure reads as a finalized charge. | `TAX_RATE_ESTIMATE = 0` + "calculated at vendor checkout" label (D-07); `RATES_AS_OF` constant + "Shipping (est.)" combined line (D-08); every estimate line carries `estimate: true` + note. |
| (engine support for REFINE-04 / SUPPLIES-02, wired Phase 23) | `detectedColorCount` + deterministic `reduceToColorCount`. | `reduceToColorCount` in `color.ts` §Reducer; `detectedColorCount` additive on `useDiamondArtMatch` (D-04). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Grid→inch density | Engine (`density.ts`) | — | Pure math on grid dims; single source consumed by cards + canvas cost. No DOM. |
| Color reduction (target-N merge) | Engine (`color.ts`) | — | Pure CIEDE2000 math over unique-color list + counts; no Preact/worker. |
| `detectedColorCount` exposure | Frontend hook (`useDiamondArtMatch`) | Engine (derives from raw counts) | Count is a trivial derivation of engine output; the hook owns *when* it recomputes (per worker run). |
| Post-match transform order (smooth→reduce) | Frontend hook (`useDiamondArtMatch`) | Engine (`smoothing.ts` + `color.ts`) | The hook is the pipeline owner (D-05); engine fns are the pure stages it composes in a `useMemo`. |
| Quote composition | Engine (`quote.ts`) | Engine (`bagPlanner`, `checkout`, `money`) | Pure aggregator one level up from `planOrderSupply`; App stays the state owner and renders it (Phase 23). |
| Curated rate/label constants | Engine (`checkout.ts` / `quote.ts`) | — | Live beside the data they annotate (`VENDOR_REGISTRY`); no logic in UI. |

**Boundary note:** App.tsx remains the state owner. No engine logic moves *into* App, and the new quote selector does **not** replace App's `totalCostSafetyCents` this phase — it is additive and unused until Phase 23.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `culori/fn` | already installed (project dep) | CIEDE2000 distance (`differenceCiede2000`) + Lab conversion, tree-shakable | Already the entire color engine (`color.ts:1`); the reducer reuses `getColorDistance` which wraps it. |
| (none new) | — | — | **Zero new dependencies** — a hard project constraint. All three pieces compose existing engine modules. |

**Installation:** None. No `npm install`. Verify no accidental new import creeps in during review.

### Supporting (existing engine modules the phase composes — all VERIFIED by read)
| Module | Symbol | Role in Phase 22 |
|--------|--------|------------------|
| `engine/money.ts` | `toCents` (throws on non-finite), `sumCents`, `fromCents`, `formatUSD` | All quote math routes through these (QUOTE-02). `[VERIFIED: money.ts:30-67]` |
| `engine/bagPlanner.ts` | `planOrderSupply → OrderSupplyPlan` (`optimizedCostCents`, `totalPackets`) | Drills half of the quote; consumed, never re-packed (D-06). `[VERIFIED: bagPlanner.ts:460-547]` |
| `engine/checkout.ts` | `VENDOR_REGISTRY` (`baseShipping`), `calculateCanvasCost(w,h,unit,vendor)`, `CanvasVendor` | Canvas base + per-vendor shipping; `grid→/10` is the implicit density. `[VERIFIED: checkout.ts:125-218]` |
| `engine/color.ts` | `getColorDistance(lab1,lab2)`, `matchPixelGrid`, `substituteLowCountColors` (reference shape) | Reducer lives here; `getColorDistance` is the CIEDE2000 fn it reuses. `[VERIFIED: color.ts:100-195]` |
| `engine/smoothing.ts` | `smoothMatches(matches, cols, rows, strength) → { codes, counts }` | Runs BEFORE reduce in D-05 order. `[VERIFIED: smoothing.ts:58-122]` |
| `engine/types.ts` | `DmcColor { dmc, name, hex, r, g, b, lab, kits }`, `LabCoordinates {l,a,b}` | Shapes for candidates + Lab math. `[VERIFIED: types.ts:1-16]` |

## Package Legitimacy Audit

**Not applicable — this phase installs zero external packages.** No registry lookups performed; the only dependency touched (`culori`) is already a resolved project dependency in use by `engine/color.ts`. The planner should add no `npm install` task; a review check that the diff introduces no new `package.json` dependency is sufficient.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌──────────────────────────────────────────┐
  image ──────────▶ │ matchPixelGrid (Web Worker, unchanged)   │
                    │   → { codes[], counts{} }  = RAW grid     │
                    └───────────────┬──────────────────────────┘
                                    │ raw counts
       detectedColorCount ◀─────────┤  = Object.keys(rawCounts).length   (D-04: recomputed only on worker re-run)
                                    │
                    ┌───────────────▼──────────────────────────┐
                    │ useDiamondArtMatch  post-process useMemo   │   (D-05 canonical order)
                    │   raw → smoothMatches(strength)            │
                    │       → reduceToColorCount(target)  [NEW]  │   ← defaulted OFF in P22
                    └───────────────┬──────────────────────────┘
                                    │ merged counts (one authoritative number)
          ┌─────────────────────────┼───────────────────────────┐
          ▼                         ▼                             ▼
    viewer / legend          planOrderSupply(counts)        (Phase 23 consumers)
                                    │ OrderSupplyPlan.optimizedCostCents
                                    ▼
   grid dims ──▶ density.ts ──▶ calculateCanvasCost ──▶  ┌──────────────────────┐
   (cols,rows)   gridToInches      (canvas base $)       │  quote.ts             │
                                                          │  buildOrderQuote(...) │
   VENDOR_REGISTRY.baseShipping ───────────────────────▶ │  drills + canvas +    │
   DRILLS_BASE_SHIPPING = 5.00 ────────────────────────▶ │  shipping(combined) + │
   TAX_RATE_ESTIMATE = 0 ──────────────────────────────▶ │  tax($0)  → all cents │
                                                          │  = ONE OrderQuote     │
                                                          └──────────┬───────────┘
                                                     Supplies "Est. total" & Order total
                                                        both read this (Phase 23)
```

Data flow, not files. `[NEW]` marks Phase 22 additions; everything else exists today.

### Recommended Project Structure
```
src/engine/
├── density.ts          # NEW — gridToInches + DOTS_PER_INCH/MM_PER_DOT constants (QUOTE-01)
├── quote.ts            # NEW — buildOrderQuote + OrderQuote/QuoteLineItem + TAX_RATE_ESTIMATE (QUOTE-02/03)
├── color.ts            # EDIT — add reduceToColorCount + MERGE_GUARD_DELTA_E beside substituteLowCountColors
├── checkout.ts         # EDIT — add DRILLS_BASE_SHIPPING = 5.00 + RATES_AS_OF beside VENDOR_REGISTRY (D-08)
└── __tests__/
    ├── density.test.ts # NEW
    ├── quote.test.ts   # NEW
    └── color.test.ts   # EDIT — add reduceToColorCount describe block
src/features/match/
└── useDiamondArtMatch.ts  # EDIT — expose detectedColorCount (additive) + optional reduce step (default off)
```

### Pattern 1: Pure `{ codes, counts }` transform (reducer follows `substituteLowCountColors`)
**What:** The reducer takes and returns the same `{ codes: string[]; counts: Record<string, number> }` shape as `substituteLowCountColors`, so it slots into the hook pipeline identically.
**When to use:** Any post-match grid transform.
**Example (proposed signature — mirrors color.ts:142):**
```typescript
// Source: shape mirrors engine/color.ts::substituteLowCountColors (VERIFIED codebase)
export const MERGE_GUARD_DELTA_E = 10; // [ASSUMED] conservative CIEDE2000 veto; tunable in REFINE-06

export function reduceToColorCount(
  gridCodes: string[],
  counts: Record<string, number>,
  activeCandidates: DmcColor[],
  targetN: number,
  guard: number = MERGE_GUARD_DELTA_E,
): { codes: string[]; counts: Record<string, number>; mergedCount: number } {
  // 1. Build code→DmcColor map (skip codes not in candidates).
  // 2. surviving = codes with count > 0. If surviving.length <= targetN → return unchanged.
  // 3. Loop:
  //    a. rarest = surviving color with MIN count, tie-break lowest dmcCode ascending.
  //    b. among OTHER surviving shades, find nearest by getColorDistance(rare.lab, s.lab);
  //       total order (distance asc, dmcCode asc), EXACT ties (no epsilon).
  //    c. if nearest distance > guard → mark rare "blocked", pick next-rarest that is not blocked.
  //    d. if every surviving color is blocked → STOP (targetN is a ceiling; may exceed).
  //    e. else merge rare→nearest: reassign grid cells, recompute counts + surviving set.
  //    f. repeat until surviving.length === targetN or all blocked.
  // 4. mergedCount = surviving.length after loop.
}
```
Return `mergedCount` explicitly (the "one merged number" all consumers read) rather than making callers re-derive `Object.keys(counts).length`.

### Pattern 2: Single-source aggregator (`quote.ts` extends `planOrderSupply`)
**What:** One pure function assembles all money lines in integer cents; the total is `sumCents` of the line cents, so lines can never diverge from the total.
**Example (proposed interface + selector):**
```typescript
// Source: extends engine/bagPlanner.ts::planOrderSupply pattern (VERIFIED)
import { toCents, sumCents } from './money';
import { OrderSupplyPlan } from './bagPlanner';
import { CanvasVendor, VENDOR_REGISTRY, DRILLS_BASE_SHIPPING, RATES_AS_OF } from './checkout';

export const TAX_RATE_ESTIMATE = 0; // D-07: single knob; label attaches, not a %.

export interface QuoteLineItem {
  key: 'drills' | 'canvas' | 'shipping' | 'tax';
  label: string;         // e.g. "Shipping (est.)", "Tax"
  cents: number;         // integer cents
  estimate: boolean;     // true → UI shows an "est." affordance
  note?: string;         // "calculated at vendor checkout" | `rates as of ${RATES_AS_OF}`
}

export interface OrderQuote {
  lineItems: QuoteLineItem[];
  totalCents: number;    // === sumCents(lineItems.map(li => li.cents)) BY CONSTRUCTION
  ratesAsOf: string;     // RATES_AS_OF provenance for curated rates
  canvasPriced: boolean; // false when calculateCanvasCost returned null (never a $0 phantom)
}

export function buildOrderQuote(input: {
  supplyPlan: OrderSupplyPlan;
  canvasBaseCost: number | null;   // from calculateCanvasCost (may be null for a bad vendor)
  vendor: CanvasVendor;            // to read VENDOR_REGISTRY[vendor].baseShipping
}): OrderQuote {
  const drillsCents = input.supplyPlan.optimizedCostCents; // already integer cents
  const canvasPriced = input.canvasBaseCost != null && Number.isFinite(input.canvasBaseCost);
  const canvasCents = canvasPriced ? toCents(input.canvasBaseCost as number) : 0;
  const shippingDollars = VENDOR_REGISTRY[input.vendor].baseShipping + DRILLS_BASE_SHIPPING;
  const shippingCents = toCents(shippingDollars);
  const taxCents = toCents((drillsCents + canvasCents + shippingCents) / 100 * TAX_RATE_ESTIMATE); // = 0
  const lineItems: QuoteLineItem[] = [
    { key: 'drills',   label: 'Drills',           cents: drillsCents,  estimate: false },
    { key: 'canvas',   label: 'Canvas print',     cents: canvasCents,  estimate: true, note: `rates as of ${RATES_AS_OF}` },
    { key: 'shipping', label: 'Shipping (est.)',  cents: shippingCents, estimate: true, note: `rates as of ${RATES_AS_OF}` },
    { key: 'tax',      label: 'Tax',              cents: taxCents,      estimate: true, note: 'calculated at vendor checkout' },
  ];
  return { lineItems, totalCents: sumCents(lineItems.map(li => li.cents)), ratesAsOf: RATES_AS_OF, canvasPriced };
}
```
Note the `canvasPriced` flag mirrors `planOrderSupply`'s `hasUnpricedSize` pattern — a null canvas cost is **surfaced**, never silently rendered as a $0 line (Phase 15 "never a $0/NaN phantom" lineage).

### Pattern 3: Density helper (one source, reconciled with `calculateCanvasCost`)
```typescript
// Source: makes checkout.ts:184-190 (width/10) the single EXPLICIT density source (QUOTE-01)
export const DOTS_PER_INCH = 10;   // 2.5 mm per dot → 25.4 / 2.5 = 10.16, rounded to 10 (matches existing grid/10)
export const MM_PER_DOT = 2.5;

export function gridToInches(cols: number, rows: number): { widthIn: number; heightIn: number } {
  return { widthIn: cols / DOTS_PER_INCH, heightIn: rows / DOTS_PER_INCH };
}
export function formatInches(inches: number): string {
  return (Math.round(inches * 10) / 10).toString(); // 1-dp, matches App.tsx:276 fmt precedent
}
```
**Reconciliation:** `calculateCanvasCost(..., 'grid', ...)` already divides `width/10, height/10` (checkout.ts:184-190). The density helper must produce the **identical** inches so canvas cost and displayed size never disagree. A test should assert `gridToInches(w,h).widthIn === w/10` and that area matches `calculateCanvasCost`'s internal `widthIn*heightIn`. Do **not** introduce a second constant (e.g. `10.16`) — App already standardized on `/10` (App.tsx:273-274, 678-679).

### Anti-Patterns to Avoid
- **Re-packing drills in `quote.ts`.** Consume `OrderSupplyPlan.optimizedCostCents`; never call `packColor` again (D-06). Two packers = two truths.
- **Count-based tie-breaks in the reducer.** Counts mutate mid-iteration → non-deterministic. Tie-break only on immutable `dmcCode` (D-02).
- **Epsilon distance bands.** Use exact `===` for CIEDE2000 tie detection (D-02); an epsilon reintroduces order-dependence.
- **Merge-anyway when over guard.** The guard is an absolute veto — skip and continue, never force a merge (D-03).
- **A second density path / hard-coded inch label.** One helper only; delete any mock inch strings (QUOTE-01).
- **Touching App.tsx's `totalCostSafetyCents`.** Additive phase — App keeps working on its current total until Phase 23.
- **Recomputing `detectedColorCount` post-smoothing.** Must derive from the RAW grid only (D-04), or the slider max jumps under the user.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CIEDE2000 distance | Trig-heavy ΔE00 impl | `getColorDistance` (wraps `culori` `differenceCiede2000`) | Already the app's distance fn; identical weights = deterministic parity. `[VERIFIED: color.ts:128-133]` |
| Integer-cents rounding/sum | `Math.round(x*100)/100` | `toCents` / `sumCents` / `fromCents` | Fixes the `1.005*100` IEEE-754 bug; throws on non-finite (fail-loud). `[VERIFIED: money.ts]` |
| Drill cost | Re-pack bags in quote | `planOrderSupply().optimizedCostCents` | Single-source; already reconciled + dye-lot aware. `[VERIFIED: bagPlanner.ts]` |
| Canvas base cost | New pricing math | `calculateCanvasCost` | Tier match + interpolation + null-guard already correct. `[VERIFIED: checkout.ts:172]` |
| Grid→inch | New density constant | `gridToInches` reconciled with `/10` | One density source; `calculateCanvasCost` already uses `/10`. |

**Key insight:** Phase 22 is *composition*, not invention. Every number it produces already has a proven primitive; the risk is a second, divergent path — not a missing algorithm.

## Common Pitfalls

### Pitfall 1: Object-key-order non-determinism in the reducer
**What goes wrong:** `substituteLowCountColors` (the reference) uses `dist < minDistance` (strict) and iterates `Object.keys(counts)`/`highCountCodes[0]` — its tie result depends on insertion order (color.ts:168-179). Copying that verbatim into `reduceToColorCount` reintroduces the exact non-determinism SC4 forbids.
**Why it happens:** V8 preserves insertion order for string keys, so it *looks* stable until inputs arrive in a different order (restore vs fresh match).
**How to avoid:** Before iterating, **sort** the surviving-code list by the total order (`dmcCode` ascending) and select rarest/nearest against that sorted list. Never let `Object.keys` order decide a tie.
**Warning signs:** A test that shuffles input `counts` key order and expects identical output fails.

### Pitfall 2: DMC codes are not all numeric
**What goes wrong:** DMC codes include non-numeric values (`"White"`, `"Ecru"`, `"B5200"`), so a naive `parseInt` ascending sort is not a total order.
**Why it happens:** The catalog mixes numeric and named colors.
**How to avoid:** Use the same numeric-then-lexical comparator App already uses for its "code" sort (App.tsx:1112-1118: `parseInt` both; if both numeric compare numerically, else `localeCompare`). Reuse that exact ordering so the reducer's "lowest DMC code" matches the UI's notion of code order.
**Warning signs:** Tie-break tests with a mix of `"310"` and `"B5200"` behave inconsistently.

### Pitfall 3: `targetN` exceeded is correct, not a bug
**What goes wrong:** A test asserting `mergedCount === targetN` fails when the guard blocks all remaining merges — but that is the **locked** target-ceiling behavior (D-03).
**How to avoid:** Test `mergedCount <= detectedColorCount` and `mergedCount >= targetN` (ceiling), and specifically that when every remaining rare color's nearest neighbor is beyond the guard, the loop stops with `mergedCount > targetN`.

### Pitfall 4: Canvas cost is nullable
**What goes wrong:** `calculateCanvasCost` returns `number | null` (checkout.ts:172). Passing `null` into `toCents` throws (money.ts:31). An unguarded quote white-screens the render path.
**How to avoid:** Guard in `buildOrderQuote` — `null`/non-finite canvas cost → `canvasCents = 0` **and** `canvasPriced = false` (surface it), never a silent $0 line.
**Warning signs:** A quote test with an out-of-union vendor throws instead of returning a flagged quote.

### Pitfall 5: `detectedColorCount` wired to the wrong memo
**What goes wrong:** If exposed off `matchResult` (post-process memo) instead of `rawMatchResult`, it recomputes on every smoothing/reduce tick → the slider max jumps (the coupled-controls anti-pattern D-04 forbids).
**How to avoid:** Derive it in a `useMemo` keyed **only** on `rawMatchResult`: `Object.keys(rawMatchResult?.counts ?? {}).length`.

### Pitfall 6: Reduce step changing App behavior this phase
**What goes wrong:** Adding `reduceToColorCount` into the hook pipeline unconditionally changes `matchResult` for the current App, breaking the strangler "no behavior change in an additive commit" rule and possibly the suite.
**How to avoid:** Gate it behind an `enableReduce`/`targetColorCount` input defaulted so it is a **no-op** (e.g. `enableReduce=false` or `targetN >= detectedColorCount`), exactly as `enableSubstitution`/`enableSmoothing` are already gated (useDiamondArtMatch.ts:223-236). Phase 23 flips it on.

## Determinism Details for the Reducer (implementation depth)

- **Distance:** reuse `getColorDistance(a.lab, b.lab)` (color.ts:128) — same `culori` `differenceCiede2000()` instance and default weights (kL=kC=kH=1) already used for matching, so results are reproducible across runs and match the viewer's matching semantics.
- **Rarest selection:** iterate the **sorted** surviving list; pick min `counts[code]`; on equal counts, lower `dmcCode` wins (D-02). Do the same sort once per iteration (cheap — tens–low hundreds of entries).
- **Nearest-used selection:** over surviving shades excluding the rare one, track `(bestDist, bestCode)` with the total order `distance asc, dmcCode asc`, using **strict** comparison plus an explicit `dmcCode` tie-break on exact-equal distance (do NOT rely on iteration order for the tie).
- **Guard integration:** `MERGE_GUARD_DELTA_E` lives as an exported constant in `color.ts` (so REFINE-06 can later make it a parameter with a default). Per-merge: if `bestDist > guard`, the rare color is **blocked** for this run; move to the next-rarest non-blocked color. When all surviving colors are blocked, stop.
- **Chain-displacement test (D-01 mitigation):** after reduction, for every grid cell compare its original matched color's Lab to its final color's Lab via `getColorDistance`; assert the **max** shift `<= guard`. If this ever fails on a real image, the contained escalation is the Hybrid (map each color from its *original* Lab) on the same fn surface — not built now.

## Density Helper (implementation depth)

- One function `gridToInches(cols, rows)`; constants `DOTS_PER_INCH = 10`, `MM_PER_DOT = 2.5`. 10 dots/inch is the existing convention (`/10` at checkout.ts:184-190, App.tsx:273-274) — 2.5mm/dot is 10.16 dots/inch exactly, rounded to 10, and the app has always used 10. Keep it 10 for a single reconciled source; a comment should note the 2.5mm rationale and the 0.16 rounding so no one "corrects" it to 10.16 and forks the density.
- Formatting: 1 decimal place (`Math.round(n*10)/10`), matching App.tsx:276's existing `fmt`. Return a plain number from `gridToInches`; a separate `formatInches` produces the display string so callers can do math on the number.
- Reconciliation test: `gridToInches(w,h).widthIn === w/10` and the derived area equals `calculateCanvasCost`'s internal `widthIn*heightIn` for the same grid.

## Quote Selector Wiring (implementation depth)

- **Inputs:** `OrderSupplyPlan` (drills cents), `canvasBaseCost: number | null` (already computed by the caller via `calculateCanvasCost`), and the `CanvasVendor` (to read `baseShipping`). Passing the *computed* canvas cost (not raw dims) keeps `quote.ts` from duplicating `calculateCanvasCost` and honors D-06 "consume, don't recompute."
- **Composition (all integer cents):** `drillsCents = optimizedCostCents`; `canvasCents = canvasPriced ? toCents(canvasBaseCost) : 0`; `shippingCents = toCents(vendor.baseShipping + DRILLS_BASE_SHIPPING)` (one combined line, D-08); `taxCents = 0` via `TAX_RATE_ESTIMATE` (D-07). `totalCents = sumCents([...])`.
- **Provenance (QUOTE-03):** `RATES_AS_OF` constant (ISO date string) defined beside the curated rates in `checkout.ts`, dated to the newer of the two curated shipping inputs (D-08). The canvas + shipping line items carry `note: \`rates as of ${RATES_AS_OF}\``; the tax line carries `note: 'calculated at vendor checkout'`. `OrderQuote.ratesAsOf` re-exposes it for a single header label.
- **Consumers (Phase 23):** both Supplies "Est. total" and the Order total read `OrderQuote.totalCents`; the Supplies/Order itemization reads `lineItems`. Because the total is `sumCents(lineItems)`, they are exactly equal by construction — no reconciliation code needed downstream.

## Strangler-Rule Risks (must-flag for the planner)

1. **App.tsx total assembly is off-limits.** `totalCostSafetyCents` (App.tsx:1143-1148) sums `toCents(sanitizeMoney(canvasBaseCost)) + toCents(sanitizeMoney(canvasShippingEstimate)) + safetyDrillCostCents`. Note App currently has **no tax line** and uses a single `canvasShippingEstimate` state (default 8.0, App.tsx:218) — **not** the new combined `VENDOR.baseShipping + DRILLS_BASE_SHIPPING`. The new `quote.ts` deliberately differs (adds tax=$0, uses curated combined shipping). That is fine because Phase 22 does **not** wire it in — App keeps its current total until Phase 23. The planner must ensure the new selector is *unreferenced by App* this phase (only imported by new tests).
2. **Hook change must stay additive.** Adding `detectedColorCount` to `MatchState` is purely additive (new return field — App ignores it until Phase 23). Adding the reduce step must be gated to a no-op default (Pitfall 6). Existing hook consumers (App passes `enableSubstitution`/`enableSmoothing` etc., useDiamondArtMatch.ts:87-97) must compile unchanged.
3. **`engine/*` signatures change ONLY in this phase's commits.** `reduceToColorCount` (new export), `DRILLS_BASE_SHIPPING`/`RATES_AS_OF` (new consts), `quote.ts`/`density.ts` (new modules) are all additive. No existing engine signature is *modified* — except the optional `theme`-param removal below.
4. **Optional `theme`-param cleanup (Claude's discretion).** The `// PHASE 22: remove theme param` markers sit at viewer.ts:392, export.ts:85, export.ts:174 — each directly above a `ctx.font = \`bold ${symbolFontPx(...)}...\`` line. **Finding:** `symbolFontPx(basePx, symbol)` (symbols.ts:145) currently takes **no** `theme` param — the parameter was already removed; only stale comment markers remain. So the "removal" here is reduced to **deleting three comment lines** (and checking git blame for any dangling `theme` argument at call sites). This is clean and low-risk — recommend doing it in a tiny isolated commit, but it is not load-bearing. Verify `npx tsc --noEmit` + suite stay green after deletion.

## Runtime State Inventory

Not applicable — Phase 22 adds new pure-engine code + additive exports. It is not a rename/refactor/migration of stored data. No datastore keys, live-service config, OS-registered state, secrets, or build artifacts embed a renamed string. **None — verified: no string rename or data-shape migration is in scope; `OrderSupplyPlan` is explicitly frozen (bagPlanner.ts:460) and untouched.**

## Test Strategy

Co-located `__tests__/` per the established convention (18 existing suites, e.g. `smoothing.test.ts`, `bagPlanner.test.ts`). Vitest + jsdom, `describe/it/expect`. **Baseline to keep green:** CONTEXT states 240+ (~255 after Phases 20/21); a raw grep of literal `it(`/`test(` call sites returns 194 (parametrized `.each` expand to more) — the planner should run `npm test` once at phase start to record the exact green baseline and assert it only grows.

### `color.test.ts` — reducer (extend existing file)
- **Determinism:** same input → identical output; **shuffle input `counts` key order** → identical output (guards Pitfall 1).
- **Tie-break:** two equidistant surviving shades → the one with the **lower DMC code** absorbs; include a numeric+named mix (`"310"` vs `"B5200"`) (Pitfall 2).
- **Guard veto:** a rare color whose nearest surviving neighbor is beyond `MERGE_GUARD_DELTA_E` is **skipped**, the next-rarest merges; when all are beyond guard, loop stops.
- **Target ceiling:** `mergedCount >= targetN` always; equals `targetN` when merges are available; **exceeds** `targetN` when the guard blocks the rest (Pitfall 3).
- **No-op:** `targetN >= detectedColorCount` → grid + counts returned unchanged (reference-safe).
- **No-visible-change bound (D-01 mitigation):** max original→final per-cell CIEDE2000 shift `<= guard`.
- **Purity:** grid length preserved; no code invented outside the input candidate set.

### `quote.test.ts` — quote selector (new)
- **Line-sum equality (QUOTE-02):** `totalCents === sumCents(lineItems.map(li => li.cents))` across several fixtures.
- **Tax (D-07):** the `tax` line is `0` cents and labeled "calculated at vendor checkout".
- **Combined shipping (D-08):** `shipping` cents `=== toCents(VENDOR_REGISTRY[vendor].baseShipping + DRILLS_BASE_SHIPPING)`; carries the `rates as of {RATES_AS_OF}` note.
- **Null canvas (Pitfall 4):** null/non-finite canvas cost → `canvasPriced === false`, `canvas` line `0` cents, no throw, total still consistent.
- **Integer-cents only:** no floats leak; feed a fixture with a `.005` boundary to confirm `toCents` half-up.

### `density.test.ts` — density helper (new)
- `gridToInches(120,160) → { widthIn: 12, heightIn: 16 }`.
- Reconciliation: `widthIn === cols/10` and area matches `calculateCanvasCost`'s internal grid conversion.
- `formatInches` rounds to 1 dp.

### `detectedColorCount` (hook)
- If the hook has a test seam, assert `detectedColorCount === Object.keys(rawCounts).length` and that it does **not** change when smoothing/reduce inputs change (only on a new raw match). If hook-level testing is impractical (worker/OffscreenCanvas env), cover the derivation as a pure helper and note the wiring for Phase 23 UAT.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Threshold merge (`substituteLowCountColors`) | Target-N merge (`reduceToColorCount`) | Phase 22 | Additive; the old fn stays for the existing substitution path, the new fn drives REFINE-04. |
| Scattered total math in App | Single `quote.ts` selector | Phase 22 (built) / 23 (wired) | Supplies + Order can never diverge. |
| Implicit density (`/10` inline) | Explicit `density.ts` helper | Phase 22 | One reconciled source; kills hard-coded mock inch labels. |

**Deprecated/outdated:** none removed this phase. The `theme` param is already gone from `symbolFontPx`; only stale comment markers remain (optional deletion).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `MERGE_GUARD_DELTA_E = 10` (CIEDE2000 units) is a reasonable fixed-conservative starting value. | Reducer / Determinism | If too low, the color slider under-merges (few merges possible at low N); if too high, a merge could be faintly visible. Mechanics are locked; only the number is a guess and is explicitly tunable in REFINE-06. The no-visible-change test bounds the worst case at exactly this value. Recommend the planner surface this as a named constant with a comment and treat the value as provisional — a `checkpoint:human-verify` or a quick empirical check on a sample image is warranted before locking. |
| A2 | `RATES_AS_OF` should be dated to today's curated-rate review date (2026-07-14) unless the planner sets a specific review date. | Quote wiring | Wrong date misrepresents provenance freshness; trivially correctable, low risk. |
| A3 | The numeric-then-lexical DMC comparator (App.tsx:1112-1118 style) is the intended meaning of "lowest DMC code." | Determinism / Pitfall 2 | If a different ordering is intended, tie-break outcomes shift (still deterministic). Low risk — any total order satisfies SC4; matching the UI's order is the least-surprising choice. |

## Open Questions (RESOLVED)

1. **RESOLVED — Exact `MERGE_GUARD_DELTA_E` value.**
   - What we know: mechanics locked (absolute veto, skip-continue, ceiling); value is fixed-conservative and tunable in REFINE-06.
   - What's unclear: the specific CIEDE2000 number that best balances "no visible change" vs "slider actually reduces."
   - Recommendation: ship a named constant (proposed 10), add the no-visible-change bound test, and let Phase 23 UAT / REFINE-06 tune it. Flag for a quick human sanity-check on one real image.
   - **RESOLVED in planning:** Plan 22-03 ships `MERGE_GUARD_DELTA_E = 10` as a documented provisional constant plus the no-visible-change bound test; empirical tuning is explicitly deferred to Phase 23 UAT / v4.x REFINE-06 per D-03. The worst-case merge shift is capped at the guard by the bound test, so execution is unambiguous.

2. **RESOLVED — Does Phase 22 wire the reduce step into the hook at all, or only add the pure fn + `detectedColorCount`?**
   - What we know: SC4 says the hook exposes `detectedColorCount`; the phase boundary says "no UI wiring — that is Phase 23."
   - What's unclear: whether the reduce *step* enters the hook pipeline now (gated off) or is added entirely in Phase 23.
   - Recommendation: land the pure `reduceToColorCount` + tests + additive `detectedColorCount` in Phase 22; add the gated (no-op default) reduce step in the hook only if it keeps App behavior byte-identical and the suite green — otherwise defer the pipeline insertion to Phase 23. Planner to decide per the strangler-green constraint.
   - **RESOLVED in planning:** Plan 22-04 lands `detectedColorCount` (raw-keyed) plus a gated no-op-default reduce step in `useDiamondArtMatch` in the canonical `raw → smooth → reduce` order, with new `MatchInputs` fields optional so App.tsx compiles byte-identical (strangler-green honored). Pipeline insertion is NOT deferred.

## Security Domain

`security_enforcement: true`, ASVS L1. This is a pure-math engine phase — no auth, sessions, access control, network, or persistence added. The only relevant control is **input validation / fail-loud on tampered numeric input**, already provided by `money.ts` (`toCents` throws on non-finite; `sanitizeMoney` clamps).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (client-side, no accounts) |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | `toCents` (fail-loud on NaN/±Infinity), `sanitizeMoney` (clamp), `calculateCanvasCost` null-guard; `reduceToColorCount` must not throw in the render path (mirror `smoothMatches`/`packColor` degrade-not-crash) and must guard a null/non-finite `canvasBaseCost` before `toCents`. |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tampered/imported price → `$0`/`NaN` phantom in total | Tampering | Route all money through `money.ts`; `canvasPriced` flag surfaces a null canvas cost instead of a silent $0 (Phase 15 lineage). |
| Non-deterministic merge → legend/cart/quote disagree | Tampering (integrity) | Total order on immutable `dmcCode`, exact ties, fixed CIEDE2000 weights (D-02). |
| Reducer throws on degenerate grid → white-screen | DoS (render path) | Degrade-not-crash: empty/`targetN >= distinct` returns input unchanged, like `smoothMatches`. |

## Sources

### Primary (HIGH confidence — direct codebase read this session)
- `src/engine/color.ts` (getColorDistance, matchPixelGrid, substituteLowCountColors, DmcColor usage)
- `src/engine/money.ts` (toCents/sumCents/fromCents/formatUSD/sanitizeMoney)
- `src/engine/bagPlanner.ts` (planOrderSupply, OrderSupplyPlan, optimizedCostCents)
- `src/engine/checkout.ts` (VENDOR_REGISTRY, baseShipping, calculateCanvasCost grid/10, CanvasVendor)
- `src/engine/smoothing.ts` (smoothMatches signature + order)
- `src/engine/types.ts` (DmcColor, LabCoordinates)
- `src/features/match/useDiamondArtMatch.ts` (pipeline, gating pattern, RawMatch/MatchState)
- `src/engine/symbols.ts:145` + `viewer.ts:392` + `export.ts:85,174` (theme-param finding)
- `src/App.tsx:217-218,273-276,1143-1148,1112-1118` (total assembly, density `/10`, code sort)
- `src/engine/__tests__/*` (test conventions; smoothing.test.ts read in full)
- `.planning/phases/22-.../22-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/config.json`

### Secondary (MEDIUM)
- CIEDE2000 JND general knowledge (ΔE ~1 imperceptible, 1–2 perceptible on inspection) — informs A1 only, not load-bearing.

### Tertiary (LOW)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; every primitive verified by read.
- Architecture / signatures: HIGH — proposed signatures mirror existing verified modules.
- Reducer determinism: HIGH mechanics / MEDIUM on the guard *value* (A1).
- Quote wiring: HIGH — composition of verified integer-cents primitives.
- Pitfalls: HIGH — drawn from actual code (Object-key order, nullable canvas cost, non-numeric DMC codes).

**Research date:** 2026-07-14
**Valid until:** ~2026-08-14 (stable internal codebase; no fast-moving external deps). Re-verify line numbers at plan time per CONTEXT instruction.
