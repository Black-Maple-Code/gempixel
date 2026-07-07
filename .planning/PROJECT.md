# GemPixel

## What This Is

GemPixel is a client-side utility web application designed for diamond painting/gem art artists. It takes a user-loaded picture and converts it into a grid representation showing how it will look as gem art, matching the image colors to standard Art Dot/DMC manufacturer color indexes (100 and 200 color kits) and custom sub-palettes. It serves as a supply planning tool that outputs the exact color codes and dot counts needed for the canvas.

## Core Value

Provide a simple, non-AI, high-fidelity grid preview of any image mapped directly to Art Dot / DMC colors, with accurate supply counts based on canvas size.

## Requirements

### Validated

- Map each pixel/grid cell to the nearest available DMC color from selected color indexes using RGB/Lab color distance formulas (Validated in Phase 01: Core Engine & Color Mathematics).
- Support Art Dot 100-color and 200-color manufacturer indexes (Validated in Phase 01: Core Engine & Color Mathematics).
- Load local images (JPEG, PNG, etc.) in-browser (Validated in Phase 02: Client-side Engine & Worker Architecture).
- Specify canvas size using two modes: direct grid dimensions (rows/cols) or physical dimensions (cm/inches) with standard density calculations (2.5mm per dot, 10 dots/inch) (Validated in Phase 02: Client-side Engine & Worker Architecture).
- Enable visual inspection of the grid with zoom/pan and custom styling (square vs. round drill representation) (Validated in Phase 03: Canvas Viewer & Zoom/Pan Interaction).
- Render a pixelated grid representation of the image (Validated in Phase 04: Supply Planning, Customization & Exports).
- Support custom sub-palette selection/filtering (allowing the artist to include or exclude specific colors from matching) (Validated in Phase 04: Supply Planning, Customization & Exports).
- Display a supply specification report showing required color codes, names, and exact quantities of dots needed (Validated in Phase 04: Supply Planning, Customization & Exports).

### Active

**Milestone v2.0: supply-partnerships-checkout-and-artist-UX**
- [ ] Direct Canvas Ordering Partnership: Provide a way for artists to order custom sticky-glue canvases matching their project layout/dimensions from partnered canvas suppliers.
- [ ] Custom Drill Cart Checkout: Compile and export direct affiliate/purchase cart links to Diamond Drills USA for the exact optimized bags (200, 500, 1000, 2000 sizes) of drills required for the canvas.
- [ ] Streamlined Commission Journey: Simplify and restructure UI panels, inputs, and navigation to optimize the workflow of a professional diamond art artist quoting a commission.

### Out of Scope

- [ ] Server-side processing or user accounts — keep the utility lightweight and run entirely client-side.
- [ ] AI-based color enhancement or style generation — stick to clean mathematical color matching.

## Context

The target user is a professional or hobbyist gem art artist who takes custom commissions. Currently, there is no simple tool to map custom image colors to the specific Art Dot kits (100 and 200 colors). A key pain point is estimating the exact number of gem drills needed before starting a project.

## Constraints

- **Tech Stack**: Vanilla HTML/JavaScript/CSS or a lightweight framework running entirely in-browser.
- **Color Accuracy**: Colors must map to the standard DMC color code system since Art Dot matches DMC numbers.
- **Privacy & Speed**: Run completely in the browser; images should never upload to a server.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Client-side processing | Fast, secure, zero server maintenance costs. | — Ingested and scaled entirely client-side (Phase 02) |
| Multi-resizing modes | Supports both canvas purchasing (cm/inches) and detailed planning (rows/cols). | — Physical size to dot formulas implemented (Phase 02) |
| Art Dot Kit Indexing | Direct mapping to 100/200 sets to match user's physical inventory. | — Compiled statically (Phase 01) |
| Color space conversions & distance | Use manually registered Culori modes, sRGB -> XYZ -> Lab, 24-bit bitwise cache, and CIEDE2000 distance. | — Implemented in color.ts (Phase 01) |
| Sizing Mapping Mode | Crop/Cover mode centered on image | — Implemented in ingest.ts (Phase 02) |
| Downsampling Algorithm | Box Sampling (Area Averaging) for accurate color representation | — Implemented in ingest.ts (Phase 02) |
| Concurrency Engine | Single persistent Web Worker with batching and abort signaling | — Implemented in matcher.worker.ts (Phase 02) |
| RGBA Match Cache | Persisted across dimension changes, cleared only on palette edits | — Implemented in worker-client.ts (Phase 02) |
| Transform Handling | Pointer Events (drag pan) + Wheel Listener (scale zoom) | — Implemented in viewer.ts (Phase 03) |
| Zoom Anchor | Cursor-centered offset updates | — Implemented in viewer.ts (Phase 03) |
| Viewport Rendering | Double-buffered offscreen canvas blitted to screen | — Implemented in viewer.ts (Phase 03) |
| Grid Gaps Backing | Slate Gray `#2D3748` drawn behind cells | — Implemented in viewer.ts (Phase 03) |
| Direct Cart & Canvas Partnerships | Integrate direct affiliate cart building and custom canvas ordering links to monetize the tool while maintaining client-side execution. | — Planned in Milestone v2.0 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-07 after Milestone v2.0 planning*
