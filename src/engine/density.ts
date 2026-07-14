/**
 * Density — the single source of truth mapping a diamond-art grid (cols x rows
 * of dots) to physical size in inches, and formatting an inch value for display.
 *
 * There is exactly ONE density path in the app (QUOTE-01): every physical-size /
 * inch figure derives from grid dimensions through `gridToInches` here. This
 * reconciles EXACTLY with the app's long-standing `/10` convention — see
 * `calculateCanvasCost` (checkout.ts, `unit === 'grid'` divides width/10,
 * height/10) and App.tsx's inline `cols / 10` — so displayed size and canvas
 * cost can never disagree.
 *
 * Pure module: no Preact, no DOM, no persistence, named exports only. Fail-soft
 * in the render-path lineage — a non-finite (tampered/restored) dimension
 * degrades that axis to 0, never NaN, and never throws.
 */

/**
 * Dots per inch. 2.5 mm per dot is exactly 25.4 / 2.5 = 10.16 dots/inch, but the
 * app has always rounded this to 10 (checkout.ts `calculateCanvasCost` width/10,
 * App.tsx `cols / 10`). We keep it at 10 deliberately so this helper stays the
 * single reconciled density source. Do NOT "correct" it to 10.16 — a second
 * density constant would fork the truth and desync size labels from canvas cost
 * (QUOTE-01).
 */
export const DOTS_PER_INCH = 10;

/** Physical size of one dot in millimetres — the rationale behind DOTS_PER_INCH. */
export const MM_PER_DOT = 2.5;

/**
 * Map grid dimensions (cols x rows of dots) to physical size in inches at
 * `DOTS_PER_INCH` (10 dots/inch), reconciled byte-identically with the app's
 * `/10` convention: `gridToInches(cols, rows).widthIn === cols / 10` for any
 * finite `cols`. A non-finite input (NaN/Infinity from a tampered/restored
 * dimension) degrades that axis to 0 — never NaN, never throws. Returns plain
 * numbers so callers can do math; use `formatInches` for a display label.
 */
export function gridToInches(
  cols: number,
  rows: number
): { widthIn: number; heightIn: number } {
  return {
    widthIn: Number.isFinite(cols) ? cols / DOTS_PER_INCH : 0,
    heightIn: Number.isFinite(rows) ? rows / DOTS_PER_INCH : 0,
  };
}

/**
 * Format an inch value as a 1-decimal-place display string (round-half-up via
 * `Math.round`), matching App.tsx's existing `fmt` precedent:
 * `formatInches(12) === "12"`, `formatInches(15.44) === "15.4"`,
 * `formatInches(15.45) === "15.5"`.
 *
 * A non-finite input formats as `"0"` (IN-01) so the display path stays fail-soft
 * end-to-end — matching `gridToInches`'s own non-finite guard rather than emitting
 * `"NaN"`/`"Infinity"` into a label.
 */
export function formatInches(inches: number): string {
  if (!Number.isFinite(inches)) return '0';
  return (Math.round(inches * 10) / 10).toString();
}
