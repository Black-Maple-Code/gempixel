---
phase: 25-retire-legacy-steps-cleanup
reviewed: 2026-07-16T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - src/App.tsx
  - src/engine/viewer.ts
  - src/features/screens/RefineScreen.tsx
  - src/features/screens/SuppliesScreen.tsx
  - src/features/wizard/AtelierShell.tsx
  - src/features/wizard/CanvasControlBar.tsx
  - src/features/wizard/CanvasWorkspace.tsx
  - src/features/wizard/StepBar.tsx
  - src/__tests__/App.test.tsx
  - src/__tests__/integration.test.tsx
  - src/__tests__/print.test.tsx
  - src/engine/__tests__/viewer.test.ts
  - src/features/screens/__tests__/RefineScreen.test.tsx
  - src/features/screens/__tests__/SuppliesScreen.test.tsx
  - src/features/wizard/__tests__/CanvasControlBar.test.tsx
findings:
  critical: 0
  warning: 5
  info: 5
  total: 10
status: issues_found
---

# Phase 25: Code Review Report

**Reviewed:** 2026-07-16
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 25 (retire-legacy-steps-cleanup) composes the fixed 3-zone `AtelierShell`,
relocates the canvas chrome into a bottom `CanvasControlBar`, adds a persistent
`isFitMode` flag to the viewer, wires an auto-recompute-on-dimension-change flow,
and makes print work from any step. The new pure screens (Refine/Supplies) and
their tests are clean and well-factored. No security vulnerabilities, injection
sinks, or `dangerouslySetInnerHTML` were found — error banners are text-only and
outbound links carry `rel="noopener noreferrer"`.

The material findings are all about **the strangler cleanup being incomplete**.
`USE_NEW_SUPPLIES` is hard-`true`, which turns the entire `Step3Canvas` branch
into dead code — and that dead branch is the *only* UI wiring for canvas-PNG
export, combined-sheet export, print-supply-report, print-legend, and Shopify
checkout. In the shipped build those actions are unreachable, and the phase's own
"re-token off dark slate" goal left three modals + both error banners fully
dark-slate styled. The new `isFitMode` viewer API is added and fully unit-tested
but never consumed by production. There is also a genuine timing race in the
debounced custom-size recompute. No BLOCKERs, but the WARNINGs below represent
real behavior regressions and data-integrity edges, not style nits.

## Warnings

### WR-01: Canvas export / print-report / checkout are unreachable in the shipped build

**File:** `src/App.tsx:993-1062`, `src/App.tsx:1214-1259`, `src/App.tsx:1615-1646`
**Issue:** `USE_NEW_SUPPLIES` is a hard-coded `true` (`src/features/screens/flags.ts:18`),
so the `Step3Canvas` ternary branch never renders. Yet `printReport`,
`printLegendSheetOnly`, `handleDownloadCanvasOnly`, `handleDownloadCombinedCanvasSheet`,
and `handleShopifyCheckout` are referenced *only* inside that dead branch (grep
confirms lines 1640-1644 are their sole call sites). `OrderScreen` offers only the
JSON "Download order packet" — no canvas PNG, no supply-report print, no checkout.
Net effect: the always-in-DOM `.supply-report-print-container` (App.tsx:1920) can
never be revealed (its only trigger is the unreachable `printReport`), and the
core product capability CLAUDE.md calls out — "exports printable canvases" — has
no reachable affordance. Comments mark this a deliberate D-01 deferral to Phase 26,
but the current build ships without those buttons. Treat as a BLOCKER if no
re-home lands before release.
**Fix:** Re-home the still-needed actions (canvas PNG download, print supply
report, checkout) onto the Supplies/Order screens now, or gate the release on
Phase 26. If the deferral is accepted, at minimum delete the dead `Step3Canvas`
import + branch + its orphaned handlers so the shipped bundle does not carry
unreachable code paths (see IN-01).

### WR-02: Debounced custom-recompute timer is never cancelled on SizeCard select, reset, or project load

**File:** `src/App.tsx:585-596` (schedule), `src/App.tsx:1290-1301` (SizeCard), `src/App.tsx:409-444` (reset), `src/App.tsx:337-407` (load)
**Issue:** `scheduleCustomRecompute` arms a 500ms timer that calls
`handleRecomputeMatch(nextCols, nextRows)` with the captured custom dims. The timer
is cleared only on the next custom edit and on unmount (App.tsx:634) — **not** when
the user commits a different way inside that 500ms window:
- Type a custom width, then click a SizeCard within 500ms: `onSelectSize` commits
  the SizeCard dims immediately, then the stale timer fires and re-commits
  `matchInputs` to the *old custom* dims. The canvas + a subsequent Save then reflect
  the old custom grid while the SizeCard shows `aria-pressed=true` — a silent
  selection/mismatch.
- Type a custom size, then click "New" (`resetWorkspace`) or load a project: the
  timer's captured `image` is still truthy, so it re-fires the worker on the *old*
  image/dims after the workspace was reset — the "New" button appears not to fully
  clear.
**Fix:** Clear `customRecomputeTimerRef` at the top of `onSelectSize`,
`handleRecomputeMatch`, `resetWorkspace`, and `loadProject`:
```ts
const cancelCustomRecompute = () => {
  if (customRecomputeTimerRef.current !== null) {
    clearTimeout(customRecomputeTimerRef.current);
    customRecomputeTimerRef.current = null;
  }
};
// call cancelCustomRecompute() before each explicit commit/reset/load
```

### WR-03: "Preparing" loading phase renders "Recomputing…" even on a first-ever upload

**File:** `src/features/wizard/CanvasWorkspace.tsx:150-155`
**Issue:** The indeterminate `loadingPhase === 'preparing'` branch renders
`Recomputing…`. The component's own doc comment (lines 141-147) says this phase
should read "Preparing image…". On a fresh upload nothing is being *re*-computed,
so the copy is misleading — a small but user-visible regression for a
design-conscious flow.
**Fix:** Restore the phase-accurate copy:
```tsx
<span className="text-sm font-medium text-ink">Preparing image…</span>
```
(or branch the label on whether a prior match exists if the recompute wording is
wanted for dimension changes specifically).

### WR-04: Leftover dark-mode remnants after the "re-token off dark slate" phase

**File:** `src/App.tsx:1505-1522` (banners), `src/App.tsx:1660-1890` (modals)
**Issue:** The phase re-tokened the canvas viewport off dark slate and retired dark
mode (App.tsx:196-198 even purges the persisted theme key), but the three modals
(Artist Resources, Checkout Warning, Save Project) are still fully dark-slate
styled — `bg-slate-900/950`, `text-white`, `text-slate-400`, indigo/violet gradient
text — and both error banners use `bg-rose-950/95 text-rose-100`. On the light
Atelier (cream) shell these render as jarring dark islands, exactly the
theme-remnant inconsistency this cleanup phase targets.
**Fix:** Re-token these surfaces onto the Atelier design tokens (`bg-panel`,
`text-ink`, `border-border`, `bg-warn/15`, etc.) as the shell/screens already do.

### WR-05: `isFitMode` / `isInFitMode()` is added and fully tested but never consumed by production code

**File:** `src/engine/viewer.ts:24,205,209-211,509`; `src/App.tsx:666-695`
**Issue:** The new `isFitMode` flag + `isInFitMode()` accessor have 11 assertions in
`viewer.test.ts`, but grep shows `isInFitMode` is referenced *nowhere* outside the
test — App.tsx only mentions `isFitMode` in a comment (line 644). The dimension-change
re-fit effect (App.tsx:683-693) calls `fitToContainer()` unconditionally whenever
`lastFitDimsRef` changes, without consulting `isInFitMode()`. So if the intent was
"don't yank a user who has manually zoomed back to fit on a size change," that guard
was never wired — a user-zoomed viewport is still force-refit on every committed
dimension change. Either the feature is incomplete (missing the guard) or the API is
dead surface added during a cleanup phase.
**Fix:** Decide the intent. To honor it, guard the re-fit:
```ts
if (viewerRef.current.isInFitMode() && lastFitDimsRef.current !== fitDimsKey) {
  viewerRef.current.fitToContainer();
}
```
Otherwise remove the unused `isInFitMode()` API and its tests.

## Info

### IN-01: Orphaned state cluster feeds only the dead `Step3Canvas` branch

**File:** `src/App.tsx` (declarations at 261-294; effect at 296-313; `sizingAdviceData` at 315-335)
**Issue:** With `USE_NEW_SUPPLIES` hard-true, `selectedVendor`, `canvasShippingEstimate`,
`drillPacketCost`, `priceDb`/`updatePriceDb`, `affiliateTag`, `affiliateApp`,
`unmappedLog`/`setUnmappedLog`, and `sizingAdviceData` are consumed only by the
dead branch (canvasBaseCost is still read by the always-mounted total math, so keep
that one). The canvas-cost recompute effect (296-313) updates state nothing live
renders.
**Fix:** When the WR-01 deferral resolves, delete this cluster with the branch. If
kept for Phase 26, add a single tracking comment so it is not mistaken for live wiring.

### IN-02: Dead sort branches + `hexToHue` after the legend sort was frozen

**File:** `src/App.tsx:137-156` (`hexToHue`), `src/App.tsx:202-203`, `src/App.tsx:1110-1128`
**Issue:** `sortBy` is frozen to `'quantity'` and `sortAsc` to `false` (interactive
setters removed). The `sortedMatches` comparator still branches on `'name'`, `'code'`,
and `'color'`, and the `'color'` branch is the sole caller of `hexToHue` — all
unreachable.
**Fix:** Collapse the comparator to the quantity path and remove `hexToHue`
(and its export if untested elsewhere).

### IN-03: `selectedPreset` is write-only state

**File:** `src/App.tsx:189`
**Issue:** `const [, setSelectedPreset]` — the setter is called from ~6 handlers but
the value is never read by any live screen (acknowledged in the comment). It exists
only to satisfy calls that now no-op.
**Fix:** Remove the state and the `setSelectedPreset('custom')` calls in the cleanup.

### IN-04: Stale dark-slate defaults + retired-theme comments in the viewer

**File:** `src/engine/viewer.ts:6,45-46,264,272`; `src/App.tsx:615,1090`
**Issue:** `roundBacking = '#2D3748'` and `gridGap = '#0d0d13'` are dark-slate defaults;
the class doc still says "showing neutral slate backing" and the setters are labelled
"themed" — all referencing the retired theme system. The unknown-code fallback
(`this.colorMap.get(code) || this.roundBacking`) paints a dark-slate cell on the now
light canvas, and App's swatch fallbacks reuse the same `#2D3748`.
**Fix:** Re-base the defaults/fallbacks to a light-neutral token and update the
comments to drop "themed"/"slate" language.

### IN-05: Skipped tests now permanently guard unreachable code

**File:** `src/__tests__/print.test.tsx:327`; `src/__tests__/App.test.tsx:190,234,600,793,815,842`
**Issue:** Six `it.skip` cases cover the per-bag price grid, unmapped-colors log +
"Clear Log", the canvas-download error banner (W5), and the checkout-log guards
(W4/WR-02). Those code paths still ship (the guards live in `handleShopifyCheckout`
/ `handleDownloadCanvasOnly`) but are now both **unreachable** (WR-01) and
**untested**. This is accumulating coverage debt around still-present defensive code.
**Fix:** When the actions are re-homed, un-skip and retarget these to the new
surfaces; if the code is deleted, delete the tests with it.

---

_Reviewed: 2026-07-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
