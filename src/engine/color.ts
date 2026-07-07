import { useMode, modeRgb, modeXyz65, modeLab, modeLab65, converter, differenceCiede2000 } from 'culori/fn';
import { LabCoordinates, DmcColor } from './types';

// Register color spaces to build the conversion path
useMode(modeRgb);
useMode(modeXyz65);
useMode(modeLab);
useMode(modeLab65);

// Prepare automatic conversion to lab and difference ciede2000
const toLab = converter('lab');
const ciede2000 = differenceCiede2000();

// Cache mapping raw RGB integers to matched DMC colors
const matchCache = new Map<number, DmcColor>();

/**
 * Clears the in-memory color matching cache.
 */
export function clearCache(): void {
  matchCache.clear();
}

/**
 * Converts standard sRGB [0-255] coordinates to CIELAB L/a/b coordinates.
 */
export function rgbToLab(r: number, g: number, b: number): LabCoordinates {
  const result = toLab({ mode: 'rgb', r: r / 255, g: g / 255, b: b / 255 });
  return {
    l: result.l !== undefined ? result.l : 0,
    a: result.a !== undefined ? result.a : 0,
    b: result.b !== undefined ? result.b : 0
  };
}

/**
 * Blends a transparent or semi-transparent pixel with a solid white background (#FFFFFF).
 */
export function blendAlpha(r: number, g: number, b: number, a: number): { r: number; g: number; b: number } {
  const aNormalized = a / 255;
  const rBlended = r * aNormalized + 255 * (1 - aNormalized);
  const gBlended = g * aNormalized + 255 * (1 - aNormalized);
  const bBlended = b * aNormalized + 255 * (1 - aNormalized);
  return {
    r: Math.round(rBlended),
    g: Math.round(gBlended),
    b: Math.round(bBlended)
  };
}

/**
 * Matches an RGB color to the nearest active DMC color candidate using CIEDE2000 distance.
 * Implements caching and stable tie-breaking.
 */
export function matchColor(
  r: number,
  g: number,
  b: number,
  activeCandidates: DmcColor[]
): DmcColor {
  const key = (r << 16) + (g << 8) + b;
  const cached = matchCache.get(key);
  if (cached) {
    return cached;
  }

  const pixelLab = rgbToLab(r, g, b);
  let minDistance = Infinity;
  let bestMatch: DmcColor | null = null;

  for (const candidate of activeCandidates) {
    const dist = ciede2000(
      { mode: 'lab', ...pixelLab },
      { mode: 'lab', ...candidate.lab }
    );
    // Strict inequality (<) resolves color ties stably by choosing the first encountered candidate
    if (dist < minDistance) {
      minDistance = dist;
      bestMatch = candidate;
    }
  }

  if (!bestMatch) {
    throw new Error('No active candidates provided for color matching.');
  }

  matchCache.set(key, bestMatch);
  return bestMatch;
}

/**
 * Processes a flat Uint8ClampedArray of RGBA pixel values, mapping each pixel to the nearest active candidate.
 * Returns a flat array of matched codes and the aggregated count summary object.
 */
export function matchPixelGrid(
  pixels: Uint8ClampedArray,
  candidates: DmcColor[]
): { codes: string[]; counts: Record<string, number> } {
  clearCache(); // D-03: clear cache at the start of each matching run

  const codes: string[] = [];
  const counts: Record<string, number> = {};

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];

    const blended = blendAlpha(r, g, b, a);
    const matched = matchColor(blended.r, blended.g, blended.b, candidates);

    codes.push(matched.dmc);
    counts[matched.dmc] = (counts[matched.dmc] || 0) + 1;
  }

  return { codes, counts };
}

/**
 * Calculates the CIEDE2000 distance between two CIELAB coordinates.
 */
export function getColorDistance(lab1: LabCoordinates, lab2: LabCoordinates): number {
  return ciede2000(
    { mode: 'lab', ...lab1 },
    { mode: 'lab', ...lab2 }
  );
}

/**
 * Substitutes low-count matched colors with the closest higher-count matched colors.
 * - gridCodes: 1D array of active grid DMC codes
 * - counts: DMC code counts dictionary
 * - activeCandidates: complete active DMC_PALETTE list containing CIELAB coordinates
 * - threshold: counts <= threshold are substituted
 */
export function substituteLowCountColors(
  gridCodes: string[],
  counts: Record<string, number>,
  activeCandidates: DmcColor[],
  threshold: number
): { codes: string[]; counts: Record<string, number> } {
  // 1. Identify low-count colors (counts <= threshold) and high-count colors (> threshold)
  const lowCountCodes = Object.keys(counts).filter(code => counts[code] > 0 && counts[code] <= threshold);
  const highCountCodes = Object.keys(counts).filter(code => counts[code] > threshold);

  // If there are no high-count colors to substitute into, do nothing
  if (highCountCodes.length === 0 || lowCountCodes.length === 0) {
    return { codes: [...gridCodes], counts: { ...counts } };
  }

  // 2. Pre-locate candidate objects for distance math
  const codeToColorMap = new Map<string, DmcColor>();
  activeCandidates.forEach(c => codeToColorMap.set(c.dmc, c));

  // Map each low-count code to its nearest high-count code
  const substitutionMap = new Map<string, string>();
  for (const lowCode of lowCountCodes) {
    const lowColor = codeToColorMap.get(lowCode);
    if (!lowColor) continue;

    let minDistance = Infinity;
    let closestHighCode = highCountCodes[0];

    for (const highCode of highCountCodes) {
      const highColor = codeToColorMap.get(highCode);
      if (!highColor) continue;

      const dist = getColorDistance(lowColor.lab, highColor.lab);
      if (dist < minDistance) {
        minDistance = dist;
        closestHighCode = highCode;
      }
    }
    substitutionMap.set(lowCode, closestHighCode);
  }

  // 3. Process grid replacement and update counts
  const newCodes = gridCodes.map(code => {
    const sub = substitutionMap.get(code);
    return sub ? sub : code;
  });

  const newCounts: Record<string, number> = {};
  newCodes.forEach(code => {
    newCounts[code] = (newCounts[code] || 0) + 1;
  });

  return { codes: newCodes, counts: newCounts };
}
