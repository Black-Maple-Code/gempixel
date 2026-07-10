import { DRILL_VARIANTS, VariantMapping } from './variants';

export interface OptimizedBags {
  qty200: number;
  qty500: number;
  qty1000: number;
  qty2000: number;
}

export interface CartItemInput {
  dmcCode: string;
  shape: 'square' | 'round';
  requiredCount: number;
}

export interface CompilerResult {
  url: string;
  unmappedItems: Array<{ dmcCode: string; handle: string }>;
  isUrlTooLong: boolean;
}

export interface CanvasRedirectOptions {
  baseUrlTemplate: string; // e.g. "https://example.com/custom?w={width}&h={height}&shape={shape}"
  widthCm: number;
  heightCm: number;
  shape: 'square' | 'round';
}

/**
 * Optimizes bag selection to avoid mixing 200-count bags with bulk sizes.
 * Implements Phase 5 Dye Lot Separation rules:
 * - If total is <= 800 drills, purchase exclusively 200-count bags.
 * - If total is > 800 drills, combine bulk sizes (500, 1000, 2000) and avoid 200-count.
 */
export function optimizeBags(count: number): OptimizedBags {
  const result: OptimizedBags = { qty200: 0, qty500: 0, qty1000: 0, qty2000: 0 };

  if (count <= 0) return result;

  // Dye lot separation rule: <= 800 drills, only use 200 bags
  if (count <= 800) {
    result.qty200 = Math.ceil(count / 200);
    return result;
  }

  // Bulk packaging math (combines 500, 1000, 2000)
  result.qty2000 = Math.floor(count / 2000);
  const remainder = count % 2000;

  if (remainder > 0) {
    if (remainder <= 500) {
      result.qty500 = 1;
    } else if (remainder <= 1000) {
      result.qty1000 = 1;
    } else if (remainder <= 1500) {
      result.qty1000 = 1;
      result.qty500 = 1;
    } else {
      result.qty2000 += 1;
    }
  }

  return result;
}

/**
 * Compiles an optimized cart permalink for Diamond Drills USA.
 * Persists affiliate referrers via query parameters and Shopify cart attributes.
 */
export function compileShopifyCartLink(
  items: CartItemInput[],
  affiliateTag: string,
  affiliateApp: 'ref' | 'rfsn' | 'none' = 'ref'
): CompilerResult {
  const baseUrl = 'https://diamonddrillsusa.com/cart/';
  const unmappedItems: Array<{ dmcCode: string; handle: string }> = [];
  const cartTokens: string[] = [];

  for (const item of items) {
    const mapping = DRILL_VARIANTS[item.dmcCode]?.[item.shape];

    if (!mapping || Object.keys(mapping).length === 0) {
      const handle = `dmc-${item.dmcCode}-${item.shape}-5d-diamond-painting-drills`;
      unmappedItems.push({ dmcCode: item.dmcCode, handle });
      continue;
    }

    // Determine available sizes sorted descending
    const availableSizes = Object.keys(mapping)
      .map(Number)
      .filter(size => mapping[size as keyof VariantMapping] !== undefined)
      .sort((a, b) => b - a);

    let remaining = item.requiredCount;
    const resolvedTokens: Array<{ variantId: number; qty: number }> = [];

    // If total <= 800 and 200 size is available, use it directly (separating dye lots)
    if (remaining <= 800 && availableSizes.includes(200)) {
      const variantId = mapping[200]!;
      resolvedTokens.push({ variantId, qty: Math.ceil(remaining / 200) });
      remaining = 0;
    } else {
      // Greedily pack with bulk sizes first
      for (const size of availableSizes) {
        if (size === 200) continue;
        const variantId = mapping[size as keyof VariantMapping]!;
        const qty = Math.floor(remaining / size);
        if (qty > 0) {
          resolvedTokens.push({ variantId, qty });
          remaining = remaining % size;
        }
      }

      // Handle remainder using smallest bulk size or 200 pack
      if (remaining > 0) {
        const bulkSizes = availableSizes.filter(s => s > 200).sort((a, b) => a - b);
        if (bulkSizes.length > 0) {
          const fitSize = bulkSizes.find(s => s >= remaining) || bulkSizes[bulkSizes.length - 1];
          const variantId = mapping[fitSize as keyof VariantMapping]!;
          const existing = resolvedTokens.find(t => t.variantId === variantId);
          if (existing) {
            existing.qty += 1;
          } else {
            resolvedTokens.push({ variantId, qty: 1 });
          }
        } else if (availableSizes.includes(200)) {
          const variantId = mapping[200]!;
          const qty = Math.ceil(remaining / 200);
          const existing = resolvedTokens.find(t => t.variantId === variantId);
          if (existing) {
            existing.qty += qty;
          } else {
            resolvedTokens.push({ variantId, qty });
          }
        } else {
          // No available size can cover it, report as unmapped
          const handle = `dmc-${item.dmcCode}-${item.shape}-5d-diamond-painting-drills`;
          unmappedItems.push({ dmcCode: item.dmcCode, handle });
        }
      }
    }

    // Add resolved tokens to cart
    for (const token of resolvedTokens) {
      cartTokens.push(`${token.variantId}:${token.qty}`);
    }
  }

  const params = new URLSearchParams();
  if (affiliateTag && affiliateApp !== 'none') {
    params.set(affiliateApp, affiliateTag);
    params.set(`attributes[ref_tag]`, affiliateTag);
  }
  params.set('return_to', '/checkout');

  const queryStr = params.toString() ? `?${params.toString()}` : '';
  const finalUrl = `${baseUrl}${cartTokens.join(',')}${queryStr}`;

  return {
    url: finalUrl,
    unmappedItems,
    isUrlTooLong: finalUrl.length > 2000
  };
}

/**
 * Generates a sizing URL redirect link by replacing template variables.
 */
export function compileCanvasPartnerUrl(options: CanvasRedirectOptions): string {
  const { baseUrlTemplate, widthCm, heightCm, shape } = options;
  const sizeStr = `${widthCm}x${heightCm}`;

  const compiled = baseUrlTemplate
    .replace(/{width}/g, encodeURIComponent(widthCm.toString()))
    .replace(/{height}/g, encodeURIComponent(heightCm.toString()))
    .replace(/{shape}/g, encodeURIComponent(shape))
    .replace(/{size}/g, encodeURIComponent(sizeStr));

  try {
    new URL(compiled);
  } catch (e) {
    console.error('Invalid compiled canvas partner URL:', compiled);
  }

  return compiled;
}

export interface PricingPoint {
  areaSqIn: number;
  price: number;
}

export interface VendorConfig {
  name: string;
  baseShipping: number;
  sqInchRate: number;
  pricingPoints: PricingPoint[];
  /** Direct "door" to the provider's rolled-canvas order / image-upload page. */
  uploadUrl: string;
}

export const VENDOR_REGISTRY: Record<'lumaprints' | 'prodigi' | 'finerworks', VendorConfig> = {
  lumaprints: {
    name: 'Lumaprints',
    baseShipping: 4.99,
    sqInchRate: 0.035,
    uploadUrl: 'https://lumaprints.com/product/rolled-canvas/',
    pricingPoints: [
      { areaSqIn: 192, price: 6.50 },  // 12x16
      { areaSqIn: 320, price: 8.50 },  // 16x20
      { areaSqIn: 560, price: 12.00 }, // 20x28
      { areaSqIn: 2400, price: 28.00 } // 40x60
    ]
  },
  prodigi: {
    name: 'Prodigi',
    baseShipping: 5.00,
    sqInchRate: 0.048,
    uploadUrl: 'https://www.prodigi.com/products/canvas/rolled-canvas/',
    pricingPoints: [
      { areaSqIn: 192, price: 9.00 },
      { areaSqIn: 320, price: 11.50 },
      { areaSqIn: 560, price: 16.00 },
      { areaSqIn: 2400, price: 35.00 }
    ]
  },
  finerworks: {
    name: 'FinerWorks',
    baseShipping: 5.50,
    sqInchRate: 0.058,
    uploadUrl: 'https://www.finerworks.com/canvasprints.aspx',
    pricingPoints: [
      { areaSqIn: 192, price: 11.00 },
      { areaSqIn: 320, price: 14.00 },
      { areaSqIn: 560, price: 19.50 },
      { areaSqIn: 2400, price: 42.00 }
    ]
  }
};

/**
 * Calculates canvas base cost using tier matching, linear interpolation, or custom sq inch rates.
 * [VERIFIED: Matches all core mathematical specifications defined in Phase 8 rules]
 */
export function calculateCanvasCost(
  width: number,
  height: number,
  unit: 'grid' | 'cm' | 'inch',
  vendorKey: 'lumaprints' | 'prodigi' | 'finerworks'
): number {
  const config = VENDOR_REGISTRY[vendorKey];
  if (!config) return 0.0;

  // 1. Convert inputs to inches
  let widthIn = width;
  let heightIn = height;
  if (unit === 'grid') {
    widthIn = width / 10;
    heightIn = height / 10;
  } else if (unit === 'cm') {
    widthIn = width / 2.54;
    heightIn = height / 2.54;
  }

  const area = widthIn * heightIn;
  const points = config.pricingPoints;

  // 2. Exact tier match lookup
  const exactMatch = points.find(p => Math.abs(p.areaSqIn - area) < 0.05);
  if (exactMatch) {
    return exactMatch.price;
  }

  // 3. Fallback to custom rate if area lies outside tier bounds
  if (area < points[0].areaSqIn || area > points[points.length - 1].areaSqIn) {
    return Math.round(area * config.sqInchRate * 100) / 100;
  }

  // 4. Perform Linear Interpolation between adjacent points
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (area >= p1.areaSqIn && area <= p2.areaSqIn) {
      const scaleFraction = (area - p1.areaSqIn) / (p2.areaSqIn - p1.areaSqIn);
      const interpolatedVal = p1.price + scaleFraction * (p2.price - p1.price);
      return Math.round(interpolatedVal * 100) / 100;
    }
  }

  return Math.round(area * config.sqInchRate * 100) / 100;
}
