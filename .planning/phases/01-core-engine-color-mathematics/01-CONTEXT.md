# Phase 1: Core Engine & Color Mathematics - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase establishes the core color-matching library and compile static manufacturer data structures. Specifically, it implements standard sRGB-to-CIELAB conversion, CIEDE2000 color distance calculations, and the static database of manufacturer indexes (Art Dot 100/200 kits) mapped to DMC color codes.

</domain>

<decisions>
## Implementation Decisions

### Color Science Library Integration
- **D-01:** Import tree-shakable functions from `culori/fn` and register modes manually to optimize bundle size.
- **D-02:** Blend transparent and semi-transparent pixels with a solid white background color (`#FFFFFF`) before color matching.
- **D-03:** Use an exact in-memory `Map` cache mapping raw RGB integers to matched DMC colors, cleared at the start of each matching run.
- **D-04:** Use Culori's built-in automatic multi-step converter by registering `modeRgb`, `modeXyz`, `modeLab`, and calling `converter('lab')`.

### Static Color Index Storage & Format
- **D-05:** Compile color indexes directly into a TypeScript file as constants, bundling them with the application for instant loading and zero network fetch overhead.
- **D-06:** Store DMC color codes as strings (e.g., `"310"`, `"BLANC"`, `"ECRU"`) to faithfully preserve official DMC names and designations.
- **D-07:** Structure the Art Dot 100-color and 200-color datasets as a single unified catalog containing all unique colors, with membership metadata (e.g. `kits: ["100", "200"]`) to prevent duplication and streamline lookups.
- **D-08:** Store both RGB hex codes (for drawing the canvas UI) and pre-calculated CIELAB L/a/b coordinates in the compiled color index to avoid converting reference colors during matching runs.

### Matching Logic & Extensibility
- **D-09:** Design matching functions to accept flat, serializable inputs (e.g., flat `Uint8ClampedArray` for image data, array of active DMC codes) to make integration with Web Workers seamless.
- **D-10:** Pre-filter the reference color index before entering the matching loop, passing only active color candidates to the distance-matching algorithm.
- **D-11:** Resolve rare color ties (when two DMC colors are equidistant to a target pixel) by picking the first encountered color in the reference array (stable matching) to ensure deterministic outcomes and high performance.
- **D-12:** Return a flat array of matched DMC codes corresponding to grid cell positions, along with a separate aggregated count summary object for supplies.

### the agent's Discretion
- None. All key gray areas were discussed and decided.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Configuration & Requirements
- `.planning/PROJECT.md` — Project context and technology constraints
- `.planning/REQUIREMENTS.md` — Core requirements mapped to Phase 1 (ENGINE-01, ENGINE-02, PALETTE-01, PALETTE-02)
- `.planning/ROADMAP.md` — Phase definition and success criteria

### Color Science & Libraries
- `culori` library documentation (external: `https://culorijs.org/`) — API reference for color space conversions and CIEDE2000 distance matching formulas.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None (completely greenfield project).

### Established Patterns
- None (completely greenfield project).

### Integration Points
- Core algorithms and compiled static files created in this phase will serve as the engine foundation for the Web Worker in Phase 2 and the Preact UI dashboard in Phase 4.

</code_context>

<specifics>
## Specific Ideas

- No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Core Engine & Color Mathematics*
*Context gathered: 2026-07-06*
