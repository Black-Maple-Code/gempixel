import { useState, useRef, useEffect, useMemo, useCallback } from 'preact/hooks';
import { substituteLowCountColors } from '../../engine/color';
import { smoothMatches } from '../../engine/smoothing';
import { MatcherClient } from '../../engine/worker-client';
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
  /**
   * Which stage the loading overlay reflects: 'preparing' during the async
   * createImageBitmap decode, then 'matching' the moment the worker's first onProgress
   * fires (D-09). Consumed by Plan 13-02 for the overlay copy.
   */
  loadingPhase: 'preparing' | 'matching';
  /** Human-readable worker/synchronous match failure; null while healthy. Cleared on the next match. */
  error: string | null;
  /** Seed (project restore) or clear (reset/delete) the raw match without a worker run. */
  restore: (raw: RawMatch | null) => void;
}

/**
 * Off-thread decode capability probe (D-07/D-08). The worker resamples on an
 * OffscreenCanvas 2D context, so the actual gate is whether we can construct one — the
 * `getContext('2d')` call is what rejects Safari 16.0–16.3 (which expose OffscreenCanvas
 * but only a webgl context). Runs once at hook init, not per-image.
 */
export function detectOffscreenSupport(): boolean {
  return (
    typeof createImageBitmap === 'function' &&
    typeof OffscreenCanvas !== 'undefined' &&
    !!new OffscreenCanvas(1, 1).getContext('2d')
  );
}

// Test seam (D-08): the node/jsdom Vitest env has no OffscreenCanvas, so tests force the
// supported/unsupported branch deterministically. null = defer to detectOffscreenSupport().
let offscreenSupportOverride: boolean | null = null;
export function __setOffscreenSupportForTest(v: boolean | null) {
  offscreenSupportOverride = v;
}

// D-08 single init-time probe: detectOffscreenSupport() allocates a throwaway OffscreenCanvas,
// so memoize the real probe once per module load rather than re-running it on every match
// trigger. The test override (__setOffscreenSupportForTest) is checked first at the call site
// and short-circuits this cache, so the injectable seam is preserved.
let cachedOffscreenSupport: boolean | null = null;
function getOffscreenSupport(): boolean {
  if (cachedOffscreenSupport === null) {
    cachedOffscreenSupport = detectOffscreenSupport();
  }
  return cachedOffscreenSupport;
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
  const [loadingPhase, setLoadingPhase] = useState<'preparing' | 'matching'>('preparing');
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<MatcherClient | null>(null);
  // Monotonic id for the in-flight createImageBitmap decode. A superseded decode that
  // resolves late is discarded (bitmap.close(), no match posted) — reuses the B2 supersede
  // scheme rather than adding a second abort channel (D-05).
  const seqRef = useRef(0);

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

    // Hard-fail unsupported browsers into the reactive error banner (D-07) — never post
    // to the worker and never flip loading on (preserves the loading-cleared-on-error /
    // spinner-never-with-banner invariant, D-09).
    const supported = offscreenSupportOverride ?? getOffscreenSupport();
    if (!supported) {
      setLoading(false);
      setError('Please update your browser — off-thread image decoding (OffscreenCanvas) is unavailable.');
      return;
    }

    setError(null);
    setLoading(true);
    setLoadingPhase('preparing');
    setProgress(0);

    // Effects can't be async directly; run the decode + transfer in an inner async fn.
    const run = async () => {
      const mySeq = ++seqRef.current;
      try {
        // Cheap on the main thread — the resample/readback now happen in the worker.
        // Pin these three options exactly; parity depends on them (Pitfall 2 / D-01).
        const bitmap = await createImageBitmap(image, {
          imageOrientation: 'from-image',
          premultiplyAlpha: 'none',
          colorSpaceConversion: 'default',
        });
        // A newer trigger superseded this decode while it was in flight — discard the
        // orphan bitmap and post nothing (D-05).
        if (mySeq !== seqRef.current) {
          bitmap.close();
          return;
        }
        // Unmount (or worker-init teardown) nulls clientRef while a decode is in flight; the
        // resolved bitmap would then be neither transferred nor closed — close the orphan
        // rather than leaking it (LO-02).
        const client = clientRef.current;
        if (!client) {
          bitmap.close();
          return;
        }
        client.match(
          bitmap,
          cols,
          rows,
          activeCandidates,
          pct => {
            setLoadingPhase('matching');
            setProgress(pct);
          },
          result => {
            setLoading(false);
            setRawMatchResult(result);
          },
          message => {
            console.error('Match failed:', message);
            setLoading(false);
            setError(message);
          }
        );
      } catch (err) {
        // A rejected createImageBitmap routes to the same reactive error signal (D-10).
        console.error(err);
        // A superseded decode that rejects late must not clobber the newer run's loading/error
        // state — mirror the success path's supersede guard before touching shared UI state
        // (HI-01).
        if (mySeq !== seqRef.current) return;
        setLoading(false);
        setError(err instanceof Error ? err.message : String(err));
      }
    };
    run();
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

  return { matchResult, symbolMap, loading, progress, loadingPhase, error, restore };
}
