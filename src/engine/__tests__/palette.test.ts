import { describe, it, expect } from 'vitest';
import { DMC_PALETTE } from '../palette';

describe('DMC Palette Database Integrity', () => {
  it('contains all unique colors without code duplication', () => {
    const codes = DMC_PALETTE.map(color => color.dmc);
    const uniqueCodes = new Set(codes);
    expect(codes.length).toBe(uniqueCodes.size);
  });

  it('filters for kit "100" and returns exactly 100 colors', () => {
    const kit100Colors = DMC_PALETTE.filter(color => color.kits.includes("100"));
    expect(kit100Colors.length).toBe(100);
  });

  it('filters for kit "200" and returns exactly 200 colors', () => {
    const kit200Colors = DMC_PALETTE.filter(color => color.kits.includes("200"));
    expect(kit200Colors.length).toBe(200);
  });

  it('contains overlapping colors with both kit memberships', () => {
    const overlapping = DMC_PALETTE.filter(
      color => color.kits.includes("100") && color.kits.includes("200")
    );
    // 50 colors were designed to overlap
    expect(overlapping.length).toBe(50);
  });

  it('verifies CIELAB coordinates for standard reference colors correspond to expected boundaries', () => {
    // Pure Black "310"
    const black = DMC_PALETTE.find(color => color.dmc === "310");
    expect(black).toBeDefined();
    expect(black!.lab.l).toBeCloseTo(0, 1);
    expect(black!.lab.a).toBeCloseTo(0, 1);
    expect(black!.lab.b).toBeCloseTo(0, 1);

    // Pure White "BLANC"
    const white = DMC_PALETTE.find(color => color.dmc === "BLANC");
    expect(white).toBeDefined();
    expect(white!.lab.l).toBeCloseTo(100, 1);
    expect(white!.lab.a).toBeCloseTo(0, 1);
    expect(white!.lab.b).toBeCloseTo(0, 1);
  });
});
