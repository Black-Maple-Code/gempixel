import { describe, it, expect } from 'vitest';
import { buildOrderQuote, TAX_RATE_ESTIMATE } from '../quote';
import { sumCents, toCents } from '../money';
import {
  VENDOR_REGISTRY,
  DRILLS_BASE_SHIPPING,
  RATES_AS_OF,
  type CanvasVendor,
} from '../checkout';
import type { OrderSupplyPlan } from '../bagPlanner';

/**
 * Minimal inline OrderSupplyPlan fixture — only `optimizedCostCents` is read by
 * buildOrderQuote (D-06: consumed, never re-packed). Every other required field is
 * zero/empty just to satisfy the frozen OrderSupplyPlan type.
 */
function makePlan(optimizedCostCents: number): OrderSupplyPlan {
  return {
    rows: [],
    totalPackets: 0,
    totalDrills: 0,
    optimizedCostCents,
    naiveCostCents: 0,
    savingsCents: 0,
    savingsPct: 0,
    hasUnpricedSize: false,
    unpricedColorCodes: [],
  };
}

const VENDORS: CanvasVendor[] = ['lumaprints', 'finerworks'];

describe('buildOrderQuote (QUOTE-02/03)', () => {
  it('LINE-SUM EQUALITY (QUOTE-02): totalCents === sumCents(lineItems) across fixtures', () => {
    const drillsFixtures = [0, 1234, 98765];
    const canvasFixtures: Array<number | null> = [12.0, 28.5, 0, null];
    for (const optimizedCostCents of drillsFixtures) {
      for (const vendor of VENDORS) {
        for (const canvasBaseCost of canvasFixtures) {
          const quote = buildOrderQuote({
            supplyPlan: makePlan(optimizedCostCents),
            canvasBaseCost,
            vendor,
          });
          expect(quote.totalCents).toBe(
            sumCents(quote.lineItems.map((li) => li.cents))
          );
          // Every line is an integer number of cents (no float leak).
          for (const li of quote.lineItems) {
            expect(Number.isInteger(li.cents)).toBe(true);
          }
        }
      }
    }
  });

  it('TAX (D-07): tax line is 0 cents, labeled "calculated at vendor checkout"; TAX_RATE_ESTIMATE === 0', () => {
    expect(TAX_RATE_ESTIMATE).toBe(0);
    const quote = buildOrderQuote({
      supplyPlan: makePlan(5000),
      canvasBaseCost: 20,
      vendor: 'lumaprints',
    });
    const tax = quote.lineItems.find((li) => li.key === 'tax')!;
    expect(tax.cents).toBe(0);
    expect(tax.label).toBe('Tax');
    expect(tax.note).toBe('calculated at vendor checkout');
    expect(tax.estimate).toBe(true);
  });

  it('COMBINED SHIPPING (D-08): one "Shipping (est.)" line = vendor baseShipping + DRILLS_BASE_SHIPPING, with RATES_AS_OF note', () => {
    for (const vendor of VENDORS) {
      const quote = buildOrderQuote({
        supplyPlan: makePlan(1234),
        canvasBaseCost: 12,
        vendor,
      });
      const shipping = quote.lineItems.find((li) => li.key === 'shipping')!;
      const expectedCents = toCents(
        VENDOR_REGISTRY[vendor].baseShipping + DRILLS_BASE_SHIPPING
      );
      expect(shipping.cents).toBe(expectedCents);
      expect(shipping.label).toBe('Shipping (est.)');
      expect(shipping.estimate).toBe(true);
      expect(shipping.note).toContain(RATES_AS_OF);
    }
    // Concrete values: lumaprints 4.99+5.00=9.99 → 999; finerworks 5.50+5.00=10.50 → 1050.
    expect(
      buildOrderQuote({
        supplyPlan: makePlan(0),
        canvasBaseCost: 0,
        vendor: 'lumaprints',
      }).lineItems.find((li) => li.key === 'shipping')!.cents
    ).toBe(999);
    expect(
      buildOrderQuote({
        supplyPlan: makePlan(0),
        canvasBaseCost: 0,
        vendor: 'finerworks',
      }).lineItems.find((li) => li.key === 'shipping')!.cents
    ).toBe(1050);
  });

  it('NULL / NON-FINITE CANVAS (Pitfall 4): canvasPriced false, 0-cent canvas line, no throw, total still consistent', () => {
    for (const badCanvas of [null, Infinity, -Infinity, NaN] as Array<
      number | null
    >) {
      let quote!: ReturnType<typeof buildOrderQuote>;
      expect(() => {
        quote = buildOrderQuote({
          supplyPlan: makePlan(1234),
          canvasBaseCost: badCanvas,
          vendor: 'lumaprints',
        });
      }).not.toThrow();
      expect(quote.canvasPriced).toBe(false);
      const canvas = quote.lineItems.find((li) => li.key === 'canvas')!;
      expect(canvas.cents).toBe(0);
      expect(quote.totalCents).toBe(
        sumCents(quote.lineItems.map((li) => li.cents))
      );
    }
  });

  it('CANVAS PRICED: finite canvasBaseCost → canvasPriced true, canvas cents === toCents(cost), RATES_AS_OF note', () => {
    const quote = buildOrderQuote({
      supplyPlan: makePlan(1234),
      canvasBaseCost: 28.5,
      vendor: 'finerworks',
    });
    expect(quote.canvasPriced).toBe(true);
    const canvas = quote.lineItems.find((li) => li.key === 'canvas')!;
    expect(canvas.cents).toBe(toCents(28.5));
    expect(canvas.note).toContain(RATES_AS_OF);
    expect(quote.ratesAsOf).toBe(RATES_AS_OF);
  });

  it('DRILLS PASS-THROUGH (D-06): drills line cents === supplyPlan.optimizedCostCents', () => {
    const quote = buildOrderQuote({
      supplyPlan: makePlan(4242),
      canvasBaseCost: 12,
      vendor: 'lumaprints',
    });
    const drills = quote.lineItems.find((li) => li.key === 'drills')!;
    expect(drills.cents).toBe(4242);
    expect(drills.estimate).toBe(false);
  });

  it('INTEGER-CENTS BOUNDARY: a .005 canvas cost rounds half-up via toCents (no float leak)', () => {
    // 12.005 * 100 = 1200.4999… in IEEE-754; toCents absorbs the error and rounds
    // half-up to 1201 — proving integer cents only, no float in totalCents.
    const quote = buildOrderQuote({
      supplyPlan: makePlan(0),
      canvasBaseCost: 12.005,
      vendor: 'lumaprints',
    });
    const canvas = quote.lineItems.find((li) => li.key === 'canvas')!;
    expect(canvas.cents).toBe(1201);
    expect(canvas.cents).toBe(toCents(12.005));
    expect(quote.totalCents).toBe(
      sumCents(quote.lineItems.map((li) => li.cents))
    );
    expect(Number.isInteger(quote.totalCents)).toBe(true);
  });
});
