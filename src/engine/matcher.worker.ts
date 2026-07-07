import { blendAlpha, matchColor } from './color';
import { DmcColor } from './types';

// Cast self (or globalThis in Node testing) to any to avoid type conflicts
const ctx: Worker = (typeof self !== 'undefined' ? self : globalThis) as any;

// The cache of RGBA numeric keys to DMC codes
const rgbaCache = new Map<number, string>();

let isAborted = false;

ctx.onmessage = async (e: MessageEvent) => {
  const { kind } = e.data;

  if (kind === 'abort') {
    isAborted = true;
  } else if (kind === 'match') {
    isAborted = false;
    const { pixels, candidates, clearCache, cols } = e.data;
    try {
      await runMatching(pixels, candidates, cols, clearCache);
    } catch (err: any) {
      ctx.postMessage({ kind: 'error', error: err.message || String(err) });
    }
  }
};

const yieldToEventLoop = () => new Promise((resolve) => setTimeout(resolve, 0));

async function runMatching(
  pixels: Uint8ClampedArray,
  candidates: DmcColor[],
  cols?: number,
  clearCacheOption?: boolean
) {
  if (clearCacheOption) {
    rgbaCache.clear();
  }

  const totalPixels = pixels.length / 4;
  const numCols = cols || 100;
  const numRows = Math.ceil(totalPixels / numCols);

  const matches: string[] = new Array(totalPixels);
  const counts: Record<string, number> = {};

  for (let r = 0; r < numRows; r++) {
    if (isAborted) {
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

      // Key = (R * 16777216) + (G * 65536) + (B * 256) + A
      const cacheKey = rVal * 16777216 + gVal * 65536 + bVal * 256 + aVal;
      let matchedCode = rgbaCache.get(cacheKey);

      if (matchedCode === undefined) {
        const blended = blendAlpha(rVal, gVal, bVal, aVal);
        const matchedColor = matchColor(blended.r, blended.g, blended.b, candidates);
        matchedCode = matchedColor.dmc;
        rgbaCache.set(cacheKey, matchedCode);
      }

      matches[i] = matchedCode;
      counts[matchedCode] = (counts[matchedCode] || 0) + 1;
    }

    const percent = Math.round(((r + 1) / numRows) * 100);
    ctx.postMessage({ kind: 'progress', percent });

    await yieldToEventLoop();
  }

  if (isAborted) {
    return;
  }

  ctx.postMessage({ kind: 'result', matches, counts });
}
