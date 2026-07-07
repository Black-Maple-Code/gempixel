import { describe, it, expect } from 'vitest';
import { calculateSafetyPurchase } from '../App';

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
});
