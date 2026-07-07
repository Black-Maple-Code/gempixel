import { describe, it, expect } from 'vitest';
import { calculateSafetyPurchase, optimizeBags } from '../App';

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

describe('Adaptive bulk bags optimization', () => {
  const prices = { 200: 0.60, 500: 1.10, 1000: 1.80, 2000: 3.20 };

  it('optimizes combinations correctly for exact quantity needs (e.g. 2446)', () => {
    const result = optimizeBags(2446, prices);
    // Cheapest option: 1 x 2000 ($3.20) + 1 x 500 ($1.10) = $4.30 (drills total: 2500)
    // Alternative: 2 x 1000 ($3.60) + 3 x 200 ($1.80) = $5.40 (drills total: 2600)
    expect(result.bags[2000]).toBe(1);
    expect(result.bags[1000]).toBe(0);
    expect(result.bags[500]).toBe(1);
    expect(result.bags[200]).toBe(0);
    expect(result.cost).toBe(4.30);
    expect(result.totalDrills).toBe(2500);
  });

  it('optimizes combinations for small values correctly (e.g. 350)', () => {
    const result = optimizeBags(350, prices);
    // Cheapest option: 2 x 200 ($1.20) or 1 x 500 ($1.10)?
    // 1 x 500 is $1.10, which is cheaper!
    expect(result.bags[2000]).toBe(0);
    expect(result.bags[1000]).toBe(0);
    expect(result.bags[500]).toBe(1);
    expect(result.bags[200]).toBe(0);
    expect(result.cost).toBe(1.10);
    expect(result.totalDrills).toBe(500);
  });
});
