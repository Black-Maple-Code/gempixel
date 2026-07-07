# Phase 5 Research: Supply Partnerships & Checkout Integration

## User Constraints

The following implementation decisions are copied verbatim from [05-CONTEXT.md](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/.planning/phases/05-supply-partnerships-checkout-integration/05-CONTEXT.md) `[CITED: 05-CONTEXT.md]`:

*   **D-01:** Transfer canvas sizing details to partner suppliers via direct URL query parameters. The supplier URL opens pre-filled with the active canvas dimensions (width/height, rows/cols) and shape selection.
*   **D-02:** Shopify Add-to-Cart redirects. Compile all required bag sizes and quantities into a single Shopify Add-to-Cart redirect link (e.g. `https://diamonddrillsusa.com/cart/{variant_id}:{qty},...`) with an optional affiliate parameter.
*   **D-03:** Store affiliate referral parameters as a customizable config option or settings input, allowing developers to test cart compilation in sandbox mode before live referral links are deployed.
*   **D-04:** Place Canvas Ordering and Drill Cart checkout options within a dedicated action card inside the Quote tab (beside the artist profit and supplies cost calculations).

---

## Standard Stack

We prescribe using browser-native capabilities to handle URL manipulation and HTTP communication. Avoid adding third-party routing or URL libraries to keep the bundle footprint light `[CITED: STACK.md]`:

1.  **URL & URLSearchParams APIs**: Use native browser `URL` and `URLSearchParams` to assemble redirect links. This handles proper character escaping and sanitization out of the box, preventing encoding errors in complex query parameter strings `[VERIFIED: MDN Web Docs - URLSearchParams API]`.
2.  **Native Fetch API**: For checking dynamic inventory or product statuses (if dynamic endpoints are implemented later), utilize browser-native `window.fetch` instead of Axios or similar libraries to keep the compile size down `[VERIFIED: STACK.md]`.
3.  **Preact Hooks (`useState`, `useMemo`, `useCallback`)**: Manage state dynamically (e.g., config settings, active affiliate tag, generated cart link state) using core React/Preact hooks.
4.  **Local Storage API**: Use native `window.localStorage` to persist user-configured settings (e.g., affiliate referral code, preferred custom canvas supplier base URL) between sessions `[CITED: REQUIREMENTS.md - ARTIST-01]`.

---

## Architecture Patterns

### 1. Lookup Table Structure
To map DMC color codes and physical shapes (square vs. round) to Diamond Drills USA's Shopify variants, we utilize a statically compiled dictionary. 
*   **Handle Pattern**: Diamond Drills USA hosts distinct product pages for each DMC color and drill shape combination. The handle follows the pattern: `/products/dmc-{dmc_code}-{shape}-5d-diamond-painting-drills` `[VERIFIED: diamonddrillsusa.com product catalog structure]`.
*   **Variant ID Generation**: Shopify generates internal 64-bit database IDs for product variants. These do not follow a predictable mathematical pattern across different products, making a static mapping table necessary `[VERIFIED: Shopify API Documentation - Variant IDs]`.
*   **Optimization**: Because loading 400+ JSONs at runtime in the browser would hit CORS errors and rate limits, we bundle a static mapping structure `[VERIFIED: Same-Origin Policy CORS restrictions on Shopify JSON endpoints]`.

The lookup table is structured as a nested TypeScript record:
```typescript
interface VariantMapping {
  200?: number;
  500?: number;
  1000?: number;
  2000?: number;
}

type VariantLookup = Record<string, Record<"square" | "round", VariantMapping>>;
```
Key lookup format: `VariantLookup[dmcCode][drillShape][bagSize]`.

### 2. Cart Packaging Optimization
Diamond Drills USA enforces a dye lot policy: 200-count bags are sourced from a different manufacturer than bulk bags (500, 1000, 2000) and might not match in shade `[CITED: diamonddrillsusa.com product details]`.
*   **Dye Lot Separation Rules**:
    *   If the total required drills (plus safety margin) is $\le 800$, purchase exclusively 200-count bags.
    *   If the total required drills is $> 800$, combine bulk sizes (500, 1000, 2000) to satisfy the quantity while strictly avoiding 200-count bags.
*   **Optimization Algorithm**:
    1.  Input: `requiredCount` (exact count + safety margin).
    2.  If `requiredCount` $\le 800$:
        *   `qty200` = `Math.ceil(requiredCount / 200)`
    3.  If `requiredCount` $> 800$:
        *   `qty2000` = `Math.floor(requiredCount / 2000)`
        *   `remainder` = `requiredCount % 2000`
        *   Distribute the remainder into combinations of 500 and 1000:
            *   `0 < remainder <= 500`: Add one 500 bag.
            *   `500 < remainder <= 1000`: Add one 1000 bag.
            *   `1000 < remainder <= 1500`: Add one 1000 and one 500 bag.
            *   `1500 < remainder < 2000`: Add another 2000 bag.

### 3. Templated URL Generation for Custom Canvases
Since custom canvas suppliers use diverse URL parameter structures (e.g., `?w=40&h=50` or `?size=40x50&shape=square`), we adopt a **Templated URL approach** `[ASSUMED: No standard query format exists across different canvas manufacturers]`.
*   The developer/user configures a URL template, such as:
    `https://example-supplier.com/products/custom?width={width}&height={height}&shape={shape}`
*   The application parses this template, dynamically replacing `{width}`, `{height}`, `{shape}`, and `{size}` (e.g., `40x50`) on the fly. This abstracts partner-specific configurations away from core code.

---

## Don't Hand-Roll

1.  **Don't build custom URL parsing regex**: Do not write custom string replacement functions for handling query parameters. Always load parameters into `URLSearchParams` to ensure valid escaping.
2.  **Don't implement custom Shopify cart syncing**: Avoid trying to use the Shopify Ajax API (`/cart/add.js`) directly via client-side fetch from the GemPixel domain. It will fail due to CORS. Instead, rely entirely on the native **Cart Permalink Redirect Link** structure `[VERIFIED: Shopify Ajax API is bound by CORS to the local store domain]`.
3.  **Don't write custom CSV / parser databases**: Use typed JSON structures for the static lookup table.

---

## Common Pitfalls

1.  **Shopify URL Length Limits**:
    *   *Issue*: Modern browsers and servers (including Shopify's Nginx ingress) enforce URL length limits (typically 2048 characters) `[VERIFIED: RFC 2616 - HTTP/1.1 URL length guidelines]`.
    *   *Impact*: If a canvas requires 45 different colors, a single permalink adding 45+ variant/quantity pairs (`/cart/id:qty,id:qty...`) could exceed the length limit, causing the redirect to fail with an HTTP 414 URI Too Long error.
    *   *Prevention*: The compiler must check URL lengths. If the generated link exceeds 2000 characters, it should display a warning and split the items into multiple links (e.g. "Cart 1 (Colors 1-20)" and "Cart 2 (Colors 21-40)") or fall back to providing direct links to individual products.
2.  **Variant ID Desynchronization**:
    *   *Issue*: Shopify variant IDs are database entries. If Diamond Drills USA deletes and rebuilds their product catalog, all static variant IDs will break, leading to empty or error carts during checkout.
    *   *Prevention*: Provide a prominent fallback UI link. If a variant ID is missing from our table, fallback to the product page handle (`/products/dmc-{code}-{shape}-5d-diamond-painting-drills`) or a direct search fallback (`/search?q=dmc+{code}+{shape}`) so the user can still order the items manually `[ASSUMED: Fallbacks are crucial to prevent complete integration failure during external catalog updates]`.
3.  **Affiliate Cookie Expiry & Attribution Loss**:
    *   *Issue*: Standard URL parameters (like `?ref=id` or `?rfsn=id`) set cookies on the store's domain. If the user clears cookies or shifts from mobile (where they generated the plan) to desktop (where they buy), attribution is lost.
    *   *Prevention*: Educate users in the UI that they should complete the checkout on the same device. Also, add the affiliate ID as a native Shopify cart attribute (e.g., `?attributes[ref_tag]={tag}`) to persist it in the order JSON on Shopify's database, bypassing cookie-only reliance where supported.

---

## Code Examples

### 1. Types & Static Lookup Configuration

```typescript
export interface VariantMapping {
  200?: number;
  500?: number;
  1000?: number;
  2000?: number;
}

export type VariantLookup = Record<string, Record<"square" | "round", VariantMapping>>;

// Sample lookup dictionary
export const DRILL_VARIANTS: VariantLookup = {
  "150": {
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
  "310": {
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
};
```

### 2. Bag Count Optimizer (Dye Lot Separation Rules)

```typescript
export interface OptimizedBags {
  qty200: number;
  qty500: number;
  qty1000: number;
  qty2000: number;
}

/**
 * Optimizes bag selection to avoid mixing 200-count bags with bulk sizes.
 * @param count - Total required drill count (exact count + safety margin)
 */
export function optimizeBags(count: number): OptimizedBags {
  const result: OptimizedBags = { qty200: 0, qty500: 0, qty1000: 0, qty2000: 0 };

  if (count <= 0) return result;

  // Dye lot separation rule: if <= 800 drills, only use 200 bags
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
```

### 3. Shopify Add-To-Cart Link Compiler

```typescript
export interface CartItemInput {
  dmcCode: string;
  shape: "square" | "round";
  requiredCount: number;
}

export interface CompilerResult {
  url: string;
  unmappedItems: Array<{ dmcCode: string; handle: string }>;
  isUrlTooLong: boolean;
}

/**
 * Compiles an optimized cart permalink for Diamond Drills USA.
 */
export function compileShopifyCartLink(
  items: CartItemInput[],
  affiliateTag: string,
  affiliateApp: "ref" | "rfsn" | "none" = "ref"
): CompilerResult {
  const baseUrl = "https://diamonddrillsusa.com/cart/";
  const unmappedItems: Array<{ dmcCode: string; handle: string }> = [];
  const cartTokens: string[] = [];

  for (const item of items) {
    const optimized = optimizeBags(item.requiredCount);
    const mapping = DRILL_VARIANTS[item.dmcCode]?.[item.shape];

    if (!mapping) {
      // Record unmapped colors so we can show link fallbacks to product pages
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
        // Fallback if that specific bag size is missing from static lookup
        const handle = `dmc-${item.dmcCode}-${item.shape}-5d-diamond-painting-drills`;
        unmappedItems.push({ dmcCode: item.dmcCode, handle });
      }
    }
  }

  // Construct query params using native URLSearchParams
  const params = new URLSearchParams();
  if (affiliateTag && affiliateApp !== "none") {
    // Set parameter depending on the active tracking engine
    params.set(affiliateApp, affiliateTag);
    // Persist as a Shopify cart attribute for order database storage
    params.set(`attributes[ref_tag]`, affiliateTag);
  }

  // Add checkout redirect parameter
  params.set("return_to", "/checkout");

  const queryStr = params.toString() ? `?${params.toString()}` : "";
  const finalUrl = `${baseUrl}${cartTokens.join(",")}${queryStr}`;

  return {
    url: finalUrl,
    unmappedItems,
    isUrlTooLong: finalUrl.length > 2000
  };
}
```

### 4. Custom Canvas Partner URL Compiler

```typescript
export interface CanvasRedirectOptions {
  baseUrlTemplate: string; // e.g. "https://example.com/custom?w={width}&h={height}&shape={shape}"
  widthCm: number;
  heightCm: number;
  shape: "square" | "round";
}

/**
 * Generates a sizing URL redirect link by replacing template variables.
 */
export function compileCanvasPartnerUrl(options: CanvasRedirectOptions): string {
  const { baseUrlTemplate, widthCm, heightCm, shape } = options;
  const sizeStr = `${widthCm}x${heightCm}`;

  let compiled = baseUrlTemplate
    .replace(/{width}/g, encodeURIComponent(widthCm.toString()))
    .replace(/{height}/g, encodeURIComponent(heightCm.toString()))
    .replace(/{shape}/g, encodeURIComponent(shape))
    .replace(/{size}/g, encodeURIComponent(sizeStr));

  // Validate output URL
  try {
    new URL(compiled);
  } catch (e) {
    console.error("Invalid compiled canvas partner URL:", compiled);
  }

  return compiled;
}
```
