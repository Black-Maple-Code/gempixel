# Walking Skeleton — GemPixel

**Phase:** 2
**Generated:** 2026-07-07

## Capability Proven End-to-End

A user-selected image is loaded client-side, decoded using HTML5 Canvas, and cropped to a target aspect ratio in Cover/Crop mode. The cropped image is downscaled using a Box Sampling (Area Averaging) algorithm. The resulting pixel grid is offloaded to a persistent Web Worker that executes the CIEDE2000 color matching loop asynchronously, reporting progress updates and final matched results without locking the main thread. Repeat runs reuse cached matches unless the candidate palette changes.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Image Sizing | Cover/Crop aspect ratio mapping | Centering the crop box eliminates aspect ratio distortions and padding cell complications (D-01). |
| Downscaling | Box Sampling (Area Averaging) | Avoids cell boundary blurring or missed details, producing the most color-accurate average cells for matching (D-03). |
| Concurrency | Single persistent Web Worker | Bypasses script startup/parsing overhead during repeated matching runs (D-04). |
| Cancellation | Abort message signaling | Worker loops check a cancellation flag between row batches, allowing instant job preemptions without terminates (D-05). |
| Cache Key | 32-bit numeric RGBA key | Primitive integer caching avoids string allocation costs, caching matches before alpha composition (D-07). |
| Cache Lifetime | Persisted until palette change | Speeds up the typical user flow of loading one image and trying multiple canvas sizes (D-07, D-08). |

## Stack Touched in Phase 2

- [ ] Image downsampling utilities in `src/engine/ingest.ts`
- [ ] Background thread processing in `src/engine/matcher.worker.ts`
- [ ] Host thread worker client manager in `src/engine/worker-client.ts`
- [ ] Downscaler unit tests in `src/engine/__tests__/ingest.test.ts`
- [ ] Worker lifecycle and caching unit tests in `src/engine/__tests__/worker.test.ts`

## Out of Scope (Deferred to Later Slices)

- Interactive zoom/pan 2D Canvas viewer viewport (Phase 3)
- Custom drill styling rendering (Square vs. Round) (Phase 3)
- Supply checklist dashboard, sub-palette exclusions, color highlighting, and native PDF layout print options (Phase 4)

## Subsequent Slice Plan

- Phase 3: Canvas Viewer & Zoom/Pan Interaction (graphics viewport & drill rendering styles)
- Phase 4: Supply Planning, Customization & Exports (printable reports, checklist dashboard & PDF exports)
