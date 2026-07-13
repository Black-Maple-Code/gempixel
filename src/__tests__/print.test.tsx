import { describe, it, expect } from 'vitest';
import { calculateSafetyPurchase, calculateFixedBagCost } from '../App';
import { packColor, priceColorPack } from '../engine/bagPlanner';

// Standard price table (bag size -> unit price) shared by the fixed-bag cases.
const priceDb = { 200: 0.25, 500: 0.55, 1000: 0.8, 2000: 1.4 };

describe('Safety margin calculations', () => {
  it('correctly rounds up counts to recommended standard 200 bags', () => {
    const result = calculateSafetyPurchase(350);
    expect(result.safety).toBe(385);
    expect(result.packets).toBe(2);
    expect(result.purchase).toBe(400);
  });

  it('handles boundary multiples correctly', () => {
    const result = calculateSafetyPurchase(181); // 181 * 1.1 = 199.1 -> 200 safety -> 1 packet -> 200 purchase
    expect(result.safety).toBe(200);
    expect(result.packets).toBe(1);
    expect(result.purchase).toBe(200);
  });

  it('supports custom bulk bag sizes in safety purchase calculations', () => {
    // 350 exact drills with 1000 bulk bag size
    const resultLarge = calculateSafetyPurchase(350, 1000);
    expect(resultLarge.safety).toBe(385);
    expect(resultLarge.packets).toBe(1);
    expect(resultLarge.purchase).toBe(1000);

    // 1500 exact drills with 1000 bulk bag size
    const resultTwoBags = calculateSafetyPurchase(1500, 1000);
    expect(resultTwoBags.safety).toBe(1650);
    expect(resultTwoBags.packets).toBe(2);
    expect(resultTwoBags.purchase).toBe(2000);
  });
});

describe('Fixed-bag cost is mapping-aware (WR-02)', () => {
  it('emits a $0 line for an unmapped-shape color (471 + square)', () => {
    // 471 has an empty `square: {}` mapping in variants.ts.
    const fixed = calculateFixedBagCost('471', 'square', 350, 200, 0.25);
    expect(fixed.costExact).toBe(0);
    expect(fixed.costSafety).toBe(0);
    expect(fixed.packets).toBe(0);
    expect(fixed.purchase).toBe(0);
    // +10% drill count is preserved (matches the optimized branch's Safety Margin column).
    expect(fixed.safety).toBe(385);
  });

  it('reconciles the estimate to the cart ($0) for the unmapped color', () => {
    // Compute the cart contribution exactly as checkout.ts does.
    const cartCost = priceColorPack(packColor('471', 'square', 350, priceDb), priceDb);
    expect(cartCost).toBe(0);
    // The cart drops the color entirely (no purchasable pack).
    expect(packColor('471', 'square', 350, priceDb).packets).toBe(0);
    // Estimate == cart: the divergence is closed.
    expect(calculateFixedBagCost('471', 'square', 350, 200, 0.25).costSafety).toBe(cartCost);
  });

  it('emits a $0 line for the second empty pair (798 + round)', () => {
    // 798 has an empty `round: {}` mapping in variants.ts.
    const fixed = calculateFixedBagCost('798', 'round', 350, 200, 0.25);
    expect(fixed.costSafety).toBe(0);
    expect(fixed.packets).toBe(0);
  });

  it('leaves a mapped color unchanged (310 + square regression guard)', () => {
    const fixed = calculateFixedBagCost('310', 'square', 350, 200, 0.25);
    expect(fixed.safety).toBe(385);
    expect(fixed.packets).toBe(2);
    expect(fixed.purchase).toBe(400);
    expect(fixed.costSafety).toBeCloseTo(0.5); // 2 * 0.25
    expect(fixed.costExact).toBeCloseTo(0.4375); // (350 / 200) * 0.25
  });
});

// The brute-force cost-minimizer `optimizeBags(target, prices)` was deleted in the
// Candidate 1 consolidation. Dye-lot-correct per-color packing is now covered by
// `src/engine/__tests__/bagPlanner.test.ts` (packColor / planColorSupply), and the
// estimate == cart property is asserted there against `compileShopifyCartLink`.
