---
phase: 23-the-four-screens-in-flow-order
plan: 04
subsystem: ui
tags: [preact, strangler-fig, feature-flags, supplies, single-source-quote, order-quote, honesty, canvas-first]

# Dependency graph
requires:
  - phase: 23-the-four-screens-in-flow-order
    plan: 01
    provides: "flags.ts (USE_NEW_* booleans) + pure SuppliesScreen shell + App data-step-panel ternaries"
  - phase: 23-the-four-screens-in-flow-order
    plan: 03
    provides: "USE_NEW_REFINE=true; App refine two-tier wiring; the re-home/skip strangler-bridge pattern"
  - phase: 22-additive-engine-density-color-reducer-single-source-quote
    provides: "buildOrderQuote / OrderQuote / QuoteLineItem (quote.ts) + money.ts integer-cents helpers + planOrderSupply/OrderSupplyPlan"
provides:
  - "SuppliesScreen — full pure/props-only Supplies screen (UI-SPEC A3): drill supply table (symbol · swatch · DMC code+name · drills incl. +10% safety · bags) + SC2/BAG-02 totals caption + native 'Why these bags?' <details> + single-source order-summary panel"
  - "App-level SINGLE-SOURCE quote seam (D-07): const orderQuote = buildOrderQuote({ supplyPlan: orderPlan, canvasBaseCost, vendor: selectedVendor }) — the ONE itemized quote Supplies renders and Order (wave 5) will consume, so their totals can never diverge"
  - "USE_NEW_SUPPLIES=true — panel-3 renders SuppliesScreen; legacy Step3Canvas dormant behind the false-less branch (removal Phase 25)"
  - "SuppliesScreen render test locking verbatim quote rendering (no local cents math), honesty affordances, and the native disclosure"
affects: [23-05-order, 25-strangler-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-source quote consumption (D-07): the screen renders quote.lineItems + quote.totalCents VERBATIM with ZERO cents summation in the component (no .reduce over cents) — the money.ts selector guarantees lineItems sum to the total, the UI just prints it"
    - "Honesty affordances (Pitfall 6 / T-23-04-01): an unpriced canvas (quote.canvasPriced=false) renders an explicit 'unavailable' Pill and a row with hasUnpricedSize renders an 'unpriced' Pill — never a silent $0 substitute; the deliberate $0.00 tax line carries its 'calculated at vendor checkout' note"
    - "Pure/props-only screen owns NO domain state and does NO money math; App remains sole state owner and the sole owner of the DMC_PALETTE join + safety math + bag packing"
    - "Strangler flip bridging (inherited from 23-03): re-home salvageable coverage to the new owner (markers/selectors), skip newly-displaced legacy-DOM cases with explicit TODO(next) markers"

key-files:
  created:
    - src/features/screens/__tests__/SuppliesScreen.test.tsx
  modified:
    - src/features/screens/SuppliesScreen.tsx
    - src/features/screens/flags.ts
    - src/features/screens/__tests__/flags.test.ts
    - src/App.tsx
    - src/__tests__/App.test.tsx
    - src/__tests__/integration.test.tsx
    - src/__tests__/print.test.tsx

key-decisions:
  - "The order-summary panel is a plain <div> (NOT <aside>) so it does not shift the App layout's aside indices that the workspace/legend tests key off of (querySelectorAll('aside')[1])"
  - "SC2/BAG-02 totalPackets/totalSafetyDrills re-homed into a visible Supplies totals caption ('Drills (N bag(s)) · M drills incl. +10% safety') so the aggregator's bag count stays user-visible in the new screen (BAG-02 test passes unchanged)"
  - "Honesty is defensive in practice: App's sanitizeMoney clamps a tampered/non-finite canvasBaseCost to 0 BEFORE it reaches buildOrderQuote, so canvasPriced is effectively always true from App; the canvasPriced=false 'unavailable' path is covered by the SuppliesScreen stub test"
  - "The 'Match colors →'/'Continue to order →' rail CTAs are NOT rendered — forward navigation is owned by the shell wizard Next button (a dead button would violate props-only purity), consistent with the 23-03 RefineScreen decision"

patterns-established:
  - "Screens that render a shared money quote read it VERBATIM: no .reduce over cents in the component; the single-source selector (buildOrderQuote/money.ts) is the sole owner of line-sum == total equality (D-07)"

requirements-completed: [SUPPLIES-01, SUPPLIES-02]

coverage:
  - id: D1
    description: "Supply table renders one row per planOrderSupply color: symbol (symbolMap) · swatch (hex) · DMC code+name · drills incl. +10% safety · bags (bagsText), plus a native 'Why these bags?' <details> whose body is DYE_LOT_WHY_SENTENCE"
    requirement: "SUPPLIES-01"
    verification:
      - kind: unit
        ref: "src/features/screens/__tests__/SuppliesScreen.test.tsx#renders one supply row per rows entry with its code, name, safety count, and bagsText"
        status: pass
      - kind: unit
        ref: "src/features/screens/__tests__/SuppliesScreen.test.tsx#renders the native \"Why these bags?\" <details> whose body is the dyeLotWhy prop"
        status: pass
      - kind: integration
        ref: "src/__tests__/print.test.tsx#exposes the native \"Why these bags?\" disclosure in the Supplies panel"
        status: pass
    human_judgment: false
  - id: D2
    description: "Inline order-summary renders buildOrderQuote(...).lineItems + totalCents VERBATIM with zero local cents math (single-source D-07)"
    requirement: "SUPPLIES-02"
    verification:
      - kind: unit
        ref: "src/features/screens/__tests__/SuppliesScreen.test.tsx#renders the order summary from quote.lineItems + quote.totalCents VERBATIM (single-source, no local math)"
        status: pass
      - kind: other
        ref: "grep -n 'reduce' src/features/screens/SuppliesScreen.tsx → only a docstring mention; no cents summation"
        status: pass
    human_judgment: false
  - id: D3
    description: "Honesty: an unpriced canvas (canvasPriced=false) or a hasUnpricedSize row surfaces an est./unavailable affordance, never a silent $0"
    requirement: "SUPPLIES-02"
    verification:
      - kind: unit
        ref: "src/features/screens/__tests__/SuppliesScreen.test.tsx#surfaces an \"unavailable\" affordance for an unpriced canvas — never a silent \"$0.00\""
        status: pass
      - kind: unit
        ref: "src/features/screens/__tests__/SuppliesScreen.test.tsx#marks a row with an unpriced bag size instead of a bag string"
        status: pass
    human_judgment: false
  - id: D4
    description: "USE_NEW_SUPPLIES=true (one flag flipped); panel-3 renders SuppliesScreen; full suite + tsc green"
    verification:
      - kind: unit
        ref: "src/features/screens/__tests__/flags.test.ts#has Upload + Refine + Supplies swapped in and Order still legacy"
        status: pass
      - kind: integration
        ref: "npm test — 333 passed / 9 skipped / 0 failed (34 files, stable across 3 runs); npx tsc --noEmit exit 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "The single-source quote seam: Supplies and Order both read the SAME buildOrderQuote result (no divergent local totals). Deferred visual/UX confirmation of the two screens agreeing lands with Order (wave 5)."
    verification: []
    human_judgment: true
    rationale: "Order screen does not exist yet (23-05); cross-screen total agreement is fully guaranteed by construction (one shared orderQuote object) but only observably demonstrable once Order renders it. Visual A3 layout fidelity (320px panel, accent-green Est. total, mono line items) is a design-conscious judgment call."

# Metrics
duration: ~40min
completed: 2026-07-14
status: complete
---

# Phase 23 Plan 04: Supplies Screen (SUPPLIES-01/02, D-07 single-source quote) Summary

**Swapped in the canvas-first Supplies screen and flipped `USE_NEW_SUPPLIES` on, wiring the LOCKED single-source quote seam: App now derives exactly ONE `const orderQuote = buildOrderQuote({ supplyPlan: orderPlan, canvasBaseCost, vendor: selectedVendor })`, and the pure props-only `SuppliesScreen` renders both the drill supply table (symbol · swatch · DMC code+name · drills incl. +10% · bags + a native "Why these bags?" `<details>`) AND the inline order-summary — printing `quote.lineItems`/`quote.totalCents` VERBATIM with zero cents math in the component, so Supplies and the future Order screen can never diverge. Unpriced canvas / unpriced-size figures surface explicit "unavailable"/"unpriced" affordances rather than a silent $0 (honesty, Pitfall 6). The legacy `totalCostSafetyCents` assembly is left untouched for the dormant Step3/Step4 bodies (Phase 25). Engine frozen; tsc + Vitest green (333 pass / 9 skip, stable across 3 runs).**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-07-14T21:25:02Z
- **Tasks:** 3 (3 atomic commits)
- **Files:** 8 (1 created, 7 modified)

## Accomplishments
- `SuppliesScreen.tsx` — full pure/props-only Supplies screen (UI-SPEC A3): a left **drill supply plan table** ("counts include +10% safety" caption; one row per `rows` entry with `symbolMap[code]` glyph, `hex` swatch, mono-bold DMC `code` + muted `name`, `safety` (+10%) drills, and `bagsText`), a SC2/BAG-02 totals caption, a native **"Why these bags?" `<details>`** whose body is `DYE_LOT_WHY_SENTENCE`, and a right **order-summary panel** ("Order summary" → `quote.lineItems` mapped to mono label+`formatUSD(cents)` rows with per-line "est." tags → "Est. total" = `formatUSD(quote.totalCents)` in accent green → "Billed by GemPixel · printed & shipped by our lab" + `rates as of` provenance). Zero `.reduce`/summation of cents in the component (D-07).
- `App.tsx` — imported `buildOrderQuote`; added the single-source `const orderQuote = buildOrderQuote(...)` right after `orderPlan`; assembled `suppliesProps` (`rows` = `sortedMatches`, `symbolMap`, `dyeLotWhy` = `DYE_LOT_WHY_SENTENCE`, `totalSafetyDrills`, `totalPackets`, `quote` = `orderQuote`) and passed it to `<SuppliesScreen {...suppliesProps} />`. Legacy `totalCostSafetyCents` (App.tsx ~1180) untouched.
- `flags.ts` `USE_NEW_SUPPLIES=true` (one flag per commit); `flags.test.ts` assertion updated in the same commit.
- `SuppliesScreen.test.tsx` — 6 jsdom cases locking verbatim single-source rendering (total stubbed ≠ line-sum → proves no local math), supply rows, both honesty affordances, the SC2/BAG-02 caption, and the native disclosure.

## Task Commits

Each task was committed atomically:

1. **Task 1+2: wire single-source orderQuote + implement SuppliesScreen (flag off)** — `e6b02e0` (feat)
2. **Task 1 (flip): flip USE_NEW_SUPPLIES on; re-home/skip displaced legacy Step3 tests** — `19c3c13` (feat)
3. **Task 3: SuppliesScreen render test — single-source summary + honesty + table** — `da1ff5d` (test)

_Task 1 (App wiring) and Task 2 (component impl) are coupled at a single JSX call site, so they landed green-together in commit 1 with the flag OFF (runtime unchanged); the flag flip is isolated in commit 2 (the 23-03 "wire-then-flip" pattern)._

## Files Created/Modified
- `src/features/screens/SuppliesScreen.tsx` - Full Supplies screen (was a placeholder shell)
- `src/features/screens/flags.ts` - `USE_NEW_SUPPLIES = true`
- `src/features/screens/__tests__/flags.test.ts` - Strangler-state assertion (Upload+Refine+Supplies live)
- `src/App.tsx` - `buildOrderQuote` import + `orderQuote` derivation + `suppliesProps`
- `src/features/screens/__tests__/SuppliesScreen.test.tsx` - New jsdom render test (6 cases)
- `src/__tests__/App.test.tsx` - Re-home (display-isolation marker) + 6 skips + 1 flaky-test hardening
- `src/__tests__/integration.test.tsx` - Re-home (legend-row click scoped to right sidebar)
- `src/__tests__/print.test.tsx` - Re-home ("Why these bags?" → native <details>; sentence count 1→2) + 1 skip

## Decisions Made
- Order-summary panel is a `<div>`, not `<aside>` — avoids shifting the App layout aside indices the workspace/legend tests index into.
- SC2/BAG-02 `totalPackets`/`totalSafetyDrills` re-homed into a visible Supplies totals caption so the aggregator bag count stays user-visible in the new screen.
- Rail "Continue to order →" CTA omitted — forward nav is the shell wizard Next button (props-only purity).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Order-summary `<aside>` collided with the App layout's aside indices**
- **Found during:** Task 1 flag flip (`npm test`).
- **Issue:** SuppliesScreen (always-mounted per D-14) rendered the order-summary panel as `<aside>`, so `container.querySelectorAll('aside')[1]` in the workspace/legend tests resolved to the Supplies panel instead of the right workspace sidebar — breaking 4 integration cases (right-sidebar collapse, DMC Supply List collapse/sort, sub-palette).
- **Fix:** Changed the panel to a `<div>` (with an explanatory comment). No visual change (same classes).
- **Files modified:** `src/features/screens/SuppliesScreen.tsx`
- **Commit:** `19c3c13`

**2. [Rule 3 - Blocking] Re-homed 3 displaced-but-still-valid legacy tests to the new Supplies/legend DOM**
- **Found during:** Task 1 flag flip.
- **Issue:** Flipping the flag replaced the legacy Step3Canvas panel-3 DOM. Three green tests keyed off gone markers: the display-isolation Step-3 marker (`#canvas-print-partner`), an integration legend-row click (broad `container.querySelector('tbody tr')` now hit the display-only Supplies table first), and the "Why these bags?" a11y test (legacy custom `aria-controls` button superseded by the mandated native `<details>`).
- **Fix:** Re-homed each: Step-3 marker → `[data-screen="supplies"]`; legend-row click scoped to `querySelectorAll('aside')[1]` (same D-14 pattern the sibling tests use); "Why these bags?" rewritten to assert the native `<details>`/`<summary>` contract. Also updated the print "sentence independence" count 1→2 (the Supplies disclosure now always renders the sentence alongside the print mirror).
- **Files modified:** `src/__tests__/App.test.tsx`, `src/__tests__/integration.test.tsx`, `src/__tests__/print.test.tsx`
- **Commit:** `19c3c13`

**3. [Rule 3 - Blocking] Skipped 6 newly-displaced legacy-DOM tests with explicit TODO markers**
- **Found during:** Task 1 flag flip.
- **Issue:** Six green tests drove controls that have NO canvas-first home in the read-only SuppliesScreen: the editable pricing-config grid (canvas cost / est. shipping / per-bag prices ×2 tests), the affiliate/unmapped-log "Clear Log" settings expander, and three ERR-01 banner tests triggered via the "Download Canvas Grid (PNG)" and "Order Drills" (Shopify checkout) buttons.
- **Fix:** Skipped with rationale markers — `TODO(25)` for the pricing-config + affiliate/unmapped-log (retire/re-home in the Phase 25 strangler cleanup), `TODO(23-05/25)` for the download + checkout triggers (belong to the Order screen, wave 5). The underlying handlers/state (priceDb, unmappedLog, handleShopifyCheckout, handleDownloadCanvasOnly, and their guards) still run unchanged; only their panel-3 UI drivers left. No coverage silently dropped.
- **Files modified:** `src/__tests__/App.test.tsx`, `src/__tests__/print.test.tsx`
- **Commit:** `19c3c13`

**4. [Rule 1 - Bug] Hardened a timing-flaky Refine custom-size test exposed by heavier renders**
- **Found during:** Task 3 (`npm test`, full 34-file parallel run).
- **Issue:** `App.test.tsx#allows changing width and height in the Refine custom-size entry` used fixed `setTimeout(r, 10)` waits. The now-always-mounted Supplies table adds DOM to every App render, nudging the effect-settle time past 10ms under parallel load → the value read intermittently failed (passed in isolation, with the verbose reporter, and in the 2-file combo, but flaked at full parallelism — deterministically once the 34th file was added).
- **Fix:** Replaced the fixed-delay reads with `vi.waitFor` polling (the pattern already used in the sibling DMC-Supply-List test). Verified green across 3 consecutive full runs.
- **Files modified:** `src/__tests__/App.test.tsx`
- **Commit:** `da1ff5d`

---

**Total deviations:** 4 auto-fixed (2 bug, 2 blocking). No architectural changes (Rule 4 not triggered); no package installs.
**Impact on plan:** All fixes necessary to keep the suite green through the strangler flip. The `<aside>`→`<div>` and vi.waitFor fixes are correctness; the re-homes/skips are the expected strangler cost (mirrors 23-03). Zero engine files touched; no scope creep.

## Threat Model
- **T-23-04-01 (Tampering — order-summary line items):** mitigated. `quote.lineItems`/`totalCents` are rendered verbatim (never recomputed); `canvasPriced=false` and `hasUnpricedSize` surface "unavailable"/"unpriced" affordances instead of a silent $0. Covered by the `canvasPriced:false` and unpriced-row render tests.
- **T-23-04-02 (DoS — tampered money into render):** accepted. Money is sanitized at the App load boundary (`sanitizeMoney`, App.tsx:351) and routed through `money.ts` in `buildOrderQuote`; the screen only reads pre-sanitized cents and does no math.
- **T-23-SC (npm installs):** accepted; zero packages installed this plan.

## Issues Encountered
- The jsdom `getContext()` "Not implemented" / "worker exploded" lines in test output are pre-existing environment noise from canvas/worker tests, not failures — 333/333 active tests pass.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 23-05 (Order) is the last screen: it flips `USE_NEW_ORDER`, builds `OrderScreen` (UI-SPEC A4 — locked spec list, finish cards, ship-to, order-packet JSON download), and consumes the SAME `buildOrderQuote` result already derived in App (`orderQuote`) for its price card — proving the D-07 single-source seam end-to-end (Supplies total == Order total by construction).
- Strangler invariant holds: exactly one flag flipped this plan; single `<CanvasViewer>` mount + the `contents`/`hidden` toggle untouched; legacy `Step3Canvas` dormant behind the false-less branch (removal is Phase 25).
- Deferred to Phase 25 (`TODO(25)`): the pricing-config grid + affiliate/unmapped-log settings. Deferred to Order/Phase 25 (`TODO(23-05/25)`): the canvas-download + Shopify-checkout triggers. Plus the two inherited 23-03 `TODO(25)` skips (drill-type select, auto-substitution UI). 9 skips total.

## Self-Check: PASSED

- Files present: `SuppliesScreen.tsx`, `SuppliesScreen.test.tsx`, `flags.ts`, `flags.test.ts`, `App.tsx`, `App.test.tsx`, `integration.test.tsx`, `print.test.tsx`.
- Commits present: `e6b02e0`, `19c3c13`, `da1ff5d`.
- `npx tsc --noEmit` exit 0; `npm test` 333 passed / 9 skipped / 0 failed (stable across 3 runs); `USE_NEW_SUPPLIES === true`, Order flag `false`; `src/engine/` untouched by this plan; no cents `.reduce` in `SuppliesScreen.tsx`.

---
*Phase: 23-the-four-screens-in-flow-order*
*Completed: 2026-07-14*
