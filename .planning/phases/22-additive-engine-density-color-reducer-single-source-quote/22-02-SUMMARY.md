---
phase: 22-additive-engine-density-color-reducer-single-source-quote
plan: 02
subsystem: engine
tags: [quote, integer-cents, money, single-source, strangler, typescript, vitest]

# Dependency graph
requires:
  - phase: 16-optimized-supply-plan-savings
    provides: "planOrderSupply / OrderSupplyPlan single-source pattern + optimizedCostCents (the drills half the quote consumes, D-06)"
  - phase: 15
    provides: "money.ts integer-cents contract (toCents fail-loud, sumCents exact) + the never-a-$0/NaN-phantom lineage"
provides:
  - "src/engine/quote.ts — buildOrderQuote: the single integer-cents customer quote selector (drills + canvas + combined shipping + $0 tax) whose lineItems sum EXACTLY to totalCents by construction (QUOTE-02)"
  - "OrderQuote / QuoteLineItem interfaces + TAX_RATE_ESTIMATE knob (D-07)"
  - "DRILLS_BASE_SHIPPING = 5.00 + RATES_AS_OF = 2026-07-14 curated-rate constants in checkout.ts (D-08, QUOTE-03)"
affects: [phase-23-ui-wiring, supplies-est-total, order-total]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-source aggregator one level up from planOrderSupply — totalCents IS sumCents(lineItems), so line items can never diverge from the grand total"
    - "Nullable-price surfacing — canvasPriced flag (mirrors hasUnpricedSize) exposes a null/non-finite canvas cost instead of a silent $0 line"

key-files:
  created:
    - src/engine/quote.ts
    - src/engine/__tests__/quote.test.ts
  modified:
    - src/engine/checkout.ts

key-decisions:
  - "OrderQuote shape: lineItems (drills/canvas/shipping/tax) + totalCents + ratesAsOf + canvasPriced; total is sumCents(lineItems) by construction (Claude's discretion per CONTEXT — line items reconcile exactly to the total)"
  - "TAX_RATE_ESTIMATE=0 kept as a single knob so a future live rate is a one-line change; the label 'calculated at vendor checkout' attaches, not a percentage (D-07)"
  - "Quote receives the already-computed canvasBaseCost (number|null), NOT raw dims — so quote.ts never duplicates calculateCanvasCost and honors D-06 consume-don't-recompute"

patterns-established:
  - "Single-source money aggregator: itemized lines and grand total are the same integer cents, computed once, so downstream consumers need no reconciliation code"
  - "Fail-loud money + surface-don't-swallow: toCents throws on non-finite; a bad canvas price is guarded to a 0-cent line AND a canvasPriced=false flag before it can reach toCents"

requirements-completed: [QUOTE-02, QUOTE-03]

coverage:
  - id: Q1
    description: "buildOrderQuote returns an OrderQuote whose totalCents === sumCents(lineItems.map(li => li.cents)) by construction across drills/vendor/canvas fixtures"
    requirement: "QUOTE-02"
    verification:
      - kind: unit
        ref: "src/engine/__tests__/quote.test.ts#LINE-SUM EQUALITY (QUOTE-02)"
        status: pass
    human_judgment: false
  - id: Q2
    description: "Tax line is 0 cents labeled 'calculated at vendor checkout' (TAX_RATE_ESTIMATE=0); shipping is ONE combined 'Shipping (est.)' line = vendor baseShipping + DRILLS_BASE_SHIPPING with a RATES_AS_OF note"
    requirement: "QUOTE-03"
    verification:
      - kind: unit
        ref: "src/engine/__tests__/quote.test.ts#TAX (D-07) / COMBINED SHIPPING (D-08)"
        status: pass
    human_judgment: false
  - id: Q3
    description: "A null/non-finite canvasBaseCost yields canvasPriced=false and a 0-cent canvas line without throwing; total still equals the line-sum (Pitfall 4 / Phase 15 lineage)"
    requirement: "QUOTE-02"
    verification:
      - kind: unit
        ref: "src/engine/__tests__/quote.test.ts#NULL / NON-FINITE CANVAS (Pitfall 4)"
        status: pass
    human_judgment: false
  - id: Q4
    description: "quote.ts is additive and unreferenced by App.tsx this phase; the full suite grows (301 → 308), never shrinks (SC5 strangler)"
    requirement: "QUOTE-02"
    verification:
      - kind: automated
        ref: "git grep 'engine/quote' src/App.tsx → 0 matches; npm test 308 passing (baseline 301)"
        status: pass
    human_judgment: false

# Metrics
duration: 4min
completed: 2026-07-14
status: complete
---

# Phase 22 Plan 02: Single Integer-Cents Quote Selector Summary

**A pure `engine/quote.ts` (`buildOrderQuote`) that composes drills + canvas + one combined "Shipping (est.)" line + a $0 "calculated at vendor checkout" tax into exactly one `OrderQuote` whose itemized line items sum EXACTLY to `totalCents` by construction (QUOTE-02) — every estimate carrying a dated `rates as of 2026-07-14` provenance (QUOTE-03), additive and unwired from App until Phase 23.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-07-14T18:39:40Z
- **Completed:** 2026-07-14T18:43:00Z
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 edited)

## Accomplishments
- Added `DRILLS_BASE_SHIPPING = 5.00` and `RATES_AS_OF = '2026-07-14'` to `checkout.ts` beside `VENDOR_REGISTRY` (D-08, QUOTE-03) — purely additive; `VENDOR_REGISTRY`, `calculateCanvasCost`, `normalizeVendor` byte-unchanged.
- Created `src/engine/quote.ts` — `buildOrderQuote({ supplyPlan, canvasBaseCost, vendor })` returns `{ lineItems, totalCents, ratesAsOf, canvasPriced }`. Drills consumed from `OrderSupplyPlan.optimizedCostCents` (no re-pack, D-06); shipping is one combined line = `toCents(vendor.baseShipping + DRILLS_BASE_SHIPPING)` (D-08); tax routes through `money.ts` at `TAX_RATE_ESTIMATE=0` → 0 cents labeled "calculated at vendor checkout" (D-07); `totalCents = sumCents(lineItems)` by construction (QUOTE-02).
- Guarded a null/non-finite `canvasBaseCost` to `canvasPriced=false` + a 0-cent canvas line BEFORE `toCents` (which throws on non-finite) — never a $0/NaN phantom (Pitfall 4, Phase 15 lineage).
- Added `quote.test.ts` (7 tests) proving line-sum equality across drills/vendor/canvas fixtures, tax/shipping labeling + provenance, the null/Infinity/NaN canvas guard, drills pass-through, and the `.005` half-up integer-cents boundary.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add DRILLS_BASE_SHIPPING + RATES_AS_OF to checkout.ts** — `6d50059` (feat)
2. **Task 2: Create engine/quote.ts single integer-cents selector** — `ef79353` (feat)
3. **Task 3: Create quote.test.ts line-sum/label/null-canvas tests** — `83215fe` (test)

## Files Created/Modified
- `src/engine/quote.ts` — `buildOrderQuote`, `OrderQuote`, `QuoteLineItem`, `TAX_RATE_ESTIMATE` (created)
- `src/engine/__tests__/quote.test.ts` — 7 tests: line-sum equality, tax/shipping labeling, null-canvas guard, boundary (created)
- `src/engine/checkout.ts` — added `DRILLS_BASE_SHIPPING` + `RATES_AS_OF` constants beside `VENDOR_REGISTRY` (modified, additive-only)

## Decisions Made
- **OrderQuote interface:** `{ lineItems, totalCents, ratesAsOf, canvasPriced }` with a four-key line-item union (`drills`/`canvas`/`shipping`/`tax`). Chose to make `totalCents` literally `sumCents(lineItems.map(li => li.cents))` so the total equals the itemization by construction — no reconciliation code is ever needed downstream (Phase 23 Supplies "Est. total" and Order total both read `totalCents`).
- **Pass the computed `canvasBaseCost` (number|null), not raw dims** — keeps `quote.ts` from duplicating `calculateCanvasCost` and honors D-06 "consume, don't recompute". The nullability is surfaced via `canvasPriced` (mirrors `planOrderSupply.hasUnpricedSize`).
- **`TAX_RATE_ESTIMATE = 0` as a single exported knob** — tax still routes through `money.ts` (0 cents, so QUOTE-02 line-sum holds) and carries a "calculated at vendor checkout" label; a future live/estimated rate is a one-line change (D-07).

## Deviations from Plan

None - plan executed exactly as written. All three tasks landed on their planned files with no auto-fixes required.

## Issues Encountered
- Git reported a benign `LF will be replaced by CRLF` warning committing the two new files (Windows line-ending normalization) — no content impact.

## Threat Surface
- **T-22-Q1 (DoS — canvas cost)** mitigated: `canvasBaseCost` null/non-finite is guarded to `canvasCents=0` + `canvasPriced=false` before `toCents`; covered by the null/Infinity/NaN canvas test — never white-screens.
- **T-22-Q2 (Tampering — line/total divergence)** mitigated: `totalCents === sumCents(lineItems)` by construction; all four lines via `money.ts` `toCents`; the line-sum-equality test enforces it across fixtures.
- **T-22-Q3 (Supply chain)** mitigated: zero new dependencies; `package.json` untouched (only checkout.ts/quote.ts/quote.test.ts changed).

## Verification Evidence
- `npx tsc --noEmit` exits 0 (strict mode).
- `npx vitest run src/engine/__tests__/quote.test.ts` — 7/7 pass.
- `npm test` — 308 passing across 30 files (baseline was 301/29; count only grew, SC5 honored).
- `git grep -n "engine/quote" src/App.tsx` → 0 matches (additive; not wired into App this phase).
- `git diff` on checkout.ts shows only the two additive constants — `VENDOR_REGISTRY`/`calculateCanvasCost`/`normalizeVendor` unchanged.
- No new dependency in `package.json` (only checkout.ts, quote.ts, quote.test.ts touched).

## Next Phase Readiness
- The single quote selector is ready for Phase 23 wiring: Supplies "Est. total" and the Order total both read `OrderQuote.totalCents`, and the itemization reads `lineItems` — equal by construction, no reconciliation code needed.
- Callers supply the already-computed `canvasBaseCost` (from `calculateCanvasCost`) and the `CanvasVendor`; `canvasPriced=false` is the seam for surfacing an unpriced/tampered canvas in the UI.
- Sibling plans 22-03 (color reducer) / 22-04 (hook `detectedColorCount`) are independent additive engine work; this plan touched none of their surfaces.

## Self-Check: PASSED

- `src/engine/quote.ts`, `src/engine/__tests__/quote.test.ts`, `22-02-SUMMARY.md` all exist on disk.
- Task commits `6d50059`, `ef79353`, `83215fe` all present in git log.

---
*Phase: 22-additive-engine-density-color-reducer-single-source-quote*
*Completed: 2026-07-14*
