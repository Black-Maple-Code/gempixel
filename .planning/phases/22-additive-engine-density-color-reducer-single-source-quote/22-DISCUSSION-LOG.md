# Phase 22: Additive Engine — Density, Color Reducer & Single-Source Quote - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-14
**Phase:** 22-additive-engine-density-color-reducer-single-source-quote
**Areas discussed:** Color reducer strategy, Tax estimate method, Shipping in the quote, detectedColorCount + pipeline order
**Mode:** advisor (research-backed comparison tables; standard calibration tier)

---

## Color reducer strategy (`reduceToColorCount`)

| Option | Description | Selected |
|--------|-------------|----------|
| Iterative-recompute | Merge globally-rarest color into nearest surviving shade, recompute counts, repeat until distinct == N. Runs over the unique-color list (not the 40k grid) so it's trivially live. | ✓ |
| One-shot survivor set | Freeze top-N-by-count survivors; map every removed color to nearest survivor in one pass. Simplest/deterministic, but more guard hits, less faithful to "nearest used". | |
| Hybrid | Iterative removal order, but each color maps from its ORIGINAL Lab to nearest current survivor. Kills chain-displacement; more bookkeeping. | |

**User's choice:** Deferred to Claude's recommendation ("What do you recommend? What are the tradeoffs?"). Recommended and locked **Iterative-recompute**.
**Notes:** The decisive axis is chain-displacement risk (A→B then B→C, a shift no single in-guard check bounded). Iterative self-suppresses chains because the absorbing shade's count grows → unlikely to be picked as globally-rarest again. Perf is a non-issue (operates on tens–low-hundreds unique colors). Mitigation for the residual edge: a reducer unit test asserting max original→final CIEDE2000 shift stays within the guard; Hybrid is the contained escalation only if that test fails on real images. Two sub-decisions locked as recommended defaults: **guard-blocked = skip-that-color-and-continue** (fixed guard is an absolute veto; slider value is a target *ceiling*, merged count may exceed N); **tie-break = lowest DMC code** (immutable; count-based ties are unstable under mutating counts).

---

## Tax estimate method

| Option | Description | Selected |
|--------|-------------|----------|
| Flat 7.5% US-avg estimate | TAX_RATE_ESTIMATE = 0.075 + dated provenance in engine/quote.ts, labeled in UI. Reflects a realistic supply budget (Claude's original rec). | |
| $0, "calculated at vendor checkout" | Show a $0 tax line labeled as calculated at the vendor's real checkout. Most honest for a no-real-payment order-packet handoff. | ✓ |
| Region rate table | State-keyed rates + selector. Over-scope for an engine-only client-side phase; effectively v5.0 live-tax territory. | |

**User's choice:** **$0, "calculated at vendor checkout"** (overrode Claude's flat-7.5% recommendation).
**Notes:** Fits the no-real-payment Order handoff — GemPixel isn't the merchant of record, so an estimated tax % would read as more finalized than reality. Still routes through money.ts (0 cents), so QUOTE-02 line-sum equality holds. A single `TAX_RATE_ESTIMATE = 0` constant keeps a future non-zero rate a one-line change. QUOTE-03 "rates as of" provenance now attaches to shipping + any curated canvas rate rather than tax.

---

## Shipping in the quote

| Option | Description | Selected |
|--------|-------------|----------|
| One combined line (canvas + $5 drills) | Sum canvas baseShipping + curated DRILLS_BASE_SHIPPING = 5.00 (defined beside VENDOR_REGISTRY) into one integer-cents "Shipping (est.)" line. Honest total, single clean line. | ✓ |
| Two explicit shipping lines | Separate canvas + drills line items, each vendor-traceable with its own date. Max transparency, busier UI. | |
| Canvas-only (today's behavior) | Keep the single canvas figure; drills shipping ignored/assumed free. Simplest but understates real cost. | |

**User's choice:** **One combined line (canvas + $5 drills).**
**Notes:** Diamond Drills USA charges $5 flat (free over $30), so "free drills shipping" reads more favorably than reality. `DRILLS_BASE_SHIPPING = 5.00` lives in checkout.ts beside VENDOR_REGISTRY (same curated layer as baseShipping); quote.ts sums into one integer-cents shipping line so items sum exactly to the total. The two-vendor detail lives in a code comment / optional tooltip. Combined line splits into per-vendor lines cleanly when v5.0 live rates arrive.

---

## detectedColorCount + post-match pipeline order

| Option | Description | Selected |
|--------|-------------|----------|
| Raw post-match max; match→smooth→reduce | detectedColorCount = distinct codes in the raw matched grid, recomputed only on worker re-run; reduction runs last = the one authoritative merged count. Slider max never moves under smoothing/color drags. | ✓ |
| Post-smoothing max | Max = distinct colors of the smoothed grid; always truthful but JUMPS when dragging edge-cleanup (coupled-controls anti-pattern). | |
| Reduce-before-smooth | match→reduce→smooth; smoothing can erase a survived color → "one merged count" contract breaks. | |

**User's choice:** **Raw post-match max; order match → smooth → reduce.**
**Notes:** Keeps the Refine color-slider max stable while the user drags smoothing (REFINE-03) or the color slider (REFINE-04). A size change legitimately moves the max (real re-match). Reduction runs last so its output count is the single number all consumers read; couples with D-03 (slider value = target ceiling, guarded merged count = what consumers see). Accepted trade-off: an inert but STABLE slider-top dead-zone under heavy smoothing (Phase 23 may show the live merged count beside the slider).

---

## Claude's Discretion

- Density-helper file/API + inch rounding/formatting (follow the `calculateCanvasCost` grid→/10 = 10 dots/inch precedent; keep one helper).
- `reduceToColorCount` signature shape and whether it lives in `color.ts` beside `substituteLowCountColors`/`getColorDistance` or a new module.
- `OrderQuote` / line-item interface shape (must reconcile exactly to the total in integer cents; every estimate carries its label + "rates as of" date).
- Whether to also remove the `viewer.ts`/`symbols.ts` `theme` param (Phase 20 D-07 quarantine) in this engine-only phase — allowed if clean and green, not forced.

## Deferred Ideas

- All Phase 22 engine UI wiring (color slider, edge-cleanup control, size cards, Supplies table, Order total) → Phase 23.
- Tunable Delta-E merge guard threshold → v4.x REFINE-06.
- Flat/estimated or live tax (constant designed for a one-line flip) → v5.0 live tax / v4.x if a labeled flat estimate is later wanted.
- Live vendor rate APIs replacing curated baseShipping + DRILLS_BASE_SHIPPING → v5.0.
- Removing the viewer.ts/symbols.ts theme param → this phase (if clean) or carried forward.
