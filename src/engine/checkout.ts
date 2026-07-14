import { DRILL_VARIANTS, VariantMapping } from './variants';
import { packColor } from './bagPlanner';

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

// Standard per-bag prices; a fallback when the caller doesn't supply live prices.
// The app passes its own editable `priceDb` so the cart matches the legend estimate.
const DEFAULT_PRICE_DB: Record<number, number> = { 200: 0.6, 500: 1.1, 1000: 1.8, 2000: 3.2 };

/**
 * Compiles an optimized cart permalink for Diamond Drills USA.
 * Persists affiliate referrers via query parameters and Shopify cart attributes.
 * Packs each color via the shared `bagPlanner.packColor` using `priceDb`, so the
 * cart's bag choices match the legend estimate exactly.
 */
export function compileShopifyCartLink(
  items: CartItemInput[],
  affiliateTag: string,
  affiliateApp: 'ref' | 'rfsn' | 'none' = 'ref',
  priceDb: Record<number, number> = DEFAULT_PRICE_DB
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

    // Per-color packing via the shared bagPlanner primitive, so the cart and the
    // legend cost estimate can never diverge (dye-lot rule + variant availability).
    const pack = packColor(item.dmcCode, item.shape, item.requiredCount, priceDb);

    // Emit variant:qty tokens largest-size-first (preserves prior cart ordering).
    const sizes = Object.keys(pack.bySize)
      .map(Number)
      .sort((a, b) => b - a);
    for (const size of sizes) {
      const variantId = mapping[size as keyof VariantMapping]!;
      cartTokens.push(`${variantId}:${pack.bySize[size]}`);
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

/**
 * The narrowed set of supported canvas print vendors (VENDOR-02). A third vendor
 * was removed here; a removed vendor must not leave a $0 free-canvas hole. Keep
 * this union narrow (never widen to `string`) so `calculateCanvasCost` and the
 * vendor dropdown stay exhaustively type-checked.
 */
export type CanvasVendor = 'lumaprints' | 'finerworks';

export const VENDOR_REGISTRY: Record<CanvasVendor, VendorConfig> = {
  lumaprints: {
    name: 'Lumaprints',
    baseShipping: 4.99,
    sqInchRate: 0.035,
    uploadUrl: 'https://www.lumaprints.com/canvas-prints/',
    pricingPoints: [
      { areaSqIn: 192, price: 6.50 },  // 12x16
      { areaSqIn: 320, price: 8.50 },  // 16x20
      { areaSqIn: 560, price: 12.00 }, // 20x28
      { areaSqIn: 2400, price: 28.00 } // 40x60
    ]
  },
  finerworks: {
    name: 'FinerWorks',
    baseShipping: 5.50,
    sqInchRate: 0.058,
    uploadUrl: 'https://finerworks.com/createaprint/default.aspx',
    pricingPoints: [
      { areaSqIn: 192, price: 11.00 },
      { areaSqIn: 320, price: 14.00 },
      { areaSqIn: 560, price: 19.50 },
      { areaSqIn: 2400, price: 42.00 }
    ]
  }
};

/**
 * Curated flat drills-shipping estimate (dollars), summed with the canvas vendor's
 * {@link VendorConfig.baseShipping} into ONE combined "Shipping (est.)" line in
 * `quote.ts` (D-08). Diamond Drills USA genuinely charges $5 flat (free over $30),
 * so treating drills shipping as free would read more favorably than reality —
 * this honest $5 is the deliberate choice. Lives here beside {@link VENDOR_REGISTRY}
 * (the same curated cost layer); v5.0 live vendor rate APIs replace it.
 */
export const DRILLS_BASE_SHIPPING = 5.0;

/**
 * The "rates as of" provenance date (ISO `YYYY-MM-DD`) for the curated shipping +
 * canvas rates (QUOTE-03). Dated to the newer of the two curated shipping inputs.
 * Every estimate line in `quote.ts` carries a `rates as of ${RATES_AS_OF}` note so
 * no figure reads as a finalized charge. Flipping to live rates later (v5.0) is a
 * one-constant change here.
 */
export const RATES_AS_OF = '2026-07-14';

/**
 * Normalizes a persisted/restored/tampered vendor value to a valid {@link CanvasVendor}.
 * Returns `raw` when it is exactly `'lumaprints'` or `'finerworks'`; every other value
 * (a legacy removed-vendor key, `undefined`, or any tampered string) maps to
 * `'lumaprints'` (the first remaining vendor) — the locked removed-vendor migration
 * decision (VENDOR-02, threat T-15-02). Read-only and non-destructive: a corrupt
 * vendor can never corrupt the rest of a restored project.
 */
export function normalizeVendor(raw: unknown): CanvasVendor {
  return raw === 'lumaprints' || raw === 'finerworks' ? raw : 'lumaprints';
}

/**
 * Calculates canvas base cost using tier matching, linear interpolation, or custom sq inch rates.
 * Returns `null` (never `0.0`) for a vendor outside the narrowed union so a
 * tampered/legacy vendor can never yield a free $0 canvas (Pitfall 7, threat T-15-01).
 * [VERIFIED: Matches all core mathematical specifications defined in Phase 8 rules]
 */
export function calculateCanvasCost(
  width: number,
  height: number,
  unit: 'grid' | 'cm' | 'inch',
  vendorKey: CanvasVendor
): number | null {
  const config = VENDOR_REGISTRY[vendorKey];
  if (!config) return null;

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
