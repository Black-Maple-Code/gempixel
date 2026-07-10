# Phase 7: Symbol-Overlay Canvas & Margin Legends - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase implements a core symbol database, renders highly distinguishable symbols inside individual grid cells of the canvas, and generates a printable layout containing margin legends (DMC code, color, symbol) that are hidden when stretched or framed. It also adds a seamless 3-way toggle between Grid Colors, Grid + Symbols, and the Original Photo.

</domain>

<decisions>
## Implementation Decisions

### Core Symbol Database
- **D-01:** Define a curated library of 80+ highly distinguishable symbols (including uppercase letters, numbers, and clean glyphs), explicitly omitting visually similar character pairs (e.g. 0/O, 1/I, 5/S, 8/B).
- **D-02:** Dynamically allocate symbols from the curated pool to active colors in order of color frequency. This guarantees that no two colors on a single canvas will ever share similar symbols.

### Canvas Overlay Rendering
- **D-03:** Adapt the text color of the centered symbol dynamically based on the cell's background luminance (using standard formula `Y = 0.299R + 0.587G + 0.114B`), rendering black text for light colors and white text for dark colors.
- **D-04:** Render symbols centered inside grid cells only when the cell scale/zoom level is large enough to remain readable (e.g., cell size >= 10px).

### 3-Way Viewport Switcher
- **D-05:** Support three viewport modes: `grid` (colors only), `symbols` (colors + symbols), and `reference` (original image).
- **D-06:** Toggling between `grid` and `symbols` is handled entirely inside the `CanvasViewer` draw loop via a boolean flag, executing in <1ms without triggering Preact DOM re-renders.

### Print/Export Layout
- **D-07:** The printable canvas sheet layout must **always force the symbols/icons to print**, preventing any printer exports of the color-only grid or original reference image.
- **D-08:** Position the color guide legend (DMC code, color swatch, symbol) on the left and right border margins of the printable canvas, separated by a dashed boundary line indicating the frame stretch fold.

</decisions>

<canonical_refs>
## Canonical References

### Project Configuration & Requirements
- `.planning/PROJECT.md` — Project context and constraints
- `.planning/ROADMAP.md` — Phase definition and roadmap progress
- `.planning/phases/07-symbol-overlay-canvas-margin-legends/` — Phase planning directory

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/engine/viewer.ts` — Existing CanvasViewer handling zoom/pan and double-buffered drawing.
- `src/App.tsx` — Main control panel with step Wizard layout.

### Integration Points
- `symbols.ts` library will map DMC color arrays to symbols inside `App.tsx` and pass this mapping to `CanvasViewer`.
- Print CSS rules in `src/index.css` will be extended to format the printable canvas page layout.

</code_context>

<specifics>
## Specific Ideas
- None.

</specifics>

<deferred>
## Deferred Ideas
- None.

</deferred>

---

*Phase: 07-symbol-overlay-canvas-margin-legends*
*Context gathered: 2026-07-09*
