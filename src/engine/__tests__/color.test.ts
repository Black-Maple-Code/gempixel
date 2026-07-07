import { describe, it, expect, beforeEach } from 'vitest';
import { rgbToLab, blendAlpha, matchColor, matchPixelGrid, clearCache } from '../color';
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
});
