import { describe, it, expect } from 'vitest';
import { resolveActiveCandidates } from '../candidates';
import { DMC_PALETTE } from '../palette';

describe('resolveActiveCandidates', () => {
  it("returns the full palette for kit 'all' with no exclusions", () => {
    const result = resolveActiveCandidates('all', new Set());
    expect(result).toHaveLength(DMC_PALETTE.length);
    expect(result).toEqual(DMC_PALETTE);
  });

  it("filters to the '100' kit subset", () => {
    const result = resolveActiveCandidates('100', new Set());
    const expected = DMC_PALETTE.filter(c => c.kits.includes('100'));
    expect(result.map(c => c.dmc)).toEqual(expected.map(c => c.dmc));
    expect(result.every(c => c.kits.includes('100'))).toBe(true);
    expect(result.length).toBeLessThan(DMC_PALETTE.length);
  });

  it("filters to the '200' kit subset", () => {
    const result = resolveActiveCandidates('200', new Set());
    const expected = DMC_PALETTE.filter(c => c.kits.includes('200'));
    expect(result.map(c => c.dmc)).toEqual(expected.map(c => c.dmc));
    expect(result.every(c => c.kits.includes('200'))).toBe(true);
  });

  it('removes excluded DMC codes (by dmc identity) and keeps the rest', () => {
    const excluded = new Set([DMC_PALETTE[0].dmc, DMC_PALETTE[1].dmc]);
    const result = resolveActiveCandidates('all', excluded);
    expect(result).toHaveLength(DMC_PALETTE.length - 2);
    expect(result.some(c => excluded.has(c.dmc))).toBe(false);
  });

  it('is identity over an empty exclusion set for a filtered kit', () => {
    const result = resolveActiveCandidates('100', new Set());
    expect(result).toEqual(DMC_PALETTE.filter(c => c.kits.includes('100')));
  });
});
