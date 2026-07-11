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
    expect(pack).toEqual({ bySize: {}, totalDrills: 0, packets: 0 });
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
    expect(priceColorPack({ bySize: {}, totalDrills: 0, packets: 0 }, PRICE_DB)).toBe(0);
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
});
