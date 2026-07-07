# Walking Skeleton — GemPixel

**Phase:** 1
**Generated:** 2026-07-06

## Capability Proven End-to-End

A source color in sRGB space is accurately blended with a solid white background, converted to CIELAB, and matched against a compiled static DMC reference index using CIEDE2000 color distance with bitwise integer caching.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Language | TypeScript (`^5.0.0`) | Provides compile-time safety and type definitions for RGB, XYZ, and Lab coordinates (PROJECT.md). |
| Color Science Library | Culori (`^4.0.2`) / Tree-shakable functional entry (`culori/fn`) | Provides precise color conversion and CIEDE2000 distance matching formulas while keeping bundle size optimized (D-01, D-04). |
| Color Matching Cache | In-memory `Map` with 24-bit encoded RGB keys | Minimizes matching runtimes by caching previous exact pixel matches without string allocation overhead (D-03). |
| Directory layout | Subdirectories under `src/` (e.g. `src/engine/`) | Separates core mathematical engine from presentation logic in later phases. |
| Test Runner | Vitest | Extremely fast, zero-config test runner aligned with TypeScript and standard ESM patterns. |

## Stack Touched in Phase 1

- [ ] Project scaffold (Vitest configuration, TypeScript settings, Culori setup)
- [ ] Core Engine Library — color utilities in `src/engine/color.ts`
- [ ] Static References — DMC/Art Dot index catalog in `src/engine/palette.ts`
- [ ] Test Coverage — Automated unit tests in `src/engine/__tests__/color.test.ts`

## Out of Scope (Deferred to Later Slices)

- Client-side image upload and downscaling/fitting (Phase 2)
- Background Web Worker execution thread (Phase 2)
- Interactive zoom/pan 2D Canvas viewer (Phase 3)
- Supply checklist dashboard, sub-palette exclusions, and native PDF layout (Phase 4)

## Subsequent Slice Plan

- Phase 2: Client-side Engine & Worker Architecture (asynchronous image processing & worker integration)
- Phase 3: Canvas Viewer & Zoom/Pan Interaction (graphics viewport & drill rendering styles)
- Phase 4: Supply Planning, Customization & Exports (printable reports, checklist dashboard & PDF exports)
