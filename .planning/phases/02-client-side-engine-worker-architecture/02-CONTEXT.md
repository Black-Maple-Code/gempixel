# Phase 2: Client-side Engine & Worker Architecture - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase implements client-side image loading (drag-and-drop / file picker), canvas-based image decoding, box-sampling downscaling to a user-specified grid size, and asynchronous color matching via a persistent Web Worker. It also adds an RGBA match cache that persists across dimension changes and invalidates only on palette changes.

</domain>

<decisions>
## Implementation Decisions

### Image Loading & Sizing
- **D-01:** Implement **Crop (cover)** as the sole image-to-grid mapping mode. The image is scaled to completely fill the target grid dimensions, cropping any overflow. No fit/stretch/padding modes — this avoids aspect ratio distortion and eliminates the need to handle empty padding cells.
- **D-02:** Accept canvas size via two input modes: direct grid dimensions (rows/cols) and physical dimensions (cm/inches) with automatic dot calculation at standard drill density (2.5mm per drill, 10 dots per inch).

### Downscaling Algorithm
- **D-03:** Use **Box Sampling (Area Averaging)** for downscaling the source image to grid dimensions. Divide the source image into blocks matching each grid cell, compute the average RGBA of all pixels in each block. This produces the most color-accurate representative value for CIEDE2000 matching downstream. The browser's native `canvas.drawImage()` is used only for decoding the image file into raw pixel data, not for the actual downscaling.

### Web Worker Architecture
- **D-04:** Use a **single persistent Web Worker** spawned at app startup, kept alive across runs, and communicated with via `postMessage`. No terminate-and-respawn pattern.
- **D-05:** Implement **abort signaling** for in-progress matching runs. When the user changes parameters mid-run, send an abort flag to the worker. The worker checks this flag between pixel batches in the matching loop and discards partial results on abort.
- **D-06:** Design the Worker message protocol with typed message kinds (e.g., `{ kind: 'match', pixels, candidates }`, `{ kind: 'abort' }`, `{ kind: 'result', matches, counts }`, `{ kind: 'progress', percent }`).

### RGBA Match Cache
- **D-07:** **Persist the RGBA-to-DMC match cache across runs** as long as the active color palette has not changed. Cache hits bypass the CIEDE2000 distance loop entirely. This optimizes the common workflow of the user loading one image and trying different canvas sizes.
- **D-08:** **Invalidate (clear) the cache** whenever the active palette selection changes, since a different set of candidate colors produces different nearest-match results.

### Carrying Forward from Phase 1
- **D-09 (from P1-D-09):** Matching functions accept flat serializable inputs (`Uint8ClampedArray` for pixel data, array of `DmcColor` candidates) for Web Worker compatibility.
- **D-10 (from P1-D-12):** `matchPixelGrid` returns `{ matches: string[], counts: Record<string, number> }` — flat array of DMC codes plus aggregated count summary.

### Agent's Discretion
- None. All key gray areas were discussed and decided.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Configuration & Requirements
- `.planning/PROJECT.md` — Project context and technology constraints
- `.planning/REQUIREMENTS.md` — Requirements mapped to Phase 2 (INGEST-01, INGEST-02, INGEST-03, INGEST-04, ENGINE-03, ENGINE-04)
- `.planning/ROADMAP.md` — Phase definition and success criteria

### Phase 1 Implementation (dependency)
- `src/engine/types.ts` — Shared type interfaces (`DmcColor`, `LabCoordinates`)
- `src/engine/color.ts` — Core color matching functions (`rgbToLab`, `findClosestDmc`, `matchPixelGrid`, `blendAlphaWhite`)
- `src/engine/palette.ts` — Static DMC palette catalog (`DMC_PALETTE`)
- `.planning/phases/01-core-engine-color-mathematics/01-CONTEXT.md` — Phase 1 decisions (serialization format, cache key strategy, tie-breaking)

### Web Worker API
- MDN Web Workers API (external: `https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API`) — `postMessage`, `onmessage`, `terminate` patterns
- MDN File API (external: `https://developer.mozilla.org/en-US/docs/Web/API/File_API`) — Drag-and-drop and file input for client-side image loading

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/engine/color.ts` — `matchPixelGrid(pixels: Uint8ClampedArray, candidates: DmcColor[])` already accepts flat serializable inputs designed for Worker transfer.
- `src/engine/palette.ts` — `DMC_PALETTE` array with pre-calculated CIELAB coordinates, ready to filter and pass to the worker.
- `src/engine/types.ts` — `DmcColor` and `LabCoordinates` interfaces shared across modules.

### Established Patterns
- Tree-shakable functional imports from `culori/fn` with manual mode registration.
- 24-bit RGB integer Map cache key (`(R << 16) + (G << 8) + B`) for O(1) lookups.
- Flat serializable I/O signatures for Web Worker compatibility.

### Integration Points
- The Worker will import the matching functions from `src/engine/color.ts` directly (bundled into the worker script by Vite).
- The image loader and downscaler will produce a `Uint8ClampedArray` that feeds directly into `matchPixelGrid`.
- Phase 3 (Canvas Viewer) will consume the `matches` array output to render the grid preview.

</code_context>

<specifics>
## Specific Ideas

- Standard drill density: 2.5mm per drill / 10 dots per inch — used for converting physical dimensions to grid dimensions.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-Client-side Engine & Worker Architecture*
*Context gathered: 2026-07-07*
