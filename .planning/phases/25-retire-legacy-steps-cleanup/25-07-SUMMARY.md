---
phase: 25-retire-legacy-steps-cleanup
plan: 07
subsystem: ui
tags: [ui, wizard, canvasworkspace, atelier, preact, tailwind, d-05, d-07, gap-1, sc8]

# Dependency graph
requires:
  - phase: 25-02
    provides: "The shipped view-mode switcher + zoom HUD (as floating overlays inside CanvasWorkspace)"
  - phase: 25-05
    provides: "The fixed 3-zone AtelierShell (Zone 1 step-bar / Zone 2 scroll / Zone 3 bottomBar Back·Next)"
provides:
  - "CanvasControlBar — a pure/props-only bottom control strip (view-mode switcher + zoom + low-zoom warning) rendered as normal-flow chrome"
  - "AtelierShell canvasControls slot — an in-flow shrink-0 no-print strip in Zone 3 above the Back/Next bar"
  - "Full-height Refine canvas: the raster region fills the space between the top step-bar and the bottom chrome, no float over the raster"
affects: [phase-26, canvas-first, wizard, refine-step]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Canvas chrome as in-flow Zone-3 slot content (not absolute overlay) — parent owns positioning, the strip is a plain flex row"
    - "Pure/props-only screen extraction (P20 D-01): App remains the sole owner of viewportMode/zoom callbacks/zoomScale"

key-files:
  created:
    - src/features/wizard/CanvasControlBar.tsx
    - src/features/wizard/__tests__/CanvasControlBar.test.tsx
  modified:
    - src/features/wizard/CanvasWorkspace.tsx
    - src/features/wizard/AtelierShell.tsx
    - src/App.tsx

key-decisions:
  - "Relocated switcher + zoom into AtelierShell Zone 3 as an in-flow strip rather than re-styling the absolute overlay — completes D-07 bottom-snap correctly and gives Zone 2 the full height (D-05)."
  - "Preserved the Fit button's hidden <span>Zoom</span> in CanvasControlBar so the existing integration test that finds the Fit control by textContent 'Zoom' stays green."
  - "Gated the CanvasControlBar composition on wizard.step === 2 (the only step the canvas is visible), reusing the same viewer-wrapped zoom callbacks App already passed to CanvasWorkspace."

patterns-established:
  - "Zone-3 canvas chrome: AtelierShell renders canvasControls as a shrink-0 no-print strip above bottomBar; both shrink-0 so the flex-1 min-h-0 Zone 2 keeps filling the height."

requirements-completed: []

coverage:
  - id: D1
    description: "CanvasControlBar renders the view-mode switcher (Grid Colors / Grid + Symbols / Original Photo) with aria-pressed on the active mode; clicking a segment calls setViewportMode with the matching mode."
    verification:
      - kind: unit
        ref: "src/features/wizard/__tests__/CanvasControlBar.test.tsx#renders exactly three view-mode segments with the contract labels + aria-pressed on the active mode"
        status: pass
      - kind: unit
        ref: "src/features/wizard/__tests__/CanvasControlBar.test.tsx#calls setViewportMode with the matching mode when a segment is clicked"
        status: pass
    human_judgment: false
  - id: D2
    description: "Zoom in/out/fit controls render in grid/symbols mode (each with its aria-label + 44px touch target) and fire onZoomIn/onZoomOut/onFit; suppressed in reference mode."
    verification:
      - kind: unit
        ref: "src/features/wizard/__tests__/CanvasControlBar.test.tsx#renders the three zoom buttons in grid/symbols mode and fires the matching callbacks"
        status: pass
      - kind: unit
        ref: "src/features/wizard/__tests__/CanvasControlBar.test.tsx#does NOT render the zoom buttons in reference mode, but keeps the switcher"
        status: pass
      - kind: integration
        ref: "src/__tests__/integration.test.tsx#triggers fitToContainer when Fit to Container button is clicked"
        status: pass
    human_judgment: false
  - id: D3
    description: "The control strip is normal-flow chrome (no absolute/fixed/bottom positioning) and the low-zoom warning appears only in symbols mode below the ~10px cell threshold."
    verification:
      - kind: unit
        ref: "src/features/wizard/__tests__/CanvasControlBar.test.tsx#roots the strip in normal flow — no absolute/fixed positioning token"
        status: pass
      - kind: unit
        ref: "src/features/wizard/__tests__/CanvasControlBar.test.tsx#shows the low-zoom warning only in symbols mode below the ~10px cell threshold"
        status: pass
    human_judgment: false
  - id: D4
    description: "Toggling Original Photo still hides the single-mount canvas (adds `hidden`) and reveals the reference image; toggling back to Grid Colors restores it — the canvas is never remounted."
    verification:
      - kind: integration
        ref: "src/__tests__/integration.test.tsx#supports toggling between Grid View and Original Photo modes"
        status: pass
    human_judgment: false
  - id: D5
    description: "On Refine the canvas viewport fills the vertical space between the top step-bar and the bottom control/Back·Next chrome, with a centered, uncropped default fit view and nothing floating over the raster (GAP-1 / UAT Test 29 SC8)."
    verification:
      - kind: manual_procedural
        ref: "UAT Test 29 SC8 re-walk — load an image, land on Refine, confirm switcher+zoom sit in the bottom strip and the canvas fills the full height uncropped"
        status: unknown
    human_judgment: true
    rationale: "Full-height framing + no-float-over-raster is a visual layout judgment that automated jsdom tests (no real layout engine) cannot confirm; requires a human UAT re-walk."

# Metrics
duration: 5min
completed: 2026-07-16
status: complete
---

# Phase 25 Plan 07: Relocate Refine Canvas Chrome to the Bottom Control Strip (GAP-1 / SC8) Summary

**The Grid/Grid+Symbols/Original switcher and the zoom in/out/fit controls now live in a pure `CanvasControlBar` mounted as an in-flow AtelierShell Zone-3 strip above Back/Next — nothing floats over the canvas raster and the Refine viewport fills the full height.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-16T17:49:53Z
- **Completed:** 2026-07-16T17:54:58Z
- **Tasks:** 3
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- New pure/props-only `CanvasControlBar` renders the relocated view-mode switcher + zoom controls + low-zoom warning as normal-flow chrome (no `absolute`/`fixed`/`bottom-*` token), locked by a 7-case unit test.
- `CanvasWorkspace` stripped of the floating top zoom HUD and the absolute `bottom-16` switcher overlay; its props no longer carry `setViewportMode`/`onZoomIn`/`onZoomOut`/`onFit`/`zoomScale` (it keeps only `viewportMode` for the canvas hidden/reference + hint-pill gates).
- `AtelierShell` gained an optional `canvasControls` Zone-3 slot (a `shrink-0 no-print` strip above the Back/Next bar), so Zone 2 (the canvas) fills the remaining height (D-05); App composes `CanvasControlBar` there gated on `wizard.step === 2` (D-07 bottom-snap done correctly).
- Full suite stays green (372 passed / 7 skipped) and `npm run build` (tsc && vite build) exits 0; the single-mount canvas is never remounted and no engine signature changed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the pure CanvasControlBar bottom control strip + its unit test** - `a637687` (feat, TDD)
2. **Task 2: Strip the top zoom HUD + floating switcher from CanvasWorkspace** - `2c287ad` (refactor)
3. **Task 3: Add the canvasControls Zone-3 slot to AtelierShell and compose CanvasControlBar in App** - `64b192f` (feat)

**Plan metadata:** committed with SUMMARY.md + STATE.md + ROADMAP.md (docs commit)

## Files Created/Modified
- `src/features/wizard/CanvasControlBar.tsx` - New pure control strip: view-mode switcher, zoom in/out/fit, low-zoom warning; normal-flow, props-only.
- `src/features/wizard/__tests__/CanvasControlBar.test.tsx` - Render-contract test (null render, labels, aria-pressed, zoom callbacks, reference suppression, low-zoom threshold, not-absolute root).
- `src/features/wizard/CanvasWorkspace.tsx` - Removed the floating zoom HUD + switcher overlays; trimmed props to `viewportMode`; kept canvas, print legends, reference image, hint pill, loading overlay.
- `src/features/wizard/AtelierShell.tsx` - Added optional `canvasControls` prop rendered as a `shrink-0 no-print` strip in Zone 3 above `bottomBar`.
- `src/App.tsx` - Imported + composed `CanvasControlBar` into `AtelierShell.canvasControls` (gated on step 2); removed the relocated props from the `CanvasWorkspace` usage.

## Decisions Made
- Relocated the chrome into Zone 3 as an in-flow strip rather than re-styling the absolute overlay — this completes D-07's bottom-snap correctly and hands Zone 2 the full vertical frame (D-05).
- Kept the Fit button's hidden `<span>Zoom</span>` so the existing integration test that locates the Fit control by `textContent` containing "Zoom" remains green.
- Composed `CanvasControlBar` only on `wizard.step === 2`, reusing the exact `viewerRef.current?.…` zoom wrappers App already owned (no new state, `viewer.ts` untouched).

## Deviations from Plan

None - plan executed exactly as written. (Task 2 leaves a transient cross-file type reference in App.tsx that Task 3 resolves; no pre-commit hook is configured in this repo, and the full `tsc && vite build` is green after Task 3 as the plan sequences.)

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- GAP-1 / SC8 is closed pending the UAT Test 29 SC8 human re-walk (D5 coverage, `human_judgment: true`).
- Phase 26 strangler guardrail preserved: `Step3Canvas.tsx`, the three fulfillment handlers, the `slate-*` fulfillment modals, `flags.ts`, `viewer.ts`, and `src/index.css` were not touched.
- Plan 25-08 (SuppliesScreen) remains untouched and independent.

## Self-Check: PASSED

- Files verified on disk: CanvasControlBar.tsx, CanvasControlBar.test.tsx, 25-07-SUMMARY.md.
- Commits verified in git log: a637687 (Task 1), 2c287ad (Task 2), 64b192f (Task 3).
- Build green (`tsc && vite build` exit 0); full vitest suite 372 passed / 7 skipped.

---
*Phase: 25-retire-legacy-steps-cleanup*
*Completed: 2026-07-16*
