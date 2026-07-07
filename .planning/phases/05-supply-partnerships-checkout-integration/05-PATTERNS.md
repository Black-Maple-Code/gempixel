# Phase 5: Supply Partnerships & Checkout Integration - Pattern Map

**Mapped:** 2026-07-07
**Files analyzed:** 4
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/engine/checkout.ts` | service / utility | transform | `src/engine/color.ts` | High |
| `src/engine/variants.ts` | config / data | input | `src/engine/palette.ts` | High |
| `src/App.tsx` | component | control | `src/App.tsx` (self) | High (Modified) |
| `src/engine/__tests__/checkout.test.ts` | test | transform | `src/engine/__tests__/color.test.ts` | High |

---

## Pattern Assignments

### `src/engine/checkout.ts` (service / utility, transform)

**Dye Lot Sizing & Bag Count Optimizer Pattern**:
Implements the dye lot separation rules where bags under 800 drills use strictly 200-count bags, and quantities above 800 combine bulk bags (500, 1000, 2000) while avoiding 200-count bags.

**Shopify Cart Permalink Compiler Pattern**:
Constructs a single checkout redirect permalink containing variants and quantities, checking URL length limits to warn if it exceeds 2000 characters, and tracking unmapped items for UI fallback links.

**Canvas Partner Redirect Parameter Compilation Pattern**:
Replaces templated tokens (`{width}`, `{height}`, `{shape}`, `{size}`) in a customizable base URL using browser-native URL sanitization.

```typescript
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
```

---

### `src/engine/variants.ts` (config / data, input)

**Shopify Variant Lookup Mapping Pattern**:
Stores static variants maps from DMC color codes and physical shapes (square vs. round) to Diamond Drills USA Shopify Variant database IDs.

```typescript
export interface VariantMapping {
  200?: number;
  500?: number;
  1000?: number;
  2000?: number;
}

export type VariantLookup = Record<string, Record<'square' | 'round', VariantMapping>>;

export const DRILL_VARIANTS: VariantLookup = {
  '150': {
    square: {
      200: 29774635827314,
      500: 29774635860082,
      1000: 29774635892850,
      2000: 29774635925618
    },
    round: {
      200: 29774635958386,
      500: 29774635991154,
      1000: 29774636023922,
      2000: 29774636056690
    }
  },
  '310': {
    square: {
      200: 29774636089458,
      500: 29774636122226,
      1000: 29774636154994,
      2000: 29774636187762
    },
    round: {
      200: 29774636220530,
      500: 29774636253298,
      1000: 29774636286066,
      2000: 29774636318834
    }
  }
  // Remaining DMC catalog mappings compiled statically...
};
```

---

### `src/App.tsx` (component, control)

**Quote Card Checkout & Sizing Configuration UI Pattern**:
Integrates canvas redirect links and Shopify add-to-cart checkouts directly into the `Quote` sidebar tab, alongside customizable affiliate configuration fields (saved in `localStorage`).

```typescript
// Add state hook settings at top of App component
const [affiliateTag, setAffiliateTag] = useState<string>(() => {
  return localStorage.getItem('gempixel_affiliate_tag') || '';
});
const [affiliateApp, setAffiliateApp] = useState<'ref' | 'rfsn' | 'none'>(() => {
  return (localStorage.getItem('gempixel_affiliate_app') as any) || 'ref';
});
const [canvasTemplate, setCanvasTemplate] = useState<string>(() => {
  return localStorage.getItem('gempixel_canvas_template') || 
         'https://www.heartfuldiamonds.com/products/custom-diamond-painting-kit?width={width}&height={height}&shape={shape}';
});

// Sync preferences to localStorage
useEffect(() => {
  localStorage.setItem('gempixel_affiliate_tag', affiliateTag);
}, [affiliateTag]);

useEffect(() => {
  localStorage.setItem('gempixel_affiliate_app', affiliateApp);
}, [affiliateApp]);

useEffect(() => {
  localStorage.setItem('gempixel_canvas_template', canvasTemplate);
}, [canvasTemplate]);

// inside Tab 'quote' rendering card (Quote Breakdown card):
/*
<div className="flex flex-col gap-2 border-t border-slate-800/80 pt-3 mt-3">
  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Partnerships & Ordering</span>
  
  <div className="flex flex-col gap-2 bg-slate-950/40 p-2.5 rounded-lg border border-slate-850/60">
    {/* Shopify Cart Integration */}
    <div className="flex flex-col gap-1">
      <button
        onClick={handleShopifyCheckout}
        disabled={!matchResult}
        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white py-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
      >
        <span>Order Drills from Diamond Drills USA</span>
      </button>
    </div>

    {/* Canvas integration */}
    <div className="flex flex-col gap-1">
      <button
        onClick={handleCanvasOrder}
        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
      >
        <span>Order Custom Sized Canvas</span>
      </button>
    </div>
    
    {/* Affiliate Configuration Modal Trigger or inline expander */}
    <details className="text-[11px] text-slate-400 mt-1 cursor-pointer">
      <summary className="font-semibold text-[10px] uppercase text-indigo-400 select-none">Affiliate & Partner Settings</summary>
      <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-slate-850">
        <div className="flex flex-col gap-1">
          <label className="text-[9px] uppercase tracking-wide text-slate-500">Affiliate Tag</label>
          <input
            type="text"
            value={affiliateTag}
            onChange={(e) => setAffiliateTag((e.target as HTMLInputElement).value)}
            placeholder="e.g. gempixel"
            className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[9px] uppercase tracking-wide text-slate-500">Tracking Engine</label>
          <select
            value={affiliateApp}
            onChange={(e) => setAffiliateApp((e.target as HTMLSelectElement).value as any)}
            className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
          >
            <option value="ref">Ref/Referral (ref=...)</option>
            <option value="rfsn">Refersion (rfsn=...)</option>
            <option value="none">None</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[9px] uppercase tracking-wide text-slate-500">Canvas Base URL Template</label>
          <input
            type="text"
            value={canvasTemplate}
            onChange={(e) => setCanvasTemplate((e.target as HTMLInputElement).value)}
            className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 font-mono"
          />
        </div>
      </div>
    </details>
  </div>
</div>
*/
```

---

### `src/engine/__tests__/checkout.test.ts` (test, transform)

**Checkout Integration Assertions Pattern**:
Tests the dye lot count optimizer boundaries, compiles Shopify redirection query and attribute strings correctly, and verifies that the canvas sizing template substitutions function properly under all standard settings.

```typescript
import { describe, it, expect } from 'vitest';
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
      expect(result.url).toContain('29774636089458:1'); // 310 square 200 variant ID
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
  });
});
```
