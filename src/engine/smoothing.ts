/**
 * Color-Boundary Smoothing — a spatial cleanup pass over the matched grid that
 * removes orphaned single drills and softens ragged, blotchy region edges left
 * behind by per-pixel nearest-color matching. This intentionally departs from
 * the source photo to produce a cleaner, more stitchable diamond-art chart.
 *
 * Algorithm: an iterative Moore-neighbourhood (8-neighbour) majority/mode filter.
 * For each cell we tally the codes of its in-bounds neighbours; if a single
 * neighbour code both dominates (>= minAgree of them) and differs from the cell,
 * the cell is reassigned to it. Isolated specks flip to their surroundings and
 * jagged boundaries straighten. Strength controls how many passes run and how
 * low the agreement bar sits.
 *
 * Pure module: no Preact, no DOM, no persistence. Never throws in the render
 * path — invalid dimensions or strength <= 0 return the input unchanged.
 *
 * CARDINAL RULES:
 * - Rule 1: pure synchronous compute invoked off the UI/audio threads (inside a
 *   useMemo during matching), never in a render or audio callback.
 * - Rule 2: not a per-frame hot path; the two grid buffers and the small tally
 *   Map are allocated once per run (not per cell) and the buffers are swapped,
 *   never re-created, between passes.
 */

export interface SmoothResult {
  codes: string[];
  counts: Record<string, number>;
}

/** Map a 1..3 strength onto passes + the minimum agreeing neighbours to flip. */
function strengthConfig(strength: number): { passes: number; minAgree: number } {
  // Light: only true orphans (>=6 of 8 agree). Strong: half the ring (>=4) over
  // more passes, straightening boundaries at the cost of more shape change.
  switch (Math.round(strength)) {
    case 1:
      return { passes: 1, minAgree: 6 };
    case 2:
      return { passes: 2, minAgree: 5 };
    default:
      return { passes: 3, minAgree: 4 };
  }
}

function tally(codes: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    counts[code] = (counts[code] || 0) + 1;
  }
  return counts;
}

/**
 * Smooth the matched grid. `strength` <= 0 (or a degenerate grid) is a no-op
 * that returns a shallow copy plus a fresh count, so callers can treat the
 * result uniformly whether or not smoothing actually ran.
 */
export function smoothMatches(
  matches: string[],
  cols: number,
  rows: number,
  strength: number
): SmoothResult {
  if (
    strength <= 0 ||
    cols <= 0 ||
    rows <= 0 ||
    matches.length !== cols * rows ||
    matches.length === 0
  ) {
    const codes = matches.slice();
    return { codes, counts: tally(codes) };
  }

  const { passes, minAgree } = strengthConfig(strength);

  // Double buffer: read from `src`, write into `dst`, swap after each pass so a
  // pass never sees its own in-progress edits (which would bias the filter).
  let src = matches.slice();
  let dst = matches.slice();
  const neighbourCounts = new Map<string, number>();

  for (let pass = 0; pass < passes; pass++) {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col;
        neighbourCounts.clear();

        // Tally the (up to) 8 in-bounds neighbours.
        let bestCode = '';
        let bestCount = 0;
        for (let dr = -1; dr <= 1; dr++) {
          const nr = row + dr;
          if (nr < 0 || nr >= rows) continue;
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nc = col + dc;
            if (nc < 0 || nc >= cols) continue;
            const code = src[nr * cols + nc];
            const next = (neighbourCounts.get(code) || 0) + 1;
            neighbourCounts.set(code, next);
            if (next > bestCount) {
              bestCount = next;
              bestCode = code;
            }
          }
        }

        // Reassign only when a single neighbour code clearly dominates and the
        // cell disagrees with it; otherwise the cell keeps its own code.
        dst[idx] =
          bestCount >= minAgree && bestCode !== src[idx] ? bestCode : src[idx];
      }
    }
    const swap = src;
    src = dst;
    dst = swap;
  }

  // After the final swap, `src` holds the newest result.
  return { codes: src, counts: tally(src) };
}
