/**
 * Symbol tiers, exhausted IN ORDER as colors are assigned by descending
 * frequency. The order is symbols-first, letters-last, digits-never:
 *
 *   1. GLYPH_SYMBOLS      — a curated tier of EASILY DISTINGUISHABLE, monochrome,
 *                           text-presentation shape glyphs (~105). The busiest
 *                           colors get these bold, instantly-legible shapes. Pure
 *                           rotations and tiny-interior twins are deliberately
 *                           excluded so every shape reads differently at ~10px.
 *   2. SAFE_LETTER_SYMBOLS — unambiguous capital letters, used ONLY once every
 *                           glyph is exhausted, so the rarest colors on a very
 *                           large palette fall to clean letters. Excludes the
 *                           digit/look-alike confusables B, G, I, O, Q, S, Z.
 *
 * There are NO digits anywhere in the pool: 0/O, 1/I, 2/Z, 5/S, 8/B confusion is
 * eliminated by construction, and no two-char "glyph+digit" combos appear in the
 * common case. Distinct glyphs lead; unambiguous letters are the last resort.
 */

// Tier 1 — GLYPH_SYMBOLS: a curated, ordered, de-duplicated tier of EASILY
// DISTINGUISHABLE, MONOCHROME, text-presentation BMP glyphs that render reliably
// via canvas fillText in the body/UI sans-serif font. Bold / most-distinct
// shapes lead. Beyond emoji/tofu safety, this tier is pruned for at-cell-size
// legibility: pure rotations and tiny-interior twins are removed so no two glyphs
// read alike at ~10px. All BMP, all text-default — no astral code points and no
// emoji-presentation glyphs (which would force color rendering). The first block
// is the proven-safe set that already ships in production, kept verbatim; the
// rest is a vetted, distinctness-pruned expansion.
export const GLYPH_SYMBOLS = [
  // --- Proven-safe production base (kept verbatim, boldest shapes first) ---
  // Playing Card Suits (filled)
  '♣', '♦', '♥', '♠',
  // Geometric Filled
  '▲', '▼', '◆', '●', '■', '★', '◀', '▶', '❖', '⬤',
  // Geometric Outlined
  '△', '▽', '◇', '○', '□', '☆', '◁', '▷', '⬡', '⭘',
  // Circles with Patterns
  '◎', '⊕', '⊖', '⊗', '⊘', '⊙', '⊚', '⊜', '⊞', '⊟', '⊠',
  // Misc Glyphs
  '✦', '✧', '⬢', '⬣', '⭓', '⭔', '▰', '▱', '†', '‡',

  // --- Vetted expansion (distinct, text-default, deduped against the base) ---
  // Filled / outline geometrics (pentagon, nested diamond, corner triangles)
  '⬟', '◈', '◢', '◣', '◤', '◥', '◸', '◹', '◺', '◿',
  // Card-suit OUTLINE variants (distinct from the filled suits above)
  '♤', '♡', '♢', '♧',
  // Half circles (mirror rotations pruned for distinctness)
  '◐', '◑', '◔', '◕',
  // Filled-pattern circle
  '◍',
  // Partitioned / hatched squares
  '◧', '◨', '◩', '◪', '◫', '▤', '▥', '▦', '▧', '▨', '▩',
  // Quadrant squares / circles (rotations pruned — one representative each)
  '◰', '◴',
  // Star / florette dingbats (text-default; interior twins pruned)
  '✶', '✷', '✵', '✱', '✲', '✻', '❂', '❉', '❋', '✹',
  // Crosses / bars (interior twins pruned)
  '✚', '✠', '✢', '⧈',
  // Double arrows
  '⇐', '⇒', '⇑', '⇓', '⇔', '⇕',
  // Single arrows
  '←', '→', '↑', '↓', '↖', '↗', '↘', '↙',
];

// Tier 2 — SAFE_LETTER_SYMBOLS: unambiguous capitals ONLY, used after every
// glyph is exhausted. Deliberately EXCLUDES B, G, I, O, Q, S, Z — the letters
// that read as digits or as each other at ~10px cell size.
export const SAFE_LETTER_SYMBOLS = [
  'A', 'C', 'D', 'E', 'F', 'H', 'J', 'K', 'L', 'M',
  'N', 'P', 'R', 'T', 'U', 'V', 'W', 'X', 'Y',
];

/**
 * The ordered allocation pool: GLYPHS → SAFE LETTERS. No digits anywhere.
 * `generateSymbolAllocation` walks this by frequency rank, so the most-used
 * colors get distinct shape glyphs and letters only appear once the (large)
 * glyph pool is spent.
 */
export const CURATED_SYMBOLS = [
  ...GLYPH_SYMBOLS,
  ...SAFE_LETTER_SYMBOLS,
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

  // Assign symbols from the curated pool. For the first `poolSize` colors each
  // gets a unique single glyph (distinct shapes first, unambiguous letters last).
  // Beyond that (only when a palette exceeds the WHOLE single-symbol pool — now a
  // rare last-ditch case given the enlarged glyph tier), fall back to a
  // deterministic multi-character symbol — base glyph + a tier suffix (>= 1) — so
  // every distinct color keeps a UNIQUE symbol instead of an `index % poolSize`
  // wraparound that would reuse the first glyph and make the chart ambiguous (B4).
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
 * `basePx` as-is; multi-character overflow symbols (B4, palettes larger than the
 * whole pool) are scaled down so they still fit the box a single glyph occupies.
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
