import { DRILL_VARIANTS, VariantMapping } from './variants';
import { toCents, fromCents, sumCents } from './money';

/**
 * Single canonical bag-size list. `defaultPacketCost` and the per-type price
 * tables below are keyed off these sizes so a tier can never be half-added
 * again (PRICE-01). 5000 is the explicit bulk fallback handled separately.
 */
export const BAG_SIZES = [200, 500, 1000, 2000] as const;

/**
 * A per-bag price is "unpriced" when the caller's priceDb has no finite value
 * for that size. An unpriced size is treated as Infinity by the cost search
 * (never a free $0 winner) and flags the color via hasUnpricedSize (PRICE-02).
 */
function isUnpriced(priceDb: Record<number, number>, size: number): boolean {
  const p = priceDb[size];
  return p == null || !Number.isFinite(p);
}

/**
 * Supply Bag Optimizer — the single per-color packing primitive shared by the
 * legend cost estimate and the Shopify cart, so the two can never diverge.
 *
 * Packing rules:
 * - Dye-lot separation: a color needing <= 800 drills is packed into 200-count
 *   bags only (never mixed with bulk sizes), preserving color consistency.
 * - Availability: a color is only ever packed into bag sizes that actually
 *   exist for it in `DRILL_VARIANTS[dmcCode][shape]`.
 * - Fewest bags within an overshoot cap (BAG-01, D-01): for bulk orders (> 800),
 *   pick the combination of the color's available bulk sizes that covers the
 *   required count in the FEWEST bags, but REJECT a fewer-bags plan that wastes
 *   more than one smallest available bulk bag's capacity (the LOCKED overshoot
 *   cap). Cost (in integer cents) is only a bounded tiebreak, never the objective.
 *   200s are never mixed into a bulk order.
 *
 * `checkout.ts::compileShopifyCartLink` calls this with the same `priceDb`, so
 * the Shopify cart and the legend estimate always pack identically.
 *
 * Pure module: no Preact, no DOM, no persistence. Never throws in the render
 * path — an unknown/unavailable color yields an empty pack.
 */

export type Shape = 'square' | 'round';

/** Result of packing ONE color's required count into concrete bags. */
export interface ColorPack {
  bySize: Record<number, number>; // e.g. { 200: 2, 1000: 1 } — only sizes that exist for this color
  totalDrills: number; // sum(size * qty)
  packets: number; // sum of quantities
  // PRICE-02: true when the color can ONLY be covered by an unpriced bag size,
  // so no priced plan exists. Such a color is surfaced (never emitted as a
  // self-selected $0 line); its bySize is left empty rather than priced at $0.
  hasUnpricedSize: boolean;
  unpricedSizes: number[]; // the offending unpriced sizes (ascending), [] when priced
}

const DYE_LOT_CEILING = 800;

/**
 * Pack a single color, honoring the <= 800 dye-lot rule AND the bag sizes
 * actually available for this DMC code + shape. Returns an empty pack for an
 * unknown code or a color with no available sizes (never throws).
 */
export function packColor(
  dmcCode: string,
  shape: Shape,
  requiredCount: number,
  priceDb: Record<number, number>
): ColorPack {
  const empty: ColorPack = {
    bySize: {},
    totalDrills: 0,
    packets: 0,
    hasUnpricedSize: false,
    unpricedSizes: [],
  };
  const mapping = DRILL_VARIANTS[dmcCode]?.[shape];
  if (!mapping || Object.keys(mapping).length === 0 || requiredCount <= 0) {
    return empty;
  }

  const availableSizes = Object.keys(mapping)
    .map(Number)
    .filter(size => mapping[size as keyof VariantMapping] !== undefined);

  const pack200 = (count: number): ColorPack => {
    // The 200 size itself may be unpriced — flag it and emit no $0 line.
    if (isUnpriced(priceDb, 200)) {
      return { bySize: {}, totalDrills: 0, packets: 0, hasUnpricedSize: true, unpricedSizes: [200] };
    }
    const qty = Math.ceil(count / 200);
    return {
      bySize: { 200: qty },
      totalDrills: qty * 200,
      packets: qty,
      hasUnpricedSize: false,
      unpricedSizes: [],
    };
  };

  // Dye-lot rule: <= 800 drills stay on a single 200-count size (color consistency).
  if (requiredCount <= DYE_LOT_CEILING && availableSizes.includes(200)) {
    return pack200(requiredCount);
  }

  // Bulk order: never mix 200s in — cost-minimize over the available bulk sizes.
  const bulkSizes = availableSizes.filter(s => s > 200);
  if (bulkSizes.length === 0) {
    return availableSizes.includes(200) ? pack200(requiredCount) : empty;
  }

  return minCostBulk(requiredCount, bulkSizes, priceDb);
}

/**
 * Fewest-bags-within-the-overshoot-cap combination of the given bulk sizes that
 * covers >= requiredCount (BAG-01, D-01). Bounded search (D-02, unchanged):
 * iterate counts of every size except the smallest; the smallest ceil-fills the
 * remainder, so the whole solution space is covered with only a few hundred
 * evaluations even for large counts.
 *
 * Selection (changed from cost-min): among the enumerated covering plans, keep
 * only those whose wasted drills (coveredDrills − requiredCount) are at most one
 * smallest available bulk bag's capacity — the LOCKED overshoot cap — then pick a
 * winner by a TOTAL, deterministic order (D-03): fewest packets, then lowest cost
 * cents (reconciled through money.ts, never a raw float threshold), then fewer
 * total drills, then largest-size-first. The all-smallest ceil-fill plan always
 * satisfies the cap (its overshoot < the smallest bulk bag), so an acceptable
 * plan always exists; the cost-min plan is retained only as a guaranteed fallback
 * for the (unreachable in practice) case where the cap rejects everything.
 */
function minCostBulk(
  requiredCount: number,
  bulkSizes: number[],
  priceDb: Record<number, number>
): ColorPack {
  const unpricedSizes = bulkSizes.filter(s => isUnpriced(priceDb, s)).sort((a, b) => a - b);
  // Exclude unpriced sizes from the candidate set so a priced plan is always
  // preferred when one exists — a missing price becomes Infinity (see priceOf),
  // never a free $0 winner in the search (PRICE-02, threat T-15-03).
  const pricedSizes = bulkSizes.filter(s => !isUnpriced(priceDb, s));

  if (pricedSizes.length === 0) {
    // The color's only bulk sizes are unpriced — no priced plan can cover it.
    // Flag it and emit NO bags, so it never reaches a quote as a $0 line.
    return { bySize: {}, totalDrills: 0, packets: 0, hasUnpricedSize: true, unpricedSizes };
  }

  const sizesDesc = [...pricedSizes].sort((a, b) => b - a);
  const smallest = sizesDesc[sizesDesc.length - 1]; // smallest available bulk bag
  const larger = sizesDesc.slice(0, -1); // sizes above the smallest, largest first
  // Missing price => Infinity (was `?? 0`): pricedSizes are all finite here, so
  // toCents never sees a non-finite value, but the guard keeps intent explicit.
  const priceOf = (size: number) => priceDb[size] ?? Infinity;
  // Per-bag cost in integer cents (money.ts): the cap/tiebreak reconciles through
  // integer cents so a tampered priceDb can't make the comparator pick a NaN/$0
  // plan (threat T-16-02); toCents throws on a non-finite price.
  const centsOf = (size: number) => toCents(priceOf(size));

  // The LOCKED overshoot cap: a fewer-bags plan may waste at most one smallest
  // available bulk bag's worth of drills.
  const overshootCap = smallest;

  interface Candidate {
    counts: number[]; // aligned to sizesDesc (largest-first)
    covered: number;
    overshoot: number;
    packets: number;
    cents: number;
  }

  // Strict total order (D-03): fewest packets -> lowest cost cents -> fewer total
  // drills -> largest-size-first (more of the larger sizes). Never depends on
  // Object key order or float wobble, so packColor is a pure deterministic fn.
  const isBetter = (a: Candidate, b: Candidate): boolean => {
    if (a.packets !== b.packets) return a.packets < b.packets;
    if (a.cents !== b.cents) return a.cents < b.cents;
    if (a.covered !== b.covered) return a.covered < b.covered; // fewer total drills
    for (let i = 0; i < a.counts.length; i++) {
      if (a.counts[i] !== b.counts[i]) return a.counts[i] > b.counts[i]; // largest-size-first
    }
    return false;
  };

  let bestAcceptable: Candidate | null = null; // best plan within the overshoot cap
  let costMin: Candidate | null = null; // guaranteed cheapest covering fallback
  const counts = new Array(larger.length).fill(0);

  const consider = (fullCounts: number[]): void => {
    let covered = 0;
    let packets = 0;
    const lineCents: number[] = [];
    sizesDesc.forEach((size, i) => {
      const qty = fullCounts[i];
      if (qty > 0) {
        covered += size * qty;
        packets += qty;
        lineCents.push(centsOf(size) * qty);
      }
    });
    const cand: Candidate = {
      counts: fullCounts,
      covered,
      overshoot: covered - requiredCount,
      packets,
      cents: sumCents(lineCents),
    };
    // Fallback tracker: lowest cost cents, ties broken by the same total order.
    if (
      costMin === null ||
      cand.cents < costMin.cents ||
      (cand.cents === costMin.cents && isBetter(cand, costMin))
    ) {
      costMin = cand;
    }
    // Overshoot-cap-acceptable set: fewer-bags plans that waste too much are
    // rejected here, so the wasteful (fewer-bags, higher-overshoot) plan can
    // never win even when it is cheaper.
    if (cand.overshoot <= overshootCap && (bestAcceptable === null || isBetter(cand, bestAcceptable))) {
      bestAcceptable = cand;
    }
  };

  // Bounded enumeration preserved verbatim (D-02): counts of every larger size,
  // smallest ceil-fills the remainder. Only the leaf action changed (was: track
  // the single cheapest total; now: evaluate against the cap + total order).
  const search = (idx: number, covered: number): void => {
    if (idx === larger.length) {
      const remaining = Math.max(0, requiredCount - covered);
      const nSmall = Math.ceil(remaining / smallest);
      consider([...counts, nSmall]);
      return;
    }
    const size = larger[idx];
    const maxN = Math.ceil(requiredCount / size);
    for (let n = 0; n <= maxN; n++) {
      counts[idx] = n;
      search(idx + 1, covered + n * size);
    }
    counts[idx] = 0;
  };
  search(0, 0);

  // Prefer the cap-acceptable winner; fall back to the cost-min plan only if the
  // cap somehow rejected everything (the all-smallest plan makes this unreachable).
  const chosen: Candidate = bestAcceptable ?? costMin!;

  const bySize: Record<number, number> = {};
  let totalDrills = 0;
  let packets = 0;
  sizesDesc.forEach((size, i) => {
    const qty = chosen.counts[i];
    if (qty > 0) {
      bySize[size] = qty;
      totalDrills += size * qty;
      packets += qty;
    }
  });
  // A priced plan was found (bounded search preserved, not greedy): the best
  // plan contains only priced sizes, so the color is not flagged.
  return { bySize, totalDrills, packets, hasUnpricedSize: false, unpricedSizes: [] };
}

/**
 * Apply a +10% safety margin to the required count, then round up to the
 * smallest bag size actually available for the color. Per-color rounding is why
 * this needs the color args (a bare count cannot know the smallest size).
 */
export function withSafetyMargin(dmcCode: string, shape: Shape, requiredCount: number): number {
  const safety = Math.ceil(Math.round(requiredCount * 110) / 100);
  const mapping = DRILL_VARIANTS[dmcCode]?.[shape];
  if (!mapping) return safety;

  const availableSizes = Object.keys(mapping)
    .map(Number)
    .filter(size => mapping[size as keyof VariantMapping] !== undefined);
  if (availableSizes.length === 0) return safety;

  const smallest = Math.min(...availableSizes);
  return Math.ceil(safety / smallest) * smallest;
}

/**
 * Price a packed color using the per-bag price table (size -> unit price),
 * computing in integer cents via money.ts so line items reconcile exactly to
 * the displayed total (PRICE-03). An unpriced size is NOT silently added as $0
 * (the old `priceDb[size] || 0` bug): packs that could only be covered by an
 * unpriced size carry an empty bySize (see minCostBulk/pack200), so a real
 * billable bag is never priced at $0 here.
 */
export function priceColorPack(pack: ColorPack, priceDb: Record<number, number>): number {
  const lineCents: number[] = [];
  for (const [size, qty] of Object.entries(pack.bySize)) {
    const unit = priceDb[Number(size)];
    // Skip an unpriced size rather than treating it as free — such packs are
    // already flagged (hasUnpricedSize) and surfaced, never billed at $0.
    if (unit == null || !Number.isFinite(unit)) continue;
    lineCents.push(toCents(unit) * qty);
  }
  return fromCents(sumCents(lineCents));
}

/** One legend row: exact + safety packs, both priced, plus display text. */
export interface ColorSupplyRow {
  exact: ColorPack;
  safety: ColorPack;
  costExact: number;
  costSafety: number;
  bagsText: string;
  // PRICE-02: OR of the exact + safety packs — true when this color can only be
  // covered by an unpriced size, so it must be surfaced, never shown at $0.
  hasUnpricedSize: boolean;
  unpricedSizes: number[];
}

/**
 * Plan supplies for a single color: pack the exact count and the safety count,
 * price both, and format the safety pack as "1×2000, 1×500" (largest first).
 */
export function planColorSupply(
  dmcCode: string,
  shape: Shape,
  count: number,
  priceDb: Record<number, number>
): ColorSupplyRow {
  const exact = packColor(dmcCode, shape, count, priceDb);
  const safety = packColor(dmcCode, shape, withSafetyMargin(dmcCode, shape, count), priceDb);

  const parts = Object.keys(safety.bySize)
    .map(Number)
    .sort((a, b) => b - a)
    .map(size => `${safety.bySize[size]}×${size}`);
  const bagsText = parts.length > 0 ? parts.join(', ') : 'None';

  return {
    exact,
    safety,
    costExact: priceColorPack(exact, priceDb),
    costSafety: priceColorPack(safety, priceDb),
    bagsText,
    hasUnpricedSize: exact.hasUnpricedSize || safety.hasUnpricedSize,
    unpricedSizes: Array.from(
      new Set([...exact.unpricedSizes, ...safety.unpricedSizes])
    ).sort((a, b) => a - b),
  };
}

export type DrillType = 'standard' | 'ab' | 'glow' | 'crystal';

/**
 * Canonical per-type / per-size price table, keyed by the single BAG_SIZES list
 * so no tier can be half-added again (PRICE-01). The 500 tier is set strictly
 * between each type's 200 and 1000 tier — the fix for a 500 bag previously
 * falling through to the 5000 bulk tier.
 */
const PACKET_PRICES: Record<DrillType, Record<(typeof BAG_SIZES)[number], number>> = {
  standard: { 200: 0.25, 500: 0.55, 1000: 0.8, 2000: 1.4 },
  ab: { 200: 0.35, 500: 0.7, 1000: 1.1, 2000: 1.9 },
  glow: { 200: 0.45, 500: 0.9, 1000: 1.4, 2000: 2.4 },
  crystal: { 200: 0.5, 500: 1.0, 1000: 1.6, 2000: 2.7 },
};

/** Per-type 5000-count bulk fallback (any size not in BAG_SIZES). */
const BULK_5000_PRICE: Record<DrillType, number> = {
  standard: 3.0,
  ab: 4.0,
  glow: 5.0,
  crystal: 6.0,
};

/**
 * Default per-packet price by drill type and bag size. Resolves from the single
 * canonical PACKET_PRICES table (keyed by BAG_SIZES); any size outside that list
 * (e.g. 5000) uses the explicit bulk fallback. Seed values for the editable
 * price table — moved from `App.tsx::getDefaultPacketCost`.
 */
export function defaultPacketCost(type: DrillType, bagSize: number): number {
  const tierPrice = PACKET_PRICES[type][bagSize as (typeof BAG_SIZES)[number]];
  return tierPrice !== undefined ? tierPrice : BULK_5000_PRICE[type];
}
