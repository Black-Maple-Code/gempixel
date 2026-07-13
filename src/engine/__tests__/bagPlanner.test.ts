import { describe, it, expect } from 'vitest';
import {
  packColor,
  withSafetyMargin,
  priceColorPack,
  planColorSupply,
  defaultPacketCost,
} from '../bagPlanner';
import { compileShopifyCartLink } from '../checkout';
import { DRILL_VARIANTS, VariantMapping } from '../variants';

// Fixtures grounded in real DRILL_VARIANTS entries:
//   "150" square -> { 200, 500, 1000, 2000 } (all sizes)
//   "150" round  -> { 200 }                  (only 200 available)
//   "99999"      -> absent from the catalog
const PRICE_DB: Record<number, number> = { 200: 2, 500: 4, 1000: 7, 2000: 12 };

describe('bagPlanner.packColor', () => {
  it('enforces the dye-lot rule: <= 800 drills packs into 200-bags only', () => {
    const pack = packColor('150', 'square', 800, PRICE_DB);
    expect(pack.bySize).toEqual({ 200: 4 });
    expect(pack.totalDrills).toBe(800);
    expect(pack.packets).toBe(4);
  });

  it('packs > 800 with bulk sizes (never all-200)', () => {
    const pack = packColor('150', 'square', 2100, PRICE_DB);
    // cost-min covering >=2100: 1×2000+1×500 ($16) beats 2×1000+1×500 ($18)
    expect(pack.bySize).toEqual({ 2000: 1, 500: 1 });
    expect(pack.totalDrills).toBe(2500);
    expect(pack.packets).toBe(2);
  });

  it('consolidates bulk bags instead of fragmenting (cost-min, not greedy)', () => {
    // The greedy packer produced 6×2000 + 1×1000 + 2×500 (9 bags) for this count;
    // cost-min buys 7×2000 (7 bags) — same 14000 drills, fewer bags, lower cost.
    const pack = packColor('150', 'square', 13533, PRICE_DB);
    expect(pack.bySize).toEqual({ 2000: 7 });
    expect(pack.packets).toBe(7);
  });

  it('never packs into a bag size the color lacks', () => {
    // "150" round only has the 200 size; a large count must stay in 200-bags,
    // never spilling into 500/1000/2000 which do not exist for this color.
    const pack = packColor('150', 'round', 3000, PRICE_DB);
    expect(Object.keys(pack.bySize)).toEqual(['200']);
    expect(pack.bySize[1000]).toBeUndefined();
    expect(pack.bySize[200]).toBe(15);
    expect(pack.totalDrills).toBe(3000);
  });

  it('returns an empty pack for an unknown DMC code and does not throw', () => {
    const pack = packColor('99999', 'square', 500, PRICE_DB);
    expect(pack).toEqual({
      bySize: {},
      totalDrills: 0,
      packets: 0,
      hasUnpricedSize: false,
      unpricedSizes: [],
    });
  });
});

describe('bagPlanner.packColor — BAG-01 fewest-bags within the overshoot cap (RED)', () => {
  it('rejects a cost-cheaper single-2000 plan whose overshoot exceeds one smallest bulk bag', () => {
    // 1050 drills, 2000 deliberately CHEAP so cost-min alone would buy 1×2000
    // ($1.00) over 1×1000+1×500 ($1.35). The LOCKED overshoot cap rejects the
    // single 2000 bag (wastes 950 drills > the 500 smallest bulk bag), so the
    // fewest-bags-within-cap objective falls to the 2-bag plan.
    const CHEAP_2000: Record<number, number> = { 200: 0.25, 500: 0.55, 1000: 0.8, 2000: 1.0 };
    const pack = packColor('150', 'square', 1050, CHEAP_2000);
    expect(pack.bySize).toEqual({ 1000: 1, 500: 1 });
    expect(pack.bySize[2000]).toBeUndefined(); // wasteful 1×2000 is NOT selected
  });
});

describe('bagPlanner.packColor — PRICE-02 (missing price is never $0-self-selected)', () => {
  // 2000 is deliberately absent from this table so it is unpriced (=> Infinity),
  // never a free winner in the cost search.
  const PRICE_DB_NO_2000: Record<number, number> = { 200: 2, 500: 4, 1000: 7 };

  it('never self-selects the unpriced 2000 size; covers with priced sizes only', () => {
    const pack = packColor('150', 'square', 2100, PRICE_DB_NO_2000);
    // With 2000 unpriced, the cheapest priced coverage of >=2100 is 2×1000 + 1×500.
    expect(pack.bySize).toEqual({ 1000: 2, 500: 1 });
    expect(pack.bySize[2000]).toBeUndefined(); // never present purely because unpriced
    expect(pack.totalDrills).toBe(2500);
    // A priced plan exists, so the color is NOT flagged unpriced and cost is finite.
    expect(pack.hasUnpricedSize).toBe(false);
    expect(Number.isFinite(priceColorPack(pack, PRICE_DB_NO_2000))).toBe(true);
    expect(priceColorPack(pack, PRICE_DB_NO_2000)).toBe(7 * 2 + 4); // 18
  });

  it('flags a color coverable ONLY by an unpriced size and never reports it at $0', () => {
    // "150" round has only the 200 size; with 200 unpriced there is no priced
    // plan, so the color is flagged and emits no self-selected $0 line.
    const PRICE_DB_NO_200: Record<number, number> = { 500: 4, 1000: 7, 2000: 12 };
    const pack = packColor('150', 'round', 300, PRICE_DB_NO_200);
    expect(pack.hasUnpricedSize).toBe(true);
    expect(pack.unpricedSizes).toContain(200);
    // Not a $0 billable line: no bags are emitted for the unpriced-only color.
    expect(pack.bySize).toEqual({});
    expect(priceColorPack(pack, PRICE_DB_NO_200)).toBe(0);
  });

  it('empty pack (unknown/zero-count color) is NOT flagged as unpriced', () => {
    const pack = packColor('150', 'square', 0, PRICE_DB);
    expect(pack.hasUnpricedSize).toBe(false);
    expect(pack.unpricedSizes).toEqual([]);
  });
});

describe('bagPlanner.withSafetyMargin', () => {
  it('adds +10% then rounds up to the smallest available bag size', () => {
    // 100 -> +10% = 110 -> round up to nearest 200 (smallest available) = 200
    expect(withSafetyMargin('150', 'square', 100)).toBe(200);
  });

  it('rounds up to the color-specific smallest size (round variant only has 200)', () => {
    // 640 -> +10% = 704 -> round up to nearest 200 = 800
    expect(withSafetyMargin('150', 'round', 640)).toBe(800);
  });
});

describe('bagPlanner.priceColorPack', () => {
  it('sums per-bag prices across the packed sizes', () => {
    const pack = packColor('150', 'square', 2100, PRICE_DB); // { 2000:1, 500:1 }
    expect(priceColorPack(pack, PRICE_DB)).toBe(12 + 4);
  });

  it('prices an empty pack as 0', () => {
    expect(
      priceColorPack(
        { bySize: {}, totalDrills: 0, packets: 0, hasUnpricedSize: false, unpricedSizes: [] },
        PRICE_DB
      )
    ).toBe(0);
  });
});

describe('bagPlanner.planColorSupply', () => {
  it('packs exact + safety and prices both', () => {
    const row = planColorSupply('150', 'square', 100, PRICE_DB);
    expect(row.exact.bySize).toEqual({ 200: 1 });
    expect(row.safety.bySize).toEqual({ 200: 1 });
    expect(row.costExact).toBe(2);
    expect(row.costSafety).toBe(2);
    expect(row.bagsText).toBe('1×200');
  });

  it('formats bagsText in descending size order', () => {
    const row = planColorSupply('150', 'square', 2100, PRICE_DB);
    // safety of 2100 rounds to 2400 -> { 2000:1, 500:1 }
    expect(row.bagsText).toBe('1×2000, 1×500');
  });
});

describe('estimate == cart (Candidate 1 regression)', () => {
  it('planColorSupply packs exactly the bags the Shopify cart builds', () => {
    const fixture = [
      { dmcCode: '150', shape: 'square' as const, requiredCount: 2100 },
      { dmcCode: '310', shape: 'square' as const, requiredCount: 150 },
      { dmcCode: '367', shape: 'square' as const, requiredCount: 1200 },
      { dmcCode: '150', shape: 'round' as const, requiredCount: 3000 },
    ];

    // Cart side: parse variantId -> total qty out of the compiled cart URL.
    const cart = compileShopifyCartLink(fixture, '', 'none', PRICE_DB);
    const cartTokens: Record<string, number> = {};
    const tokenStr = cart.url.split('/cart/')[1].split('?')[0];
    for (const tok of tokenStr.split(',')) {
      if (!tok) continue;
      const [id, qty] = tok.split(':');
      cartTokens[id] = (cartTokens[id] || 0) + Number(qty);
    }

    // Estimate side: map planColorSupply's exact pack (size -> qty) to variant IDs.
    const estTokens: Record<string, number> = {};
    for (const item of fixture) {
      const row = planColorSupply(item.dmcCode, item.shape, item.requiredCount, PRICE_DB);
      const mapping = DRILL_VARIANTS[item.dmcCode][item.shape];
      for (const [size, qty] of Object.entries(row.exact.bySize)) {
        const id = String(mapping[Number(size) as keyof VariantMapping]);
        estTokens[id] = (estTokens[id] || 0) + qty;
      }
    }

    expect(estTokens).toEqual(cartTokens);
  });
});

describe('bagPlanner.defaultPacketCost', () => {
  it('mirrors the per-type / per-size price table', () => {
    expect(defaultPacketCost('standard', 200)).toBe(0.25);
    expect(defaultPacketCost('crystal', 200)).toBe(0.5);
    expect(defaultPacketCost('ab', 1000)).toBe(1.1);
    expect(defaultPacketCost('glow', 2000)).toBe(2.4);
    expect(defaultPacketCost('standard', 5000)).toBe(3.0);
  });

  it('PRICE-01: the 500 tier is strictly between the 200 and 1000 tiers for every type', () => {
    const types = ['standard', 'ab', 'glow', 'crystal'] as const;
    for (const t of types) {
      expect(defaultPacketCost(t, 500)).toBeGreaterThan(defaultPacketCost(t, 200));
      expect(defaultPacketCost(t, 500)).toBeLessThan(defaultPacketCost(t, 1000));
    }
  });

  it('PRICE-01: a 500 bag is never priced at the 5000 bulk tier', () => {
    const types = ['standard', 'ab', 'glow', 'crystal'] as const;
    for (const t of types) {
      expect(defaultPacketCost(t, 500)).not.toBe(defaultPacketCost(t, 5000));
      expect(defaultPacketCost(t, 500)).toBeLessThan(defaultPacketCost(t, 5000));
    }
  });
});
