import { describe, it, expect, beforeEach } from 'vitest';
import {
  rgbToLab,
  blendAlpha,
  matchColor,
  matchPixelGrid,
  clearCache,
  substituteLowCountColors,
  reduceToColorCount,
  MERGE_GUARD_DELTA_E,
  compareDmcCode,
  getColorDistance
} from '../color';
import { DmcColor } from '../types';

describe('Color Engine Math & Matching', () => {
  // Define mock DMC color candidates locally to avoid Wave 2 dependencies
  const mockCandidates: DmcColor[] = [
    {
      dmc: "310",
      name: "Black",
      hex: "#000000",
      r: 0,
      g: 0,
      b: 0,
      lab: { l: 0, a: 0, b: 0 },
      kits: ["100", "200"]
    },
    {
      dmc: "BLANC",
      name: "White",
      hex: "#FFFFFF",
      r: 255,
      g: 255,
      b: 255,
      lab: { l: 100, a: 0, b: 0 },
      kits: ["100", "200"]
    },
    {
      dmc: "606",
      name: "Bright Red",
      hex: "#FF0000",
      r: 255,
      g: 0,
      b: 0,
      lab: { l: 53.23, a: 80.11, b: 67.22 }, // Approx Lab for pure RGB Red
      kits: ["200"]
    }
  ];

  beforeEach(() => {
    clearCache();
  });

  describe('rgbToLab', () => {
    it('converts sRGB to CIELAB coordinate boundaries within tolerance of 0.05', () => {
      // Pure Black
      const blackLab = rgbToLab(0, 0, 0);
      expect(blackLab.l).toBeCloseTo(0, 1);
      expect(blackLab.a).toBeCloseTo(0, 1);
      expect(blackLab.b).toBeCloseTo(0, 1);

      // Pure White
      const whiteLab = rgbToLab(255, 255, 255);
      expect(whiteLab.l).toBeCloseTo(100, 1);
      expect(whiteLab.a).toBeCloseTo(0, 1);
      expect(whiteLab.b).toBeCloseTo(0, 1);
    });
  });

  describe('blendAlpha', () => {
    it('blends transparent pixels with solid white background', () => {
      const result = blendAlpha(0, 0, 0, 0); // fully transparent
      expect(result).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('blends solid colors without change', () => {
      const result = blendAlpha(100, 150, 200, 255); // fully opaque
      expect(result).toEqual({ r: 100, g: 150, b: 200 });
    });

    it('blends semi-transparent colors correctly', () => {
      // 50% transparent black over white:
      // R = 0 * 0.5 + 255 * 0.5 = 127.5 => 128
      const result = blendAlpha(0, 0, 0, 127.5);
      expect(result.r).toBeCloseTo(128, 0);
      expect(result.g).toBeCloseTo(128, 0);
      expect(result.b).toBeCloseTo(128, 0);
    });
  });

  describe('matchColor and Caching', () => {
    it('matches RGB values to the nearest mock DMC color candidate', () => {
      const match = matchColor(10, 10, 10, mockCandidates);
      expect(match.dmc).toBe("310");

      const whiteMatch = matchColor(240, 240, 240, mockCandidates);
      expect(whiteMatch.dmc).toBe("BLANC");
    });

    it('caches matches to avoid re-evaluating candidate lists', () => {
      // First match maps (0,0,0) to Black ("310")
      const firstMatch = matchColor(0, 0, 0, mockCandidates);
      expect(firstMatch.dmc).toBe("310");

      // Change candidates list: remove "310", only leave "BLANC"
      const alteredCandidates = [mockCandidates[1]];

      // If caching is working, it should still return the cached "310" color
      // instead of re-evaluating and returning "BLANC"
      const secondMatch = matchColor(0, 0, 0, alteredCandidates);
      expect(secondMatch.dmc).toBe("310");

      // Verify that after clearing the cache, it re-evaluates and picks the only available candidate "BLANC"
      clearCache();
      const postClearMatch = matchColor(0, 0, 0, alteredCandidates);
      expect(postClearMatch.dmc).toBe("BLANC");
    });
  });

  describe('Stable Tie Resolution', () => {
    it('resolves equidistant color ties stably by selecting the first encountered candidate', () => {
      // Define two candidates with identical Lab coordinates (forces distance to be exactly equal)
      const candidate1: DmcColor = {
        dmc: "C1",
        name: "Cand 1",
        hex: "#808080",
        r: 128, g: 128, b: 128,
        lab: { l: 50, a: 0, b: 0 },
        kits: ["100"]
      };

      const candidate2: DmcColor = {
        dmc: "C2",
        name: "Cand 2",
        hex: "#808080",
        r: 128, g: 128, b: 128,
        lab: { l: 50, a: 0, b: 0 },
        kits: ["100"]
      };

      // Since the distance is identical under CIEDE2000, stable matching should return
      // the first candidate in the list.
      
      // With [candidate1, candidate2], it should return "C1"
      const match1 = matchColor(128, 128, 128, [candidate1, candidate2]);
      expect(match1.dmc).toBe("C1");

      // With [candidate2, candidate1], it should return "C2"
      clearCache();
      const match2 = matchColor(128, 128, 128, [candidate2, candidate1]);
      expect(match2.dmc).toBe("C2");
    });
  });

  describe('matchPixelGrid', () => {
    it('correctly maps a flat pixel grid and calculates aggregate counts', () => {
      // 2x2 image with:
      // Pixel 0: Black, opaque
      // Pixel 1: White, opaque
      // Pixel 2: Semi-transparent Black (will blend to gray, which matches White or Black depending on distance)
      // Pixel 3: Black, opaque
      const pixels = new Uint8ClampedArray([
        0, 0, 0, 255,       // Black
        255, 255, 255, 255, // White
        0, 0, 0, 50,        // Semi-transparent Black (blends to 205, 205, 205 -> matches White)
        0, 0, 0, 255        // Black
      ]);

      const result = matchPixelGrid(pixels, mockCandidates);

      // Expected codes:
      // Pixel 0 -> Black ("310")
      // Pixel 1 -> White ("BLANC")
      // Pixel 2 -> Semi-transparent Black (blended with white = 205,205,205 -> closer to White "BLANC")
      // Pixel 3 -> Black ("310")
      expect(result.codes).toEqual(["310", "BLANC", "BLANC", "310"]);

      // Expected counts:
      // "310" -> 2
      // "BLANC" -> 2
      expect(result.counts).toEqual({
        "310": 2,
        "BLANC": 2
      });
    });
  });

  describe('substituteLowCountColors', () => {
    it('substitutes low-count colors with closest high-count color based on CIEDE2000', () => {
      const gridCodes = ["310", "310", "310", "150"]; // "150" is low count (only 1 occurrence)
      const counts = { "310": 3, "150": 1 };

      const candidate150: DmcColor = {
        dmc: "150",
        name: "Dusty Rose",
        hex: "#E5C8D4",
        r: 229, g: 200, b: 212,
        lab: { l: 83, a: 11, b: -2 },
        kits: ["100"]
      };
      
      const candidate310: DmcColor = {
        dmc: "310",
        name: "Black",
        hex: "#000000",
        r: 0, g: 0, b: 0,
        lab: { l: 0, a: 0, b: 0 },
        kits: ["100"]
      };

      const candidates = [candidate150, candidate310];

      const result = substituteLowCountColors(gridCodes, counts, candidates, 2);

      // "150" count is 1 (<= threshold 2), so it is substituted with the closest high-count color ("310")
      expect(result.codes).toEqual(["310", "310", "310", "310"]);
      expect(result.counts).toEqual({ "310": 4 });
    });

    it('does nothing if there are no high-count colors to substitute into', () => {
      const gridCodes = ["310", "150"];
      const counts = { "310": 1, "150": 1 };
      const candidates: DmcColor[] = [
        { dmc: "310", name: "Black", hex: "#000000", r: 0, g: 0, b: 0, lab: { l: 0, a: 0, b: 0 }, kits: ["100" as const] },
        { dmc: "150", name: "Pink", hex: "#FF0000", r: 255, g: 0, b: 0, lab: { l: 53, a: 80, b: 67 }, kits: ["100" as const] }
      ];

      const result = substituteLowCountColors(gridCodes, counts, candidates, 2);

      // Both are <= 2, so no high-count candidates exist. Nothing is substituted.
      expect(result.codes).toEqual(["310", "150"]);
      expect(result.counts).toEqual({ "310": 1, "150": 1 });
    });
  });

  describe('reduceToColorCount (SC4 / REFINE-04 support)', () => {
    // Deliberately-spaced Lab coordinates so CIEDE2000 distances are predictable and the
    // within-guard / beyond-guard / equidistant relationships are pinned. Measured distances
    // (MERGE_GUARD_DELTA_E === 10):
    //   '999'(52,10,10) -> '310'(50,10,10) = 1.995  (nearest, within guard)
    //   '999'(52,10,10) -> '150'(50,12,10) = 2.770  (within guard, but farther than '310')
    //   '999'(52,10,10) -> '820'(20,-40,-40) = 46.469 (beyond guard)
    //   '820'(20,-40,-40) -> '310'(50,10,10) = 45.395 (beyond guard — '820' has no near neighbor)
    const c = (dmc: string, lab: { l: number; a: number; b: number }): DmcColor => ({
      dmc,
      name: dmc,
      hex: '#000000',
      r: 0,
      g: 0,
      b: 0,
      lab,
      kits: ['100' as const]
    });

    const reducerCandidates: DmcColor[] = [
      c('310', { l: 50, a: 10, b: 10 }),   // survivor, nearest to rare '999'
      c('150', { l: 50, a: 12, b: 10 }),   // survivor, second-nearest to '999'
      c('999', { l: 52, a: 10, b: 10 }),   // rare; nearest survivor is '310' (1.995)
      c('820', { l: 20, a: -40, b: -40 }) // isolated; beyond guard from everything
    ];

    // Identical-lab pair (different codes) → GUARANTEED exact-equal distance to any rare color,
    // pinning the compareDmcCode tie-break path deterministically.
    const tieCandidates: DmcColor[] = [
      c('310', { l: 50, a: 10, b: 10 }),
      c('B5200', { l: 50, a: 10, b: 10 }), // identical lab to '310'
      c('999', { l: 52, a: 10, b: 10 })    // rare; equidistant from '310' and 'B5200'
    ];

    const labOf = (candidates: DmcColor[], code: string) =>
      candidates.find(x => x.dmc === code)!.lab;

    describe('compareDmcCode (numeric-then-lexical total order — D-02 / Pitfall 2)', () => {
      it('orders two numeric codes numerically (40 before 310, not lexically)', () => {
        expect(compareDmcCode('40', '310')).toBeLessThan(0);
        expect(compareDmcCode('310', '40')).toBeGreaterThan(0);
      });

      it('orders a numeric code below a named code (310 before B5200)', () => {
        expect(compareDmcCode('310', 'B5200')).toBeLessThan(0);
        expect(compareDmcCode('B5200', '310')).toBeGreaterThan(0);
      });

      it('returns 0 for equal codes', () => {
        expect(compareDmcCode('310', '310')).toBe(0);
      });
    });

    // Grids are the authoritative source of the returned counts (the reducer tallies newCodes),
    // so each fixture keeps `counts` consistent with the grid tally, as it always is in production
    // (counts is the tally of gridCodes straight out of matchPixelGrid).
    it('is deterministic: identical input yields identical output', () => {
      const grid = ['310', '310', '310', '150', '150', '999'];
      const counts = { '310': 3, '150': 2, '999': 1 };

      const a = reduceToColorCount(grid, counts, reducerCandidates, 2);
      const b = reduceToColorCount(grid, counts, reducerCandidates, 2);

      expect(a).toEqual(b);
      // '999' (rarest) merges into its nearest survivor '310'.
      expect(a.counts).toEqual({ '310': 4, '150': 2 });
      expect(a.mergedCount).toBe(2);
    });

    it('is independent of Object.keys insertion order (shuffled counts → identical output)', () => {
      const grid = ['310', '310', '310', '150', '150', '999'];
      // Same entries, different key insertion order — must not change the result (Pitfall 1).
      const canonical = { '310': 3, '150': 2, '999': 1 };
      const shuffled = { '999': 1, '310': 3, '150': 2 };

      const a = reduceToColorCount(grid, canonical, reducerCandidates, 2);
      const b = reduceToColorCount(grid, shuffled, reducerCandidates, 2);

      expect(b).toEqual(a);
    });

    it('breaks equidistant ties on the lowest DMC code (310 over B5200)', () => {
      const grid = ['310', '310', 'B5200', 'B5200', '999'];
      const counts = { '310': 2, 'B5200': 2, '999': 1 };

      // '999' is equidistant from '310' and 'B5200' (identical lab) → lower code '310' absorbs.
      const result = reduceToColorCount(grid, counts, tieCandidates, 2);

      expect(result.codes).toEqual(['310', '310', 'B5200', 'B5200', '310']); // the '999' cell became '310'
      expect(result.counts).toEqual({ '310': 3, 'B5200': 2 });
      expect(result.counts['999']).toBeUndefined();
      expect(result.mergedCount).toBe(2);
    });

    it('vetoes merges beyond the guard: skips the isolated color, merges the within-guard one', () => {
      const grid = ['310', '310', '999', '820'];
      const counts = { '310': 2, '999': 1, '820': 1 };

      // Both '999' and '820' have count 1; '820' sorts first (compareDmcCode), but its nearest
      // survivor '310' is 45.4 (> guard) → SKIPPED. '999' then merges into '310' (1.995).
      const result = reduceToColorCount(grid, counts, reducerCandidates, 1);

      expect(result.counts['999']).toBeUndefined();      // merged away
      expect(result.counts['820']).toBe(1);              // skipped, survives (guard veto)
      expect(result.counts['310']).toBe(3);              // absorbed '999'
      // targetN was 1 but the guard blocks '820' → the loop stops with 2 colors (ceiling).
      expect(result.mergedCount).toBe(2);
    });

    it('treats targetN as a ceiling: mergedCount may exceed targetN when the guard blocks (Pitfall 3)', () => {
      const grid = ['310', '310', '999', '820'];
      const counts = { '310': 2, '999': 1, '820': 1 };

      const result = reduceToColorCount(grid, counts, reducerCandidates, 1);

      expect(result.mergedCount).toBeGreaterThanOrEqual(1); // never below targetN
      expect(result.mergedCount).toBeGreaterThan(1);        // exceeds it here (guard-blocked '820')
    });

    it('hits targetN exactly when merges are available (mergedCount === targetN)', () => {
      const grid = ['310', '310', 'B5200', 'B5200', '999'];
      const counts = { '310': 2, 'B5200': 2, '999': 1 };

      const result = reduceToColorCount(grid, counts, tieCandidates, 2);

      expect(result.mergedCount).toBe(2); // equals targetN — a within-guard merge was available
    });

    it('is a no-op when targetN >= distinct color count (grid + counts returned unchanged)', () => {
      const grid = ['310', '150', '150'];
      const counts = { '310': 1, '150': 2 };

      const result = reduceToColorCount(grid, counts, reducerCandidates, 5);

      expect(result.codes).toEqual(grid);
      expect(result.counts).toEqual(counts);
      expect(result.codes.length).toBe(grid.length);
      expect(result.mergedCount).toBe(2);
    });

    it('does not throw on a degenerate empty grid / empty counts', () => {
      expect(() => reduceToColorCount([], {}, reducerCandidates, 3)).not.toThrow();
      const result = reduceToColorCount([], {}, reducerCandidates, 3);
      expect(result.codes).toEqual([]);
      expect(result.counts).toEqual({});
      expect(result.mergedCount).toBe(0);
    });

    it('bounds the max original→final per-cell CIEDE2000 shift at MERGE_GUARD_DELTA_E (D-01 mitigation)', () => {
      const grid = ['310', '310', '310', '150', '150', '999'];
      const counts = { '310': 3, '150': 2, '999': 1 };

      const result = reduceToColorCount(grid, counts, reducerCandidates, 2);

      // For every cell, the original matched color's Lab vs its final color's Lab must stay
      // within the guard — the "no visible change" contract bound.
      let maxShift = 0;
      for (let i = 0; i < grid.length; i++) {
        const shift = getColorDistance(labOf(reducerCandidates, grid[i]), labOf(reducerCandidates, result.codes[i]));
        maxShift = Math.max(maxShift, shift);
      }
      expect(maxShift).toBeLessThanOrEqual(MERGE_GUARD_DELTA_E);
    });

    it('bounds original→final shift across a MERGE CHAIN, not just per hop (CR-01 regression)', () => {
      // Three shades on a lightness line. Each ADJACENT hop is within the guard, but the two
      // ENDPOINTS are ~15.8 ΔE apart (> guard). Merge order is rarest-first: '150'→'310', then an
      // attempted '310'→'840'. A per-hop-only guard would let '150' chain all the way to '840'
      // (15.8 ΔE > guard) — a visible shift the "no visible change" contract forbids. The cluster
      // guard must re-check '150' (already folded into '310') against '840' and veto that hop.
      const chainCandidates: DmcColor[] = [
        c('150', { l: 40, a: 10, b: 10 }), // A — rarest (count 1); ~15.8 ΔE from '840'
        c('310', { l: 48, a: 10, b: 10 }), // B — middle; within guard of both A and C
        c('840', { l: 56, a: 10, b: 10 })  // C — endpoint
      ];
      // Fixture sanity: the geometry is genuinely chain-prone (endpoints exceed the guard,
      // adjacent hops do not) — otherwise this test could pass without exercising the bug.
      expect(getColorDistance(chainCandidates[0].lab, chainCandidates[2].lab)).toBeGreaterThan(MERGE_GUARD_DELTA_E);
      expect(getColorDistance(chainCandidates[0].lab, chainCandidates[1].lab)).toBeLessThanOrEqual(MERGE_GUARD_DELTA_E);
      expect(getColorDistance(chainCandidates[1].lab, chainCandidates[2].lab)).toBeLessThanOrEqual(MERGE_GUARD_DELTA_E);

      const grid = ['840', '840', '840', '310', '310', '150'];
      const counts = { '840': 3, '310': 2, '150': 1 };
      const result = reduceToColorCount(grid, counts, chainCandidates, 1);

      let maxShift = 0;
      for (let i = 0; i < grid.length; i++) {
        const shift = getColorDistance(labOf(chainCandidates, grid[i]), labOf(chainCandidates, result.codes[i]));
        maxShift = Math.max(maxShift, shift);
      }
      // With the cluster guard, no original cell drifts past the guard despite the chain.
      expect(maxShift).toBeLessThanOrEqual(MERGE_GUARD_DELTA_E);
    });

    it('is pure: preserves grid length, invents no new codes, and does not mutate inputs', () => {
      const grid = ['310', '310', '310', '150', '150', '999'];
      const counts = { '310': 3, '150': 2, '999': 1 };
      const gridSnapshot = [...grid];
      const countsSnapshot = { ...counts };
      const inputCodeSet = new Set(grid);

      const result = reduceToColorCount(grid, counts, reducerCandidates, 2);

      // Grid length preserved.
      expect(result.codes.length).toBe(grid.length);
      // No invented codes: every output code was present in the input grid.
      for (const code of result.codes) {
        expect(inputCodeSet.has(code)).toBe(true);
      }
      // Inputs untouched.
      expect(grid).toEqual(gridSnapshot);
      expect(counts).toEqual(countsSnapshot);
    });
  });
});
