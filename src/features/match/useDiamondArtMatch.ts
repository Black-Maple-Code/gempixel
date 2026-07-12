import { useState, useRef, useEffect, useMemo, useCallback } from 'preact/hooks';
import { substituteLowCountColors } from '../../engine/color';
import { smoothMatches } from '../../engine/smoothing';
import { MatcherClient } from '../../engine/worker-client';
import { boxSampleImage } from '../../engine/ingest';
import { generateSymbolAllocation, ColorSymbolMap } from '../../engine/symbols';
import { DmcColor } from '../../engine/types';

/**
 * useDiamondArtMatch — owns the image→grid pipeline: Web Worker match, low-count
 * substitution, and symbol allocation, behind a small read-only signal surface.
 * App composes these signals and no longer touches the worker directly.
 *
 * `restore()` is the one imperative seam: the app injects a raw match when loading
 * a saved project (grid restored from storage, no worker run) or clears it on
 * reset/delete. Everything else — worker lifecycle, abort-on-new-input, cache-hash
 * reuse (both internal to MatcherClient), loading/progress — lives here.
 */

export interface RawMatch {
  matches: string[];
  counts: Record<string, number>;
}

export interface MatchInputs {
  image: HTMLImageElement | null;
  cols: number;
  rows: number;
  activeCandidates: DmcColor[];
  enableSubstitution: boolean;
  substitutionThreshold: number;
  /** Spatial cleanup: dissolve orphan drills / straighten blotchy region edges. */
  enableSmoothing: boolean;
  /** Smoothing aggressiveness 1 (light) .. 3 (strong); ignored when disabled. */
  smoothingStrength: number;
}

export interface MatchState {
  matchResult: RawMatch | null;
  symbolMap: ColorSymbolMap;
  loading: boolean;
  progress: number;
  /** Seed (project restore) or clear (reset/delete) the raw match without a worker run. */
  restore: (raw: RawMatch | null) => void;
}

// Extract pixels from an image, downscaling huge images for performance.
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

  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2d context for image pixels');
  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  return { pixels: imageData.data, width: w, height: h };
}

export function useDiamondArtMatch(inputs: MatchInputs): MatchState {
  const {
    image,
    cols,
    rows,
    activeCandidates,
    enableSubstitution,
    substitutionThreshold,
    enableSmoothing,
    smoothingStrength,
  } = inputs;

  const [rawMatchResult, setRawMatchResult] = useState<RawMatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const clientRef = useRef<MatcherClient | null>(null);

  // Worker lifecycle: construct once, terminate on unmount (no leaked worker).
  useEffect(() => {
    clientRef.current = new MatcherClient(new URL('../../engine/matcher.worker.ts', import.meta.url));
    return () => {
      clientRef.current?.terminate();
      clientRef.current = null;
    };
  }, []);

  // Stable dependency for the match trigger: activeCandidates is a fresh array each
  // render, so key on the joined dmc codes (changes iff the active color set changes).
  const candidatesKey = activeCandidates.map(c => c.dmc).join(',');

  // Trigger a match when the image, dimensions, or active color set change.
  useEffect(() => {
    if (!image) return;
    if (activeCandidates.length === 0) return;

    setLoading(true);
    setProgress(0);

    try {
      const { pixels, width: srcW, height: srcH } = getImagePixels(image);
      const downsampled = boxSampleImage(pixels, srcW, srcH, cols, rows);

      clientRef.current?.match(
        downsampled,
        activeCandidates,
        pct => setProgress(pct),
        result => {
          setLoading(false);
          setRawMatchResult(result);
        },
        cols
      );
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
    // activeCandidates intentionally keyed via candidatesKey (stable) to avoid
    // re-running the match on every render from the fresh array reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, cols, rows, candidatesKey]);

  const matchResult = useMemo<RawMatch | null>(() => {
    if (!rawMatchResult) return null;

    // 1. Global low-count substitution (merges rare colors into their neighbors).
    let matches = rawMatchResult.matches;
    let counts = rawMatchResult.counts;
    if (enableSubstitution) {
      const sub = substituteLowCountColors(matches, counts, activeCandidates, substitutionThreshold);
      matches = sub.codes;
      counts = sub.counts;
    }

    // 2. Spatial smoothing (dissolves orphans, straightens ragged region edges).
    //    Runs after substitution so it cleans the final, fewer-color grid; counts
    //    are recomputed from the smoothed grid so the legend/symbols stay in sync.
    if (enableSmoothing && smoothingStrength > 0) {
      const sm = smoothMatches(matches, cols, rows, smoothingStrength);
      matches = sm.codes;
      counts = sm.counts;
    }

    if (matches === rawMatchResult.matches) return rawMatchResult;
    return { matches, counts };
  }, [
    rawMatchResult,
    enableSubstitution,
    substitutionThreshold,
    activeCandidates,
    enableSmoothing,
    smoothingStrength,
    cols,
    rows,
  ]);

  const symbolMap = useMemo<ColorSymbolMap>(() => {
    if (!matchResult) return {};
    return generateSymbolAllocation(matchResult.matches, activeCandidates.map(c => c.dmc));
  }, [matchResult, activeCandidates]);

  const restore = useCallback((raw: RawMatch | null) => setRawMatchResult(raw), []);

  return { matchResult, symbolMap, loading, progress, restore };
}
