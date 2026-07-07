# Walking Skeleton — GemPixel

**Phase:** 3
**Generated:** 2026-07-07

## Capability Proven End-to-End

An interactive Canvas viewport renders matched DMC drill grids. Users pan the grid by dragging with mouse or touch pointer events, and zoom in/out with the mouse wheel centered exactly on the cursor position. The grid is drawn to a separate offscreen double-buffering canvas to support smooth 60 FPS viewport transitions, rendering square cells or round circular cells showing a slate background through corner gaps.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Interactions | Pointer Events API | Pointer events provide touch, stylus, and mouse compatibility under a single API (D-01). |
| Zoom Centering | Cursor-Anchored Offset Math | Scrolling anchors the canvas coordinates under the mouse, making navigation feel natural (D-02). |
| Viewport Rendering | Offscreen double-buffer blitting | Drawing to a background canvas once and copying it as a single image ensures 60 FPS panning (D-05). |
| Backing Color | Slate Gray `#2D3748` background | Mimics canvas sticky backing sheets and provides clear contrast around round drill gaps (D-04). |
| Drill Toggles | Square vs. Round styles | Toggles cell visual styles dynamically, redrawing only the offscreen cache (D-03). |

## Stack Touched in Phase 3

- [ ] Viewport service library in `src/engine/viewer.ts`
- [ ] Viewport unit tests in `src/engine/__tests__/viewer.test.ts`

## Out of Scope (Deferred to Later Slices)

- Preact dashboard Layout wrapper component integration (Phase 4)
- Legend highlight overlays showing drill positions (Phase 4)
- CSS print stylesheets and native print-to-PDF export layouts (Phase 4)

## Subsequent Slice Plan

- Phase 4: Supply Planning, Customization & Exports (printable reports, checklist dashboard & PDF exports)
