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

  // Assign symbols from curated pool
  const allocation: ColorSymbolMap = {};
  sortedColors.forEach((item, index) => {
    const symbolIndex = index % CURATED_SYMBOLS.length;
    allocation[item.code] = CURATED_SYMBOLS[symbolIndex];
  });

  return allocation;
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
