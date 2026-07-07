# Project Research Summary

**Project:** GemPixel
**Domain:** Client-side image-to-diamond-painting match utility and planning tool
**Researched:** 2026-07-06
**Confidence:** HIGH

## Executive Summary

GemPixel is designed as a high-fidelity image-to-diamond-painting matching tool running entirely client-side in the browser. By operating with zero server infrastructure, the application guarantees user privacy, offers instantaneous rendering response times, and incurs zero maintenance overhead. The recommended approach utilizes Vite and TypeScript for building a lightweight dashboard (via Preact and Tailwind CSS) paired with an interactive HTML5 Canvas 2D renderer for high-detail previewing. 

The core matching engine converts downsampled image pixels from sRGB to the CIELAB color space and performs perceptual color distance matching against DMC color palettes using the CIEDE2000 formula. To prevent browser lockups when comparing thousands of pixels against hundreds of colors, these calculations are offloaded to a background Web Worker thread using Transferable Objects and an RGBA hash-memoization cache.

Key risks include perceptual color matching inaccuracies (mitigated via CIEDE2000), browser main thread freezing (mitigated via Web Workers), rendering latency on large canvas grids (mitigated via double-buffered offscreen canvas caching and dynamic Level-of-Detail rendering), and physical drill shortages (mitigated via safety buffers and packaging quantization).

## Key Findings

### Recommended Stack

GemPixel relies on a lightweight, high-performance, and tree-shakable client-side stack. By avoiding heavy view frameworks, canvas graphs, and PDF libraries, the final compiled bundle footprint is kept to a minimum.

**Core technologies:**
- **Vite (`^6.0.0`) & TypeScript (`^5.0.0`)**: Build system and type safety — provides fast compile times, strict typing for color models, and native, configuration-free Web Worker bundling.
- **Preact (`^10.25.0`) & Tailwind CSS (`^4.0.0`)**: Lightweight UI dashboard engine (<4KB) and utility CSS — manages size settings, sub-palette checkboxes, and reports without React's bundle size and virtual DOM overhead.
- **Culori (`^4.0.2`)**: Tree-shakable color science library — implements reliable sRGB-to-CIELAB conversions and CIEDE2000 color distance formulas.
- **Native Browser Web Workers & HTML5 Canvas 2D**: Concurrency and graphics rendering — offloads heavy calculation loops and provides GPU-accelerated interactive canvas viewport rendering.

### Expected Features

**Must have (table stakes):**
- **Local Image Loading (F01)** — Drag-and-drop client-side file reading for absolute user privacy.
- **Dual-Mode Canvas Resizing (F02)** — Resolves grids using either direct dimensions or density-based physical measurements (based on 2.5mm per drill / 4 drills per cm / 10.16 drills per inch).
- **Color Mapping Engine (F03)** — Perceptual color matching using CIELAB and CIEDE2000 formulas.
- **Manufacturer Palette Matching (F04)** — Restricts matches to color lists in standard Art Dot 100-color and 200-color kits.
- **Interactive Grid Preview (F05)** — Interactive viewport support for zooming and panning across large grids.
- **Supply Specification Report (F06)** — Tabular list of DMC codes, swatches, quantity counts, and safety buffers.

**Should have (competitive):**
- **Active Sub-Palette Selector (F07)** — Enable/disable specific kit colors with instant matching recalculation to adapt patterns to physical inventories.
- **Drill Styling Engine (F08)** — Toggle between Square (full coverage) and Round (circular preview exposing the backing canvas) styles.
- **Legend Highlight (F09)** — Selecting a color row in the supply report highlights its occurrences in the grid.
- **Confetti Reduction Pass (F10)** — Noise reduction/median filtering to group isolated single pixels, simplifying physical assembly.

**Defer (v2+):**
- **Server-Side Accounts & Storage** — Defer to local configuration JSON import/export.
- **Canvas Painting/Editing Tools** — Defer drawing and pixel adjustments to external image editors.
- **E-Commerce Checkout Integration** — Output copy-pasteable CSV tables rather than third-party API checkouts.
- **Vector Symbols PDF Export** — Defer heavy vector generation in-browser, using CSS print media formatting (`window.print()`) instead.

### Architecture Approach

GemPixel implements a unidirectional data-flow structure separating grid generation, color matching, and view rendering.

**Major components:**
1. **App Orchestrator / State Store** — Central reactive state container coordinating user inputs and data dispatching.
2. **Canvas Downsampler & Parser** — Uses offscreen HTML5 canvas to downsample source images and parse raw RGBA pixel arrays.
3. **Color Matcher (Worker)** — Multi-threaded background Web Worker resolving CIEDE2000 color matching with cache memoization.
4. **Interactive Grid Renderer** — Canvas viewport engine drawing grids (square/round) and handling zoom/pan transformations.
5. **Palette Manager** — Curates static DMC indexes and filters customized sub-palettes.
6. **Supply Stats Generator** — Aggregates matched pixel counts, applies buffer math, and compiles reports.

### Critical Pitfalls

1. **Perceptual Color Matching Failures (RGB Euclidean)** — Naive calculations produce muddy tones. *Mitigation:* Convert to CIELAB space and apply the CIEDE2000 formula.
2. **Main Thread Freezing (UI Locking)** — Running millions of distance checks synchronously freezes the UI. *Mitigation:* Offload matching loops to a Web Worker with Transferable Objects.
3. **Canvas Rendering Latency** — Drawing tens of thousands of shapes per frame degrades pan/zoom performance. *Mitigation:* Render static layers once to an OffscreenCanvas and blit it (`drawImage`) during pan/zoom, with viewport frustum culling.
4. **DMC-to-Physical Color Divergence** — Online hex indexes vary. *Mitigation:* Freeze a hand-curated static DMC-to-RGB conversion table and emphasize the physical DMC code as the primary source of truth.
5. **Underestimating Drill Quantities** — Exact counts cause physical shortages. *Mitigation:* Apply a 10-15% safety buffer and quantize counts to standard physical packaging units (e.g. bags of 200 or 1000).
6. **Aspect Ratio Distortion** — Fitting raw images to canvas shapes stretches them. *Mitigation:* Provide scale-to-fit (pillarbox/letterbox) and cropping controls, enforcing strict 2.5mm grid cell spacing.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Core Engine & Color Mathematics
**Rationale:** Establishing accurate color conversions and static manufacturer data formats is a primary dependency. Unit tests verify these calculations before building user interfaces.
**Delivers:** Static DMC conversion tables, XYZ/Lab color space converters, CIEDE2000 distance logic, and mathematical unit tests.
**Addresses:** F04 (Art Dot Palette Indexes), F03 (Color Mapping Engine)
**Avoids:** Pitfall 1 (RGB Euclidean mismatches), Pitfall 4 (Hex inconsistencies)

### Phase 2: Client-side Engine & Worker Architecture
**Rationale:** Establishing image ingestion, physical scale calculators, and background processing models ensures performance issues are caught before drawing complex grids.
**Delivers:** HTML5 File API loader, Offscreen canvas downscaler, aspect ratio fit/crop bounds calculator, Web Worker interface with transferable buffer logic, and progress dispatching.
**Uses:** Vite Web Worker bundling, HTML5 File API & Offscreen Canvas
**Implements:** Image Loader, Grid Dimension Resolver, Canvas Downsampler, Color Matcher

### Phase 3: Canvas Viewer & Zoom/Pan Interaction
**Rationale:** Rendering performance requires caching structures. Interactive zoom, pan, and visual drill styling are built and optimized here.
**Delivers:** Interactive Canvas viewport, mouse/touch transformation matrices, double-buffered OffscreenCanvas rendering, Level-of-Detail (LOD) render controls, viewport culling.
**Uses:** HTML5 Canvas 2D context
**Implements:** Interactive Grid Renderer, Drill Styling Engine

### Phase 4: Supply Planning, Customization & Exports
**Rationale:** Finalizing the application requires binding the interactive rendering output with palette exclusion toggles, noise reduction passes, and data exports.
**Delivers:** Checklist UI for custom palette inclusions/exclusions, Legend Highlight canvas interaction, Confetti Reduction filter, CSV exporter, CSS Print layout formatting.
**Uses:** Preact state bindings, CSS `@media print`
**Implements:** Supply Stats Generator, Sub-Palette Exclusions, Legend Highlight, Confetti Reduction

### Phase Ordering Rationale

- **Logical Dependency:** Math configurations and static indices (Phase 1) feed into image parsers (Phase 2), which feed into visual render viewports (Phase 3), which are customized by dashboard toggles and exports (Phase 4).
- **Architecture Integrity:** Introducing background Web Workers early (Phase 2) prevents having to refactor synchronous main-thread code later. Structuring double-buffering into the Canvas viewport (Phase 3) guarantees high zoom/pan frame rates before the UI is layered.
- **Pitfall Prevention:** Sizing aspect ratios (Phase 2), packaging buffers (Phase 4), and confetti reduction passes (Phase 4) are baked into structural specifications rather than tacked on.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4: Confetti Reduction:** Standard noise-reduction algorithms (median filters) must be adapted to run efficiently on 2D indices and preserve crucial artistic edges.
- **Phase 1: CIEDE2000 Optimizations:** Performance profiles must verify that pre-converting palettes to Lab coordinates on initialization prevents performance bottlenecks in the worker.

Phases with standard patterns (skip research-phase):
- **Phase 2: Image Downsampling & Workers:** Native offscreen drawing and worker messaging follow standard, highly-documented browser APIs.
- **Phase 3: Canvas Zoom & Pan:** Matrix scale and translate transforms using mouse pointer coordinates are well-established graphics practices.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | The combination of Vite, Preact, Tailwind, and Culori is highly suited for performance-critical client-side utilities. |
| Features | HIGH | Table stakes and differentiators directly address core user concerns (confetti, inventory mismatches, canvas sizing). |
| Architecture | HIGH | Web Worker offloading, memoization caching, and double-buffered canvases successfully eliminate web performance bottlenecks. |
| Pitfalls | HIGH | Identified issues (Euclidean distance, UI lag, exact count shortages) are proven bottlenecks in browser graphic utilities. |

**Overall confidence:** HIGH

### Gaps to Address

- **DMC Hex Standardization:** Online databases differ on hex values; a single calibrated conversion map matching Art Dot kits must be frozen.
- **Confetti Reduction Tuning:** The exact neighborhood-based noise-filtering rules must be benchmarked to simplify grids without losing vital pixel art details.

## Sources

### Primary (HIGH confidence)
- **Culori API Docs (culorijs.org)** — Verification of tree-shakable color parsing and CIEDE2000 math.
- **MDN Web Docs (Workers API)** — Standard specs on Transferable Objects and Worker threads.
- **Standard Diamond Painting Specifications** — Dimensions of physical drills (2.5mm).

### Secondary (MEDIUM confidence)
- **Art Dot Product Lists** — Color profiles for standard Art Dot 100/200 palettes.
- **Cross-Stitch/Floss Databases** — Analysis of DMC hex variances across online databases.

---
*Research completed: 2026-07-06*
*Ready for roadmap: yes*
