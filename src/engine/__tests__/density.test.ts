import { describe, it, expect } from 'vitest';
import { gridToInches, formatInches, DOTS_PER_INCH } from '../density';

describe('density helper (QUOTE-01)', () => {
  it('gridToInches(120,160) → { widthIn: 12, heightIn: 16 }', () => {
    expect(gridToInches(120, 160)).toEqual({ widthIn: 12, heightIn: 16 });
  });

  it('reconciles with calculateCanvasCost grid→/10: widthIn === cols / DOTS_PER_INCH', () => {
    const cols = 200;
    const rows = 280;
    const { widthIn, heightIn } = gridToInches(cols, rows);
    // Both this helper and calculateCanvasCost derive inches from grid dims via
    // the SAME /10 divisor (checkout.ts: width/10, height/10). Assert the axes
    // match exactly and that the derived area equals the area calculateCanvasCost
    // computes internally for the same grid — one density source, never divergent.
    expect(widthIn).toBe(cols / DOTS_PER_INCH);
    expect(heightIn).toBe(rows / DOTS_PER_INCH);
    const canvasCostArea = (cols / 10) * (rows / 10);
    expect(widthIn * heightIn).toBe(canvasCostArea);
  });

  it('degrades a non-finite axis to 0 (never NaN, never throws)', () => {
    expect(() => gridToInches(NaN, 160)).not.toThrow();
    expect(gridToInches(NaN, 160).widthIn).toBe(0);
    expect(gridToInches(NaN, 160).heightIn).toBe(16);
    expect(gridToInches(120, Infinity).heightIn).toBe(0);
  });

  it('formatInches rounds to 1 decimal place (round-half-up)', () => {
    expect(formatInches(12)).toBe('12');
    expect(formatInches(15.44)).toBe('15.4');
    expect(formatInches(15.45)).toBe('15.5');
  });
});
