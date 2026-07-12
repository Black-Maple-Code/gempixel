import { blendAlpha, matchColor, clearCache } from './color';
import { DmcColor } from './types';

// Cast self (or globalThis in Node testing) to any to avoid type conflicts
const ctx: Worker = (typeof self !== 'undefined' ? self : globalThis) as any;

// The cache of RGBA numeric keys to DMC codes
const rgbaCache = new Map<number, string>();

let isAborted = false;

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
    const { pixels, candidates, clearCache, cols, runId } = e.data;
    currentRunId = runId; // adopt the client-supplied id — supersedes any prior run
    try {
      await runMatching(runId, pixels, candidates, cols, clearCache);
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
