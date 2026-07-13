import { describe, it, expect } from 'vitest';
import { toCents, fromCents, sumCents, formatUSD, sanitizeMoney } from '../money';

describe('money.toCents', () => {
  it('converts whole and fractional dollars to integer cents', () => {
    expect(toCents(8.5)).toBe(850);
    expect(toCents(4.99)).toBe(499);
    expect(toCents(0)).toBe(0);
    expect(toCents(15)).toBe(1500);
  });

  it('has no float drift: toCents(0.1) + toCents(0.2) === toCents(0.3)', () => {
    expect(toCents(0.1) + toCents(0.2)).toBe(toCents(0.3));
    expect(toCents(0.3)).toBe(30);
  });

  it('uses EPSILON-safe round-half-up (not naive Math.round(x*100))', () => {
    // Naive Math.round(1.005 * 100) === 100 because 1.005*100 === 100.4999… in IEEE-754.
    expect(toCents(1.005)).toBe(101);
    // Naive Math.round(0.005 * 100) === 0 for the same reason.
    expect(toCents(0.005)).toBe(1);
    expect(toCents(2.675)).toBe(268);
  });

  it('rounds half-up for exactly representable halves', () => {
    expect(toCents(0.125)).toBe(13); // $0.125 -> 13¢ (round half up)
    expect(toCents(0.015)).toBe(2);
  });

  it('handles negative dollars with round-half-up magnitude semantics', () => {
    expect(toCents(-8.5)).toBe(-850);
    expect(toCents(-4.99)).toBe(-499);
  });

  it('THROWS (RangeError) on non-finite input — a bad price must fail loud, never become $0/NaN cents', () => {
    expect(() => toCents(NaN)).toThrow(RangeError);
    expect(() => toCents(Infinity)).toThrow(RangeError);
    expect(() => toCents(-Infinity)).toThrow(RangeError);
  });
});

describe('money.sanitizeMoney (CR-01: finite/non-negative guard before toCents)', () => {
  it('passes through finite, non-negative numbers unchanged', () => {
    expect(sanitizeMoney(15)).toBe(15);
    expect(sanitizeMoney(8.5)).toBe(8.5);
    expect(sanitizeMoney(0)).toBe(0);
  });

  it('parses numeric strings (the raw <input type="number"> value)', () => {
    expect(sanitizeMoney('15')).toBe(15);
    expect(sanitizeMoney('8.50')).toBe(8.5);
    expect(sanitizeMoney('')).toBe(0);
  });

  it('collapses non-finite input to 0 — the exact CR-01 crash vector', () => {
    // `<input type="number">` accepts oversized/scientific notation; parseFloat
    // yields Infinity, and `Infinity || 0 === Infinity` (the old bug) slipped
    // through to toCents. sanitizeMoney clamps it to 0.
    expect(sanitizeMoney('1e999')).toBe(0);
    expect(sanitizeMoney(Infinity)).toBe(0);
    expect(sanitizeMoney(-Infinity)).toBe(0);
    expect(sanitizeMoney(NaN)).toBe(0);
  });

  it('clamps negative amounts to 0', () => {
    expect(sanitizeMoney(-5)).toBe(0);
    expect(sanitizeMoney('-0.01')).toBe(0);
  });

  it('makes toCents(sanitizeMoney(x)) total-path-safe for any input', () => {
    // The regression: before the guard, toCents(Infinity) threw and
    // white-screened the render. sanitizeMoney closes the vector.
    expect(() => toCents(sanitizeMoney('1e999'))).not.toThrow();
    expect(toCents(sanitizeMoney('1e999'))).toBe(0);
    expect(() => toCents(sanitizeMoney(NaN))).not.toThrow();
    expect(toCents(sanitizeMoney(-Infinity))).toBe(0);
    // A valid amount still converts correctly.
    expect(toCents(sanitizeMoney('8.50'))).toBe(850);
  });
});

describe('money.fromCents', () => {
  it('converts integer cents back to dollars', () => {
    expect(fromCents(850)).toBe(8.5);
    expect(fromCents(499)).toBe(4.99);
    expect(fromCents(0)).toBe(0);
    expect(fromCents(1379)).toBe(13.79);
  });

  it('round-trips through toCents without drift', () => {
    expect(fromCents(toCents(8.5))).toBe(8.5);
    expect(fromCents(toCents(0.1) + toCents(0.2))).toBe(0.3);
  });
});

describe('money.sumCents', () => {
  it('sums an integer-cents array exactly', () => {
    expect(sumCents([850, 499, 16, 14])).toBe(1379);
    expect(sumCents([])).toBe(0);
    expect(sumCents([1])).toBe(1);
  });
});

describe('money.formatUSD', () => {
  it('formats integer cents as a $X.XX string', () => {
    expect(formatUSD(850)).toBe('$8.50');
    expect(formatUSD(499)).toBe('$4.99');
    expect(formatUSD(0)).toBe('$0.00');
    expect(formatUSD(1379)).toBe('$13.79');
  });
});

describe('money reconciliation (PRICE-03: line items sum exactly to the total)', () => {
  it('sum of per-line cents equals the grand-total cents — no float drift', () => {
    // A realistic quote: canvas base, shipping, several drill line costs.
    const lineItemsDollars = [8.5, 4.99, 0.16, 0.14, 1.005, 0.005];
    const lineItemCents = lineItemsDollars.map(toCents);

    // Intended grand total computed independently in integer cents.
    // 850 + 499 + 16 + 14 + 101 + 1 = 1481
    const totalCents = 1481;

    expect(sumCents(lineItemCents)).toBe(totalCents);
    // The displayed total (dollars) reconstructed from cents matches exactly.
    expect(fromCents(sumCents(lineItemCents))).toBe(14.81);
    expect(formatUSD(sumCents(lineItemCents))).toBe('$14.81');
  });

  it('naive float summation would drift, but cents summation does not', () => {
    const dollars = [0.1, 0.2, 0.3, 0.1, 0.1, 0.1];
    // Float sum drifts (0.899999...); cents sum is exact.
    const cents = dollars.map(toCents);
    expect(sumCents(cents)).toBe(90);
    expect(fromCents(sumCents(cents))).toBe(0.9);
  });
});
