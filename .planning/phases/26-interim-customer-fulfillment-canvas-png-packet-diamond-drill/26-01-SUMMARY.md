---
phase: 26-interim-customer-fulfillment-canvas-png-packet-diamond-drill
plan: 01
subsystem: export
tags: [canvas, png, legend, renderer, diamond-art]

# Dependency graph
requires:
  - phase: 22
    provides: "frozen canvas renderers (drawCanvasOnly, drawCombinedCanvasSheet, triggerCanvasDownload)"
provides:
  - "drawLegendOnly — additive engine export returning a legend-band-only HTMLCanvasElement for the standalone legend PNG (SC1)"
  - "drawLegendItems — internal shared per-item legend draw helper keeping the combined sheet and standalone legend in sync"
affects: [26-02, OrderScreen, App]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive engine export (no frozen-signature change) — the one sanctioned Phase-26 engine addition (D-05)"
    - "Shared internal draw helper extracted from an existing renderer, called by both, without altering the exported signature/output"

key-files:
  created: []
  modified:
    - src/engine/export.ts
    - src/engine/__tests__/export.test.ts

key-decisions:
  - "Extracted the combined-sheet legend loop into a private drawLegendItems helper (not the D-05 escape hatch) — the extraction left drawCombinedCanvasSheet's exported signature and observable output byte-identical, so no fallback/trim was needed."
  - "drawLegendOnly options are a subset of CombinedSheetOptions (leftLegendColors, rightLegendColors, symbolMap, optional cellScale) so no caller invents new data; cellScale is accepted for call-site symmetry but the legend band is grid-independent so it is not destructured (avoids noUnusedLocals)."
  - "Legend-band canvas is sized from its own column metrics (numCols/itemsPerCol/itemHeight/topPadding + a fixed 70px colSpacing and 10px side padding), never the grid-inclusive canvasWidth."

patterns-established:
  - "Sanctioned additive-export pattern under a signature freeze: add a new export + optionally an internal shared helper, and assert via git diff that the frozen exports' `export function` lines are byte-identical."

requirements-completed: [ORDER-04]

coverage:
  - id: D1
    description: "drawLegendOnly renders the color legend band alone as an HTMLCanvasElement (the standalone legend PNG source for SC1)"
    requirement: "ORDER-04"
    verification:
      - kind: unit
        ref: "src/engine/__tests__/export.test.ts#drawLegendOnly returns a canvas with positive, finite width and height"
        status: pass
      - kind: unit
        ref: "src/engine/__tests__/export.test.ts#sizes to the legend band only — strictly narrower than the combined sheet"
        status: pass
    human_judgment: false
  - id: D2
    description: "Phase-22-frozen renderers (drawCanvasOnly, drawCombinedCanvasSheet, triggerCanvasDownload) keep byte-identical exported signatures"
    requirement: "ORDER-04"
    verification:
      - kind: automated
        ref: "git diff src/engine/export.ts | grep on `export function (drawCanvasOnly|drawCombinedCanvasSheet|triggerCanvasDownload)` returns empty"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-07-16
status: complete
---

# Phase 26 Plan 01: Add drawLegendOnly renderer Summary

**Added the additive `drawLegendOnly` engine export (plus a shared internal `drawLegendItems` helper) so the Order step can download the color legend as its own PNG — the Phase-22-frozen renderer signatures stay byte-identical and zero new dependencies were added.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-16T16:38Z
- **Completed:** 2026-07-16T16:45Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `drawLegendOnly` export added to `src/engine/export.ts`, returning a legend-band-only `HTMLCanvasElement` (swatch backing, black stroke, contrast symbol, 9px mono DMC label) sized to the legend alone — no grid, margins, or folding guides.
- Preferred D-05 outcome achieved (no escape hatch): the combined sheet's per-item legend loop was extracted into a private `drawLegendItems` helper called by BOTH renderers, keeping them in sync while leaving `drawCombinedCanvasSheet`'s exported signature and observable output byte-identical.
- Unit coverage added proving return type, band-only sizing (legend width < combined-sheet width for the same legend + real grid), the 2- and 3-column branches, and missing-symbol fallback.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add additive drawLegendOnly renderer (D-05)** - `c1e45cb` (feat)
2. **Task 2: Unit coverage for drawLegendOnly** - `f8d1ef2` (test)

## Files Created/Modified
- `src/engine/export.ts` - Added `LegendOnlyOptions` interface, private `drawLegendItems` shared helper, and the exported `drawLegendOnly`; refactored the combined sheet's inline legend loop to call the helper (signature/output unchanged).
- `src/engine/__tests__/export.test.ts` - Added a `describe('drawLegendOnly')` block (4 tests).

## Decisions Made
- Took the STRONGLY PREFERRED path over the D-05 escape hatch: extraction was verified not to change the frozen renderer's exported signature or output, so the standalone legend ships as the third PNG source (SC1 kept fully in scope — no third-PNG trim).
- Accepted `cellScale` in the options interface for call-site symmetry with the other renderers, but left it out of the destructure since the legend band is grid-independent (keeps `noUnusedLocals`/`noUnusedParameters` clean).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. `noUnusedLocals` was anticipated (both flags on in tsconfig) and handled by not destructuring the unused `cellScale`.

## User Setup Required
None - no external service configuration required.

## Verification
- `npx tsc --noEmit` exits 0.
- `npx vitest run src/engine/__tests__/export.test.ts` — 8 passed (4 new `drawLegendOnly` tests).
- `npx vitest run` — 377 passed, 7 skipped (37 files), well above the ≥240 regression floor.
- `grep -c "export function drawLegendOnly" src/engine/export.ts` = 1.
- `git diff src/engine/export.ts` shows the three frozen `export function` signature lines byte-identical (empty diff on those lines).
- `git diff --exit-code package.json package-lock.json` clean — zero new dependencies.

## Self-Check: PASSED
- FOUND: src/engine/export.ts (drawLegendOnly export present, count = 1)
- FOUND: src/engine/__tests__/export.test.ts (drawLegendOnly describe block, 4 tests passing)
- FOUND commit: c1e45cb (feat 26-01 drawLegendOnly)
- FOUND commit: f8d1ef2 (test 26-01 drawLegendOnly coverage)
