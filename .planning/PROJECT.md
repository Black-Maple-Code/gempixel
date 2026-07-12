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

**Milestone v2.0 (shipped, Phases 5–9):**
- Direct Canvas Ordering Partnership — order custom sticky-glue canvases matching the project layout from partnered suppliers (Validated in Phase 5).
- Custom Drill Cart Checkout — compile affiliate/purchase cart links to Diamond Drills USA for the optimized drill bags (Validated in Phase 5).
- Streamlined Commission Journey — 4-step wizard + local commission workspace (Validated in Phase 6).
- Symbol-overlay canvas, margin legends, multi-vendor PNG export, and viewport HUD navigation (Validated in Phases 7–9).

**Milestone v2.1 (shipped 2026-07-12, Phases 11 + 13):**
- Storage robustness & error feedback — app survives blocked/private-mode storage, persisted settings centralized behind one `usePersistentState` helper, and save/download/checkout failures surfaced in a dismissible banner (Validated in Phase 11, STORE-01/02, ERR-01).
- Off-main-thread image decode — the resample + `getImageData` readback + box-sampling now run in the matcher Web Worker via a zero-copy `ImageBitmap` transfer, keeping the UI responsive on large images with bit-identical output (Validated in Phase 13, PERF-01).

### Active

**No milestone currently in progress.** v2.1 shipped 2026-07-12 (storage robustness + off-main-thread decode — see Validated). Start the next milestone with `/gsd-new-milestone`.

**Deferred to a future milestone** (roadmapped under v2.1, never built — to be re-scoped/rewritten; requirements preserved in `milestones/v2.1-REQUIREMENTS.md`):
- [ ] Project Load Correctness — restored projects keep their saved price and grid (LOAD-01, LOAD-02).
- [ ] Supply Pricing Accuracy — correct 500-bag pricing, no $0 unpriced sizes, variant integrity test (PRICE-01, PRICE-02, DATA-01).
- [ ] Security & Cleanup — validate the partner canvas URL against an http/https allowlist and wire-up-or-remove the unfinished partner-link path (SEC-01).

### Out of Scope

- [ ] Server-side processing or user accounts — keep the utility lightweight and run entirely client-side.
- [ ] AI-based color enhancement or style generation — stick to clean mathematical color matching.

## Context

The target user is a professional or hobbyist gem art artist who takes custom commissions. Currently, there is no simple tool to map custom image colors to the specific Art Dot kits (100 and 200 colors). A key pain point is estimating the exact number of gem drills needed before starting a project.

**Current state (v2.1, 2026-07-12):** Preact 10 + Vite 6 + TypeScript (strict) + Tailwind v4; `culori` color science; native Web Worker for CIEDE2000 matching **and (as of v2.1) off-main-thread image decode**; persistence via a guarded `localStorage` helper. 100% client-side, no backend. Test suite: 178 passing (Vitest, node env). Shipped to `Black-Maple-Code/gempixel` master, tagged `v2.1`. Known tech debt: Phases 07/08/09 lack formal UAT sign-off; Phases 10/12/14 deferred.

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
| Direct Cart & Canvas Partnerships | Integrate direct affiliate cart building and custom canvas ordering links to monetize the tool while maintaining client-side execution. | — Shipped in Milestone v2.0 (Phase 5) |
| Post-milestone maintenance review | Ran GSD map-codebase + a full deep code review before further feature work; fixed 4 blockers, roadmapped remaining warnings as Milestone v2.1. | — REVIEW.md; blockers fixed via quick tasks 2026-07-12 |
| Off-main-thread image decode | Evict resample + `getImageData` readback + box-sampling from the main thread via a transferred `ImageBitmap` into the existing matcher worker (topology A), reusing the B2 abort; keep output bit-identical. | ✓ Shipped Phase 13; execute-time code review caught + fixed a stale-decode-rejection bug and an EXIF parity bug the tests missed |
| v2.1 scope cut | Ship only the two highest-value review items (Phases 11 + 13); defer Phases 10/12/14 to a later rewrite. | ⚠ Revisit — deferred requirements carried in `milestones/v2.1-REQUIREMENTS.md` |

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
*Last updated: 2026-07-12 — v2.1 milestone complete (Phases 11 + 13 shipped; Phases 10/12/14 deferred); tagged v2.1*
