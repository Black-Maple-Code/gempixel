---
phase: 26-interim-customer-fulfillment-canvas-png-packet-diamond-drill
fixed_at: 2026-07-17T00:34:18Z
review_path: .planning/phases/26-interim-customer-fulfillment-canvas-png-packet-diamond-drill/26-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 26: Code Review Fix Report

**Fixed at:** 2026-07-17T00:34:18Z
**Source review:** .planning/phases/26-interim-customer-fulfillment-canvas-png-packet-diamond-drill/26-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (Warnings; Info findings IN-01/IN-02/IN-03 out of scope for `critical_warning`)
- Fixed: 3
- Skipped: 0

All fixes landed in a single file (`src/App.tsx`) in disjoint regions and were committed
atomically per finding. `npx tsc --noEmit` passes clean after each commit (Tier 2
verification). WR-01 and WR-03 are state/effect-behavior changes flagged for human
verification — the existing Phase 26 test suite (`src/__tests__/App.test.tsx`,
`src/__tests__/print.test.tsx`, `src/features/screens/__tests__/OrderScreen.test.tsx`)
should be run to confirm no regression and to add coverage for the new reset/banner paths.

## Fixed Issues

### WR-01: Done-state terminals go stale on upstream design edits

**Files modified:** `src/App.tsx`
**Commits:** 42d6393 (initial), 6ed7b54 (regression correction)
**Status:** fixed — verified by test suite (385/385 pass)
**Applied fix:** Added a reset effect that clears both `canvasDownloaded` and `cartOpened`
whenever the committed design changes.

The initial fix (42d6393) keyed the effect on `[matchResult, drillStyle]`. This regressed
4 Order-state tests in `src/__tests__/App.test.tsx`: `matchResult` is the async worker
output whose object identity churns on every match settle independent of a user edit, so
the effect fired the instant the match re-settled after a download — clearing a fresh
"Downloaded ✓" / "Cart opened ↗" (all 4 failures were `expected null to be truthy`).

Corrected (6ed7b54) to key on the committed design inputs the review actually enumerated:
`[matchInputs, drillStyle, selectedBaseKit, targetColorCount, enableReduce, excludedColors,
enableSmoothing, smoothingStrength]`. Each is state that changes only on a genuine design
edit or a project load, so the terminals invalidate on real size/kit/exclusion/reduce/
smoothing/shape changes but persist across the async re-settle. `tsc --noEmit` clean; full
suite 385/385 green (previously-failing Order-state tests now pass).

### WR-02: `cartOpened` reset by canvas-finish and ship-to edits though the cart is independent of both

**Files modified:** `src/App.tsx`
**Commit:** d97d21a
**Status:** fixed
**Applied fix:** Removed `setCartOpened(false)` from both `handleFinishChange` and
`handleShipToChange`. The drill cart depends only on `matchResult.counts` + `drillStyle` +
pricing, so editing finish (a no-price enum) or ship-to (embedded only in the JSON packet)
no longer erases a valid "Cart opened" confirmation. `setCanvasDownloaded(false)` is
retained in both handlers because the JSON packet embeds finish + ship-to and does go
stale on those edits. The cart's done-state is now invalidated only by the WR-01
committed-design-inputs effect.

### WR-03: Imperative `setActionError(null)` permanently drops an active derived warning

**Files modified:** `src/App.tsx`
**Commit:** af6b615
**Status:** fixed: requires human verification
**Applied fix:** Separated the persistent derived advisory from the one-shot imperative
banner (the review's preferred option). Added dedicated `derivedWarning` state; the
reconciling effect now sets it unconditionally (removing the `derivedActionWarningRef`
previous-value gating and the `setActionError` writes), and it renders as its own
non-dismissible banner beside `actionError`. Imperative `setActionError(null)` clears in
the action handlers can no longer drop the derived unpriced/unmapped-shape warning, and a
stale checkout note can no longer suppress a fresh warning. Checkout-specific notes
(manual-add colors, url-too-long, corrupt-log) remain on the imperative `actionError`
banner. Flagged for human verification because it restructures effect + render logic:
confirm the derived banner appears/updates on unpriced/unmapped-shape conditions and does
not loop or double-render alongside the imperative banner.

---

_Fixed: 2026-07-17T00:34:18Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
