import { DRILL_VARIANTS, VariantMapping } from './variants';

/**
 * Supply Bag Optimizer — the single per-color packing primitive shared by the
 * legend cost estimate and the Shopify cart, so the two can never diverge.
 *
 * Packing rules (mirrored from `checkout.ts::compileShopifyCartLink`):
 * - Dye-lot separation: a color needing <= 800 drills is packed into 200-count
 *   bags only (never mixed with bulk sizes), preserving color consistency.
 * - Availability: a color is only ever packed into bag sizes that actually
 *   exist for it in `DRILL_VARIANTS[dmcCode][shape]`.
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
export function packColor(dmcCode: string, shape: Shape, requiredCount: number): ColorPack {
  const empty: ColorPack = { bySize: {}, totalDrills: 0, packets: 0 };
  const mapping = DRILL_VARIANTS[dmcCode]?.[shape];
  if (!mapping || Object.keys(mapping).length === 0 || requiredCount <= 0) {
    return { bySize: {}, totalDrills: 0, packets: 0 };
  }

  // Sizes present for this color, largest first.
  const availableSizes = Object.keys(mapping)
    .map(Number)
    .filter(size => mapping[size as keyof VariantMapping] !== undefined)
    .sort((a, b) => b - a);

  const bySize: Record<number, number> = {};
  const add = (size: number, qty: number) => {
    if (qty <= 0) return;
    bySize[size] = (bySize[size] || 0) + qty;
  };

  let remaining = requiredCount;

  if (remaining <= DYE_LOT_CEILING && availableSizes.includes(200)) {
    // Dye-lot rule: keep small orders on a single 200-count size.
    add(200, Math.ceil(remaining / 200));
    remaining = 0;
  } else {
    // Greedily pack bulk sizes first (largest to smallest, skipping 200).
    for (const size of availableSizes) {
      if (size === 200) continue;
      const qty = Math.floor(remaining / size);
      if (qty > 0) {
        add(size, qty);
        remaining = remaining % size;
      }
    }

    // Cover any remainder with the smallest bulk size that fits, else 200-bags.
    if (remaining > 0) {
      const bulkSizes = availableSizes.filter(s => s > 200).sort((a, b) => a - b);
      if (bulkSizes.length > 0) {
        const fitSize = bulkSizes.find(s => s >= remaining) || bulkSizes[bulkSizes.length - 1];
        add(fitSize, 1);
      } else if (availableSizes.includes(200)) {
        add(200, Math.ceil(remaining / 200));
      } else {
        // No available size can cover it — leave it unpacked (caller still lists the color).
        return empty;
      }
    }
  }

  let totalDrills = 0;
  let packets = 0;
  for (const [size, qty] of Object.entries(bySize)) {
    totalDrills += Number(size) * qty;
    packets += qty;
  }

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
  const exact = packColor(dmcCode, shape, count);
  const safety = packColor(dmcCode, shape, withSafetyMargin(dmcCode, shape, count));

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
