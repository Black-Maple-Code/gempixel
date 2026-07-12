import { describe, it, expect } from 'vitest';
import {
  CURATED_SYMBOLS,
  LETTER_SYMBOLS,
  NUMBER_SYMBOLS,
  WINGDING_SYMBOLS,
  generateSymbolAllocation,
  getContrastColor,
} from '../symbols';

describe('Symbol Database & Allocation Engine', () => {
  describe('CURATED_SYMBOLS pool', () => {
    it('contains at least 80 distinct, highly distinguishable symbols', () => {
      expect(CURATED_SYMBOLS.length).toBeGreaterThanOrEqual(80);
      
      // Ensure all symbols in the pool are unique (no duplicates)
      const uniqueSymbols = new Set(CURATED_SYMBOLS);
      expect(uniqueSymbols.size).toBe(CURATED_SYMBOLS.length);
    });

    it('is ordered Letters (A-Z) → Numbers (0-9) → Wingdings', () => {
      // Tier 1: the first 26 symbols are the uppercase alphabet in order.
      expect(CURATED_SYMBOLS.slice(0, 26)).toEqual(LETTER_SYMBOLS);
      expect(LETTER_SYMBOLS).toEqual('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));

      // Tier 2: the next 10 symbols are the digits 0-9 in order.
      expect(CURATED_SYMBOLS.slice(26, 36)).toEqual(NUMBER_SYMBOLS);
      expect(NUMBER_SYMBOLS).toEqual('0123456789'.split(''));

      // Tier 3: everything after is the non-alphanumeric Wingding glyph pool.
      expect(CURATED_SYMBOLS.slice(36)).toEqual(WINGDING_SYMBOLS);
      const alphanumerics = /[A-Za-z0-9]/;
      WINGDING_SYMBOLS.forEach(char => {
        expect(alphanumerics.test(char)).toBe(false);
      });
    });

    it('assigns the most-frequent color a plain letter, starting at A', () => {
      expect(CURATED_SYMBOLS[0]).toBe('A');
      expect(CURATED_SYMBOLS[1]).toBe('B');
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

    it('wraps around symbols pool correctly if active color count exceeds pool size', () => {
      // Create more active codes than pool size
      const codeCount = CURATED_SYMBOLS.length + 5;
      const activePaletteCodes = Array.from({ length: codeCount }, (_, i) => `COLOR_${String(i).padStart(3, '0')}`);
      
      const allocation = generateSymbolAllocation([], activePaletteCodes);
      
      // First 5 elements of pool should be reassigned at the end
      expect(allocation[`COLOR_000`]).toBe(CURATED_SYMBOLS[0]);
      expect(allocation[`COLOR_${String(CURATED_SYMBOLS.length).padStart(3, '0')}`]).toBe(CURATED_SYMBOLS[0]);
      
      expect(allocation[`COLOR_004`]).toBe(CURATED_SYMBOLS[4]);
      expect(allocation[`COLOR_${String(CURATED_SYMBOLS.length + 4).padStart(3, '0')}`]).toBe(CURATED_SYMBOLS[4]);
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
