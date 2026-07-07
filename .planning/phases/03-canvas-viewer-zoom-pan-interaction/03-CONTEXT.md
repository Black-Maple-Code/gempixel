# Phase 3: Canvas Viewer & Zoom/Pan Interaction - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase implements a high-performance interactive grid preview canvas viewport. It handles user interactions including zoom (centered at the mouse cursor) and pan using standard pointer events. It supports toggling between Square and Round drill styles (with a neutral slate backing showing through the round gaps). To ensure a smooth 60 FPS rendering speed, it uses an offscreen canvas double-buffering cache.

</domain>

<decisions>
## Implementation Decisions

### Viewport Interaction
- **D-01:** Implement standard **pointer events** (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) and the `wheel` event to support zoom and pan interactions. Pointer events provide native support for mouse, touch, and stylus input.
- **D-02:** Implement **Zoom centered at the mouse cursor**. The transformation matrix offsets are adjusted during scrolling so the coordinates under the user's cursor remain anchored at the same screen position.

### Drill Rendering Styles
- **D-03:** Support two drill styles: **Square** (covering the full grid cell) and **Round** (circular drills).
- **D-04:** Render a solid **neutral slate backing color** (specifically `#2D3748`) in the canvas background. When Round drills are selected, the slate backing shows through the corner gaps, providing realistic feedback and contrast.

### Performance Optimization
- **D-05:** Implement **Offscreen Canvas double-buffering**. Draw the entire grid of drills (either squares or circles) onto a separate offscreen canvas. During pan and drag operations, draw that offscreen canvas to the screen as a single image (blitting).
- **D-06:** Redraw the offscreen canvas only when parameters change: on zoom level change, canvas resize, drill style toggle, or palette matching completion.

### Carrying Forward from Phase 2
- **D-07 (from P2-D-10):** The viewport consumes the flat array of matched DMC codes and dimensions returned by the Web Worker.

### Agent's Discretion
- None. All key gray areas were discussed and decided.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Configuration & Requirements
- `.planning/PROJECT.md` — Project context and technology constraints
- `.planning/REQUIREMENTS.md` — Requirements mapped to Phase 3 (VIEW-01, VIEW-02)
- `.planning/ROADMAP.md` — Phase definition and success criteria

### Viewport Interactions
- MDN Pointer Events API (external: `https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events`) — handling drag/touch
- 2D Transformation Matrices (external: standard 2D affine transformations $x' = a \cdot x + c \cdot y + e$)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/engine/types.ts` — contains common model shapes.
- `src/engine/color.ts` — matching functions.

### Established Patterns
- Lightweight, self-contained TypeScript classes or modules.
- Canvas 2D context drawing operations.

### Integration Points
- The Canvas Viewer will be initialized in the main UI thread. It listens to matching completion results from `MatcherClient` and redraws the grid when new matches arrive.
- In Phase 4, the viewer will be wrapped into a Preact component and integrated with the sidebar controls (sizing, file loading, drill style toggles).

</code_context>

<specifics>
## Specific Ideas

- Neutral slate backing color: `#2D3748` — used behind grid cells.

</specifics>

<deferred>
## Deferred Ideas

- Drill symbol overlays (VIEW-04) — deferred to Phase 4 (milestone v2 or detailed Legend additions).
- Hover highlighting (VIEW-03) — deferred to Phase 4.

</deferred>

---

*Phase: 3-Canvas Viewer & Zoom/Pan Interaction*
*Context gathered: 2026-07-07*
