# Phase 13: Performance — Off-Main-Thread Decode - Pattern Map

**Mapped:** 2026-07-12
**Files analyzed:** 6 modified (no new files — topology A, pure relocation)
**Analogs found:** in-repo for every seam (decode preamble derives from existing worker + test-injection pattern)

> This phase creates **no new module files** (D-04). Every change edits an existing file. So this map pairs each **modified file** with the exact current-code excerpts (line numbers) the executor must edit/replicate, and pairs the one **new capability (the injectable decode/flag seam, D-08)** with its closest in-repo analog (the `worker.test.ts` global-override injection style).

---

## File Classification

| Modified File | Role | Data Flow | What Changes | Decisions |
|---------------|------|-----------|--------------|-----------|
| `src/features/match/useDiamondArtMatch.ts` | hook | request-response (async) | Remove `getImagePixels()` + main-thread `boxSampleImage`; add `createImageBitmap` + in-flight seq-abort; inject capability flag; add "Preparing image…" loading label state | D-01, D-06, D-08, D-09, D-10 |
| `src/engine/matcher.worker.ts` | worker | transform / streaming-progress | Add decode preamble (OffscreenCanvas→getImageData→boxSampleImage) guarded by injectable decoder; keep `runMatching(pixels)` pure; move `currentRunId` guard to BEFORE box-sample | D-02, D-04, D-05 |
| `src/engine/worker-client.ts` | client/service | request-response + transfer | `match()` signature: `(bitmap, cols, rows, candidates, …)`; add `[bitmap]` transfer list; onmessage/onerror seams unchanged | D-06 |
| `src/engine/ingest.ts` | utility | transform (pure) | **UNCHANGED** — `boxSampleImage` reused verbatim; its import moves into the worker | D-02 |
| `src/App.tsx` | component | — | Generalize banner copy (line 1659); overlay label wording (D-09, line 1648) | D-09, D-10 |
| `src/engine/__tests__/worker.test.ts` | test | — | Route through D-08 decode seam; feed pixels via injected stub; preserve 4 existing behaviors | D-08 |

**Vitest env confirmed:** `vite.config.ts:9` → `environment: 'node'` (NOT jsdom). RESEARCH.md correction verified. Neither node nor jsdom exposes `OffscreenCanvas`/`ImageBitmap`, so the injectable flag/decoder seam (D-08) is mandatory for testability.

---

## Pattern Assignments

### `src/features/match/useDiamondArtMatch.ts` (hook, async request-response)

**read_first:** `useDiamondArtMatch.ts:49-138` (getImagePixels + the trigger effect + call site)

**REMOVE — current `getImagePixels()`** (lines 50-69) — its sizing math migrates into the worker's `capDims`, its draw+readback becomes the worker's `decodeToPixels`:
```typescript
function getImagePixels(img: HTMLImageElement): { pixels: Uint8ClampedArray; width: number; height: number } {
  const canvas = document.createElement('canvas');
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  const maxDimension = 2000;
  if (w > maxDimension || h > maxDimension) {
    const scale = maxDimension / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2d context for image pixels');
  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  return { pixels: imageData.data, width: w, height: h };
}
```

**REPLACE — current synchronous call site** (lines 107-138) — the `try` block runs sync work then calls `match(downsampled, …)`. New: set indeterminate "Preparing image…" label, `await createImageBitmap`, seq-abort a superseded decode, then `match(bitmap, cols, rows, …)`:
```typescript
setLoading(true);
setProgress(0);
setError(null);
try {
  const { pixels, width: srcW, height: srcH } = getImagePixels(image);   // ← both lines removed
  const downsampled = boxSampleImage(pixels, srcW, srcH, cols, rows);    // ← moves into worker
  clientRef.current?.match(
    downsampled,                       // ← becomes: bitmap, cols, rows
    activeCandidates,
    pct => setProgress(pct),
    result => { setLoading(false); setRawMatchResult(result); },
    message => { console.error('Match failed:', message); setLoading(false); setError(message); },
    cols                               // ← cols/rows now passed as explicit args (D-06)
  );
} catch (err) { … setLoading(false); setError(...); }
```
Effect deps stay `[image, cols, rows, candidatesKey]` (line 138). Note: the `catch` already routes to `setError` → this is the reactive `error` signal D-10 wants for decode failures.

**Signal surface (D-09/D-10 — preserve):** `MatchState` (lines 38-47) and the return `{ matchResult, symbolMap, loading, progress, error, restore }` (line 181). `loading` cleared on error via the `catch` and the worker `onError` callback — keeps the D-09 "spinner never co-displays with banner" invariant. D-09 loading-label: add a small state (e.g. `phase: 'preparing' | 'matching'`) or a label string in the signal surface, flipped from "preparing" to "matching" on the first `onProgress`.

**Import to keep:** `import { boxSampleImage } from '../../engine/ingest';` (line 5) is **removed from the hook** and added inside the worker (the call site moves, D-02).

**createImageBitmap options (RESEARCH Pattern 3 / Pitfall 2 — pin exactly):**
```typescript
const bitmap = await createImageBitmap(image, {
  imageOrientation: 'from-image', premultiplyAlpha: 'none', colorSpaceConversion: 'default',
});
if (mySeq !== seqRef.current) { bitmap.close(); return; }   // superseded in-flight decode
```

---

### `src/engine/matcher.worker.ts` (worker, transform + streaming-progress)

**read_first:** `matcher.worker.ts:1-103` (whole file — 103 lines)

**Current `onmessage` handler** (lines 17-32) — extend the `'match'` branch with the decode preamble; `currentRunId = runId` adoption at line 25 stays:
```typescript
} else if (kind === 'match') {
  isAborted = false;
  const { pixels, candidates, clearCache, cols, runId } = e.data;   // pixels → bitmap, cols, rows
  currentRunId = runId; // adopt the client-supplied id — supersedes any prior run (B2)
  try {
    await runMatching(runId, pixels, candidates, cols, clearCache);  // ← preamble inserted before this
  } catch (err: any) {
    ctx.postMessage({ kind: 'error', runId, error: err.message || String(err) });
  }
}
```
New body (per RESEARCH §"Worker message handler"): destructure `{ bitmap, cols, rows, ... }`; `capDims(bitmap.width, bitmap.height, 2000)` (verbatim sizing math from the removed `getImagePixels` lines 55-60); `pixels = decodeToPixels(bitmap, w, h)`; `bitmap.close()`; **then the D-05 guard `if (runId !== currentRunId || isAborted) return;` BEFORE** `boxSampleImage(pixels, w, h, cols, rows)`; then `runMatching(runId, sampled, candidates, cols, clearCache)`. The existing `try/catch` already routes throws to `{kind:'error'}` — decode throws reuse it (D-10).

**Abort guard placement (D-05):** the existing guard lives INSIDE `runMatching` at the top of the row loop (lines 57-59) and again pre-result (lines 98-100). D-05 requires an ADDITIONAL guard placed **after decode, before box-sample** so a superseded decode bails at the existing boundary — do not remove the in-loop guards.

**`runMatching` stays pure** (lines 36-103) — it already takes `pixels: Uint8ClampedArray`; keep it node-testable. Only the call site's `pixels` source changes (now from `decodeToPixels`).

**Palette-hash cache** (`rgbaCache` line 8, `clearCache` handling lines 43-46) — unchanged (D-05).

**Node/self cast** (line 5, `ctx = typeof self !== 'undefined' ? self : globalThis`) — the established pattern the injected decoder seam must coexist with; `OffscreenCanvas` is undefined under node, hence the injectable `decodeToPixels`.

**Injectable decoder seam (D-08 — the one new pattern):**
```typescript
type Decoder = (bitmap: ImageBitmap, w: number, h: number) => Uint8ClampedArray;
let decodeToPixels: Decoder = (bitmap, w, h) => {
  const off = new OffscreenCanvas(w, h);
  const c = off.getContext('2d');            // defaults: smoothing on, quality 'low', srgb
  if (!c) throw new Error('OffscreenCanvas 2D context unavailable');
  c.drawImage(bitmap, 0, 0, w, h);           // replicates getImagePixels() drawImage EXACTLY
  return c.getImageData(0, 0, w, h).data;
};
export function __setDecoderForTest(fn: Decoder) { decodeToPixels = fn; }
```

---

### `src/engine/worker-client.ts` (client, request-response + transfer)

**read_first:** `worker-client.ts:1-61` (whole file — 61 lines)

**Current `match()` signature** (lines 14-34) — first param `pixels: Uint8ClampedArray` becomes `bitmap: ImageBitmap` + explicit `cols, rows`; `postMessage` gains a `[bitmap]` transfer list:
```typescript
public match(
  pixels: Uint8ClampedArray,     // → bitmap: ImageBitmap, cols: number, rows: number
  candidates: DmcColor[],
  onProgress, onComplete, onError?, cols?,   // cols currently trailing/optional — promote to explicit
): void {
  const paletteHash = candidates.map((c) => c.dmc).sort().join(',');   // KEEP verbatim
  const clearCache = paletteHash !== this.currentPaletteHash;          // KEEP
  this.currentPaletteHash = paletteHash;
  const runId = ++this.runSeq;                                          // KEEP (B2 runSeq)
  this.worker.postMessage(
    { kind: 'match', pixels, candidates, clearCache, cols, runId },     // pixels→bitmap; add rows
    // ← ADD transfer list: [bitmap]
  );
  …
}
```

**onmessage / onerror seams (B1/B2) — UNCHANGED** (lines 36-55): the `if (e.data.runId !== runId) return;` stale-drop filter (line 38), the progress/result/error dispatch (39-47), and the `this.worker.onerror` crash→`onError` seam (52-55) all stay. Decode `{kind:'error'}` messages route through the same path (D-10). `runSeq` (line 8) unchanged.

---

### `src/engine/ingest.ts` (utility, pure) — UNCHANGED

**read_first:** `ingest.ts:75-121` (`boxSampleImage`) and `42-68` (`calculateCropBounds`)

`boxSampleImage(srcPixels, srcWidth, srcHeight, targetCols, targetRows)` (line 75) is reused **verbatim** (D-02) — pure integer averaging, calls `calculateCropBounds` internally (line 82) so cropping stays inside it (no crop in the worker's `drawImage`). Only its **import site moves** from the hook (line 5) into the worker. Its jsdom/node unit test remains the CI math parity gate (D-11). Do not edit this file.

---

### `src/App.tsx` (component) — copy edits only

**read_first:** `App.tsx:1642-1661` (loading overlay + matchError banner); binding at `App.tsx:395`

**Banner copy (D-10) — line 1659:**
```tsx
Color matching failed: {matchError}        // → Couldn't process the image: {matchError}
```
`matchError` is the hook's `error` signal, bound at line 395: `const { …, error: matchError } = useDiamondArtMatch({…})`. Keep text-only (no `dangerouslySetInnerHTML`) — security invariant (App.tsx:1652-1660 comment, RESEARCH §Security V5).

**Overlay label (D-09) — line 1648:**
```tsx
<span …>Matching colors: {progress}%</span>
```
Becomes phase-labeled: indeterminate bar + "Preparing image…" during decode, flip to determinate "Matching colors: {progress}%" on first `onProgress`. The bar markup (lines 1645-1647) drives width off `progress`; for the indeterminate state either render a pulsing/full bar or gate the determinate width on the new phase flag from the hook. Preserve `{loading && …}` gating (line 1643) so spinner and `{matchError && …}` banner (line 1657) never co-display.

---

## Shared Patterns

### Test-injection seam (analog for the new D-08 decoder stub)
**Source:** `src/engine/__tests__/worker.test.ts:33-102`
**Apply to:** the D-08 `__setDecoderForTest` wiring in `worker.test.ts`
The established injection style is a `MockWorker implements Worker` class (lines 33-80) plus `beforeAll` overriding `globalThis.postMessage` / `globalThis.Worker` and importing the worker module so it registers `globalThis.onmessage` (lines 84-102):
```typescript
(globalThis as any).Worker = MockWorker;
await import('../matcher.worker');
workerOnMessage = (globalThis as any).onmessage;
```
The new decode seam mirrors this: import `__setDecoderForTest` from `../matcher.worker` and in `beforeAll`/`beforeEach` inject a stub `(bitmap, w, h) => knownPixels`. Because node has no `ImageBitmap`, the four existing tests (result lines 122-155, abort 157-190, cache clear-on-palette-change 192-242, B2 supersede 244-286) either (a) pass a fake bitmap-like `{width,height}` object + stubbed decoder returning today's `pixels` arrays, or (b) keep a flag-false path that accepts a raw `pixels` message (RESEARCH Open Question 2 — planner's call). Preserve all four assertions verbatim.

### Reactive error routing (B1 + Phase 11 banner)
**Source:** `worker-client.ts:52-55` (`worker.onerror`→`onError`) → hook `catch`/`onError`→`setError` (`useDiamondArtMatch.ts:123-127, 130-134`) → `App.tsx:1657-1661` banner
**Apply to:** worker decode failures (D-10) — they post `{kind:'error'}` (already handled at `worker-client.ts:43-46`) and surface in the same `matchError` banner, auto-clearing on the next match (`setError(null)` at `useDiamondArtMatch.ts:109`).

### Monotonic supersede (B2) — extend, don't replace
**Source:** `worker-client.ts:8,26` (`runSeq`/`runId`) + `matcher.worker.ts:15,25,57-59,98-100` (`currentRunId` guards)
**Apply to:** the whole decode+sample+match pipeline (D-05). Add a `runId === currentRunId` check after decode; add a hook-side `seqRef` check after `await createImageBitmap` to discard + `close()` a superseded in-flight bitmap. No second worker, no second abort channel.

---

## No Analog Found

| Concern | Reason | Fallback |
|---------|--------|----------|
| OffscreenCanvas `drawImage` resample | No prior OffscreenCanvas usage in repo; the only precedent is the main-thread `HTMLCanvasElement` path in the removed `getImagePixels` (`useDiamondArtMatch.ts:62-67`) | Replicate that draw path exactly (D-02); parity is the one-time manual D-11 gate — not CI-guardable |
| `createImageBitmap` on main thread | No prior use in repo | Follow RESEARCH Pattern 3 pinned options |
| Capability probe | No prior feature-detect probe in repo | RESEARCH §"Capability probe" — `!!new OffscreenCanvas(1,1).getContext('2d')`, injected as the D-08 flag |

---

## Metadata

**Analog search scope:** `src/engine/`, `src/features/match/`, `src/App.tsx`, `src/engine/__tests__/`, `vite.config.ts`
**Files read (full or targeted):** `useDiamondArtMatch.ts` (1-183), `matcher.worker.ts` (1-103), `worker-client.ts` (1-61), `ingest.ts` (1-121), `worker.test.ts` (1-287), `App.tsx` (1600-1689 targeted), `vite.config.ts` (1-18)
**Confirmations:** Vitest env = `node` (`vite.config.ts:9`) ✓; `boxSampleImage` signature at `ingest.ts:75` ✓; B1/B2 seams at `worker-client.ts:38,52` ✓; banner copy at `App.tsx:1659`, overlay label at `App.tsx:1648` ✓
**Pattern extraction date:** 2026-07-12
