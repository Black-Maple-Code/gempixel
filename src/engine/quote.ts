/**
 * Single integer-cents customer quote selector (QUOTE-02, QUOTE-03).
 *
 * `buildOrderQuote` composes drills + canvas + one combined shipping line + a $0
 * tax estimate into exactly one {@link OrderQuote} whose itemized line items always
 * sum EXACTLY to the total in integer cents — the `planOrderSupply` single-source
 * pattern (Phase 16) raised one level. Because `totalCents` IS `sumCents(lineItems)`,
 * Supplies "Est. total" and the Order total (both Phase 23 consumers) can never
 * diverge from the itemization.
 *
 * Pure engine module: no Preact, no DOM, no persistence. It consumes the already
 * reconciled `OrderSupplyPlan.optimizedCostCents` (does NOT re-pack drills — D-06)
 * and routes ALL money through `money.ts` (`toCents`/`sumCents`), so a bad/tampered
 * price fails loud rather than leaking a $0/NaN phantom into the total (Phase 15
 * lineage). A null/non-finite canvas cost is SURFACED via `canvasPriced`, never
 * silently thrown into `toCents` (which throws on non-finite) and never a silent
 * $0 line.
 *
 * ADDITIVE this phase: NOT wired into App.tsx — App keeps its current
 * `totalCostSafetyCents` assembly untouched until Phase 23 (SC5 strangler).
 */
import { toCents, sumCents } from './money';
import type { OrderSupplyPlan } from './bagPlanner';
import { type CanvasVendor, VENDOR_REGISTRY, DRILLS_BASE_SHIPPING, RATES_AS_OF } from './checkout';

/**
 * The single tax-rate knob (D-07). Held at 0: GemPixel is not the merchant of
 * record and the Order step is a no-real-payment order-packet download, so an
 * estimated tax figure would read as more finalized than reality. The tax line
 * still routes through `money.ts` (contributes 0 cents, so QUOTE-02 line-sum
 * equality holds) and carries a "calculated at vendor checkout" label. Flipping
 * to a live/estimated rate later is a one-line change here — the label attaches,
 * not a percentage.
 */
export const TAX_RATE_ESTIMATE = 0;

/** One itemized money line of an {@link OrderQuote}, in integer cents. */
export interface QuoteLineItem {
  key: 'drills' | 'canvas' | 'shipping' | 'tax';
  /** Display label, e.g. "Shipping (est.)", "Tax". */
  label: string;
  /** Integer cents (never a float). */
  cents: number;
  /** true → the UI shows an "est." affordance for this line. */
  estimate: boolean;
  /** Provenance/context note, e.g. `rates as of ${RATES_AS_OF}` or "calculated at vendor checkout". */
  note?: string;
}

/**
 * The single customer quote. `totalCents === sumCents(lineItems.map(li => li.cents))`
 * BY CONSTRUCTION, so the grand total can never disagree with the itemization.
 */
export interface OrderQuote {
  lineItems: QuoteLineItem[];
  /** `sumCents` of the line cents — equals the itemization by construction (QUOTE-02). */
  totalCents: number;
  /** `RATES_AS_OF` provenance for the curated rates (QUOTE-03). */
  ratesAsOf: string;
  /** false when `canvasBaseCost` was null/non-finite — a bad price is surfaced, never a silent $0 phantom. */
  canvasPriced: boolean;
}

/**
 * Compose one {@link OrderQuote} in integer cents from the reconciled drills plan,
 * the curated canvas base cost, and the vendor's curated shipping (D-06/07/08).
 *
 * @param input.supplyPlan  the already-packed drill plan — `optimizedCostCents` is
 *   consumed directly (NOT re-packed via packColor, D-06).
 * @param input.canvasBaseCost  from `calculateCanvasCost` (may be `null`/non-finite
 *   for a tampered/legacy vendor) — guarded to a 0-cent line + `canvasPriced=false`.
 * @param input.vendor  to read `VENDOR_REGISTRY[vendor].baseShipping`.
 */
export function buildOrderQuote(input: {
  supplyPlan: OrderSupplyPlan;
  canvasBaseCost: number | null;
  vendor: CanvasVendor;
}): OrderQuote {
  // Drills: consume the reconciled integer cents — never re-pack (D-06).
  const drillsCents = input.supplyPlan.optimizedCostCents;

  // Canvas: guard null/non-finite BEFORE toCents (which throws on non-finite).
  // A bad price is SURFACED via canvasPriced, never a silent $0 line (Pitfall 4).
  const canvasPriced =
    input.canvasBaseCost != null && Number.isFinite(input.canvasBaseCost);
  const canvasCents = canvasPriced ? toCents(input.canvasBaseCost as number) : 0;

  // Shipping: ONE combined line = canvas vendor baseShipping + curated flat drills
  // shipping, summed in dollars then to integer cents (D-08).
  const shippingCents = toCents(
    VENDOR_REGISTRY[input.vendor].baseShipping + DRILLS_BASE_SHIPPING
  );

  // Tax: routed through money.ts so QUOTE-02 line-sum equality holds; = 0 while
  // TAX_RATE_ESTIMATE = 0 (D-07). The single knob keeps a future live rate one line.
  const taxCents = toCents(
    ((drillsCents + canvasCents + shippingCents) / 100) * TAX_RATE_ESTIMATE
  );

  const lineItems: QuoteLineItem[] = [
    { key: 'drills', label: 'Drills', cents: drillsCents, estimate: false },
    {
      key: 'canvas',
      label: 'Canvas print',
      cents: canvasCents,
      estimate: true,
      note: `rates as of ${RATES_AS_OF}`,
    },
    {
      key: 'shipping',
      label: 'Shipping (est.)',
      cents: shippingCents,
      estimate: true,
      note: `rates as of ${RATES_AS_OF}`,
    },
    {
      key: 'tax',
      label: 'Tax',
      cents: taxCents,
      estimate: true,
      note: 'calculated at vendor checkout',
    },
  ];

  // totalCents IS the line-sum, so the grand total equals the itemization by
  // construction (QUOTE-02) — no downstream reconciliation is ever needed.
  return {
    lineItems,
    totalCents: sumCents(lineItems.map((li) => li.cents)),
    ratesAsOf: RATES_AS_OF,
    canvasPriced,
  };
}
