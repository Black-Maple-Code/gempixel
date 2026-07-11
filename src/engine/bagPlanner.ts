import { DRILL_VARIANTS, VariantMapping } from './variants';

/**
 * Supply Bag Optimizer — the single per-color packing primitive shared by the
 * legend cost estimate and the Shopify cart, so the two can never diverge.
 *
 * Packing rules:
 * - Dye-lot separation: a color needing <= 800 drills is packed into 200-count
 *   bags only (never mixed with bulk sizes), preserving color consistency.
 * - Availability: a color is only ever packed into bag sizes that actually
 *   exist for it in `DRILL_VARIANTS[dmcCode][shape]`.
 * - Cost minimization: for bulk orders (> 800), pick the CHEAPEST combination of
 *   the color's available bulk sizes that covers the required count (never mixing
 *   200s in), using the caller's per-bag `priceDb`. This avoids fragmentation
 *   like `1×1000 + 2×500` where a single `1×2000` is fewer bags and cheaper.
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
  const empty: ColorPack = { bySize: {}, totalDrills: 0, packets: 0 };
  const mapping = DRILL_VARIANTS[dmcCode]?.[shape];
  if (!mapping || Object.keys(mapping).length === 0 || requiredCount <= 0) {
    return empty;
  }

  const availableSizes = Object.keys(mapping)
    .map(Number)
    .filter(size => mapping[size as keyof VariantMapping] !== undefined);

  const pack200 = (count: number): ColorPack => {
    const qty = Math.ceil(count / 200);
    return { bySize: { 200: qty }, totalDrills: qty * 200, packets: qty };
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
 * Cheapest combination of the given bulk sizes that covers >= requiredCount.
 * Bounded search: iterate counts of every size except the smallest; the smallest
 * ceil-fills the remainder, so the whole solution space is covered with only a
 * few hundred evaluations even for large counts.
 */
function minCostBulk(
  requiredCount: number,
  bulkSizes: number[],
  priceDb: Record<number, number>
): ColorPack {
  const sizesDesc = [...bulkSizes].sort((a, b) => b - a);
  const smallest = sizesDesc[sizesDesc.length - 1];
  const larger = sizesDesc.slice(0, -1); // sizes above the smallest, largest first
  const priceOf = (size: number) => priceDb[size] ?? 0;

  let bestCounts: number[] = [];
  let bestCost = Infinity;
  const counts = new Array(larger.length).fill(0);

  const search = (idx: number, covered: number, cost: number) => {
    if (idx === larger.length) {
      const remaining = Math.max(0, requiredCount - covered);
      const nSmall = Math.ceil(remaining / smallest);
      const total = cost + nSmall * priceOf(smallest);
      if (total < bestCost - 1e-9) {
        bestCost = total;
        bestCounts = [...counts, nSmall];
      }
      return;
    }
    const size = larger[idx];
    const maxN = Math.ceil(requiredCount / size);
    for (let n = 0; n <= maxN; n++) {
      counts[idx] = n;
      search(idx + 1, covered + n * size, cost + n * priceOf(size));
    }
    counts[idx] = 0;
  };
  search(0, 0, 0);

  const bySize: Record<number, number> = {};
  let totalDrills = 0;
  let packets = 0;
  sizesDesc.forEach((size, i) => {
    const qty = bestCounts[i];
    if (qty > 0) {
      bySize[size] = qty;
      totalDrills += size * qty;
      packets += qty;
    }
  });
  return { bySize, totalDrills, packets };
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

/** Price a packed color using the per-bag price table (size -> unit price). */
export function priceColorPack(pack: ColorPack, priceDb: Record<number, number>): number {
  let cost = 0;
  for (const [size, qty] of Object.entries(pack.bySize)) {
    cost += qty * (priceDb[Number(size)] || 0);
  }
  return Math.round(cost * 100) / 100;
}

/** One legend row: exact + safety packs, both priced, plus display text. */
export interface ColorSupplyRow {
  exact: ColorPack;
  safety: ColorPack;
  costExact: number;
  costSafety: number;
  bagsText: string;
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
  };
}

/**
 * Default per-packet price by drill type and bag size. Moved verbatim from
 * `App.tsx::getDefaultPacketCost` — the seed values for the editable price table.
 */
export function defaultPacketCost(
  type: 'standard' | 'ab' | 'glow' | 'crystal',
  bagSize: number
): number {
  if (bagSize === 200) {
    if (type === 'standard') return 0.25;
    if (type === 'ab') return 0.35;
    if (type === 'glow') return 0.45;
    return 0.5; // crystal
  }
  if (bagSize === 1000) {
    if (type === 'standard') return 0.8;
    if (type === 'ab') return 1.1;
    if (type === 'glow') return 1.4;
    return 1.6;
  }
  if (bagSize === 2000) {
    if (type === 'standard') return 1.4;
    if (type === 'ab') return 1.9;
    if (type === 'glow') return 2.4;
    return 2.7;
  }
  // 5000 drills bulk bag
  if (type === 'standard') return 3.0;
  if (type === 'ab') return 4.0;
  if (type === 'glow') return 5.0;
  return 6.0;
}
