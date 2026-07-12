# Phase 13: Performance — Off-Main-Thread Decode - Research

**Researched:** 2026-07-12
**Domain:** Browser-native off-main-thread image resample (OffscreenCanvas + ImageBitmap transfer) inside an existing Vite module worker
**Confidence:** HIGH on mechanics/transfer/seam; MEDIUM on byte-for-byte resample parity (implementation-defined, hence the D-11 manual gate)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Boundary option **(b)** — evict the `drawImage` resample + `getImageData` readback off-thread. Main thread creates an `ImageBitmap` from the already-loaded `HTMLImageElement` via `createImageBitmap`, **transfers it (zero-copy Transferable)** into the worker; worker draws to an **OffscreenCanvas**, resamples to the ≤2000px cap, calls `getImageData`, then box-samples. (The initial browser decode already happened at `img.onload`; what moves is resample + readback.)
- **D-02:** Worker replicates `getImagePixels()`'s draw path **exactly** — same `maxDimension = 2000` cap and same canvas/`imageSmoothing` defaults. Parity depends on the **resample bytes**, not just the averaging math. `boxSampleImage` (`src/engine/ingest.ts`) is reused **verbatim**.
- **D-03:** Rejected (a) raw-Blob-decode-in-worker (parity risk + Firefox blocks `createImageBitmap(blob)` in worker). Rejected (c) box-sample-only (leaves resample/readback hitch on main).
- **D-04:** Topology **A** — fold decode+resample+box-sample into the **existing** `src/engine/matcher.worker.ts` as one step of the match request. One `postMessage` carries the transferred `ImageBitmap` (+ dims) → resample → box-sample → match → single round-trip back. **No new worker file.**
- **D-05:** Reuse the existing monotonic `currentRunId`/`runSeq` abort (B2 fix) to cancel the entire pipeline atomically. Add a `runId === currentRunId` guard **before** box-sample/match. No second worker, no second abort channel. Palette-hash cache stays as-is.
- **D-06:** `MatcherClient.match()` signature changes to accept the source (`ImageBitmap` + dims) instead of a pre-sampled `Uint8ClampedArray`, and transfers the `ImageBitmap`. The hook's public input surface (`image: HTMLImageElement`) is **unchanged** — the `createImageBitmap(image)` call is added inside the hook.
- **D-07:** **Hard-fail, single worker-only path.** If worker-side OffscreenCanvas/`createImageBitmap` is unavailable (Safari < 16.4), surface an "update your browser" message through Phase 11's existing error banner. No permanent main-thread fallback.
- **D-08:** Detect capability via an **init-time probe exposed as an injectable flag** (once at init, not per-image). This flag is also the node/Vitest test seam.
- **D-09:** **Phase-labeled single overlay.** Reuse the one loading overlay: **indeterminate** bar labeled "Preparing image…" during async decode/resample, flip to **determinate** "Matching colors: {progress}%" when the worker's `onProgress` fires. Preserve the invariant that spinner never co-displays with the error banner (`loading` cleared on error).
- **D-10:** Worker-side decode failures route through the same reactive `error` signal as match failures (the hook's `error` → `matchError` banner), **not** the imperative `actionError` seam. Generalize banner copy from "Color matching failed:" to a stage-agnostic form ("Couldn't process the image:").
- **D-11:** Verify bit-identical output via a **one-time manual in-browser fixture diff** at phase-verification time — not a permanent automated real-browser harness. The pure-integer `boxSampleImage` unit test stays the CI gate for the math.

### Claude's Discretion
- Exact message-shape additions to `{kind:'match'}`, OffscreenCanvas creation details in the worker, and how `createImageBitmap` is awaited within the hook's effect (including abort of a superseded in-flight `createImageBitmap`) are implementation details for research/planning, provided D-01…D-11 hold.

### Deferred Ideas (OUT OF SCOPE)
- Automated real-browser parity gate (vitest browser mode / Playwright) — deferred; revisit only if a resample-parity regression surfaces.
- Changing the box-sample algorithm, the `maxDimension = 2000` cap, caching, worker pools, or any output-affecting change. This phase is a **pure relocation** of existing work.
- Phases 10, 12, 14 remain deferred.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-01 | Loading/re-matching a large source image keeps the UI responsive — image decode and box-sampling do not block the main thread. (review W8) | The Architecture Patterns section specifies the exact transfer + OffscreenCanvas resample relocation; the Common Pitfalls section names the parity-preserving `createImageBitmap` option values; the Code Examples give worker/hook/probe skeletons. Responsiveness win = the heavy `drawImage`-resample + `getImageData` readback (currently synchronous on main at `useDiamondArtMatch.ts:112-113`) run in the worker; `createImageBitmap(HTMLImageElement)` on the main thread is cheap (references the already-decoded image, no pixel loop). |
</phase_requirements>

## Summary

This is a **pure work-relocation** phase, not a feature. Today `useDiamondArtMatch.ts:112-113` runs two synchronous main-thread operations before invoking the (already off-thread) matcher: `getImagePixels()` (a `canvas.drawImage(img, 0,0,w,h)` resample to the 2000px cap followed by a full-frame `getImageData` readback) and `boxSampleImage()` (a millions-of-pixels averaging loop). Both block paint on every match trigger for large images. The fix (locked as boundary option **b**, topology **A**) is to create an `ImageBitmap` from the loaded `HTMLImageElement` on the main thread, **transfer** it zero-copy into the existing `matcher.worker.ts`, and have the worker draw it to an `OffscreenCanvas`, `getImageData`, `boxSampleImage`, then match — one `postMessage` in, one result out.

The single highest risk is **resample byte-parity**: whether `OffscreenCanvas.getContext('2d').drawImage(imageBitmap, …)` produces byte-identical pixels to the current main-thread `HTMLCanvasElement` `drawImage(HTMLImageElement, …)`. Per spec the smoothing defaults are identical (`imageSmoothingEnabled=true`, `imageSmoothingQuality='low'`, `colorSpace='srgb'`) and in Chrome/Firefox/Safari both canvas types share the same rendering backend, so identical output is *expected* — but it is **implementation-defined, not spec-guaranteed**. The `createImageBitmap` options that silently change pixels (`premultiplyAlpha`, `colorSpaceConversion`, `imageOrientation`) must be pinned to values that mirror the current direct `drawImage(img)` path, and `resizeWidth/Height/Quality` must **not** be passed (resize stays in `drawImage`). This residual uncertainty is exactly why D-11 keeps a one-time manual in-browser fixture diff.

Two corrections to assumptions carried in CONTEXT.md, verified against live config: (1) the Vitest test environment is **`node`**, not jsdom (`vite.config.ts:9` → `environment: 'node'`); jsdom is installed but not the default env. Neither `node` nor jsdom exposes `OffscreenCanvas`/`createImageBitmap`, so the injectable-flag seam (D-08) is still required, and the existing `worker.test.ts` — which posts a **pre-sampled `pixels` array** directly — must be updated because the worker message shape changes. (2) `nyquist_validation` is `false`, so no formal Validation Architecture section is required; `boxSampleImage`'s existing unit test remains the CI math gate.

**Primary recommendation:** Keep `runMatching(pixels, …)` as a pure, node-testable core. Add a thin decode preamble in the worker guarded by the injectable capability flag: `drawImage(bitmap) → getImageData → boxSampleImage → runMatching`. Pin `createImageBitmap` options to `{ imageOrientation: 'from-image', premultiplyAlpha: 'none', colorSpaceConversion: 'default' }`, never pass `resizeWidth/Height`, and probe support via `new OffscreenCanvas(1,1).getContext('2d') !== null` (not a bare `typeof`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Initial image decode (`img.onload`) | Browser / Client (main) | — | Already happens before this phase; `HTMLImageElement` is decoded when `onload` fires. Unchanged. |
| `ImageBitmap` creation (`createImageBitmap(img)`) | Browser / Client (main) | — | Must run where the `HTMLImageElement` lives (window). Cheap — references the decoded image, no per-pixel loop. Produces a Transferable. |
| Transfer of `ImageBitmap` | Main → Worker boundary | — | Zero-copy `postMessage(msg, [bitmap])`; sender's handle is neutered. |
| Resample to ≤2000px (`drawImage`) | Worker (OffscreenCanvas) | — | **The jank being moved.** Off main thread per D-01. |
| Pixel readback (`getImageData`) | Worker (OffscreenCanvas) | — | Moves with the resample; readback is the other main-thread stall today. |
| Box-sampling / averaging (`boxSampleImage`) | Worker | — | Pure integer math, reused verbatim; call site relocated per D-02/D-05. |
| Color matching (CIEDE2000 loop) | Worker | — | Already off-thread; unchanged. |
| Capability probe | Main (init) + Worker (context test) | — | Flag decided once at init; the meaningful test is worker-side `getContext('2d')` availability. |
| Loading/progress UI + error banner | Frontend (Preact / App.tsx) | Hook (`useDiamondArtMatch`) | D-09/D-10 — reactive `loading`/`error` signals rendered in `App.tsx`. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native `createImageBitmap` | Browser API | Produce a Transferable `ImageBitmap` from the `HTMLImageElement` on main thread | Only zero-copy, transferable, decoded-image handle. Project convention: browser-native first (GEMINI.md §5). `[CITED: developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap]` |
| Native `OffscreenCanvas` + `getContext('2d')` | Browser API (Safari 16.4+) | Draw/resample the bitmap and read pixels inside the worker | The only way to run 2D canvas resample off the main thread. `[VERIFIED: MDN + WebKit — 2D-in-OffscreenCanvas landed Safari 16.4]` |
| `boxSampleImage` (existing) | `src/engine/ingest.ts:75` | Area-average downsample to the grid | Pure integer, deterministic, already unit-tested; reused verbatim (D-02). `[VERIFIED: codebase read]` |
| Existing Vite module worker | Vite `^6.0.7` | Hosts the folded decode step; bundled via `new Worker(new URL(...), {type:'module'})` | Native Vite worker bundling; no new worker file (D-04). `[VERIFIED: worker-client.ts:11, useDiamondArtMatch.ts:91]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript DOM lib types | tsc `^5.3.3` | `OffscreenCanvas`, `ImageBitmap`, `OffscreenCanvasRenderingContext2D`, `createImageBitmap` typings | Already available — `tsconfig.json:6` has `"lib": ["DOM","DOM.Iterable","ESNext"]`. **No lib change needed.** `[VERIFIED: tsconfig read]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Transfer decoded `ImageBitmap` | `createImageBitmap(blob)` in worker | Rejected D-03: Firefox historically blocks/slows blob decode in worker; higher parity risk. Not applicable to `createImageBitmap(HTMLImageElement)` on main thread. |
| `drawImage` resize in worker | `createImageBitmap(img, {resizeWidth, resizeQuality})` | Uses a *different*, high-quality resampler than the current `drawImage` path → guaranteed byte-divergence. **Must not use** (D-02). |
| New dedicated decode worker | Second worker + second abort channel | Rejected D-04/D-05: re-splits what the B2 fix unified. |

**Installation:** None. **No new npm packages** — all APIs are browser-native (aligns with GEMINI.md §5 "browser-native first" and the developer's "no re-introduced deps" directive).

## Package Legitimacy Audit

**Not applicable — this phase installs zero external packages.** All capability is browser-native (`createImageBitmap`, `OffscreenCanvas`) plus existing in-repo code. No registry lookup, no slopsquat surface.

## Architecture Patterns

### System Architecture Diagram

```
                          MAIN THREAD (useDiamondArtMatch effect)
  image: HTMLImageElement ──► already decoded at img.onload
        │
        │  capabilityFlag === false ──► setError("Couldn't process the image: update your browser") ──► [banner]
        ▼  (flag === true)
  setLoading(true) + "Preparing image…" (indeterminate)
        │
        ▼
  bitmap = await createImageBitmap(image, {imageOrientation:'from-image',
                                           premultiplyAlpha:'none',
                                           colorSpaceConversion:'default'})
        │
        │  superseded while awaiting? ─(seq check)─► bitmap.close(); return  (abort in-flight decode)
        ▼
  MatcherClient.match(bitmap, cols, rows, candidates, …)
        │  postMessage({kind:'match', bitmap, cols, rows, candidates, clearCache, runId}, [bitmap])  ◄── TRANSFER (zero-copy)
        ▼  (bitmap handle on main is now NEUTERED)
────────────────────────────────────────────────────────────────────────────
  WORKER (matcher.worker.ts)   currentRunId = runId
        │
        ▼
  off = new OffscreenCanvas(w,h)   // w,h = bitmap dims capped to ≤2000, same math as getImagePixels
  ctx = off.getContext('2d')       // defaults: smoothing on, quality 'low', srgb
  ctx.drawImage(bitmap, 0,0,w,h)   // ◄── THE MOVED RESAMPLE
  pixels = ctx.getImageData(0,0,w,h).data   // ◄── THE MOVED READBACK
  bitmap.close()                   // free promptly
        │
        │  runId !== currentRunId ? ──► return (superseded — D-05 guard BEFORE box-sample)
        ▼
  sampled = boxSampleImage(pixels, w, h, cols, rows)   // verbatim, crops to grid AR internally
        │
        ▼
  runMatching(runId, sampled, candidates, cols, clearCache)   // existing loop, yields + runId checks
        │  progress ──► postMessage({kind:'progress',...})  ──► onProgress ──► "Matching colors: {n}%" (determinate)
        ▼  result ──► postMessage({kind:'result',...})      ──► onComplete ──► setLoading(false)
   decode/draw throw ──► postMessage({kind:'error',...})    ──► onError ──► hook setError ──► [matchError banner]
```

### Recommended structure (files touched — no new files)
```
src/
├── features/match/useDiamondArtMatch.ts  # remove getImagePixels(); add createImageBitmap + in-flight abort;
│                                         #   inject/hold capability flag; "Preparing image…" loading label state
├── engine/matcher.worker.ts              # add decode preamble (OffscreenCanvas→getImageData→boxSampleImage)
│                                         #   guarded by injectable flag; keep runMatching(pixels) pure
├── engine/worker-client.ts               # match() signature: (bitmap, cols, rows, candidates, …) + transfer list
├── engine/ingest.ts                      # boxSampleImage UNCHANGED (import moves into worker)
├── App.tsx                               # banner copy generalized (line 1659); overlay label wording (D-09)
└── engine/__tests__/worker.test.ts       # UPDATE: inject decode stub / capability flag; feed pixels via seam
```

### Pattern 1: Pure core + injectable decode preamble (the D-08 seam)
**What:** Keep the box-sample→match core as a pure function taking `pixels`. Gate the OffscreenCanvas decode behind an injectable function/flag so node tests bypass it.
**When to use:** Always here — it satisfies D-08 (injectable flag), keeps `runMatching` node-testable, and holds D-07 (single hard-fail path) because the *only* production decode path is the OffscreenCanvas one.
**Example:**
```typescript
// Source: pattern derived from existing matcher.worker.ts + D-08
// Default production decoder — injectable so node/Vitest can stub it.
type Decoder = (bitmap: ImageBitmap, w: number, h: number) => Uint8ClampedArray;

let decodeToPixels: Decoder = (bitmap, w, h) => {
  const off = new OffscreenCanvas(w, h);
  const ctx = off.getContext('2d');            // defaults: smoothing on, quality 'low', srgb
  if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0, w, h);           // replicates getImagePixels() drawImage EXACTLY
  return ctx.getImageData(0, 0, w, h).data;
};

// test-only seam (mirrors how worker.test.ts already overrides globals):
export function __setDecoderForTest(fn: Decoder) { decodeToPixels = fn; }
```

### Pattern 2: Cap dimensions with the *exact* current math
**What:** Replicate `getImagePixels()` sizing verbatim so `drawImage` output geometry is identical.
```typescript
// Source: src/engine/useDiamondArtMatch.ts:51-60 (must be reproduced in worker)
let w = bitmap.width;   // == img.naturalWidth for a bitmap made from the loaded img
let h = bitmap.height;
const maxDimension = 2000;
if (w > maxDimension || h > maxDimension) {
  const scale = maxDimension / Math.max(w, h);
  w = Math.round(w * scale);
  h = Math.round(h * scale);
}
// then OffscreenCanvas(w,h); drawImage(bitmap,0,0,w,h); NO crop here (crop is inside boxSampleImage)
```
Note: current code reads `img.naturalWidth || img.width`. `ImageBitmap.width/height` equal the source's natural (EXIF-oriented) dimensions, so pass those. Confirm the fixture image's `naturalWidth === bitmap.width` during the D-11 check.

### Pattern 3: Transfer + abort of a superseded in-flight `createImageBitmap`
**What:** `createImageBitmap` returns a Promise with **no AbortSignal support** — you cannot cancel it. Discard by seq check after it resolves and `close()` the orphan bitmap.
```typescript
// Source: pattern for the hook effect; ties into existing runSeq (worker-client.ts)
const mySeq = ++seqRef.current;              // capture at effect start
const bitmap = await createImageBitmap(image, {
  imageOrientation: 'from-image',
  premultiplyAlpha: 'none',
  colorSpaceConversion: 'default',
});
if (mySeq !== seqRef.current) { bitmap.close(); return; }  // superseded: free, don't post
clientRef.current?.match(bitmap, cols, rows, activeCandidates, /* callbacks */);
// inside MatcherClient.match: this.worker.postMessage(msg, [bitmap]);  // transfer list
```

### Anti-Patterns to Avoid
- **Passing `resizeWidth`/`resizeHeight`/`resizeQuality` to `createImageBitmap`:** invokes a different (high-quality) resampler → byte-divergence from the current `drawImage` path. Resize only via `drawImage` in the worker.
- **Setting `colorSpaceConversion: 'none'`:** the current `drawImage(HTMLImageElement)` path applies default color management (ICC→sRGB); `'none'` would skip it and diverge on wide-gamut/ICC-tagged images. Keep `'default'`.
- **Structured-cloning the bitmap (forgetting the transfer list):** copies pixels (slow) and leaves two live bitmaps. Always pass `[bitmap]`.
- **A bare `typeof OffscreenCanvas !== 'undefined'` probe:** Safari 16.0–16.3 exposed `OffscreenCanvas` but returned `null` for `getContext('2d')`. Probe the actual 2D context.
- **A second worker or second abort channel:** violates D-04/D-05; re-splits the B2 unification.
- **Reimplementing `boxSampleImage`:** D-02 — reuse verbatim; its unit test is the CI math gate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Downscale a large image | Custom resampler (Pica/Jimp-style) | `OffscreenCanvas.drawImage` (browser resampler) | GEMINI.md §5 explicitly bans image-resize libs; native path is what parity is defined against. |
| Move a decoded image to a worker | Serialize pixels / re-decode | Transfer the `ImageBitmap` | Zero-copy; re-decode risks parity + perf (D-03). |
| Cancel a superseded run | New AbortController plumbing | Existing `runId`/`runSeq` + `close()` orphan bitmap | D-05; `createImageBitmap` has no AbortSignal anyway. |
| Area-average to grid | New averaging loop | `boxSampleImage` verbatim | D-02; already correct + tested. |
| Surface decode failure | New error UI | Phase 11 reactive `error` → `matchError` banner | D-10; auto-clears on next match. |

**Key insight:** Every "custom" option here is a parity or convention violation. The phase's whole value is that it changes *where* code runs, not *what bytes* it produces.

## Common Pitfalls

### Pitfall 1: Resample bytes differ between HTMLCanvasElement and OffscreenCanvas
**What goes wrong:** `drawImage` output is not byte-identical, breaking success criterion #2.
**Why it happens:** The 2D scaling algorithm is **implementation-defined**, not spec-pinned. In practice Chrome (Skia), Firefox, and Safari use the same backend for both canvas types, so within one browser they match — but this is not guaranteed by any standard.
**How to avoid:** (1) Match smoothing defaults — do **not** set `imageSmoothingEnabled`/`imageSmoothingQuality` on either canvas; both default to `true`/`'low'`. (2) Pin `createImageBitmap` options (below). (3) D-11 manual fixture diff on a real browser confirms it for the target platform.
**Warning signs:** A handful of grid cells differ near high-contrast edges in the D-11 diff.
`[CITED: html.spec.whatwg.org — imageSmoothingQuality default 'low'; canvas colorSpace default 'srgb']`

### Pitfall 2: `createImageBitmap` options silently alter pixels
**What goes wrong:** Default option values change alpha/color/orientation vs the direct `drawImage(img)` path.
**Why it happens:**
- `imageOrientation`: **spec default is `'none'` but MDN/modern browsers moved toward `'from-image'`, and the value is inconsistent across engines.** Meanwhile the *current* `drawImage(HTMLImageElement)` path honors EXIF orientation (Chrome ≥81 respects `image-orientation: from-image`). To match, set **`imageOrientation: 'from-image'`** explicitly. `[CITED: MDN createImageBitmap — notes the spec/impl default discrepancy]`
- `premultiplyAlpha`: default `'default'` (implementation may premultiply then un-premultiply on readback, losing sub-LSB precision for `alpha < 255`). Set **`'none'`** to best mirror the direct path. **Opaque images (all JPG, most PNG) are unaffected either way.** Note: browsers disagree on whether `'none'` is honored on canvas round-trip — flag semi-transparent PNGs as the residual D-11 risk. `[CITED: whatwg/html issue #10142]`
- `colorSpaceConversion`: default `'default'` = apply color management, which **matches** the current path. Keep `'default'` (never `'none'`).
**How to avoid:** Pass `{ imageOrientation:'from-image', premultiplyAlpha:'none', colorSpaceConversion:'default' }`.
**Warning signs:** Whole-image rotation mismatch (EXIF), or faint edge tint on wide-gamut photos.

### Pitfall 3: `worker.test.ts` breaks on the new message shape
**What goes wrong:** Existing tests `postMessage` a pre-sampled `pixels` array and expect matches; after D-06 the worker expects a transferred `ImageBitmap`, and node has neither `OffscreenCanvas` nor `ImageBitmap`.
**Why it happens:** Test env is **`node`** (`vite.config.ts:9`), not jsdom — corrects the CONTEXT.md assumption. jsdom (installed) also lacks these APIs, so switching envs would not help.
**How to avoid:** Route tests through the D-08 seam — inject a decode stub (`__setDecoderForTest`) that returns a known `Uint8ClampedArray`, or keep a test-only path where the worker accepts `pixels` directly when the capability flag is injected false. Preserve the four existing behaviors (result, abort, cache clear-on-palette-change, B2 supersede). The `MockWorker`/`globalThis.postMessage` override pattern in `worker.test.ts:33-102` is the established injection style to follow.
**Warning signs:** `ReferenceError: OffscreenCanvas is not defined` in `npm test`.

### Pitfall 4: Safari 16.0–16.3 false-positive capability
**What goes wrong:** `OffscreenCanvas` exists but `getContext('2d')` returns `null` in-worker → runtime crash instead of the clean D-07 "update your browser" banner.
**Why it happens:** 2D-in-OffscreenCanvas landed in **Safari 16.4** (Mar 2023). `[VERIFIED: MDN + WebKit commit — Chrome 69+, Firefox 105+, Safari 16.4+]`
**How to avoid:** Probe `typeof createImageBitmap === 'function' && typeof OffscreenCanvas !== 'undefined' && !!new OffscreenCanvas(1,1).getContext('2d')`. Ideally the *worker* also verifies `getContext('2d') !== null` at init and reports back; the main-thread probe is a good proxy since 16.0–16.3 also fails 2D on a window-side `OffscreenCanvas`.
**Warning signs:** Blank grid + uncaught worker error on old Safari instead of the banner.

### Pitfall 5: Forgetting to `close()` bitmaps → GPU memory growth
**What goes wrong:** Orphaned bitmaps (superseded decodes, or the worker's copy after `drawImage`) leak.
**How to avoid:** Worker calls `bitmap.close()` right after `drawImage`. Hook calls `bitmap.close()` on the superseded-before-post branch. A *transferred* bitmap needs no `close()` on the sender — it's neutered by transfer.

## Code Examples

### Capability probe (main thread, init-time, injectable)
```typescript
// Source: derived from D-08 + MDN OffscreenCanvas.getContext support notes
export function detectOffscreenSupport(): boolean {
  return (
    typeof createImageBitmap === 'function' &&
    typeof OffscreenCanvas !== 'undefined' &&
    !!new OffscreenCanvas(1, 1).getContext('2d')   // Safari 16.0–16.3 returns null here
  );
}
// Injected once at hook/worker init; tests pass an explicit boolean instead of calling this.
```

### Worker message handler (folded decode step, D-04/D-05)
```typescript
// Source: extension of existing matcher.worker.ts:17-32
ctx.onmessage = async (e: MessageEvent) => {
  const { kind } = e.data;
  if (kind === 'abort') { isAborted = true; return; }
  if (kind !== 'match') return;

  isAborted = false;
  const { bitmap, cols, rows, candidates, clearCache, runId } = e.data;
  currentRunId = runId;                       // adopt id — supersedes prior run (B2)
  try {
    // capDims replicates getImagePixels() sizing exactly
    const { w, h } = capDims(bitmap.width, bitmap.height, 2000);
    const pixels = decodeToPixels(bitmap, w, h);   // OffscreenCanvas draw+getImageData (injectable)
    bitmap.close();

    if (runId !== currentRunId || isAborted) return;   // D-05 guard BEFORE box-sample

    const sampled = boxSampleImage(pixels, w, h, cols, rows);  // verbatim, crops internally
    await runMatching(runId, sampled, candidates, cols, clearCache);
  } catch (err: any) {
    ctx.postMessage({ kind: 'error', runId, error: err.message || String(err) });
  }
};
```

### Client transfer (worker-client.ts, D-06)
```typescript
// Source: extension of existing MatcherClient.match (worker-client.ts:14-34)
public match(
  bitmap: ImageBitmap, cols: number, rows: number, candidates: DmcColor[],
  onProgress, onComplete, onError,
): void {
  const paletteHash = candidates.map(c => c.dmc).sort().join(',');
  const clearCache = paletteHash !== this.currentPaletteHash;
  this.currentPaletteHash = paletteHash;
  const runId = ++this.runSeq;
  this.worker.postMessage(
    { kind: 'match', bitmap, cols, rows, candidates, clearCache, runId },
    [bitmap],                                   // ◄── transfer list (zero-copy; neuters sender handle)
  );
  // onmessage / onerror wiring unchanged (B1/B2 filters keyed on runId still apply)
}
```

### Banner copy generalization (App.tsx:1659, D-10)
```tsx
// before:  Color matching failed: {matchError}
// after (stage-agnostic — reads correctly for decode OR match failures):
Couldn't process the image: {matchError}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Resample + readback on main thread (`getImagePixels`) | OffscreenCanvas resample in worker | This phase | Main thread stays responsive on 4000×3000 loads. |
| Serialize/copy pixels to worker | Transfer `ImageBitmap` (zero-copy) | Transferable ImageBitmap broadly available | No copy cost even for full-res source. |
| `drawImage` honored intrinsic (pre-EXIF) image | `drawImage(img)` honors EXIF via `image-orientation:from-image` | Chrome ≥81 | Must set `createImageBitmap` `imageOrientation:'from-image'` to match. |

**Deprecated/outdated:**
- The synchronous `getImagePixels()` helper (`useDiamondArtMatch.ts:50-69`) is removed; its logic migrates into the worker's `capDims` + `decodeToPixels`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `OffscreenCanvas` and `HTMLCanvasElement` `drawImage` produce byte-identical resample within a given browser | Summary / Pitfall 1 | Success criterion #2 fails; caught by D-11 manual diff (mitigated). MEDIUM — spec does not guarantee it. |
| A2 | `premultiplyAlpha:'none'` best mirrors the current path for semi-transparent PNGs | Pitfall 2 | Sub-LSB alpha differences on transparent PNGs; opaque images unaffected. Flag as the specific D-11 case. |
| A3 | Current `drawImage(HTMLImageElement)` path applies EXIF orientation (so `imageOrientation:'from-image'` matches) | Pitfall 2 / State of the Art | Whole-image rotation mismatch if the target browser's `drawImage` did *not* orient. Verify in D-11 with an EXIF-tagged fixture. |
| A4 | `ImageBitmap.width/height` equal `img.naturalWidth/Height` used by the current sizing math | Pattern 2 | Off-by geometry if EXIF swaps axes; verify `bitmap.width === naturalWidth` on the fixture. |

**None of A1–A4 are CI-guardable** (node can't run the decode path) — they are exactly the D-11 manual-gate scope.

## Open Questions

1. **Does the worker also need to self-probe `getContext('2d')`, or is the main-thread probe sufficient?**
   - What we know: main-thread `new OffscreenCanvas(1,1).getContext('2d')` fails on Safari 16.0–16.3, matching worker behavior.
   - What's unclear: any environment where main-thread 2D-OffscreenCanvas succeeds but the *worker* one does not.
   - Recommendation: Primary gate = main-thread probe (D-08 injectable flag). Belt-and-suspenders: worker posts `{kind:'error'}` if its own `getContext('2d')` is null, which already routes to the D-10 banner. Low cost, closes the edge case.

2. **Exact test strategy for `worker.test.ts` — inject decode stub vs. keep a pixels path.**
   - What we know: node has no OffscreenCanvas/ImageBitmap; existing tests feed `pixels`.
   - Recommendation: Expose `__setDecoderForTest(fn)` and have tests inject a stub returning known pixels; keep all four existing assertions. Planner decides whether the injected-flag-false branch also accepts a raw `pixels` message for the abort/cache/B2 tests (simplest — preserves those tests nearly verbatim).

## Environment Availability

**Skipped — no external tools/services/runtimes are introduced.** All dependencies are browser-native APIs evaluated at runtime in the user's browser (gated by the D-07 capability probe) and existing dev tooling (Vite 6, Vitest 3, tsc 5.3) already present in `package.json`. Build/test commands unchanged: `npm run build`, `npm test`.

## Security Domain

`security_enforcement: true`, ASVS Level 1. This phase adds **no new external input surface** — the source image is already user-loaded and processed today; the phase only relocates processing.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | minimal | Image is client-local, never uploaded; box-sample/match math unchanged. |
| V5 Output encoding | yes (inherited) | Worker error strings surface in the `matchError` banner as **plain JSX text children, never `dangerouslySetInnerHTML`** — the existing invariant (App.tsx:1652-1660) must be preserved so a crafted worker error string cannot inject markup. |
| V6 Cryptography | no | — |
| V2/V3/V4 Auth/Session/Access | no | Fully client-side, no auth. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Crafted worker error string → markup injection in banner | Tampering | Keep banner text-only (no `dangerouslySetInnerHTML`) — already the case; do not regress when generalizing copy (D-10). |
| Malformed/huge image → worker crash strands `loading` | DoS (local) | B1 `worker.onerror` seam already routes crashes to `onError` → `setLoading(false)`; decode errors reuse this path (D-10). |
| Memory growth from leaked `ImageBitmap` | Resource exhaustion | `bitmap.close()` after `drawImage` and on superseded-decode branch (Pitfall 5). |

No high-severity findings; nothing blocks under `security_block_on: high`.

## Sources

### Primary (HIGH confidence)
- MDN — `OffscreenCanvas` / `OffscreenCanvas.getContext()` support matrix (Chrome 69+, Firefox 105+, **Safari 16.4+**, 2D-in-worker probe guidance) — `developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas/getContext`
- WebKit commit + release notes — 2D context enabled in OffscreenCanvas in Safari 16.4
- WHATWG HTML Standard — canvas `imageSmoothingQuality` default `'low'`, canvas `colorSpace` default `'srgb'`, ImageBitmap options — `html.spec.whatwg.org/multipage/canvas.html`, `.../imagebitmap-and-animations.html`
- Live codebase reads: `useDiamondArtMatch.ts` (getImagePixels 50-69; effect 103-138), `matcher.worker.ts` (17-103), `worker-client.ts` (14-56), `ingest.ts` (boxSampleImage 75-121), `App.tsx` (overlay 1642-1660), `worker.test.ts` (MockWorker seam 33-102), `vite.config.ts` (env=node), `tsconfig.json` (DOM lib present)

### Secondary (MEDIUM confidence)
- MDN — `Window.createImageBitmap()` options and the noted spec-vs-implementation default discrepancy for `imageOrientation` — `developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap`
- whatwg/html issue #10142 — cross-browser inconsistency of `premultiplyAlpha:'none'` on canvas round-trip

### Tertiary (LOW confidence)
- Aggregator summaries of OffscreenCanvas browser support (corroborate the Safari 16.4 boundary, not sole source)

## Metadata

**Confidence breakdown:**
- Standard stack / transfer mechanics: HIGH — spec + codebase confirmed, no new deps.
- Capability probe / Safari 16.4 boundary: HIGH — MDN + WebKit corroborated.
- Test seam design: HIGH — env confirmed `node`; existing injection pattern in `worker.test.ts`.
- Resample byte-parity (A1–A4): MEDIUM — implementation-defined; intentionally covered by the D-11 manual gate, not CI.

**Research date:** 2026-07-12
**Valid until:** ~2026-08-11 (stable browser APIs; re-verify only if Safari min-version target shifts)
