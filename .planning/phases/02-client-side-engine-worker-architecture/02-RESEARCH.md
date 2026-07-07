# Phase 02 Research: Client-side Engine & Worker Architecture

## User Constraints

### Locked Decisions (verbatim from 02-CONTEXT.md)
*   **Image Loading & Sizing**
    *   **D-01:** Implement **Crop (cover)** as the sole image-to-grid mapping mode. The image is scaled to completely fill the target grid dimensions, cropping any overflow. No fit/stretch/padding modes — this avoids aspect ratio distortion and eliminates the need to handle empty padding cells.
    *   **D-02:** Accept canvas size via two input modes: direct grid dimensions (rows/cols) and physical dimensions (cm/inches) with automatic dot calculation at standard drill density (2.5mm per drill, 10 dots per inch).
*   **Downscaling Algorithm**
    *   **D-03:** Use **Box Sampling (Area Averaging)** for downscaling the source image to grid dimensions. Divide the source image into blocks matching each grid cell, compute the average RGBA of all pixels in each block. This produces the most color-accurate representative value for CIEDE2000 matching downstream. The browser's native `canvas.drawImage()` is used only for decoding the image file into raw pixel data, not for the actual downscaling.
*   **Web Worker Architecture**
    *   **D-04:** Use a **single persistent Web Worker** spawned at app startup, kept alive across runs, and communicated with via `postMessage`. No terminate-and-respawn pattern.
    *   **D-05:** Implement **abort signaling** for in-progress matching runs. When the user changes parameters mid-run, send an abort flag to the worker. The worker checks this flag between pixel batches in the matching loop and discards partial results on abort.
    *   **D-06:** Design the Worker message protocol with typed message kinds (e.g., `{ kind: 'match', pixels, candidates }`, `{ kind: 'abort' }`, `{ kind: 'result', matches, counts }`, `{ kind: 'progress', percent }`).
*   **RGBA Match Cache**
    *   **D-07:** **Persist the RGBA-to-DMC match cache across runs** as long as the active color palette has not changed. Cache hits bypass the CIEDE2000 distance loop entirely. This optimizes the common workflow of the user loading one image and trying different canvas sizes.
    *   **D-08:** **Invalidate (clear) the cache** whenever the active palette selection changes, since a different set of candidate colors produces different nearest-match results.
*   **Carrying Forward from Phase 1**
    *   **D-09 (from P1-D-09):** Matching functions accept flat serializable inputs (`Uint8ClampedArray` for pixel data, array of `DmcColor` candidates) for Web Worker compatibility.
    *   **D-10 (from P1-D-12):** `matchPixelGrid` returns `{ matches: string[], counts: Record<string, number> }` — flat array of DMC codes plus aggregated count summary.

---

## Technical Domain Research

### 1. Ingestion & Sizing Logic

#### A. Local Image Loading via HTML5 File API
To ensure privacy and high performance, image file loading occurs entirely client-side. We read files selected via a standard `<input type="file">` or dragged into a drop zone, converting them to in-memory URL references:
```typescript
const objectUrl = URL.createObjectURL(file);
```
An `HTMLImageElement` is then instantiated, loading the object URL to decode the image. When the image is loaded, we draw it to an offscreen canvas to obtain raw `ImageData` containing the source sRGB pixels:
```typescript
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
// draw at natural size to avoid losing detail before downscaling
canvas.width = img.naturalWidth;
canvas.height = img.naturalHeight;
ctx.drawImage(img, 0, 0);
const srcData = ctx.getImageData(0, 0, canvas.width, canvas.height);
```

#### B. Sizing Conversions
Users specify size in two modes:
1. **Direct Sizing**: Rows and Columns (integer boundaries).
2. **Physical Sizing**: Width and Height in cm/inches. Standard diamond painting drill density is exactly 2.5mm per drill or 10 drills per inch. The conversion formulas are:
   - **Metric**: $\text{dots} = \text{dimension (cm)} \times 10 / 2.5 = \text{dimension (cm)} \times 4$
   - **Imperial**: $\text{dots} = \text{dimension (inches)} \times 10$
   - Dot counts are always rounded to the nearest integer.

#### C. Aspect Ratio Cover/Crop Calculations
To fit the image to the target columns ($W_{\text{target}}$) and rows ($H_{\text{target}}$) while preserving the original aspect ratio without stretching or padding, we crop the source image first. Let $AR_{\text{src}} = W_{\text{src}} / H_{\text{src}}$ and $AR_{\text{target}} = W_{\text{target}} / H_{\text{target}}$:

1. **If $AR_{\text{src}} > AR_{\text{target}}$**: The source image is wider than the target. We crop the left/right sides.
   - Crop Width: $W_{\text{crop}} = H_{\text{src}} \times AR_{\text{target}}$
   - Crop Height: $H_{\text{crop}} = H_{\text{src}}$
   - Crop X Offset: $X_{\text{offset}} = (W_{\text{src}} - W_{\text{crop}}) / 2$
   - Crop Y Offset: $Y_{\text{offset}} = 0$
2. **If $AR_{\text{src}} < AR_{\text{target}}$**: The source image is taller than the target. We crop the top/bottom.
   - Crop Width: $W_{\text{crop}} = W_{\text{src}}$
   - Crop Height: $H_{\text{crop}} = W_{\text{src}} / AR_{\text{target}}$
   - Crop X Offset: $X_{\text{offset}} = 0$
   - Crop Y Offset: $Y_{\text{offset}} = (H_{\text{src}} - H_{\text{crop}}) / 2$

---

### 2. Box Sampling Downscaler

Rather than standard linear interpolation (which introduces visual artifacts like blur or halos at cell boundaries), we implement Box Sampling (Area Averaging) to compute the average color of all pixels in the source bounding box corresponding to each grid cell.

For each cell $(col, row)$ where $0 \le col < W_{\text{target}}$ and $0 \le row < H_{\text{target}}$:
- Bounding Box in cropped source space:
  - $X_{\text{start}} = \lfloor col \times (W_{\text{crop}} / W_{\text{target}}) + X_{\text{offset}} \rfloor$
  - $X_{\text{end}} = \lfloor (col + 1) \times (W_{\text{crop}} / W_{\text{target}}) + X_{\text{offset}} \rfloor$
  - $Y_{\text{start}} = \lfloor row \times (H_{\text{crop}} / H_{\text{target}}) + Y_{\text{offset}} \rfloor$
  - $Y_{\text{end}} = \lfloor (row + 1) \times (H_{\text{crop}} / H_{\text{target}}) + Y_{\text{offset}} \rfloor$

To avoid division by zero or empty intervals due to rounding, we ensure $X_{\text{end}} \ge X_{\text{start}} + 1$ and $Y_{\text{end}} \ge Y_{\text{start}} + 1$.
Inside the bounding box, we sum the $R, G, B, A$ channels and divide by the pixel count:
```typescript
let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
let count = 0;

for (let y = yStart; y < yEnd; y++) {
  for (let x = xStart; x < xEnd; x++) {
    const idx = (y * srcWidth + x) * 4;
    rSum += srcPixels[idx];
    gSum += srcPixels[idx + 1];
    bSum += srcPixels[idx + 2];
    aSum += srcPixels[idx + 3];
    count++;
  }
}

const rAvg = Math.round(rSum / count);
const gAvg = Math.round(gSum / count);
const bAvg = Math.round(bSum / count);
const aAvg = Math.round(aSum / count);
```
This produces a flat `Uint8ClampedArray` of length $W_{\text{target}} \times H_{\text{target}} \times 4$ containing the averaged grid cells.

---

### 3. Persistent Web Worker Architecture

#### A. Vite Integration
In Vite, Web Workers are instantiated using the native `URL` constructor:
```typescript
const worker = new Worker(
  new URL('./matcher.worker.ts', import.meta.url),
  { type: 'module' }
);
```

#### B. Message Protocol
The worker communications use flat serializable JSON messages.
**To Worker**:
- `{ kind: 'match', pixels: Uint8ClampedArray, candidates: DmcColor[] }` — start a matching run.
- `{ kind: 'abort' }` — request the cancellation of the active run.

**From Worker**:
- `{ kind: 'progress', percent: number }` — progress update (0-100) for UI loading indicators.
- `{ kind: 'result', matches: string[], counts: Record<string, number> }` — completed matching coordinates and counts.
- `{ kind: 'error', error: string }` — error boundaries reporting.

#### C. Abort & Batch Loop Logic
To check for abort events without blocking worker execution, we execute the matching loop in batches (e.g., 10 rows at a time). We handle messages by setting a shared state boolean `isAborted`.

```typescript
let isAborted = false;

self.onmessage = (e) => {
  if (e.data.kind === 'abort') {
    isAborted = true;
  } else if (e.data.kind === 'match') {
    isAborted = false;
    runMatching(e.data.pixels, e.data.candidates);
  }
};
```
Inside the generator loop:
```typescript
for (let row = 0; row < totalRows; row++) {
  if (isAborted) {
    // silently discard results and stop matching
    return;
  }
  // Match pixels in this row...
  // Send progress after each row or batch of rows
}
```

---

### 4. RGBA-to-DMC Caching & Persistence

#### A. Cache Key
Because alpha composition occurs before matching, different alpha transparency levels result in different background-blended colors. We must key the cache using raw `RGBA` values. We encode the 4-byte RGBA value into a numeric primitive key to avoid string allocations:
$$\text{Key} = (R \times 16777216) + (G \times 65536) + (B \times 256) + A$$
This uses standard multiplication and addition, avoiding bitwise sign bit shifts on the MSB (Red) which can cause signed conversion overhead in JS engines.

```typescript
const rgbaCache = new Map<number, string>(); // maps RGBA key to DMC color code
```

#### B. Invalidation Strategy
The cache is kept active across consecutive runs on the same canvas or image. However, it must be cleared when the active candidate set changes.
Inside the host thread wrapper or worker manager:
```typescript
let lastPaletteHash = '';

function getPaletteHash(candidates: DmcColor[]): string {
  // Simple hash of active codes to check for palette changes
  return candidates.map(c => c.dmc).sort().join(',');
}

// In worker, if palette changes:
if (currentHash !== lastPaletteHash) {
  rgbaCache.clear();
  lastPaletteHash = currentHash;
}
```
This guarantees correctness while boosting performance during size changes.
