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
    const optimized = optimizeBags(item.requiredCount);
    const mapping = DRILL_VARIANTS[item.dmcCode]?.[item.shape];

    if (!mapping) {
      const handle = `dmc-${item.dmcCode}-${item.shape}-5d-diamond-painting-drills`;
      unmappedItems.push({ dmcCode: item.dmcCode, handle });
      continue;
    }

    const sizes: Array<keyof VariantMapping> = [200, 500, 1000, 2000];
    for (const size of sizes) {
      const qtyKey = `qty${size}` as keyof OptimizedBags;
      const qty = optimized[qtyKey];
      const variantId = mapping[size];

      if (qty > 0 && variantId) {
        cartTokens.push(`${variantId}:${qty}`);
      } else if (qty > 0 && !variantId) {
        // Fallback for missing bag size variants in static lookup
        const handle = `dmc-${item.dmcCode}-${item.shape}-5d-diamond-painting-drills`;
        unmappedItems.push({ dmcCode: item.dmcCode, handle });
      }
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
