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
  // Quantize RGB values to multiples of 4 to maximize cache hit rate and optimize matching speed
  const rQ = r & 0xFC;
  const gQ = g & 0xFC;
  const bQ = b & 0xFC;
  const key = (rQ << 16) + (gQ << 8) + bQ;

  const cached = matchCache.get(key);
  if (cached) {
    return cached;
  }

  const pixelLab = rgbToLab(rQ, gQ, bQ);
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

/**
 * A fixed-conservative CIEDE2000 absolute merge veto for {@link reduceToColorCount} (D-03).
 *
 * If the rarest surviving color's CIEDE2000 distance to its nearest already-used shade
 * exceeds this value, the merge is vetoed (skip-that-color-and-continue) — the reducer
 * never merges anyway. This bounds the worst-case original→final per-cell color shift, so
 * the reduction reads as "no visible change" (the reducer's contract).
 *
 * PROVISIONAL: the mechanics are locked but this numeric value is tunable in REFINE-06 (v4.x).
 * It is NOT a runtime-tunable UI knob in v4.0. The reducer's no-visible-change bound test
 * caps the worst-case merge shift at exactly this value.
 */
export const MERGE_GUARD_DELTA_E = 10;

/**
 * Total order over DMC codes: numeric-then-lexical (D-02).
 *
 * DMC codes are not all numeric (e.g. "310" vs "B5200" vs "Ecru"), so a naive parseInt sort
 * is not a total order. This mirrors the App's "code" sort: parse both as base-10 integers;
 * if both parse to real numbers compare numerically, otherwise fall back to localeCompare.
 *
 * This is the stable tie-break basis for {@link reduceToColorCount} — exported so the
 * tie-break test can assert the ordering directly.
 *
 * @returns negative if `a` sorts before `b`, positive if after, 0 if equal.
 */
export function compareDmcCode(a: string, b: string): number {
  const numA = parseInt(a, 10);
  const numB = parseInt(b, 10);
  if (!isNaN(numA) && !isNaN(numB)) {
    return numA - numB;
  }
  return a.localeCompare(b);
}

/**
 * Deterministic, Delta-E-guarded target-N color reducer (D-01/D-02/D-03).
 *
 * Repeatedly picks the globally-rarest surviving color and merges it into the
 * CIEDE2000-nearest already-used (surviving) shade, recomputing counts each pass, until
 * `distinct === targetN` or the guard blocks all further merges. Operates over the
 * unique-color list + counts (tens–low hundreds of entries), NOT the ~40k-drill grid.
 *
 * Determinism (D-02): selection is driven by a stable total order — the surviving list is
 * sorted by `compareDmcCode` before every pick (never Object.keys order, Pitfall 1); rarest
 * ties break on the lowest DMC code; nearest ties break on EXACT distance equality (no
 * epsilon) then lowest DMC code. Counts are never used as a tie-break (they mutate).
 *
 * Guard (D-03): `guard` is an absolute veto that bounds every original cell's ORIGINAL→final
 * CIEDE2000 shift (not merely the per-merge hop). A merge is allowed only when the rare color AND
 * every original color already folded into it (its cluster) are all within `guard` of the
 * absorbing shade; otherwise the rare color is SKIPPED and the next-rarest is tried. This makes a
 * chain (A→B→C) safe: A is re-checked against C before B folds into C. The loop stops only when
 * every surviving color is blocked. `targetN` is therefore a CEILING — `mergedCount` may
 * legitimately EXCEED `targetN` when the guard blocks the remainder (this is correct, not a bug).
 *
 * Degrade-not-crash: an empty grid / empty counts never throws; grid codes missing from
 * `activeCandidates` cannot be distance-computed and are treated as permanently surviving.
 * `targetN < 1` is coerced to a floor of 1. Inputs are never mutated.
 *
 * @param gridCodes 1D array of active grid DMC codes.
 * @param counts DMC code → drill count dictionary.
 * @param activeCandidates complete active DMC candidate list (provides CIELAB coordinates).
 * @param targetN target distinct color count (a ceiling — see D-03).
 * @param guard CIEDE2000 absolute merge veto (defaults to {@link MERGE_GUARD_DELTA_E}).
 * @returns `{ codes, counts, mergedCount }` — new arrays/objects; `mergedCount` is the single
 *          authoritative merged distinct count all consumers read.
 */
export function reduceToColorCount(
  gridCodes: string[],
  counts: Record<string, number>,
  activeCandidates: DmcColor[],
  targetN: number,
  guard: number = MERGE_GUARD_DELTA_E
): { codes: string[]; counts: Record<string, number>; mergedCount: number } {
  // 1. Build code→DmcColor map (grid codes not present here cannot be distance-computed).
  const codeToColor = new Map<string, DmcColor>();
  activeCandidates.forEach(c => codeToColor.set(c.dmc, c));

  // Coerce targetN to a sane floor of 1.
  const effectiveTarget = targetN < 1 ? 1 : targetN;

  // Working counts copy (never mutate the caller's counts).
  const workingCounts: Record<string, number> = { ...counts };

  // 2. No-op fast path: surviving distinct already <= targetN.
  const initialSurviving = Object.keys(workingCounts).filter(code => workingCounts[code] > 0);
  if (initialSurviving.length <= effectiveTarget) {
    return {
      codes: [...gridCodes],
      counts: { ...counts },
      mergedCount: initialSurviving.length
    };
  }

  // Colors permanently vetoed this run (no within-guard neighbor / un-mappable). Once a color
  // is blocked it stays blocked: its Lab is fixed and removing neighbors can only increase its
  // nearest-neighbor distance, so a blocked color can never become mergeable later.
  const blocked = new Set<string>();
  const mergeMap = new Map<string, string>();

  // Cluster membership (CR-01): each surviving code → the ORIGINAL codes currently resolving to
  // it. Grows as merges fold clusters together. Used to bound EVERY original color's total shift
  // to its absorbing shade by `guard`, so a chain (A→B→C) can never displace an original cell
  // beyond the guard — the per-hop check alone did not guarantee this.
  const cluster = new Map<string, string[]>();
  initialSurviving.forEach(code => cluster.set(code, [code]));

  // 3. Iterative-recompute loop.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const surviving = Object.keys(workingCounts).filter(code => workingCounts[code] > 0);
    if (surviving.length <= effectiveTarget) break;

    // a. Candidate order: (count ascending, dmcCode ascending). Sort every iteration so the
    //    pick never depends on Object.keys insertion order (Pitfall 1).
    const ordered = surviving
      .filter(code => !blocked.has(code))
      .sort((x, y) => {
        const dc = workingCounts[x] - workingCounts[y];
        if (dc !== 0) return dc;
        return compareDmcCode(x, y);
      });

    let mergedThisPass = false;
    for (const rare of ordered) {
      const rareColor = codeToColor.get(rare);
      // Un-mappable rare color: cannot compute distance → permanently blocked (degrade-not-crash).
      if (!rareColor) {
        blocked.add(rare);
        continue;
      }

      // c. Nearest OTHER surviving mappable shade under (distance asc, dmcCode asc).
      let bestDist = Infinity;
      let bestCode: string | null = null;
      for (const other of surviving) {
        if (other === rare) continue;
        const otherColor = codeToColor.get(other);
        if (!otherColor) continue;
        const dist = getColorDistance(rareColor.lab, otherColor.lab);
        if (dist < bestDist) {
          bestDist = dist;
          bestCode = other;
        } else if (dist === bestDist && bestCode !== null && compareDmcCode(other, bestCode) < 0) {
          // EXACT distance tie → lowest DMC code wins (no epsilon, D-02).
          bestCode = other;
        }
      }

      // No mappable neighbor at all → block this color.
      if (bestCode === null) {
        blocked.add(rare);
        continue;
      }

      // d. Guard veto (absolute, D-03) — bounds the ORIGINAL→final per-cell shift, not merely the
      //    per-hop shift (CR-01). Every original color already folded into `rare` (its cluster),
      //    plus `rare` itself, must be within `guard` of the absorbing shade; otherwise a chain
      //    A→rare→bestCode would displace A beyond the guard. Nearest-first already covers `rare`
      //    via bestDist; the cluster members are the extra, chain-safe check. If any member is
      //    beyond the guard, skip-and-continue (a farther target can only be worse).
      const rareCluster = cluster.get(rare) ?? [rare];
      const bestColor = codeToColor.get(bestCode) as DmcColor;
      const withinGuard =
        bestDist <= guard &&
        rareCluster.every(member => {
          const memberColor = codeToColor.get(member);
          return memberColor ? getColorDistance(memberColor.lab, bestColor.lab) <= guard : false;
        });
      if (!withinGuard) {
        blocked.add(rare);
        continue;
      }

      // e. Merge rare's whole cluster → nearest: fold rare's count into the absorbing shade, drop
      //    rare, and relocate its cluster membership so a LATER merge of `bestCode` re-checks these
      //    original colors' guard against the new destination (keeps the original→final bound).
      mergeMap.set(rare, bestCode);
      const destCluster = cluster.get(bestCode) ?? [bestCode];
      cluster.set(bestCode, destCluster.concat(rareCluster));
      cluster.delete(rare);
      workingCounts[bestCode] = (workingCounts[bestCode] || 0) + workingCounts[rare];
      delete workingCounts[rare];
      mergedThisPass = true;
      break;
    }

    // f. Stop when no within-guard merge was possible this pass (every color blocked).
    if (!mergedThisPass) break;
  }

  // 4. Apply the merge map to the grid, following chains so a cell whose color was merged into a
  //    shade that itself later merged resolves to the final surviving code.
  const resolve = (code: string): string => {
    let current = code;
    const seen = new Set<string>();
    while (mergeMap.has(current) && !seen.has(current)) {
      seen.add(current);
      current = mergeMap.get(current) as string;
    }
    return current;
  };

  const newCodes = gridCodes.map(resolve);
  const newCounts: Record<string, number> = {};
  newCodes.forEach(code => {
    newCounts[code] = (newCounts[code] || 0) + 1;
  });

  // 5. mergedCount = distinct codes with count > 0 in the recomputed grid tally.
  return { codes: newCodes, counts: newCounts, mergedCount: Object.keys(newCounts).length };
}
