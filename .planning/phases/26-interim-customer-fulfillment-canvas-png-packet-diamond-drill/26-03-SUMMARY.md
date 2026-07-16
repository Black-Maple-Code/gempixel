---
phase: 26-interim-customer-fulfillment-canvas-png-packet-diamond-drill
plan: 03
subsystem: ui
tags: [preact, strangler-close, deletion, order-screen, shopify-cart, actionError-banner]

# Dependency graph
requires:
  - phase: 26-02
    provides: OrderScreen owns the reachable fulfillment path (4 canvas downloads + single drill cart) before this delete runs
provides:
  - Single UI tree — panel-3 renders SuppliesScreen unconditionally (no USE_NEW_SUPPLIES ternary)
  - Step3Canvas.tsx, flags.ts, flags.test.ts deleted; both coupled dark-slate fulfillment modals removed
  - Too-long / unmapped cart branch surfaced via the shared actionError banner (deleted Checkout Warning modal's replacement)
  - Single Diamond Drills USA cart call site (App handleShopifyCheckout → OrderScreen)
affects: [26-04 banner/Save-modal re-token, verify-work, ui-review]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Strangler CLOSE: last flag consumer removed → flags module safe to delete (D-02)"
    - "Honest text-only banner replaces a dark-slate modal; cart still opens for mapped colors (D-08)"
    - "tsc-driven dead-member grep-clean after a UI deletion (25-01 precedent)"

key-files:
  created: []
  modified:
    - src/App.tsx
    - src/__tests__/App.test.tsx
    - src/__tests__/print.test.tsx
  deleted:
    - src/features/wizard/steps/Step3Canvas.tsx
    - src/features/screens/flags.ts
    - src/features/screens/__tests__/flags.test.ts

key-decisions:
  - "Refactored handleShopifyCheckout to accumulate text-only banner notes (corrupt-log + unmapped + too-long) and ALWAYS open the cart for mapped colors — no modal gate; noopener,noreferrer preserved verbatim (T-26-07)"
  - "Removed only tsc-flagged orphans; kept every value still consumed by planOrderSupply/buildOrderQuote/handleShopifyCheckout/print containers"
  - "Retargeted the W4/WR-02 log-guard + W5 canvas-download-failure tests onto the reachable OrderScreen CTAs rather than dropping guard/error coverage"

patterns-established:
  - "Deletion plan keeps the suite green by retargeting live assertions onto the re-homed path and retiring only strangler-obsolete ones (Phase 23 aside precedent)"

requirements-completed: [ORDER-04, ORDER-05]

# Metrics
duration: 30min
completed: 2026-07-16
status: complete
---

# Phase 26 Plan 03: Strangler close — delete the legacy Step3Canvas fulfillment path Summary

**Completed the D-02 strangler CLOSE: deleted `Step3Canvas.tsx`, `flags.ts`, `flags.test.ts` and the two coupled dark-slate fulfillment modals; collapsed panel-3 to `SuppliesScreen` only; and refactored the too-long/unmapped cart branch onto the shared `actionError` banner — reaching a single UI tree with one reachable fulfillment path and a green suite (385 passed).**

## Performance

- **Tasks:** 2
- **Files modified:** 3 (App.tsx, App.test.tsx, print.test.tsx)
- **Files deleted:** 3 (Step3Canvas.tsx, flags.ts, flags.test.ts)

## Accomplishments
- **Single UI tree (SC5/D-02):** panel-3 now renders `<SuppliesScreen />` unconditionally — the `USE_NEW_SUPPLIES` ternary, the `Step3Canvas` import, and the `flags` import are gone. With the last flag consumer removed, `flags.ts` + `flags.test.ts` were deleted.
- **Dormant fulfillment UI removed:** deleted the Artist Resources modal (already unreachable — no opener) and the Checkout Warning modal (dies with the re-homed checkout path).
- **Cart-error path re-homed (D-08):** `handleShopifyCheckout`'s guarded branch no longer opens a modal. It accumulates honest, text-only notes (corrupt-log fallback, unmapped colors to add manually at Diamond Drills USA, and the too-long-link caveat), sets them on the shared `actionError` banner, and STILL opens the cart for the mapped colors — `window.open(url, '_blank', 'noopener,noreferrer')` preserved verbatim (T-26-07).
- **Single cart call site (D-01):** `compileShopifyCartLink` resolves to exactly one App usage wired to OrderScreen; SuppliesScreen has none.
- **tsc-driven dead-member cleanup:** removed only genuinely-orphaned members and their now-unused imports; every value still consumed by the live pricing/quote/print paths was kept. tsc exits 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete Step3Canvas + flags.ts + coupled modals; collapse panel-3; refactor cart-error path** — `135cc25` (refactor)
2. **Task 2: Retire/retarget the Step3Canvas-coupled tests** — `1588dd6` (test)

## Files Created/Modified
- `src/App.tsx` — panel-3 collapsed to `SuppliesScreen`; removed `Step3Canvas` + `USE_NEW_SUPPLIES` imports, the Artist Resources + Checkout Warning modals, `resourcesModalOpen`/`checkoutWarning` state; refactored `handleShopifyCheckout` onto the `actionError` banner; removed unused imports `fromCents`, `FRAMER_MARGIN_CELLS`.
- `src/__tests__/App.test.tsx` — retargeted W5 (canvas-download failure → `order-download-canvas-cta`), W4 + WR-02 (corrupt / wrong-type log guard → `order-cart-cta`) onto the OrderScreen; retired the price-grid, commission-quote and unmapped-log-settings tests with inline strangler notes.
- `src/__tests__/print.test.tsx` — retired the WR-01 per-bag-price-grid readout test (Step3Canvas price grid deleted) with an inline note.

## tsc-flagged members removed (Task 1)
`updatePriceDb`, `sizingAdviceData` (useMemo), `printReport`, `printLegendSheetOnly`, the `safetyDrillCost` / `totalCostSafety` dollar consts (the `*Cents` versions are kept — still consumed by the print report + total), the `resourcesModalOpen` / `setResourcesModalOpen` and `checkoutWarning` / `setCheckoutWarning` state, and the `unmappedLog` VALUE (its destructure became `const [, setUnmappedLog]`; the setter still persists the checkout log). Unused imports `fromCents` and `FRAMER_MARGIN_CELLS` were dropped. Everything consumed by `planOrderSupply` / `buildOrderQuote` / `handleShopifyCheckout` / the print DOM containers (`priceDb`, `selectedVendor`, `canvasBaseCost`, `canvasShippingEstimate`, `drillStyle`, `affiliateTag`, `affiliateApp`, `savingsHeadline`, `totalSafetyDrills`, `totalCostSafetyCents`, `setUnmappedLog`) was kept.

## Checkout log-guard tests: retargeted (not retired)
The W4 (corrupt log) and WR-02 (valid-JSON-wrong-type log) guard tests and the W5 (canvas-download failure) test were **retargeted** onto the now-reachable OrderScreen CTAs (`order-cart-cta` / `order-download-canvas-cta`) at step 4, so the corrupt-log read/repair and download-error coverage is preserved on the live path — not dropped. The file-level `compileShopifyCartLink` mock returns an unmapped item `['939']`, so the guard branch runs; the D-08 banner now carries the "could not read the saved unmapped-colors log" note (folded in alongside the unmapped caveat), and the log is repaired to `['939']`. `window.open` is stubbed for jsdom. The price-config-grid, commission-quote, unmapped-log-settings and print WR-01 price-grid tests had no canvas-first home (SuppliesScreen is read-only) and were retired with inline strangler notes.

## Decisions Made
- **Banner note accumulation, not clobber:** `handleShopifyCheckout` builds a `notes[]` array so the corrupt-log fallback message and the unmapped/too-long caveats coexist on one banner string — the corrupt-log guard message is preserved even when the unmapped caveat also fires, keeping the retargeted W4/WR-02 assertions honest.
- **Cart always opens on the warning branch:** matching the plan's D-08 instruction — the deleted modal used to gate the open behind a "Proceed anyway" button; the banner is non-blocking, so the cart opens directly for the mapped colors while the caveat is surfaced.

## Deviations from Plan

None — plan executed exactly as written. (The W4/WR-02/W5 tests were retargeted onto the OrderScreen path, which the plan explicitly PREFERRED over retirement.)

## Issues Encountered
None — tsc was clean after the first deletion pass and the full suite stayed green.

## Known Stubs
None — deletion-only plus one banner refactor; no placeholder/empty-data surfaces introduced.

## Threat Flags
None — no new network endpoints, auth paths, or trust-boundary surface. The single cart new-tab open preserves `noopener,noreferrer` (T-26-07); the banner message is a fixed, app-authored text node (T-26-08).

## User Setup Required
None.

## Next Phase Readiness
- Single UI tree shipped green: `npx tsc --noEmit` clean; `npx vitest run` = **385 passed / 0 skipped** (>= 240). No change to `index.css` print rules or the Ctrl+P canvas-grid print path.
- 26-04 owns the D-08 grep-gate + the remaining banner / Save-modal / error-banner re-token to Atelier light (the retained `bg-slate-950/80` Save-modal backdrop + `rose-950` banner are deliberately left for that plan).

## Self-Check: PASSED

All deleted files confirmed gone (Step3Canvas.tsx, flags.ts, flags.test.ts); both task commits present (135cc25, 1588dd6); SUMMARY.md exists on disk.
