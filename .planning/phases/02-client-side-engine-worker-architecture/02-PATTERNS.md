# Phase 2: Client-side Engine & Worker Architecture - Pattern Map

**Mapped:** 2026-07-07
**Files analyzed:** 5
**Analogs found:** 0 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/engine/ingest.ts` | utility | transform | `src/engine/color.ts` | Medium |
| `src/engine/matcher.worker.ts` | service | transform | None (Greenfield Worker) | N/A |
| `src/engine/worker-client.ts` | service | control | None (Greenfield Client) | N/A |
| `src/engine/__tests__/ingest.test.ts` | test | transform | `src/engine/__tests__/color.test.ts` | High |
| `src/engine/__tests__/worker.test.ts` | test | transform | `src/engine/__tests__/color.test.ts` | High |

---

## Pattern Assignments

### `src/engine/ingest.ts` (utility, transform)

**Crop/Cover Bounding Box Math Pattern**:
Determine the cropped coordinates of the source image to fit the target aspect ratio.
```typescript
export interface CropBounds {
  xOffset: number;
  yOffset: number;
  cropWidth: number;
  cropHeight: number;
}

export function calculateCropBounds(
  srcWidth: number,
  srcHeight: number,
  targetCols: number,
  targetRows: number
): CropBounds {
  const arSrc = srcWidth / srcHeight;
  const arTarget = targetCols / targetRows;

  if (arSrc > arTarget) {
    const cropWidth = srcHeight * arTarget;
    return {
      xOffset: Math.floor((srcWidth - cropWidth) / 2),
      yOffset: 0,
      cropWidth: Math.floor(cropWidth),
      cropHeight: srcHeight
    };
  } else {
    const cropHeight = srcWidth / arTarget;
    return {
      xOffset: 0,
      yOffset: Math.floor((srcHeight - cropHeight) / 2),
      cropWidth: srcWidth,
      cropHeight: Math.floor(cropHeight)
    };
  }
}
```

**Box Sampling (Area Averaging) Pattern**:
For each grid cell, sample and average the corresponding rectangular block from the source image.
```typescript
export function boxSampleImage(
  srcPixels: Uint8ClampedArray,
  srcWidth: number,
  srcHeight: number,
  targetCols: number,
  targetRows: number
): Uint8ClampedArray {
  const bounds = calculateCropBounds(srcWidth, srcHeight, targetCols, targetRows);
  const dstPixels = new Uint8ClampedArray(targetCols * targetRows * 4);

  const blockWidth = bounds.cropWidth / targetCols;
  const blockHeight = bounds.cropHeight / targetRows;

  for (let row = 0; row < targetRows; row++) {
    for (let col = 0; col < targetCols; col++) {
      const xStart = Math.floor(col * blockWidth + bounds.xOffset);
      const xEnd = Math.max(xStart + 1, Math.floor((col + 1) * blockWidth + bounds.xOffset));
      const yStart = Math.floor(row * blockHeight + bounds.yOffset);
      const yEnd = Math.max(yStart + 1, Math.floor((row + 1) * blockHeight + bounds.yOffset));

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

      const dstIdx = (row * targetCols + col) * 4;
      dstPixels[dstIdx] = Math.round(rSum / count);
      dstPixels[dstIdx + 1] = Math.round(gSum / count);
      dstPixels[dstIdx + 2] = Math.round(bSum / count);
      dstPixels[dstIdx + 3] = Math.round(aSum / count);
    }
  }

  return dstPixels;
}
```

---

### `src/engine/matcher.worker.ts` (service, transform)

**Asynchronous Matching Batch Loop with Abort Pattern**:
Listen for incoming matching configurations, tracking abort states, and matching colors in batch rows.
```typescript
import { matchPixelGrid } from './color';
import { DmcColor } from './types';

let isAborted = false;

self.onmessage = (e: MessageEvent) => {
  const { kind } = e.data;

  if (kind === 'abort') {
    isAborted = true;
  } else if (kind === 'match') {
    isAborted = false;
    const { pixels, candidates } = e.data;
    runMatching(pixels, candidates);
  }
};

function runMatching(pixels: Uint8ClampedArray, candidates: DmcColor[]) {
  // Batch processing loop...
  // check isAborted at start of batch, postMessage progress, postMessage result
}
```

---

### `src/engine/worker-client.ts` (service, control)

**Web Worker Client Manager Wrapper**:
Encapsulate Web Worker lifecycle, callbacks, abort requests, and palette cache tracking.
```typescript
import { DmcColor } from './types';

export class MatcherClient {
  private worker: Worker;
  private currentPaletteHash: string = '';

  constructor(workerUrl: URL) {
    this.worker = new Worker(workerUrl, { type: 'module' });
  }

  public match(
    pixels: Uint8ClampedArray,
    candidates: DmcColor[],
    onProgress: (percent: number) => void,
    onComplete: (result: { matches: string[]; counts: Record<string, number> }) => void
  ) {
    const paletteHash = candidates.map(c => c.dmc).sort().join(',');
    const clearCache = paletteHash !== this.currentPaletteHash;
    this.currentPaletteHash = paletteHash;

    this.worker.postMessage({ kind: 'abort' });
    this.worker.postMessage({
      kind: 'match',
      pixels,
      candidates,
      clearCache
    });

    this.worker.onmessage = (e) => {
      if (e.data.kind === 'progress') {
        onProgress(e.data.percent);
      } else if (e.data.kind === 'result') {
        onComplete({ matches: e.data.matches, counts: e.data.counts });
      }
    };
  }

  public terminate() {
    this.worker.terminate();
  }
}
```
