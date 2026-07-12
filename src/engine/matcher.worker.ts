import { blendAlpha, matchColor, clearCache } from './color';
import { boxSampleImage } from './ingest';
import { DmcColor } from './types';

// Cast self (or globalThis in Node testing) to any to avoid type conflicts
const ctx: Worker = (typeof self !== 'undefined' ? self : globalThis) as any;

// The cache of RGBA numeric keys to DMC codes
const rgbaCache = new Map<number, string>();

let isAborted = false;

// Parity cap with the removed main-thread getImagePixels path (D-02): the resample
// target's larger axis never exceeds this.
const MAX_DIMENSION = 2000;

// Injectable decode seam (D-08). The default draws the transferred ImageBitmap to an
// OffscreenCanvas at the capped size and reads the pixels back — replicating the removed
// getImagePixels draw path EXACTLY (same size, no imageSmoothing overrides) so the
// resampled bytes stay bit-identical. Node/jsdom have no OffscreenCanvas, so
// worker.test.ts swaps this via __setDecoderForTest.
type Decoder = (bitmap: ImageBitmap, w: number, h: number) => Uint8ClampedArray;
let decodeToPixels: Decoder = (bitmap, w, h) => {
  const off = new OffscreenCanvas(w, h);
  const c = off.getContext('2d');
  if (!c) throw new Error('OffscreenCanvas 2D context unavailable');
  // Do NOT set imageSmoothingEnabled/imageSmoothingQuality — inherit the same defaults
  // the removed main-thread canvas used; parity depends on the resample bytes (D-02).
  c.drawImage(bitmap, 0, 0, w, h);
  return c.getImageData(0, 0, w, h).data;
};

/** Test seam (D-08): swap the OffscreenCanvas decoder for a deterministic stub in node. */
export function __setDecoderForTest(fn: Decoder) {
  decodeToPixels = fn;
}

// Pure sizing helper migrated verbatim from getImagePixels (lines 55-60): scale the larger
// axis down to `max` when either axis exceeds it, else identity.
function capDims(w: number, h: number, max: number): { w: number; h: number } {
  if (w > max || h > max) {
    const scale = max / Math.max(w, h);
    return { w: Math.round(w * scale), h: Math.round(h * scale) };
  }
  return { w, h };
}

// Monotonic id adopted from the incoming match message. A match run captures its own
// runId; once a newer match message arrives, currentRunId moves on and the older run is
// considered superseded — it must stop at its next yield and post nothing further (B2).
let currentRunId = 0;

ctx.onmessage = async (e: MessageEvent) => {
  const { kind } = e.data;

  if (kind === 'abort') {
    isAborted = true;
  } else if (kind === 'match') {
    isAborted = false;
    const { bitmap, cols, rows, candidates, clearCache, runId } = e.data;
    currentRunId = runId; // adopt the client-supplied id — supersedes any prior run
    try {
      // Decode + resample + readback now live here (off the main thread, PERF-01/D-01).
      const { w, h } = capDims(bitmap.width, bitmap.height, MAX_DIMENSION);
      // Close the transferred bitmap even if the decode throws (getImageData OOM, missing 2D
      // context) — the worker is long-lived, so a skipped close orphans it until GC (LO-01).
      let pixels: Uint8ClampedArray;
      try {
        pixels = decodeToPixels(bitmap, w, h);
      } finally {
        bitmap.close();
      }
      // A run superseded during decode bails at the existing abort boundary (D-05) —
      // before any box-sample/match work, posting nothing further.
      if (runId !== currentRunId || isAborted) return;
      const sampled = boxSampleImage(pixels, w, h, cols, rows);
      await runMatching(runId, sampled, candidates, cols, clearCache);
    } catch (err: any) {
      ctx.postMessage({ kind: 'error', runId, error: err.message || String(err) });
    }
  }
};

const yieldToEventLoop = () => new Promise((resolve) => setTimeout(resolve, 0));

async function runMatching(
  runId: number,
  pixels: Uint8ClampedArray,
  candidates: DmcColor[],
  cols?: number,
  clearCacheOption?: boolean
) {
  if (clearCacheOption) {
    rgbaCache.clear();
    clearCache();
  }

  const totalPixels = pixels.length / 4;
  const numCols = cols || 100;
  const numRows = Math.ceil(totalPixels / numCols);

  const matches: string[] = new Array(totalPixels);
  const counts: Record<string, number> = {};


  for (let r = 0; r < numRows; r++) {
    if (isAborted || runId !== currentRunId) {
      return;
    }

    const startPixel = r * numCols;
    const endPixel = Math.min(totalPixels, (r + 1) * numCols);

    for (let i = startPixel; i < endPixel; i++) {
      const idx = i * 4;
      const rVal = pixels[idx];
      const gVal = pixels[idx + 1];
      const bVal = pixels[idx + 2];
      const aVal = pixels[idx + 3];

      // Blend alpha and quantize to multiples of 4 to maximize cache hit rate
      const blended = blendAlpha(rVal, gVal, bVal, aVal);
      const rQ = blended.r & 0xFC;
      const gQ = blended.g & 0xFC;
      const bQ = blended.b & 0xFC;

      const cacheKey = (rQ << 16) + (gQ << 8) + bQ;
      let matchedCode = rgbaCache.get(cacheKey);

      if (matchedCode === undefined) {
        const matchedColor = matchColor(rQ, gQ, bQ, candidates);
        matchedCode = matchedColor.dmc;
        rgbaCache.set(cacheKey, matchedCode);
      }

      matches[i] = matchedCode;
      counts[matchedCode] = (counts[matchedCode] || 0) + 1;
    }

    const yieldInterval = Math.max(1, Math.floor(numRows / 20));
    if ((r + 1) % yieldInterval === 0 || r === numRows - 1) {
      const percent = Math.round(((r + 1) / numRows) * 100);
      ctx.postMessage({ kind: 'progress', runId, percent });
      await yieldToEventLoop();
    }
  }

  if (isAborted || runId !== currentRunId) {
    return;
  }

  ctx.postMessage({ kind: 'result', runId, matches, counts });
}
