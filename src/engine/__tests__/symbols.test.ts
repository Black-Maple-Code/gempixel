import { describe, it, expect } from 'vitest';
import {
  CURATED_SYMBOLS,
  GLYPH_SYMBOLS,
  SAFE_LETTER_SYMBOLS,
  generateSymbolAllocation,
  getContrastColor,
  symbolFontPx,
} from '../symbols';

describe('Symbol Database & Allocation Engine', () => {
  describe('CURATED_SYMBOLS pool', () => {
    it('contains a large pool (>118) of distinct, unique symbols', () => {
      // A full 118-color chart must be coverable by glyphs alone, so the whole
      // pool comfortably exceeds 118.
      expect(CURATED_SYMBOLS.length).toBeGreaterThan(118);

      // Ensure all symbols in the pool are unique (no duplicates)
      const uniqueSymbols = new Set(CURATED_SYMBOLS);
      expect(uniqueSymbols.size).toBe(CURATED_SYMBOLS.length);
    });

    it('leads with a non-alphanumeric shape glyph (symbols-first)', () => {
      // The most-frequent color gets a distinct shape, never a letter or digit.
      expect(/[A-Za-z0-9]/.test(CURATED_SYMBOLS[0])).toBe(false);
    });

    it('never contains a digit (0-9) anywhere in the pool', () => {
      expect(CURATED_SYMBOLS.every(s => !/[0-9]/.test(s))).toBe(true);
    });

    it('has a letter-free glyph tier', () => {
      expect(GLYPH_SYMBOLS.every(g => !/[A-Za-z]/.test(g))).toBe(true);
      // The glyph tier alone covers a 118-color chart.
      expect(GLYPH_SYMBOLS.length).toBeGreaterThan(118);
    });

    it('puts unambiguous letters last, filtered of look-alike/confusable capitals', () => {
      // Exactly the 19 unambiguous capitals, in order.
      expect(SAFE_LETTER_SYMBOLS).toEqual(
        ['A', 'C', 'D', 'E', 'F', 'H', 'J', 'K', 'L', 'M',
         'N', 'P', 'R', 'T', 'U', 'V', 'W', 'X', 'Y']
      );

      // None of the digit/look-alike confusables are present.
      ['B', 'G', 'I', 'O', 'Q', 'S', 'Z'].forEach(bad => {
        expect(SAFE_LETTER_SYMBOLS).not.toContain(bad);
      });

      // The letter tier sits strictly AFTER every glyph.
      expect(CURATED_SYMBOLS.slice(0, GLYPH_SYMBOLS.length)).toEqual(GLYPH_SYMBOLS);
      expect(CURATED_SYMBOLS.slice(GLYPH_SYMBOLS.length)).toEqual(SAFE_LETTER_SYMBOLS);
    });
  });

  describe('generateSymbolAllocation', () => {
    it('allocates symbols to active colors in order of color frequency descending', () => {
      // Create a grid matches array with varying color frequencies
      // "310" (Black) appears 5 times
      // "BLANC" (White) appears 3 times
      // "606" (Red) appears 1 time
      // "995" (Blue) appears 0 times
      const gridMatches = [
        '310', '310', '310', '310', '310',
        'BLANC', 'BLANC', 'BLANC',
        '606'
      ];
      
      const activePaletteCodes = ['310', 'BLANC', '606', '995'];
      
      const allocation = generateSymbolAllocation(gridMatches, activePaletteCodes);
      
      // The most frequent color ("310") should get the first symbol
      expect(allocation['310']).toBe(CURATED_SYMBOLS[0]);
      
      // Second most frequent ("BLANC") gets second symbol
      expect(allocation['BLANC']).toBe(CURATED_SYMBOLS[1]);
      
      // Third most frequent ("606") gets third symbol
      expect(allocation['606']).toBe(CURATED_SYMBOLS[2]);
      
      // Least frequent ("995", count 0) gets fourth symbol
      expect(allocation['995']).toBe(CURATED_SYMBOLS[3]);
    });

    it('breaks color frequency ties stably using alphabetical sorting', () => {
      // Colors "A" and "B" have equal frequency (2 each)
      // Colors "C" and "D" have equal frequency (0 each)
      const gridMatches = ['A', 'A', 'B', 'B'];
      const activePaletteCodes = ['B', 'A', 'D', 'C'];
      
      const allocation = generateSymbolAllocation(gridMatches, activePaletteCodes);
      
      // Ties resolved alphabetically: 'A' before 'B', 'C' before 'D'
      expect(allocation['A']).toBe(CURATED_SYMBOLS[0]);
      expect(allocation['B']).toBe(CURATED_SYMBOLS[1]);
      expect(allocation['C']).toBe(CURATED_SYMBOLS[2]);
      expect(allocation['D']).toBe(CURATED_SYMBOLS[3]);
    });

    it('ensures distinct colors receive different symbols within pool size limit', () => {
      const activePaletteCodes = CURATED_SYMBOLS.slice(0, 10).map((_, i) => `COLOR_${i}`);
      const gridMatches: string[] = []; // frequency doesn't matter since all counts are 0
      
      const allocation = generateSymbolAllocation(gridMatches, activePaletteCodes);
      
      const assignedSymbols = Object.values(allocation);
      const uniqueAssigned = new Set(assignedSymbols);
      
      expect(assignedSymbols.length).toBe(10);
      expect(uniqueAssigned.size).toBe(10);
    });

    it('keeps every symbol UNIQUE when active color count exceeds pool size (B4)', () => {
      // A palette larger than the WHOLE single-symbol pool must still get a
      // unique symbol per color — the old `index % poolSize` wraparound reused
      // the first glyph and made the exported legend ambiguous. This test derives
      // from the live pool size so it tracks the (now much larger) glyph tier.
      const poolSize = CURATED_SYMBOLS.length;
      const codeCount = poolSize + 20;
      const activePaletteCodes = Array.from({ length: codeCount }, (_, i) => `COLOR_${String(i).padStart(3, '0')}`);

      const allocation = generateSymbolAllocation([], activePaletteCodes);

      const assignedSymbols = Object.values(allocation);
      expect(assignedSymbols.length).toBe(codeCount);
      // No collisions across the whole oversized palette.
      expect(new Set(assignedSymbols).size).toBe(codeCount);

      // The first `poolSize` colors keep their single curated glyph.
      expect(allocation['COLOR_000']).toBe(CURATED_SYMBOLS[0]);
      expect(allocation[`COLOR_${String(poolSize - 1).padStart(3, '0')}`]).toBe(CURATED_SYMBOLS[poolSize - 1]);

      // The color at index `poolSize` triggers the overflow branch: a
      // deterministic multi-char symbol (base glyph + tier suffix >= 1) that no
      // longer collides with the first glyph.
      const overflowSymbol = allocation[`COLOR_${String(poolSize).padStart(3, '0')}`];
      expect(overflowSymbol).toBe(`${CURATED_SYMBOLS[0]}1`);
      expect(overflowSymbol).not.toBe(CURATED_SYMBOLS[0]);
      expect(overflowSymbol.length).toBeGreaterThan(1);
    });
  });

  describe('symbolFontPx', () => {
    it('returns the base size for single-glyph symbols and scales multi-char ones down', () => {
      expect(symbolFontPx(20, 'A')).toBe(20);
      expect(symbolFontPx(20, '♣')).toBe(20);
      // A 2-char overflow symbol shrinks so it still fits the single-glyph box.
      expect(symbolFontPx(20, 'A1')).toBe(10);
      expect(symbolFontPx(8, 'B3')).toBe(4);
      // Never returns a sub-1px font.
      expect(symbolFontPx(1, 'C2')).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getContrastColor', () => {
    it('handles standard 6-character hex colors (with and without hash)', () => {
      // Light background -> Black text (#000000)
      expect(getContrastColor('#FFFFFF')).toBe('#000000');
      expect(getContrastColor('FFFFFF')).toBe('#000000');
      
      // Dark background -> White text (#FFFFFF)
      expect(getContrastColor('#000000')).toBe('#FFFFFF');
      expect(getContrastColor('000000')).toBe('#FFFFFF');
    });

    it('handles 3-character hex colors (with and without hash)', () => {
      // Light background -> Black text
      expect(getContrastColor('#FFF')).toBe('#000000');
      expect(getContrastColor('FFF')).toBe('#000000');
      
      // Dark background -> White text
      expect(getContrastColor('#000')).toBe('#FFFFFF');
      expect(getContrastColor('000')).toBe('#FFFFFF');
    });

    it('computes BT.601 luminance correctly for color thresholds', () => {
      // Luminance = 0.299 * R + 0.587 * G + 0.114 * B
      // Threshold is 0.55
      
      // Pure Green: #00FF00
      // Luminance = 0.587 * 255 / 255 = 0.587 > 0.55 => Black text
      expect(getContrastColor('#00FF00')).toBe('#000000');
      
      // Pure Red: #FF0000
      // Luminance = 0.299 * 255 / 255 = 0.299 <= 0.55 => White text
      expect(getContrastColor('#FF0000')).toBe('#FFFFFF');
      
      // Pure Blue: #0000FF
      // Luminance = 0.114 * 255 / 255 = 0.114 <= 0.55 => White text
      expect(getContrastColor('#0000FF')).toBe('#FFFFFF');

      // Mid-Gray: #808080 (128, 128, 128)
      // Luminance = 0.299*128 + 0.587*128 + 0.114*128 = 128 / 255 = 0.5019 <= 0.55 => White text
      expect(getContrastColor('#808080')).toBe('#FFFFFF');
      
      // Light Mid-Gray: #909090 (144, 144, 144)
      // Luminance = 144 / 255 = 0.5647 > 0.55 => Black text
      expect(getContrastColor('#909090')).toBe('#000000');
    });
  });
});
