---
phase: 23-the-four-screens-in-flow-order
reviewed: 2026-07-15T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/App.tsx
  - src/features/wizard/CanvasWorkspace.tsx
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 23: Code Review Report (gap-closure — viewport-first shell flip)

**Reviewed:** 2026-07-15
**Depth:** standard (delta vs `b7f0c27`)
**Files Reviewed:** 2
**Status:** issues_found

> Scope note: this is a fresh gap-closure review of the "viewport-first shell flip"
> (UAT Test 26), covering only `src/App.tsx` and the new `src/features/wizard/CanvasWorkspace.tsx`.
> It supersedes the earlier resolved 7-file review of the screen components.

## Summary

Reviewed the delta: the extraction of `CanvasWorkspace.tsx` (pure/props-only center-canvas
region) and the App.tsx replacement of the legacy dark 3-column shell (left "My Images" aside
+ right DMC-legend aside + bottom nav) with a centered 1180px cream viewport frame hosting the
four `data-step-panel` screens.

Verdict on the primary invariants:

- **Single-canvas-mount (D-14): sound.** The `<canvas>` lives inside `CanvasWorkspace`, which
  is always rendered inside a `<main>` whose *class* toggles between the step-2 flex layout
  and `hidden` (`display:none`). The element is never gated behind a step conditional, so the
  `CanvasViewer` is never remounted on a step change. Mount still keys on `image || matchResult`
  exactly as before, and the step-2 `useEffect` (`viewerRef.current?.fitToContainer()` on
  `wizard.step === 2`) correctly re-measures the container that reads 0 while hidden. Guarded
  with optional chaining, so a not-yet-created viewer is safe.
- **Dead state cleanup: clean.** `imagesDrawerOpen`, `leftPanelCollapsed`,
  `rightPanelCollapsed`, `supplyListOpen`, `handleHeaderClick`, and the `sortBy/sortAsc`
  setters were removed with zero dangling references (grep-confirmed; `tsc` clean).
- **Relocated controls (New / Save / Back / Next): wired correctly.** IDs, handlers, and the
  `!canEnter(step+1) || nextBlockedByStale` gating are preserved verbatim; no duplicate IDs.
- **State leak on load/reset: none found in the delta.** `loadProject`/`resetWorkspace`
  already reset the order state (finish, shipTo, packetDownloaded) and were not touched here.

One functional regression (print coupling) is worth fixing, plus dead code the flip newly
orphaned. Per scope, the legacy `Step1–4` ternary branches are dead (all four `USE_NEW_*`
flags are `true`) but are deliberately retained for the Phase 25 grep-clean; they are noted
below for completeness only, not weighted.

## Narrative Findings (AI reviewer)

### Warnings

#### WR-01: Canvas print path is now coupled to step 2 — Ctrl+P from Upload/Supplies/Order prints a blank canvas region

**File:** `src/App.tsx:1619` (interacts with the `beforeprint` handler at `src/App.tsx:706-731`)
**Issue:**
Before the flip, the canvas `<main>` was always `print:block`
(`<main className="flex-1 relative flex flex-col min-w-0 print:block">`), so a native browser
print (Ctrl+P) rendered the canvas grid + fold legends from *any* step. After the flip the
`<main>` class is:

```tsx
<main className={wizard.step === 2 ? 'relative flex min-w-0 flex-1 flex-col print:block' : 'hidden'}>
```

On steps 1/3/4 the element is `hidden` (`display:none`) with **no `print:` override**, and the
default `@media print` block (`src/index.css:184`) does not target `main` — it only reveals
`.print-canvas-sheet`, which is a descendant of the now-`display:none` `main` and therefore
stays collapsed. The step panels are all `no-print`, and the always-in-DOM
`.supply-report-print-container` / `.legend-checklist-print-container` only appear under their
explicit `print-only-*-mode` body classes. Net effect: a plain Ctrl+P from any step other than
Refine (2) produces an empty page.

This is compounded by the global `beforeprint` handler, which unconditionally forces
`viewportMode = 'symbols'` and calls `fitToContainer()` regardless of step — it still assumes
the canvas is printable everywhere, but the DOM no longer honors that on steps 1/3/4.

Practical blast radius is limited today because the new `SuppliesScreen`/`OrderScreen` do not
wire the dedicated print/export handlers, so Ctrl+P is the only remaining canvas-print path —
and printing a diamond chart is a core value-prop of the app.

**Fix:** Keep the canvas `<main>` printable regardless of the on-screen step, e.g. give the
hidden branch a print override:

```tsx
<main className={wizard.step === 2
  ? 'relative flex min-w-0 flex-1 flex-col print:block'
  : 'hidden print:block'}>
```

Alternatively add, to the default `@media print` block,
`body:not(.print-only-report-mode):not(.print-only-legend-mode) main { display:block !important }`
so the canvas sheet always surfaces on a plain print. Verify the two explicit modes (which set
`main { display:none }`) still win.

### Info

#### IN-01: Artist Resources modal + `resourcesModalOpen` state are now fully unreachable (trigger deleted)

**File:** `src/App.tsx:216`, `src/App.tsx:1834-1927`
**Issue:** The only control that set `resourcesModalOpen` to `true` was the "Artist Resources"
button in the deleted left-sidebar footer. After the flip, `setResourcesModalOpen(true)` has
no caller (grep-confirmed: only `useState`, the `setResourcesModalOpen(false)` closers, and the
`resourcesModalOpen && (...)` render guard remain), so the ~90-line modal is dead. This is
distinct from the flag-gated legacy `Step1–4` bodies — it is chrome the flip orphaned. Scope
notes the modal is intentionally retained for Phase 25, so this is recorded for the grep-clean,
not as a live defect.
**Fix:** Either re-home an "Artist Resources" trigger into the new shell (e.g. the frame action
row) or delete `resourcesModalOpen`/`setResourcesModalOpen` and the modal block in Phase 25.

#### IN-02: Recent-uploads state and handlers are orphaned in the live flow

**File:** `src/App.tsx:205` (`recentImages`), `src/App.tsx:638-640` (persistence effect), `src/App.tsx:1018` (`loadRecentImage`), `src/App.tsx:1056` (`deleteRecentImage`), `src/App.tsx:210` (`imageFitMode`), `src/App.tsx:190`/`207` (`recsOpen`/`recentUploadsOpen`)
**Issue:** With `USE_NEW_UPLOAD === true`, `UploadScreen` renders and the legacy `Step1Ingest`
branch is unreachable. `recentImages` is still populated on every upload (`src/App.tsx:1001`)
and persisted to localStorage on every change (`src/App.tsx:638`), but the recent-uploads UI
that consumed it lives only in the dead `Step1Ingest`. `loadRecentImage`, `deleteRecentImage`,
`imageFitMode`, `recsOpen`, and `recentUploadsOpen` are likewise consumed only by that dead
branch. Harmless (a small ongoing localStorage write for data nothing displays), and part of
the deliberately-retained legacy surface — noted for Phase 25.
**Fix:** Retire the recent-uploads state/handlers (and the `projectStore.recents` writes)
alongside the `Step1Ingest` removal, or wire a recent-uploads affordance into `UploadScreen`
if the feature is still desired (currently only saved *projects* surface there).

#### IN-03: Legacy export/checkout handlers unreferenced by any live path

**File:** `src/App.tsx:1068` (`printReport`), `src/App.tsx:1078` (`handleDownloadCanvasOnly`), `src/App.tsx:1102` (`handleDownloadCombinedCanvasSheet`), `src/App.tsx:1129` (`printLegendSheetOnly`), `src/App.tsx:1289` (`handleShopifyCheckout`), `src/App.tsx:1283` (`checkoutWarning`)
**Issue:** These handlers are threaded only into the legacy `Step3Canvas`/`Step4Export`
branches, which are unreachable now that `USE_NEW_SUPPLIES`/`USE_NEW_ORDER` are `true`. The new
`SuppliesScreen`/`OrderScreen` prop objects do not include canvas-download, legend/report print,
or Shopify-checkout wiring, so those capabilities are currently absent from the live flow. This
gap predates the shell-flip delta (the screens were built without them in earlier Phase 23
plans), so it is out of this diff's scope — flagged so it is not lost: confirm during Phase 25
whether canvas-PNG export / supply-report print / Shopify checkout are meant to be re-homed into
the new screens or genuinely dropped.
**Fix:** During the Phase 25 strangler cleanup, either re-home the export/print/checkout
affordances into the canvas-first screens or delete the now-orphaned handlers and the
`checkoutWarning` modal with the legacy `Step3/Step4` bodies.

---

_Reviewed: 2026-07-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
