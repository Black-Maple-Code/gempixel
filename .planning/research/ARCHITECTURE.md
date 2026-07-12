# Architecture Research

**Domain:** Client-side (Preact) diamond-art planner — integrating a two-mode viewport wizard + fulfillment-ready order packet into a shipped v2.1 app
**Researched:** 2026-07-12
**Confidence:** HIGH (grounded in the actual v2.1 source: `App.tsx`, `engine/checkout.ts`, `engine/variants.ts`, `engine/bagPlanner.ts`, `engine/projectStore.ts`, `engine/export.ts`, `engine/types.ts`, `features/wizard/*`)

---

## Standard Architecture

### System Overview (as it exists today, v2.1)

```
┌──────────────────────────────────────────────────────────────────────┐
│  ORCHESTRATOR  — src/App.tsx  (2319 lines, ~40 useState/usePersistent) │
│  Owns: image, cols/rows, unit, drillStyle/Type, kit, excludedColors,   │
│  vendor, priceDb, canvas cost, affiliate, sortedMatches derivation,    │
│  handleShopifyCheckout, download handlers, ALL layout chrome.          │
│  Renders: left sidebar (My Images + wizard step body) · top progress   │
│  · <main> viewport + floating HUD · right legend aside · modals.       │
├───────────────┬───────────────────────────┬──────────────────────────┤
│  HOOKS        │  FEATURE COMPONENTS        │  PERSISTENCE             │
│  useWizard    │  wizard/steps/Step1..4     │  usePersistentState      │
│  useDiamond-  │  (pure presentational,     │  projectStore (CRUD +    │
│   ArtMatch    │   props-only; Step3 =      │   quota) · safeStorage   │
│  usePersist-  │   "Cost & Order",          │   (guarded localStorage) │
│   entState    │   Step4 = "Save")          │                          │
├───────────────┴───────────────────────────┴──────────────────────────┤
│  ENGINE  — src/engine/*  (PURE: no Preact, no DOM*, no persistence)    │
│  color · ingest · palette · candidates · smoothing · symbols          │
│  variants (drill-bag SKU table) · bagPlanner (packColor/planColorSupply│
│  /withSafetyMargin) · checkout (VENDOR_REGISTRY, cart link, canvas cost)│
│  export (canvas PNG — *DOM canvas only) · matcher.worker + worker-client│
└──────────────────────────────────────────────────────────────────────┘
```

**Key observation:** `App.tsx` is a *god component*. State lives there; `Step1..4` are thin, fully-controlled presentational children receiving ~25 props each. The engine is already cleanly pure and UI-agnostic — `bagPlanner.packColor` is the single packing primitive shared by both the legend estimate (`planColorSupply`, called in `App.tsx` `sortedMatches` line 914) and the cart (`checkout.compileShopifyCartLink` line 54). This shared-primitive pattern is the model for how the order packet should feed both modes.

### Component Responsibilities (today)

| Component | Owns | Relevance to v3.0 |
|-----------|------|-------------------|
| `App.tsx` | All app state + all chrome | The surface every UX rework touches; must be de-risked, not big-banged |
| `useWizard` | `step: 1..4`, `canEnter`, `next/back/goTo/reset` | The seam to extend for viewport-native steps + mode gating |
| `useDiamondArtMatch` | Worker lifecycle, `matchResult`, `symbolMap`, `restore` | Untouched by v3.0; pure match pipeline |
| `engine/bagPlanner` | `packColor`, `planColorSupply`, `withSafetyMargin`, `priceColorPack` | The gem-bag optimizer; already pure — extend here, not in UI |
| `engine/checkout` | `VENDOR_REGISTRY`, `calculateCanvasCost`, `compileShopifyCartLink` | Vendor removal + canvas-spec source |
| `engine/variants` | `DRILL_VARIANTS` SKU lookup (5107 lines) | Price/data integrity test target |
| `engine/projectStore` | `ProjectData` shape + localStorage CRUD | Model for the packet's serializable, versioned contract |

---

## Per-Feature Integration Analysis

Legend: **[NEW]** = new file/module · **[MOD]** = modify existing · **[MOVE]** = relocate logic out of `App.tsx`.

### Feature 3 — Remove Prodigi (smallest; do first as a warm-up)

**Integration points (verified):** the `prodigi` literal appears in exactly 4 files:
- `engine/checkout.ts` — `VENDOR_REGISTRY` key + entry (lines 119–143) and the `vendorKey` union on `calculateCanvasCost` (line 166).
- `App.tsx` — `useState<'lumaprints' | 'prodigi' | 'finerworks'>` (line 168) + `selectedVendor` usage.
- `features/wizard/steps/Step3Canvas.tsx` — the `selectedVendor` prop union (lines 25–26).
- `engine/__tests__/checkout.test.ts` — assertions.

**NEW vs MODIFIED:** all **[MOD]**. Delete the `prodigi` registry entry; narrow the union to `'lumaprints' | 'finerworks'` in checkout.ts, App.tsx, Step3Canvas.tsx (let `tsc --noEmit` surface every stray reference). Update the checkout test.
**Data-flow change:** none structural. **Guard:** `selectedVendor` can be restored as `'prodigi'` from a saved `ProjectData` — add a normalizing fallback on load (unknown vendor → `'lumaprints'`), mirroring the existing legacy-host remap in `customTemplateCodec` (App.tsx lines 32–36).

### Feature 4 — Price accuracy (500-bag cost, no $0 unpriced, variant integrity test)

**Integration points (verified):**
- `engine/bagPlanner.ts` — `priceColorPack` uses `priceDb[size] || 0` (line 153) and `minCostBulk`'s `priceOf = priceDb[size] ?? 0` (line 89). A **missing/zero price silently yields $0** — the "$0 unpriced" bug: any color packed into a size absent from `priceDb` (or priced 0) vanishes from the estimate rather than flagging.
- `App.tsx` — the `priceDb` seed `{200,500,1000,2000}` (lines 174–179) and the `drillType` effect that resets it per type (lines 549–560). The "500-bag cost" fix lives in these seeds + `defaultPacketCost` (bagPlanner lines 199–226 — which notably has **no 500 branch**; it handles 200/1000/2000/5000).
- `engine/variants.ts` — the SKU table; DATA-01 wants an integrity test.

**NEW vs MODIFIED:**
- **[MOD]** `bagPlanner`: replace the silent `|| 0` / `?? 0` fallbacks with an explicit "unpriced" signal so the UI/packet can flag it instead of under-counting. Recommend a pure return of `{ cost, hasUnpricedSize, unpricedSizes[] }` — stays pure.
- **[MOD]** correct the 500-tier seed values in the `App.tsx` presets and align `defaultPacketCost` (add/verify a 500 branch).
- **[NEW]** `engine/__tests__/variants.integrity.test.ts` (DATA-01): assert every `DRILL_VARIANTS[code][shape]` value is a positive-integer SKU; check for duplicate SKUs across colors (spot-check found codes **731/732 and 781/782 share identical SKUs** — either intended aliases or a data bug the test must adjudicate); and that every bag size any color can be packed into has a `priceDb` entry.

**Data-flow change:** `priceDb` becomes the single validated price source consumed by `bagPlanner` → (legend estimate ∪ cart ∪ **new order packet**). The new "unpriced" flag is threaded engine → packet.

### Feature 7 — Gem-bag optimization (feeds both cart and packet)

**Integration point (verified):** already centralized and pure in `engine/bagPlanner.ts`. `packColor` enforces the dye-lot ≤800 rule + availability + `minCostBulk`; `planColorSupply` yields the priced per-color row. Both `checkout.compileShopifyCartLink` and `App.tsx` `sortedMatches` call it → they **cannot diverge**. This is the architectural template for v3.0.
**NEW vs MODIFIED:** **[NEW]** a pure aggregator `planOrderSupply(counts, shape, priceDb): OptimizedBagList` in/next to `bagPlanner.ts` mapping `matchResult.counts` → the full optimized bag list + totals + unpriced flag. Both the Artist cart and the Customer packet consume this **one** function.
**Data-flow change:** `App.tsx` currently inlines the aggregation (`sortedMatches`, `totalPackets`, `safetyDrillCost`, lines 902–970). **[MOVE]** that reduction into the pure aggregator so packet + legend + cart share byte-identical numbers.

### Feature 5 — Percent-based service fee

**Integration point (verified):** no existing fee anywhere (grep for `serviceFee` = 0 hits). Current total is `totalCostSafety = canvasBaseCost + canvasShippingEstimate + safetyDrillCost` (App.tsx line 972).
**NEW vs MODIFIED:**
- **[NEW]** a pure `computeQuote(parts, feePercent): Quote` in a new `engine/pricing.ts` (or extend `checkout.ts`) returning `{ subtotal, feePercent, feeAmount, total }`. Keep the fee a *configurable input*, never a hard-coded constant.
- **[MOD]** `App.tsx` replaces the inline `totalCostSafety` sum with `computeQuote(...)`.
**Data-flow change:** the fee belongs **in the quote computation, after subtotal, before total** — and only for **Customer** mode (Artist self-serves drills at cost via the affiliate cart, so no service fee). Mode therefore gates whether `feePercent > 0`. The `Quote` flows into the packet unchanged.

### Feature 6 — Customer order packet (the forward-compatible contract — see dedicated section)

**Integration points:**
- **[NEW]** `engine/orderPacket.ts` — pure `assembleOrderPacket(input): OrderPacket`. Composes: design PNG (via `export.drawCanvasOnly` / `drawCombinedCanvasSheet`), optimized bag list (Feature-7 aggregator), canvas spec (`checkout.calculateCanvasCost` + dimensions + `sizingAdviceData`), `Quote` (Feature 5), and a `largeOrderReview` flag.
- **[MOD]** `export.ts` — reuse `drawCanvasOnly`; add a `canvasToDataUrl`/`canvasToBlob` accessor so the packet can embed/attach the PNG **without** triggering a browser download (today only `triggerCanvasDownload` exists, lines 260–288).
- **[NEW]** a serializer producing the exportable manifest (JSON + attached PNG); reuse `projectStore`'s guarded-write + `generateUUID` patterns for the packet id.
- **[MOD]** `App.tsx` Customer "Buy" handler calls the assembler instead of `handleShopifyCheckout`.
**Data-flow change:** new terminal flow `matchResult + dimensions + priceDb + feePercent → assembleOrderPacket → serialize → download/export`. Shaped so the *same* JSON can later `POST` to the v4.0 backend with zero change.

### Feature 1 — Viewport-native interactive wizard (the load-bearing rework)

**Integration points:** `features/wizard/useWizard.ts` (state machine), plus `App.tsx` chrome — left sidebar step body (lines 1151–1277), top progress bar (1381–1435), floating HUD (1467–1545), right legend aside (1708–1994), mobile tab bar (2103–2157).
**NEW vs MODIFIED:**
- **[MOD]** extend `useWizard` from a raw step counter into a step *descriptor* model — each step exposes `{ id, title, canEnter, contextualActions }` so the HUD can render "what can I do now" without `App` hard-coding per-step JSX. Preserve `canEnter` logic exactly (tests assert on it).
- **[NEW]** `features/viewport/ViewportHud.tsx` — promote the inline floating HUD (currently anonymous JSX in `App`, gated on `image`) into a component rendering the *current step's* guidance + contextual actions in-canvas.
- **[MOVE]** step bodies (`Step1..4`) migrate from "sidebar page" slots to "surfaced-in-viewport panel" slots. Because they're already pure props-only components, this is a **host swap, not a rewrite** — the strangler seam.
**Data-flow change:** guidance/actions move from sidebar-position to HUD-position, driven by `useWizard`. State ownership unchanged (still `App`), so risk is contained to layout, not logic.

### Feature 2 — Customer vs Artist mode split (rides ON TOP of Feature 1)

**Integration points:** `useWizard` (which steps/actions exist per mode), `App.tsx` (gates vendor UI, affiliate cart vs Buy-packet CTA, service fee), `Step3Canvas` (affiliate + vendor = Artist-only; packet CTA = Customer).
**NEW vs MODIFIED:**
- **[NEW]** `features/mode/useAppMode.ts` — a persisted top-level `mode: 'customer' | 'artist'` via `usePersistentState` (mirrors the `theme` pattern at App.tsx lines 123–125). The single new top-level state atom.
- **[MOD]** `useWizard` accepts `mode` and derives the step list from it (Artist: design→palette→cost→order+cart; Customer: collapse to design→review→buy-packet). `canEnter` already parameterizes on data; add mode.
- **[MOD]** `App.tsx` gates: Artist → affiliate cart (`handleShopifyCheckout`) + own-canvas ordering (`VENDOR_REGISTRY` doors) + `feePercent = 0`; Customer → `assembleOrderPacket` + `feePercent > 0`, vendor/affiliate UI hidden.
- **[NEW]** a mode selector at entry (above/before the viewport).
**Data-flow change:** `mode` becomes a top-level branch feeding `useWizard` (step set), the pricing quote (fee on/off), and the terminal action (cart vs packet). Because mode only *selects among* wiring Feature 1 already made HUD-driven and Features 5/6 already made pure, it needs no second `App.tsx` rewrite — see sequencing.

---

## The Critical Sequencing (avoid double-rework of App.tsx)

**Recommended build order — dependency-respecting:**

```
1. Feature 3  Remove Prodigi                    (isolated; tsc-guided; warms up vendor types)
2. Feature 4  Price accuracy + integrity test   (pure engine; unblocks a trustworthy quote)
3. Feature 7  Bag-optimization aggregator       (pure; MOVE the App reduction into engine)
4. Feature 5  Service fee → engine/pricing.ts   (pure; consumes 3+4)
5. Feature 6  Order-packet assembler + serializer  (pure; consumes 3+4+5+export)
   ── engine now exposes pure, mode-agnostic building blocks ──
6. Feature 1  Viewport-native wizard rework     (useWizard descriptors; strangler-migrate
              Step1..4 hosts; add ViewportHud)
7. Feature 2  Mode split ON TOP of 6            (useAppMode; parameterize useWizard by mode;
              gate cart-vs-packet + fee using the pure blocks from 4/5/6)
```

**Why this order (the two constraints in the brief):**

**(a) Mode split rides on the new viewport wizard, not the old one.** Do all engine work (2–5) and the packet (6) **first**, while `App.tsx` is still the familiar 4-step wizard — these changes hide behind pure functions and don't touch layout. Then rework the *presentation* (Feature 1) **once**. Only after the HUD-driven step-descriptor model exists do you introduce `mode` (7→2), which merely *chooses among* step-sets and terminal actions the earlier steps already made pure. If mode were built before Feature 1, you'd wire mode branching into the old sidebar wizard and then rip it out during the viewport rework — the exact double-rework to avoid. Gating (cart vs packet, fee vs no-fee) is cheap to add because Features 4/5/6 already isolated it into pure functions; the mode branch is a one-line selector at each seam, not a re-plumb.

**(b) Strangler, not big-bang, for the sidebars.** `App.tsx`'s three wizard-driven surfaces — left sidebar step body, top progress bar, right legend aside — are already fed by pure props-only `Step1..4` components and derived data (`sortedMatches`, `leftLegendColors`). Migrate incrementally:
1. Introduce `ViewportHud` *alongside* the existing sidebars (both visible), driven by the same `useWizard` step. Ship it.
2. Move one step's contextual actions at a time from sidebar into the HUD; hide that sidebar region behind a flag as each moves. The `leftPanelCollapsed`/`rightPanelCollapsed` state already exists (App.tsx 113–114) — reuse it as the retire-the-sidebar toggle.
3. When all step bodies render in-viewport, delete the sidebar `<aside>` shells last. The right legend aside can persist longest (reference chrome, not wizard flow).
Each step is independently shippable and testable — `App.test.tsx` / `integration.test.tsx` assert on step reachability (`canEnter`, disabled Next), which the descriptor model must preserve.

**Engine-purity guard throughout:** Features 2–7 add logic to `engine/*` (pure: no Preact, no DOM except `export.ts`'s canvas, no persistence — as `bagPlanner.ts`'s own header contract states). `App`/hooks/features remain the only place touching state, DOM, and storage. This keeps the packet assembler and optimizer node/vitest-testable exactly like `bagPlanner.test.ts`.

---

## Order-Packet Data Model (forward-compatible v4.0 contract)

The highest-leverage artifact: it must serialize client-side in v3.0 and be `POST`ed **unchanged** to a v4.0 backend + admin dashboard. Design it as a **versioned, self-describing, pure-data manifest** — no functions, no DOM handles, no class instances. Model it on the frozen-shape discipline already used for `ProjectData` (`projectStore.ts` lines 23–43).

```typescript
// engine/orderPacket.ts  (PURE — no Preact/DOM/persistence in the type or the assembler)
export interface OrderPacket {
  schemaVersion: 1;                 // bump on breaking change; backend switches on it
  packetId: string;                 // crypto UUID (reuse generateUUID)
  createdAt: string;                // ISO 8601
  mode: 'customer';                 // packets are a Customer-mode artifact
  status: 'draft' | 'submitted';    // client sets 'draft'; backend owns lifecycle later

  design: {
    imageName: string;
    // Embed as data URL for an offline packet; a v4.0 backend swaps this for an
    // uploaded asset ref WITHOUT changing the surrounding shape:
    pngDataUrl?: string;            // v3.0 offline
    pngAssetRef?: string;           // v4.0 backend-assigned (mutually exclusive)
    thumbnailDataUrl?: string;
  };

  canvas: {                         // from checkout.calculateCanvasCost + dimensions
    cols: number; rows: number;
    unit: 'grid' | 'cm' | 'inch';
    widthIn: number; heightIn: number;
    drillStyle: 'square' | 'round';
    drillType: 'standard' | 'ab' | 'glow' | 'crystal';
    baseCost: number;
  };

  bags: {                           // from the Feature-7 pure aggregator
    shape: 'square' | 'round';
    items: Array<{
      dmcCode: string;
      exactCount: number;
      safetyCount: number;          // +10% margin
      bySize: Record<number, number>;   // e.g. { 200: 2, 2000: 1 }  (Record, never Map)
      lineCost: number;
    }>;
    totalDrills: number;
    totalBags: number;
    hasUnpricedSize: boolean;       // Feature-4 flag — surfaces data gaps to the admin
    unpricedSizes: number[];
  };

  quote: {                          // from engine/pricing.computeQuote (Feature 5)
    currency: 'USD';
    drillsSubtotal: number;
    canvasSubtotal: number;
    shipping: number;
    subtotal: number;
    serviceFeePercent: number;
    serviceFeeAmount: number;
    total: number;
  };

  review: {
    largeOrder: boolean;            // e.g. total > threshold OR totalDrills > N
    flags: string[];               // 'unpriced-sizes', 'oversized-canvas', …
  };

  customer?: {                      // optional now; backend fills/validates in v4.0
    name?: string; email?: string; notes?: string;
  };
}
```

**Contract rules that make it forward-compatible:**
1. **`schemaVersion` first-class** — the v4.0 backend branches on it; never reuse a field's meaning across versions.
2. **Pure data only** — JSON round-trippable; no `HTMLImageElement`, no `Map` (note the app's `colorMap` is a `Map` — the packet must use `Record`), no functions. This is exactly why the assembler lives in the pure engine layer.
3. **Additive evolution** — v4.0 adds fields (`pngAssetRef`, `status` transitions, `customer` validation) without removing v3.0 ones; `design` carries both an offline `pngDataUrl` and a future `pngAssetRef` slot so the upload swap is non-breaking.
4. **Server-authoritative fields present but client-defaulted** — `status: 'draft'`, empty `customer` — so the POST body shape already matches what the backend expects; the backend just takes ownership.
5. **Numbers precomputed and frozen at assembly** — the packet is a *snapshot* (like a saved `ProjectData` grid), so a later price-table edit can't retroactively change a submitted order; the admin dashboard trusts the packet's own numbers.

**Assembler placement:** `engine/orderPacket.ts::assembleOrderPacket(input)` — pure, unit-tested like `bagPlanner`. `App.tsx` gathers the inputs (it owns state) and calls it; serialization/download reuses `export.triggerCanvasDownload` + a JSON blob writer patterned on `projectStore`'s guarded writes.

---

## Recommended Project Structure (additions)

```
src/
├── engine/
│   ├── bagPlanner.ts        # [MOD] add planOrderSupply aggregator + unpriced flag
│   ├── pricing.ts           # [NEW] computeQuote (subtotal → fee → total)
│   ├── orderPacket.ts       # [NEW] OrderPacket type + assembleOrderPacket (pure)
│   ├── checkout.ts          # [MOD] drop prodigi; narrow vendor union
│   ├── variants.ts          # [MOD] (data only) + integrity test
│   └── __tests__/
│       ├── variants.integrity.test.ts   # [NEW] DATA-01
│       ├── pricing.test.ts              # [NEW]
│       └── orderPacket.test.ts          # [NEW]
├── features/
│   ├── mode/
│   │   └── useAppMode.ts    # [NEW] persisted 'customer' | 'artist'
│   ├── viewport/
│   │   └── ViewportHud.tsx  # [NEW] in-canvas step guidance + contextual actions
│   └── wizard/
│       └── useWizard.ts     # [MOD] step descriptors + mode parameterization
└── App.tsx                  # [MOD] strangler-migrate chrome; gate mode; call assembler
```

**Structure rationale:**
- **`engine/`:** keep every new *computation* here — pure, node-testable, mode-agnostic. The codebase already rewards this (`bagPlanner` shared by cart+legend is the proof).
- **`features/` + hooks:** every new *presentation / state* atom (mode, HUD) lives here, matching the existing `features/wizard` split.
- **`App.tsx`:** shrinks as logic is extracted, which is precisely what makes the Feature-1 layout rework survivable.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Branching mode inside the old sidebar wizard first
**What people do:** add `if (mode === 'customer')` throughout the current 4-step sidebar render, then later move it all to the viewport.
**Why it's wrong:** guarantees the double-rework the brief warns against — every mode branch written against sidebar layout is thrown away when the HUD lands.
**Do instead:** land the pure engine blocks + packet, then the HUD rework, then mode as a thin selector over both.

### Anti-Pattern 2: Assembling the packet in `App.tsx`
**What people do:** build the `OrderPacket` inline in the Buy handler using local state, `Map` color maps, and `HTMLImageElement`.
**Why it's wrong:** non-serializable handles leak in; the shape drifts from what a backend can accept; it's untestable in node.
**Do instead:** pure `assembleOrderPacket` in `engine/`; `App` only supplies plain inputs.

### Anti-Pattern 3: Silent `|| 0` pricing
**What people do:** keep `priceDb[size] || 0` so a missing tier just costs $0 (current bagPlanner behavior).
**Why it's wrong:** produces the "$0 unpriced" bug and a packet the admin can't trust.
**Do instead:** return an explicit `hasUnpricedSize` flag; surface it in legend + packet `review.flags`.

### Anti-Pattern 4: Big-bang delete of the sidebars
**What people do:** rip out both `<aside>` shells and rebuild the viewport in one PR.
**Why it's wrong:** breaks the many `App.test`/`integration.test` reachability assertions at once; no shippable intermediate.
**Do instead:** strangler — HUD alongside sidebars, migrate one step's actions at a time behind the existing `*PanelCollapsed` toggles, delete shells last.

---

## Integration Points Summary

| Boundary | Communication | v3.0 change |
|----------|---------------|-------------|
| `App.tsx` ↔ engine | Direct pure-function calls | Add `pricing`, `orderPacket`, `planOrderSupply`; MOVE the `sortedMatches` reduction into engine |
| `App.tsx` ↔ `useWizard` | Hook returning step API | Extend to descriptors; parameterize by `mode` |
| `App.tsx` ↔ `useAppMode` | New persisted hook | Top-level mode branch |
| `bagPlanner` → cart ∪ legend ∪ packet | Shared `packColor` primitive | Add aggregator so all three stay identical (existing pattern) |
| Order packet → v4.0 backend | Serialized JSON (`POST`, deferred) | Versioned, pure-data, additive-evolution contract |
| Saved `ProjectData` → `selectedVendor` | localStorage restore | Normalize legacy `'prodigi'` → `'lumaprints'` on load |

## Sources

- Direct read of v2.1 source: `src/App.tsx`, `src/engine/{checkout,variants,bagPlanner,projectStore,export,types}.ts`, `src/features/wizard/{useWizard.ts,steps/Step3Canvas.tsx,steps/Step4Export.tsx}` (HIGH confidence — integration points cited by file/function/line).
- `.planning/PROJECT.md` — v3.0 milestone goal, scope boundary, deferred v4.0 backend + admin dashboard.
- Strangler Fig migration pattern (Fowler) — incremental replacement of the sidebar wizard.

---
*Architecture research for: client-side Preact diamond-art planner — v3.0 two-mode viewport integration*
*Researched: 2026-07-12*
