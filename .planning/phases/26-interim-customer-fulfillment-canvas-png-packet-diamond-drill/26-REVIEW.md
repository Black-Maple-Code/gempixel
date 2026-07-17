---
phase: 26-interim-customer-fulfillment-canvas-png-packet-diamond-drill
reviewed: 2026-07-16T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/engine/export.ts
  - src/engine/__tests__/export.test.ts
  - src/features/screens/OrderScreen.tsx
  - src/features/screens/__tests__/OrderScreen.test.tsx
  - src/App.tsx
  - src/__tests__/App.test.tsx
  - src/__tests__/print.test.tsx
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 26: Code Review Report

**Reviewed:** 2026-07-16T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the Phase 26 changes: the additive `drawLegendOnly` renderer, the two-task-section OrderScreen with per-task `canvasDownloaded`/`cartOpened` state, the App.tsx handler re-homing, the strangler deletion of `Step3Canvas`/`flags`/coupled-modals, and the checkout too-long/unmapped branch moving onto the `actionError` banner.

The strangler deletion is clean — no dangling imports of `Step3Canvas` or `flags` remain (only comment references), and the deleted `flags.test.ts` has no orphaned references. `drawLegendOnly` reuses the shared `drawLegendItems` draw so swatch/symbol/label content cannot diverge from the combined sheet, its canvas is correctly sized to fit all rows/columns without clipping, and the honesty guardrails hold (the drills sub-terminal reads "Cart opened ↗", never "Ordered"; external navigation keeps `noopener,noreferrer`). Ship-to inputs are plain text with no injection sink. No security vulnerabilities, crashes, or data-loss paths found.

The concerns are all in the **done-state reset matrix** and the **shared `actionError` banner reconciliation**: the terminals can assert freshness for artifacts that no longer match the current design (or that were never affected by the edit that reset them), and an imperative action can permanently drop an active derived warning. These are correctness/honesty degradations, not blockers.

## Warnings

### WR-01: Done-state terminals go stale on upstream design edits — no reset on size / shape / kit / color changes

**File:** `src/App.tsx:1354-1363` (reset sites), reset setters at `src/App.tsx:364-365, 418-419, 1356-1357, 1361-1362`
**Issue:** `canvasDownloaded` / `cartOpened` are reset only by `loadProject`, `resetWorkspace`, `handleFinishChange`, and `handleShipToChange`. They are NOT reset by any of the design-mutating handlers reachable after a download/cart-open: SizeCard selection / custom size (`onSelectSize`, `handleRecomputeMatch`, `scheduleCustomRecompute`), drill shape (`onShapeChange` → `setDrillStyle`), base kit (`onKitChange`), color reduce (`onColorTargetChange`), or exclusions (`toggleColorExclusion`). A user can download the grid PNG / open the drill cart on step 4, go back to Refine, change the size or drill shape (which changes the grid, the legend, and the drill plan the cart was built from), and return to Order where "Downloaded ✓" / "Cart opened ↗" still assert the on-disk files and opened cart reflect the current design — they do not. This is the exact honesty invariant the phase guards, applied in the wrong direction.
**Fix:** Reset both per-task done-states whenever the committed match or drill plan changes. For example, drive the reset from `matchInputs` / `drillStyle` identity in an effect, or clear them inside `handleRecomputeMatch` and `setDrillStyle`'s call sites:
```ts
useEffect(() => {
  setCanvasDownloaded(false);
  setCartOpened(false);
  // guard against clearing on the initial mount if desired
}, [matchInputs, drillStyle, selectedBaseKit, targetColorCount, excludedColors]);
```

### WR-02: `cartOpened` is reset by canvas-finish and ship-to edits, though the drill cart is independent of both

**File:** `src/App.tsx:1354-1363`
**Issue:** `handleFinishChange` and `handleShipToChange` both call `setCartOpened(false)`. The drill cart (`handleShopifyCheckout`) is built purely from `matchResult.counts` + `drillStyle` + pricing — it does not depend on the canvas `finish` (a fixed enum with no price impact, per the code's own RESEARCH-Q3 note) or on `shipTo` (which is embedded only in the JSON packet). So editing the shipping address or toggling Trimmed/Image-wrap silently erases a valid "Cart opened ↗" confirmation for a cart that is still exactly as opened. This is the inverse of WR-01: the reset fires on edits that do not invalidate the cart. (The `canvasDownloaded` reset on these edits is defensible for the JSON packet, which embeds finish + ship-to, but is a false invalidation for the three PNGs, which embed neither — the coarse shared flag makes this imprecise.)
**Fix:** Do not couple `cartOpened` to finish/ship-to edits — remove `setCartOpened(false)` from both handlers. Keep `setCanvasDownloaded(false)` only if you accept the coarse-flag imprecision, or split the packet-download done-state from the PNG-download done-state so finish/ship-to invalidate only the packet.

### WR-03: An imperative `setActionError(null)` permanently drops an active derived unpriced / unmapped-shape warning

**File:** `src/App.tsx:1163-1184` (reconciling effect) with clear-then-act handlers at `src/App.tsx:966, 993, 1028, 1188, 1375`
**Issue:** The derived warning (unpriced bag sizes + `These colors have no {shape} drills available`) is written to the shared `actionError` via an effect that only re-runs on `[unpricedColorsKey, unmappedShapeKey, drillStyle]`. Every action handler starts with `setActionError(null)` (clear-then-act). When a derived warning is showing and the user fires any action that does not change those three deps — e.g. clicking "Download canvas (grid)" or "Open drill cart" — the warning is cleared and the effect never re-fires to restore it, so a legitimate "these colors have no square drills — switch shape or exclude them" advisory silently disappears and the user proceeds unaware. Worse, if `handleShopifyCheckout` then leaves its own `notes` on `actionError`, a later dep change makes the reconciling effect see `current !== prevDerived && current !== null`, so it declines to write the NEW derived warning — the banner can get stuck on stale checkout notes and suppress a fresh warning.
**Fix:** Separate the persistent derived warning from the one-shot imperative banner (two pieces of state, rendered as two banners), or have the reconciling effect re-assert its warning unconditionally when its deps evaluate non-null rather than gating on the previous-value equality check. At minimum, do not `setActionError(null)` for a value the effect owns.

## Info

### IN-01: `FRAMER_MARGIN_CELLS` is exported but has no external consumer

**File:** `src/engine/export.ts:22`
**Issue:** The constant is used internally at line 52 (`drawCanvasOnly`), and the doc comment says it is "Exported so the sizing advice can recommend a matching rolled-canvas order size," but no module imports it (App.tsx imports only the four renderers + `triggerCanvasDownload`). The `export` keyword is currently dead surface area.
**Fix:** Drop `export` until a consumer exists, or wire the promised sizing-advice consumer.

### IN-02: `handleDownloadOrderPacket` re-implements the anchor / `createObjectURL` / deferred-revoke idiom instead of reusing it

**File:** `src/App.tsx:1397-1406`
**Issue:** The packet download hand-rolls the same Blob → anchor → `click` → deferred `revokeObjectURL(…, 100)` sequence that `triggerCanvasDownload` (`export.ts:352-380`) already encapsulates. Duplicated logic invites drift (e.g. the two revoke delays or `document.body` append/remove behaviors diverging over time).
**Fix:** Extract a shared `triggerBlobDownload(blob, filename)` in `export.ts` and have both the canvas PNG path and the JSON packet path call it.

### IN-03: `cartOpened` is set true even when `window.open` returns null (popup blocked)

**File:** `src/App.tsx:1250-1252`
**Issue:** `setCartOpened(true)` runs unconditionally after `window.open(...)`. If a popup blocker prevents the tab, the honest "Cart opened ↗" terminal still appears. Note that with `noopener` the return value is unreliable across browsers, so this cannot be fully guarded — flagged for awareness rather than a hard fix.
**Fix:** Where feasible, only flip the done-state when `window.open(...)` returns a non-null handle; otherwise leave copy that does not over-promise (e.g. "Opening cart…").

---

_Reviewed: 2026-07-16T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
