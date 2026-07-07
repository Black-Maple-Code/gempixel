import { describe, it, expect, vi } from 'vitest';
import { optimizeBags, compileShopifyCartLink, compileCanvasPartnerUrl } from '../checkout';

describe('Checkout and Sizing Integration', () => {
  describe('Dye Lot Bag Optimizer', () => {
    it('forces 200 bags exclusively for counts <= 800', () => {
      const result = optimizeBags(550);
      expect(result.qty200).toBe(3); // 3 * 200 = 600
      expect(result.qty500).toBe(0);
      expect(result.qty1000).toBe(0);
      expect(result.qty2000).toBe(0);
    });

    it('combines bulk sizes and avoids 200 bags for counts > 800', () => {
      const result = optimizeBags(1250);
      expect(result.qty200).toBe(0); // Dye lot rule avoids 200 count
      expect(result.qty1000).toBe(1); // 1000 + 500 = 1500
      expect(result.qty500).toBe(1);
      expect(result.qty2000).toBe(0);
    });

    it('supports higher thresholds using 2000-count bags', () => {
      const result = optimizeBags(2700);
      expect(result.qty2000).toBe(1);
      expect(result.qty1000).toBe(1);
      expect(result.qty500).toBe(0);
      expect(result.qty200).toBe(0);
    });
  });

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
});
