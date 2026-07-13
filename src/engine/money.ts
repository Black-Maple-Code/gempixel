/**
 * Canonical integer-cents money helper (PRICE-03).
 *
 * All customer-facing money math routes through this module so that itemized
 * line items always reconcile EXACTLY to the displayed grand total — a total
 * summed from the same integer cents can never silently disagree with the
 * visible line items (threat T-15-05).
 *
 * This SUPERSEDES the ad-hoc `Math.round(x * 100) / 100` cents math scattered in
 * checkout.ts / bagPlanner.ts: it keeps the same round-half-up convention but
 * fixes the IEEE-754 representation-error edge cases the naive form has
 * (e.g. `1.005 * 100 === 100.4999…`, so `Math.round(1.005 * 100) === 100`).
 *
 * Pure module: no Preact, no DOM, no persistence. `toCents` fails LOUD on a
 * non-finite input (NaN/Infinity) so a bad/tampered price can never silently
 * become a $0/NaN cent value in the total (threat T-15-04).
 */

/**
 * Convert a dollar amount to integer cents using EPSILON-safe round-half-up.
 *
 * The naive `Math.round(dollars * 100)` is BANNED here: `1.005 * 100` evaluates
 * to `100.4999999999…` in IEEE-754, so the naive form returns 100 instead of
 * 101 — exactly the float-money bug PRICE-03 exists to prevent. Rounding the
 * scaled value at 6 decimal places first absorbs the representation error, then
 * `Math.round` applies the round-half-up convention.
 *
 * @throws {RangeError} if `dollars` is not a finite number (NaN / ±Infinity).
 */
export function toCents(dollars: number): number {
  if (!Number.isFinite(dollars)) {
    throw new RangeError(`toCents: expected a finite dollar amount, got ${dollars}`);
  }
  // Trim the IEEE-754 representation error (Number.EPSILON-scale) at 6 decimals
  // so a true half-cent survives, then round-half-up via Math.round.
  return Math.round(Number((dollars * 100).toFixed(6)));
}

/** Convert integer cents back to a dollar number. */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Coerce an arbitrary parsed/user value to a finite, non-negative dollar number.
 *
 * Non-finite (NaN / ±Infinity) or negative inputs collapse to 0. This is the
 * single guard that keeps a bad price input from ever reaching `toCents` (which
 * throws on non-finite input by design). The `parseFloat(x) || 0` idiom it
 * replaces catches NaN but NOT Infinity — a `<input type="number">` accepts
 * oversized/scientific notation like `1e999`, and `Infinity || 0 === Infinity`
 * would flow into `toCents` and white-screen the render path (CR-01).
 */
export function sanitizeMoney(value: number | string): number {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Exact integer sum of a list of cent values (no float accumulation). */
export function sumCents(values: number[]): number {
  return values.reduce((acc, c) => acc + c, 0);
}

/** Format integer cents as a `$X.XX` display string. */
export function formatUSD(cents: number): string {
  return '$' + (cents / 100).toFixed(2);
}
