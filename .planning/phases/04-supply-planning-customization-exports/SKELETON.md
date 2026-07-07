# Walking Skeleton — GemPixel

**Phase:** 4
**Generated:** 2026-07-07

## Capability Proven End-to-End

A complete functional dashboard wrapper coordinates local image loading, aspect ratio cropping, and Box Sampling downscaling. Matched pixel grids are calculated asynchronously on a persistent Web Worker. The UI renders side-by-side: a sidebar with sizing fields, a center viewport displaying the canvas with panning and cursor-centered zooming, and a right panel showing the sub-palette checklist and Legend checklist. Excluded colors trigger instant matches, row clicks dim non-selected cells in the viewport to 20% opacity, and PDF exports format the canvas grid and supply report natively for printing.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| View Framework | Preact (`^10.25.0`) | Lightweight, high-performance rendering engine that avoids react bundle weight (GEMINI.md). |
| CSS Styling | Tailwind CSS (`^4.0.0`) | Zero runtime utility styles keeping dashboard layouts completely responsive and fast. |
| Highlight View | Cell Opacity Dimming | Opacity dimming is highly visible on complex canvas sizes, rendering highlighted cells at full opacity (D-01). |
| Safety Buffer | +10% rounded to 200 bags | Prevents running out of drills and maps directly to standard package purchase sizes (D-03, D-04). |
| PDF Export | CSS print layouts + window.print | Eliminates heavy PDF builder package sizes, letting browser print engines save vectors natively (D-06). |

## Stack Touched in Phase 4

- [ ] Core UI application view in `src/App.tsx`
- [ ] Mount handler module in `src/main.tsx`
- [ ] Tailwind styles and print media sheets in `src/index.css`
- [ ] Mounting DOM container reference in `index.html`
- [ ] Unit tests checking components and controllers in `src/__tests__/App.test.tsx`
- [ ] Integration tests checking exclusions and highlight links in `src/__tests__/integration.test.tsx`
- [ ] Print tests checking margin calculations and package counts in `src/__tests__/print.test.tsx`

## Out of Scope (Deferred to Milestone v2)

- Confetti reduction pass median noise filter (ENGINE-05)
- Custom sub-palette JSON exports and imports (PALETTE-04)
- Symbol overlay fonts inside cells at high zoom levels (VIEW-04)
