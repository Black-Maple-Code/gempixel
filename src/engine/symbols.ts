/**
 * Symbol tiers, exhausted IN ORDER as colors are assigned by descending
 * frequency: the most-used color gets 'A', the next 'B', ... through 'Z', then
 * '0'–'9', then the Wingding-style glyph pool. This keeps the busiest colors on
 * plain, instantly-legible letters and pushes ornate glyphs to rare colors.
 */

// Tier 1 — Letters A–Z (26). Most-frequent color = 'A'.
export const LETTER_SYMBOLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Tier 2 — Numbers 0–9 (10).
export const NUMBER_SYMBOLS = '0123456789'.split('');

// Tier 3 — "Wingdings": distinguishable non-alphanumeric glyphs (46).
export const WINGDING_SYMBOLS = [
  // Playing Card Suits (4)
  '♣', '♦', '♥', '♠',
  // Geometric Filled (10)
  '▲', '▼', '◆', '●', '■', '★', '◀', '▶', '❖', '⬤',
  // Geometric Outlined (10)
  '△', '▽', '◇', '○', '□', '☆', '◁', '▷', '⬡', '⭘',
  // Circles with Patterns (12)
  '◎', '⊕', '⊖', '⊗', '⊘', '⊙', '⊚', '⊛', '⊜', '⊞', '⊟', '⊠',
  // Misc Glyphs (10)
  '✦', '✧', '⬢', '⬣', '⭓', '⭔', '▰', '▱', '†', '‡',
];

/**
 * The ordered allocation pool: Letters → Numbers → Wingdings (82 total).
 * `generateSymbolAllocation` walks this by frequency rank.
 */
export const CURATED_SYMBOLS = [
  ...LETTER_SYMBOLS,
  ...NUMBER_SYMBOLS,
  ...WINGDING_SYMBOLS,
];

export interface ColorSymbolMap {
  [dmcCode: string]: string;
}

/**
 * Calculates frequency of colors in grid matches and assigns symbols
 */
export function generateSymbolAllocation(
  gridMatches: string[],
  activePaletteCodes: string[]
): ColorSymbolMap {
  // Count occurrences
  const freqMap: { [code: string]: number } = {};
  activePaletteCodes.forEach(code => {
    freqMap[code] = 0;
  });

  gridMatches.forEach(code => {
    if (freqMap[code] !== undefined) {
      freqMap[code]++;
    }
  });

  // Sort by frequency descending
  const sortedColors = activePaletteCodes
    .map(code => ({ code, count: freqMap[code] || 0 }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      // If frequency is equal, break ties using alphabetical code sorting for stability
      return a.code.localeCompare(b.code);
    });

  // Assign symbols from curated pool. For the first 82 colors each gets a unique
  // single glyph. Beyond that (e.g. the 200-color kit or 'all'), fall back to a
  // deterministic multi-character symbol — base glyph + a tier suffix (>= 1) — so
  // every distinct color keeps a UNIQUE symbol instead of the old `index % 82`
  // wraparound that reused 'A' for the 83rd color and made the chart ambiguous (B4).
  const poolSize = CURATED_SYMBOLS.length;
  const allocation: ColorSymbolMap = {};
  sortedColors.forEach((item, index) => {
    if (index < poolSize) {
      allocation[item.code] = CURATED_SYMBOLS[index];
    } else {
      const base = CURATED_SYMBOLS[index % poolSize];
      const suffix = Math.floor(index / poolSize); // >= 1 here, so never collides
      allocation[item.code] = `${base}${suffix}`; // with a single-glyph assignment
    }
  });

  return allocation;
}

/**
 * Pixel font size for drawing a cell/legend symbol. Single-glyph symbols use
 * `basePx` as-is; multi-character overflow symbols (B4, >82 colors) are scaled
 * down so they still fit the box a single glyph occupies.
 */
export function symbolFontPx(basePx: number, symbol: string): number {
  if (symbol.length <= 1) return basePx;
  return Math.max(1, Math.round(basePx / symbol.length));
}

/**
 * Calculates BT.601 background luminance and returns high-contrast text color
 * Formula: Y = 0.299R + 0.587G + 0.114B
 */
export function getContrastColor(hexColor: string): string {
  // Normalize hex
  const hex = hexColor.replace('#', '');
  let r = 0, g = 0, b = 0;

  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6) {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }

  // Calculate luminance (0.0 to 1.0 range)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black text for light backgrounds, white for dark backgrounds
  return luminance > 0.55 ? '#000000' : '#FFFFFF';
}
