import { describe, it, expect, vi } from 'vitest';
import { compileShopifyCartLink, compileCanvasPartnerUrl, calculateCanvasCost, normalizeVendor } from '../checkout';
import { packColor } from '../bagPlanner';
import { DRILL_VARIANTS, VariantMapping } from '../variants';

// The dye-lot aggregate `optimizeBags(count)` was removed in the Candidate 1
// consolidation (unused in production). Its dye-lot rule is now covered per-color
// by `bagPlanner.test.ts` and end-to-end by the Shopify compiler tests below.

describe('Checkout and Sizing Integration', () => {
  describe('Shopify Permalink Compiler', () => {
    it('correctly compiles variant:qty pairs and includes attributes and referrers', () => {
      const items = [
        { dmcCode: '310', shape: 'square' as const, requiredCount: 150 } // fits in <= 800 (uses 200 bag)
      ];

      const result = compileShopifyCartLink(items, 'tag123', 'ref');
      expect(result.url).toContain('diamonddrillsusa.com/cart/');
      expect(result.url).toContain('29699641213010:1'); // 310 square 200 variant ID
      expect(result.url).toContain('ref=tag123');
      expect(result.url).toContain('attributes%5Bref_tag%5D=tag123');
      expect(result.isUrlTooLong).toBe(false);
    });

    it('collects unmapped variant fallback identifiers', () => {
      const items = [
        { dmcCode: '9999', shape: 'round' as const, requiredCount: 100 } // Unmapped DMC code
      ];

      const result = compileShopifyCartLink(items, '', 'none');
      expect(result.unmappedItems.length).toBe(1);
      expect(result.unmappedItems[0].dmcCode).toBe('9999');
      expect(result.unmappedItems[0].handle).toContain('dmc-9999-round');
    });

    it('gracefully falls back to 200 bags if bulk size variant IDs are missing', () => {
      const items = [
        { dmcCode: '367', shape: 'square' as const, requiredCount: 1200 } // > 800 (normally bulk)
      ];

      const result = compileShopifyCartLink(items, '', 'none');
      expect(result.unmappedItems.length).toBe(0);
      expect(result.url).toContain('29699663593554:6');
    });

    it('packs a bulk count into descending-size tokens (characterization)', () => {
      // "150" square has { 200, 500, 1000, 2000 }. 2100 -> 1x2000 + 1x500,
      // emitted largest-first. Pins cart output across the packColor refactor.
      const items = [
        { dmcCode: '150', shape: 'square' as const, requiredCount: 2100 }
      ];

      const result = compileShopifyCartLink(items, '', 'none');
      expect(result.unmappedItems.length).toBe(0);
      expect(result.url).toContain('29699704848466:1,29699704782930:1'); // 2000 then 500
    });
  });

  describe('packColor == cart no-divergence (D-03, BAG-01 overshoot cap)', () => {
    it('the cart emits exactly the bags packColor produces, including the 1050 overshoot-cap case', () => {
      // Shared primitive contract: compileShopifyCartLink and the legend both call
      // packColor with the same priceDb, so under the new fewest-bags comparator
      // they can never diverge on a tie. 1050 exercises the overshoot cap directly.
      const STD: Record<number, number> = { 200: 0.25, 500: 0.55, 1000: 0.8, 2000: 1.4 };
      const fixture = [
        { dmcCode: '150', shape: 'square' as const, requiredCount: 1050 }, // cap -> 1×1000+1×500
        { dmcCode: '150', shape: 'square' as const, requiredCount: 2100 }, // 1×2000+1×500
        { dmcCode: '150', shape: 'round' as const, requiredCount: 3000 },  // 200-only color
        { dmcCode: '310', shape: 'square' as const, requiredCount: 150 },  // dye-lot 200s
      ];

      // Cart side: parse variantId -> total qty out of the compiled cart URL.
      const cart = compileShopifyCartLink(fixture, '', 'none', STD);
      const cartTokens: Record<string, number> = {};
      const tokenStr = cart.url.split('/cart/')[1].split('?')[0];
      for (const tok of tokenStr.split(',')) {
        if (!tok) continue;
        const [id, qty] = tok.split(':');
        cartTokens[id] = (cartTokens[id] || 0) + Number(qty);
      }

      // Estimate side: map packColor's bags (size -> qty) to the same variant IDs.
      const packTokens: Record<string, number> = {};
      for (const item of fixture) {
        const pack = packColor(item.dmcCode, item.shape, item.requiredCount, STD);
        const mapping = DRILL_VARIANTS[item.dmcCode][item.shape];
        for (const [size, qty] of Object.entries(pack.bySize)) {
          const id = String(mapping[Number(size) as keyof VariantMapping]);
          packTokens[id] = (packTokens[id] || 0) + qty;
        }
      }

      expect(packTokens).toEqual(cartTokens);
    });
  });

  describe('Canvas Partner URL Compiler', () => {
    it('replaces all bracket tokens correctly', () => {
      const template = 'https://partner.com/custom?w={width}&h={height}&sh={shape}&sz={size}';
      const url = compileCanvasPartnerUrl({
        baseUrlTemplate: template,
        widthCm: 40,
        heightCm: 50,
        shape: 'square'
      });
      expect(url).toBe('https://partner.com/custom?w=40&h=50&sh=square&sz=40x50');
    });

    it('handles percent-encoding of substituted values correctly', () => {
      const template = 'https://partner.com/custom?shape={shape}';
      const url = compileCanvasPartnerUrl({
        baseUrlTemplate: template,
        widthCm: 40,
        heightCm: 50,
        shape: 'round/drill' as any
      });
      expect(url).toBe('https://partner.com/custom?shape=round%2Fdrill');
    });

    it('safely logs an error and returns compiled string for invalid URLs', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const template = 'not-a-valid-url?w={width}&h={height}&shape={shape}';
      const url = compileCanvasPartnerUrl({
        baseUrlTemplate: template,
        widthCm: 10,
        heightCm: 20,
        shape: 'round'
      });
      
      expect(url).toBe('not-a-valid-url?w=10&h=20&shape=round');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid compiled canvas partner URL:',
        'not-a-valid-url?w=10&h=20&shape=round'
      );
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Canvas Cost Calculator', () => {
    it('returns exact tier prices when dimensions match exactly (using inches)', () => {
      // 12x16 inches = 192 sq in
      expect(calculateCanvasCost(12, 16, 'inch', 'lumaprints')).toBe(15.00);
      // 16x20 inches = 320 sq in
      expect(calculateCanvasCost(16, 20, 'inch', 'lumaprints')).toBe(21.00);
      // 20x28 inches = 560 sq in
      expect(calculateCanvasCost(20, 28, 'inch', 'lumaprints')).toBe(33.00);
      // 40x60 inches = 2400 sq in
      expect(calculateCanvasCost(40, 60, 'inch', 'lumaprints')).toBe(80.00);
    });

    it('handles exact matches for other vendors', () => {
      // 12x16 inches = 192 sq in
      expect(calculateCanvasCost(12, 16, 'inch', 'finerworks')).toBe(22.00);
    });

    it('interpolates prices linearly between tiers', () => {
      // Area = 16x16 = 256 sq in
      // For Lumaprints: between 192 ($15.00) and 320 ($21.00)
      // (256 - 192) / (320 - 192) = 64 / 128 = 0.5
      // 15.00 + 0.5 * (21.00 - 15.00) = 18.00
      expect(calculateCanvasCost(16, 16, 'inch', 'lumaprints')).toBe(18.00);

      // Area = 18x24 = 432 sq in
      // For FinerWorks: between 320 ($30.00) and 560 ($46.00)
      // Fraction = (432 - 320) / (560 - 320) = 112 / 240 = 0.46667
      // Price = 30.00 + 0.46667 * (46.00 - 30.00) = 30.00 + 7.4667 = 37.47
      expect(calculateCanvasCost(18, 24, 'inch', 'finerworks')).toBe(37.47);
    });

    it('clamps small canvases up to the vendor minimum-price floor', () => {
      // Area = 10x10 = 100 sq in (below the 192 tier). The raw per-sq-in fallback
      // would be under market, so the result is clamped up to the vendor minimum.
      // Lumaprints: 100 * 0.10 = 10.00 → clamped to minPrice 14.00
      expect(calculateCanvasCost(10, 10, 'inch', 'lumaprints')).toBe(14.00);
      // FinerWorks: 100 * 0.15 = 15.00 → clamped to minPrice 19.00
      expect(calculateCanvasCost(10, 10, 'inch', 'finerworks')).toBe(19.00);
    });

    it('falls back to custom square inch rate when area is above maximum tier', () => {
      // Area = 50x60 = 3000 sq in (above 2400)
      // For FinerWorks: 3000 * 0.15 = 450.00 (well above the minimum floor)
      expect(calculateCanvasCost(50, 60, 'inch', 'finerworks')).toBe(450.00);
    });

    it('performs unit conversions correctly', () => {
      // Grid unit: w = cols/10, h = rows/10
      // 120 x 160 grid = 12 x 16 inches = 192 sq in
      expect(calculateCanvasCost(120, 160, 'grid', 'lumaprints')).toBe(15.00);

      // Cm unit: w = cm/2.54, h = cm/2.54
      // 30.48 x 40.64 cm = 12 x 16 inches = 192 sq in
      expect(calculateCanvasCost(30.48, 40.64, 'cm', 'lumaprints')).toBe(15.00);
    });
  });

  describe('Unknown-vendor guard + normalizeVendor migration', () => {
    it('returns null (never 0) for a vendor outside the narrowed union', () => {
      // Guard: a removed/tampered vendor must NOT yield a free $0 canvas (T-15-01).
      expect(calculateCanvasCost(12, 16, 'inch', 'prodigi' as any)).toBe(null);
      expect(calculateCanvasCost(12, 16, 'inch', 'prodigi' as any)).not.toBe(0);
    });

    it('migrates legacy and tampered vendor values to lumaprints', () => {
      expect(normalizeVendor('prodigi')).toBe('lumaprints');
      expect(normalizeVendor('nonsense')).toBe('lumaprints');
      expect(normalizeVendor(undefined)).toBe('lumaprints');
    });

    it('passes valid vendors through unchanged', () => {
      expect(normalizeVendor('finerworks')).toBe('finerworks');
      expect(normalizeVendor('lumaprints')).toBe('lumaprints');
    });
  });
});
