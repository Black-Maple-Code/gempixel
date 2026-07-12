import { describe, it, expect } from 'vitest';
import { smoothMatches } from '../smoothing';

// Build a cols*rows grid filled with `bg`, then apply per-cell overrides.
function grid(cols: number, rows: number, bg: string, overrides: Record<number, string> = {}): string[] {
  const cells = new Array(cols * rows).fill(bg);
  for (const [idx, code] of Object.entries(overrides)) cells[Number(idx)] = code;
  return cells;
}

describe('smoothMatches', () => {
  it('removes an orphaned single pixel surrounded by one color', () => {
    // 3x3 field of 'W' with a lone 'X' dead center (index 4) — all 8 neighbours
    // are 'W', so even the gentlest strength flips it.
    const g = grid(3, 3, 'W', { 4: 'X' });
    const { codes, counts } = smoothMatches(g, 3, 3, 1);
    expect(codes[4]).toBe('W');
    expect(counts).toEqual({ W: 9 });
    expect(counts.X).toBeUndefined();
  });

  it('is a no-op when strength <= 0 (returns the grid unchanged, recounted)', () => {
    const g = grid(3, 3, 'W', { 4: 'X' });
    const { codes, counts } = smoothMatches(g, 3, 3, 0);
    expect(codes).toEqual(g);
    expect(codes).not.toBe(g); // fresh array, not the same reference
    expect(counts).toEqual({ W: 8, X: 1 });
  });

  it('preserves grid length and never invents codes outside the input set', () => {
    const g = grid(5, 5, 'A', { 12: 'B', 7: 'B', 17: 'B' });
    const { codes } = smoothMatches(g, 5, 5, 3);
    expect(codes).toHaveLength(25);
    const allowed = new Set(['A', 'B']);
    codes.forEach(c => expect(allowed.has(c)).toBe(true));
  });

  it('light strength keeps a genuine 2x2 block (not a stray orphan)', () => {
    // A solid 2x2 'X' block in a 4x4 'W' field. Its cells each have 3 same-color
    // neighbours — below the strength-1 bar (6), so the block survives.
    const g = grid(4, 4, 'W', { 5: 'X', 6: 'X', 9: 'X', 10: 'X' });
    const { codes } = smoothMatches(g, 4, 4, 1);
    expect(codes[5]).toBe('X');
    expect(codes[6]).toBe('X');
    expect(codes[9]).toBe('X');
    expect(codes[10]).toBe('X');
  });

  it('recomputes counts from the smoothed grid', () => {
    // Two orphans in a 5x5 'W' field, both fully surrounded -> both dissolve.
    const g = grid(5, 5, 'W', { 6: 'Y', 18: 'Z' });
    const { counts } = smoothMatches(g, 5, 5, 1);
    expect(counts.W).toBe(25);
    expect(counts.Y).toBeUndefined();
    expect(counts.Z).toBeUndefined();
  });

  it('handles a mismatched length defensively (no throw, returns copy)', () => {
    const g = ['A', 'A', 'B'];
    const { codes, counts } = smoothMatches(g, 4, 4, 2); // 3 !== 16
    expect(codes).toEqual(g);
    expect(counts).toEqual({ A: 2, B: 1 });
  });
});
