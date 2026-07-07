# Phase 4: Supply Planning, Customization & Exports - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase implements the Preact dashboard wrapper UI components. It integrates the image file loader, canvas sizing configurations, and active sub-palette selectors. It displays a tabular supply checklist summary that adds a safety margin and rounds counts up to recommended 200-drill packets. Panning, zooming, and color highlighting (dimming non-selected colors to 20% opacity) are linked in the viewport. It also sets up CSS print media stylesheets and a native `window.print()` PDF print interface.

</domain>

<decisions>
## Implementation Decisions

### Viewport Highlighting
- **D-01:** Implement **Dimming non-selected colors** as the highlight mode (VIEW-03). When a color row is selected in the legend, draw that highlighted color cells with full opacity, while dimming all other canvas cells to low opacity (`20%` or `0.2` alpha). This makes highlighted colors visually stand out immediately.

### Sub-palette Customization
- **D-02:** Implement **Instant recalculation on toggle** (PALETTE-03). When check/unchecking color options in the sub-palette checklist, instantly re-run the Web Worker color matching task using the active candidates set. In-flight tasks are aborted automatically by `MatcherClient` to maintain main thread responsiveness.

### Supply Planning & Safety Margins
- **D-03:** Add a **+10% safety margin** to all exact dot counts (REPORT-02).
- **D-04:** Implement **Standard 200-drill packet rounding** (REPORT-02). Round safety-adjusted drill counts up to the nearest multiple of 200, and display the recommended number of purchase packets/bags required (e.g. count of 385 drills requires 2 packets of 200).
- **D-05:** Display a tabular legend checklist summary showing DMC codes, swatches, exact dot counts, and recommended packets (REPORT-01).

### Exports & Printing
- **D-06:** Implement **CSS print layouts** using native media queries (`@media print`) and trigger exports via the native browser print interface `window.print()` (REPORT-03). The print layout hides sidebar menus, formats columns, and adjusts grids onto clean pages without requiring heavy PDF libraries.

### Carrying Forward from Phase 3
- **D-07 (from P3-D-01):** The Preact component initializes `CanvasViewer` on a container canvas and delegates drag-pan and scroll-zoom events to it.

### Agent's Discretion
- None. All key gray areas were discussed and decided.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Configuration & Requirements
- `.planning/PROJECT.md` — Project context and technology constraints
- `.planning/REQUIREMENTS.md` — Requirements mapped to Phase 4 (PALETTE-03, VIEW-03, REPORT-01, REPORT-02, REPORT-03)
- `.planning/ROADMAP.md` — Phase definition and success criteria

### CSS Printing & Page Layouts
- MDN Printing and print-specific layouts (external: `https://developer.mozilla.org/en-US/docs/Web/Guide/Printing`) — page breaks, media queries, print formatting styles.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/engine/viewer.ts` — `CanvasViewer` class handles panning, zooming, and drawing. We will add a `setHighlightedColor(code: string | null)` method to support dimming.
- `src/engine/worker-client.ts` — `MatcherClient` class manages background worker executions.

### Established Patterns
- High-performance, functional, and tree-shakable designs.
- Preact virtual DOM rendering for tables and checklist forms.
- Tailwind CSS class styling for styling dashboards and sidebar drawers.

### Integration Points
- The UI layer will initialize `MatcherClient` and `CanvasViewer`.
- Checkbox selections feed directly into the active candidates list passed to `MatcherClient.match()`.
- Row selections in the Legend table trigger viewer updates via `viewer.setHighlightedColor(code)`.

</code_context>

<specifics>
## Specific Ideas

- Default safety margin: +10%.
- Packet packaging size: 200 drills per packet.
- Non-highlighted cell opacity: 20% (`0.2` alpha).

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 4-Supply Planning, Customization & Exports*
*Context gathered: 2026-07-07*
