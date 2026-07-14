# Phase 23: The Four Screens in Flow Order - Research

**Researched:** 2026-07-14
**Domain:** Preact UI wiring — composing four pure/props-only screen components from an existing 2460-line state-owning App.tsx behind per-screen strangler flags
**Confidence:** HIGH (every claim grounded in the live source at cited line numbers; no external packages, no new engine work)

## Summary

This is a **UI-wiring / strangler phase**, not a greenfield build. Every engine and primitive the four screens need already exists and is frozen: the `src/ui/` primitives (Phase 21), the `useDiamondArtMatch` pipeline with `detectedColorCount` + the gated `raw → smooth → reduce` post-process (Phase 22), the single-source `buildOrderQuote`/`planOrderSupply` selectors, `gridToInches`/`formatInches`, and `projectStore`. The work is to extract four pure screen components (`UploadScreen`, `RefineScreen`, `SuppliesScreen`, `OrderScreen`) that App composes via props, and swap each into its existing `data-step-panel` slot behind a per-screen boolean flag — one flag per commit, suite green at every step.

The single most important architectural finding: **the two-tier reactivity the Refine keystone needs (D-03) is already fully supported by the existing hook.** The worker effect keys ONLY on `[image, cols, rows, candidatesKey]` (`useDiamondArtMatch.ts:236`); smoothing strength, `enableReduce`, and `targetColorCount` live only in the `matchResult` `useMemo` deps (`:279-290`) — so edge-cleanup and the color slider are already pure main-thread post-processes that never re-fire the worker. Edge-cleanup maps directly onto the **already-wired** `enableSmoothing`/`smoothingStrength` state; the color slider needs two **new** App state vars (`enableReduce`, `targetColorCount`) passed into the hook's already-present-but-unwired params. Size selection is the worker tier, and the existing Phase 20 D-13 soft-invalidate ("stale → Recompute match" CTA) is the exact mechanism it flows through.

**Primary recommendation:** Build four pure screens mirroring the shipped `StepBar.tsx`/primitive pattern (props-only, `<Component>Props` interface above the component, named export, co-located jsdom render test). Add `src/features/screens/flags.ts` with four plain `const` booleans. In each `data-step-panel` slot, render `flag ? <NewScreen .../> : <LegacyStep .../>` — legacy Step body untouched, viewer single-mount preserved. Sequence the flag flips Upload → Supplies → Order → Refine (simplest first, keystone last), or Refine last regardless since it is highest-risk.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** New `src/features/screens/` directory holding four pure/props-only components — `UploadScreen.tsx`, `RefineScreen.tsx`, `SuppliesScreen.tsx`, `OrderScreen.tsx` — each mirroring the shipped `StepBar.tsx` pattern (props-only, Atelier-tokened, a11y-correct). They compose the `src/ui/` primitives; own no state; make no engine calls beyond pure selectors fed data by App.
- **D-02:** Per-screen strangler flags, not one global switch. A single `src/features/screens/flags.ts` exports four booleans (e.g. `USE_NEW_UPLOAD`, `USE_NEW_REFINE`, `USE_NEW_SUPPLIES`, `USE_NEW_ORDER`). App renders the new screen when its flag is `true`, else the existing `StepN…` body — in the same `data-step-panel` CSS-toggled sibling slot (preserving Phase 20 D-14 single-mount viewer + `hidden` toggling). Each plan flips exactly one flag on.
- **D-03:** Two-tier reactivity. Canvas-size selection is a real re-match (re-runs the worker, moves size ownership out of Upload into Refine). Edge-cleanup (Off/Light/Med/Strong → 0–3) and the color-count slider are pure main-thread post-processes over the unchanged raw grid via `useDiamondArtMatch`'s `raw → smoothMatches → reduceToColorCount` pipeline — no worker re-fire per tick. Color slider max = `detectedColorCount` (stable while dragging); lowering merges orphan drills with no visible change.
- **D-04:** Soft-invalidate (Phase 20 D-13) fires only on the re-match tier. A size change marks downstream steps stale + surfaces the single "Recompute match" CTA; edge-cleanup/color-slider ticks must NOT trigger staleness or a worker re-fire.
- **D-05:** Preset `SizeCard`s first, one custom-size entry second. Cards show grid dims + true derived inches from `gridToInches` (2.5mm/dot) + a live drill count (never a mock label). Custom canvas size (cols/inches with sane clamps, following the existing App canvas-clamp precedent) available when no preset fits.
- **D-06:** Kit / color-exclusion / drill-shape live under a single collapsible "Advanced" disclosure in Refine — not their own step. Defaults: kit = all, drill-shape = square. Controlled collapse (native `<details>` or a small controlled disclosure — planner's call); closed by default.
- **D-07:** Both Supplies and Order render exclusively from `buildOrderQuote` (`engine/quote.ts`) + `planOrderSupply` — zero local total math. Supplies shows the legend/supply table (symbol · swatch · DMC code + name · drills incl. +10% safety · bags) with a "why these bags?" dye-lot explanation inline, plus the inline itemized order-summary. Order renders the same itemized quote. One selector, two views.
- **D-08:** Auto-filled, locked spec + finish + ship-to + itemized quote → download a versioned JSON packet. Print spec locked (Rolled Canvas fixed, size derived from grid, finish). Completion = downloading a versioned self-contained order packet with a schema `version` field (design/chart reference, canvas spec, optimized gem-bag list, integer-cents quote snapshot; forward-compatible with v5.0 backend). Reuse existing `export.ts` / `projectStore` serialization. Ship-to stays client-side only — embedded in the file, never sent anywhere.
- **D-09:** No implied payment, no fake receipt. Terminal state is an honest "packet downloaded — take this to the vendor" confirmation. No order number, no receipt, no payment UI.
- **D-10:** Drag/drop + browse + an inline recent-projects list from `projectStore`. Upload composes the existing ingest path plus an inline list of recent projects (thumbnails/summaries from `projectStore`); selecting one rehydrates state and advances into the flow — no modal picker. Canvas-size selection is removed from Upload and owned by Refine.

### Claude's Discretion

- Exact prop interfaces / `<Screen>Props` shapes; how much App prop-drills vs passes a small grouped props object — follow "App owns state, children pure"; **no new context/store** (props only).
- `flags.ts` shape — plain `const` booleans vs a typed record; inlined vs a tiny module. Keep it one obvious place.
- Advanced disclosure implementation (native `<details>` vs a controlled Pill-toggle disclosure); recent-projects thumbnail size/layout.
- Order-packet filename, exact `version` string, packet field naming — as long as self-contained, versioned, forward-compatible with the future v5.0 backend schema.
- Which screen lands first in the swap order (planner sequences the flags).

### Deferred Ideas (OUT OF SCOPE)

- Mobile responsive + touch (single portrait column ~300px, pinch-zoom, `touch-action: none`) → **Phase 24**.
- Deleting legacy Step1..4 components, side asides, theme toggle, dead sidebar/preset state → **Phase 25** (strangler close). Legacy Step bodies stay live behind their flags this phase.
- Tunable Delta-E merge guard threshold → **REFINE-06 (v4.x)**.
- Richer finish/canvas visualization proof on Order → **ORDER-03 (v4.x)**.
- Service-fee line + order-ref/threshold auto-flagging → deferred.
- Real payment + lab submission → **v5.0**.
- Any `engine/*` signature change — engine is frozen (Phase 22 was the only engine phase).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UPLOAD-01 | Drag/drop or browse a photo + reopen a recent project from an inline list | Ingest path (`handleFileChange`/`handleDrop`/`loadImageFile` App.tsx:855-938) + `loadRecentImage` (:940) + saved-project rehydrate `loadProject` (:292-354). Inline list source = `projectStore.list()` (`ProjectSummary[]`, thumbnails) exposed today via `projectsRegistry` state (App.tsx:143). Size-select removed from Upload. |
| REFINE-01 | Size cards: grid dims + true derived inches + live drill count; changing size re-renders live | `SizeCard` primitive (dumb, props-only). Inches via `gridToInches(cols,rows)` + `formatInches` (density.ts:38-61). Live drill count = `cols*rows` (pure). Size drives `setCols`/`setRows` → worker tier (see two-tier seam). **See Open Question Q1 re "live" vs stale-gated preview.** |
| REFINE-02 | Custom canvas size (cols/inches, sane clamps) | Existing App custom-size path: `widthInput`/`heightInput`/`unit`/`handleWidthChange`/`handleHeightChange` (App.tsx:157-159, 792-853 region) + `STANDARD_SIZES` presets (:48-65). Clamp precedent lives in the existing width/height change handlers. |
| REFINE-03 | Edge-cleanup Off/Light/Med/Strong → smoothing 0–3, live | `SegmentedControl` primitive → maps onto ALREADY-WIRED `enableSmoothing`+`smoothingStrength` state (App.tsx:203-209). Post-process only — worker never re-fires (`useDiamondArtMatch.ts:261-265,279-290`). Live today. |
| REFINE-04 (engine Complete) | Color-count slider, max = detected count, deterministic merge, no visible change, no worker re-run | `Slider` primitive (native range, `onInput` live). Hook already supports `enableReduce`+`targetColorCount` (`useDiamondArtMatch.ts:40-47,271-275`) but **App does not yet pass them** (:482-493). Wire = add two App state vars + pass through. Max = `detectedColorCount` from hook (:57,241-244). |
| REFINE-05 | Advanced disclosure: kit (100/200/all), color exclusion, drill shape; defaults kit=all shape=square | Existing state: `selectedBaseKit` (:186, default 'all'), `excludedColors` (:188), `drillStyle` (:185, default 'square'). Currently in `Step2Palette`. Move into a Refine "Advanced" `<details>`/disclosure. |
| SUPPLIES-01 | Legend/supply table (symbol·swatch·DMC code+name·drills incl. +10%·bags) + "why these bags?" | `planOrderSupply(counts,shape,priceDb) → OrderSupplyPlan` (bagPlanner.ts:493-547). Rows joined to `DMC_PALETTE` for name/hex + `symbolMap` for symbols (App.tsx:1079-1104 shows the exact join today). `DYE_LOT_WHY_SENTENCE` static string (App.tsx:26). |
| SUPPLIES-02 (engine Complete) | Inline itemized order-summary from the single-source quote | `buildOrderQuote({supplyPlan, canvasBaseCost, vendor}) → OrderQuote` (quote.ts:74-140). `lineItems[]` + `totalCents` (sum by construction). |
| ORDER-01 | Auto-filled locked spec + finish + ship-to + itemized quote | Same `buildOrderQuote`. Spec derived: size from `gridToInches(matchCols,matchRows)`, "Rolled Canvas" fixed, finish = new local Order state. |
| ORDER-02 | Honest client-side handoff — download versioned self-contained packet, no payment/receipt | New packet serializer + reuse `triggerCanvasDownload`/anchor-blob pattern (export.ts:260-288). Packet fields from `matchResult`, `OrderSupplyPlan`, `OrderQuote` snapshot. Terminal confirmation only. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Image ingest, worker match, all app state | App.tsx (state owner) | Web Worker (`MatcherClient`) | Phase 20 D-01: App is the sole state owner; children pure. Worker owns heavy color-match compute off the main thread. |
| Size-tier re-match (worker re-fire) | Web Worker via committed `matchInputs` | App soft-invalidate (D-13) | Worker keys on `[image,cols,rows,candidatesKey]` only; committed inputs gate re-fire (abort-race safety, Phase 22 D-04). |
| Edge-cleanup + color-slider post-process | Main thread (`matchResult` useMemo) | — | Pure `raw → smooth → reduce`; never touches the worker (D-03). |
| Quote / supply totals | Pure engine (`quote.ts`, `bagPlanner.ts`) | — | Single-source integer-cents selectors; Supplies + Order read, never recompute (D-07). |
| Screen rendering | `src/features/screens/*` (pure, props-only) | `src/ui/*` primitives | Presentational only; App feeds every value via props (D-01). |
| Persistence (recents, projects, order packet download) | `projectStore` / `export.ts` | Browser localStorage / Blob download | All client-side; packet embeds ship-to, never transmits (D-08). |

## Standard Stack

No new packages are installed in this phase. The screens compose existing, in-repo modules.

### Core (existing, frozen)
| Module | Path | Purpose | Verified |
|--------|------|---------|----------|
| Preact + hooks | `preact/hooks` | View + state (App owns state) | `[VERIFIED: src/App.tsx:1]` |
| `useDiamondArtMatch` | `src/features/match/useDiamondArtMatch.ts` | Match pipeline: worker + `smooth→reduce` post-process + `detectedColorCount` + `restore` | `[VERIFIED: useDiamondArtMatch.ts:106-300]` |
| `buildOrderQuote` / `OrderQuote` | `src/engine/quote.ts` | Single-source integer-cents itemized quote | `[VERIFIED: quote.ts:74-140]` |
| `planOrderSupply` / `OrderSupplyPlan` | `src/engine/bagPlanner.ts` | Aggregated supply plan (rows, +10% safety, bags, savings) | `[VERIFIED: bagPlanner.ts:460-547]` |
| `gridToInches` / `formatInches` | `src/engine/density.ts` | Derived inches for SizeCards (2.5mm/dot, 10 dots/in) | `[VERIFIED: density.ts:25-61]` |
| `reduceToColorCount` / `getColorDistance` | `src/engine/color.ts` | Target-N merge + CIEDE2000 (consumed inside the hook) | `[VERIFIED: color.ts:128-271]` |
| `smoothMatches` | `src/engine/smoothing.ts` | Edge cleanup (consumed inside the hook) | `[VERIFIED: hook import useDiamondArtMatch.ts:3]` |
| `projectStore` | `src/engine/projectStore.ts` | `list`/`load`/`save`/`remove`, `recents.list/save`, thumbnails | `[VERIFIED: projectStore.ts:112-198]` |
| `triggerCanvasDownload` + anchor/Blob pattern | `src/engine/export.ts` | Client-side download idiom to mirror for the JSON packet | `[VERIFIED: export.ts:260-288]` |

### Supporting UI primitives (Phase 21, built, unwired)
| Primitive | Path | Contract |
|-----------|------|----------|
| `SizeCard` | `src/ui/SizeCard.tsx` | Dumb card: `label, gridDims, inches, drillCount, selected, onSelect, tag?`. NO derivation — every value is a computed prop. `aria-pressed`. `[VERIFIED: SizeCard.tsx:4-75]` |
| `SegmentedControl<T>` | `src/ui/SegmentedControl.tsx` | Controlled `role="radiogroup"`: `value, onChange, options, label`. Selection-follows-focus arrows. `[VERIFIED: SegmentedControl.tsx:10-93]` |
| `Slider` | `src/ui/Slider.tsx` | Controlled native range: `value, onChange, min, max, step?, ariaLabel, ariaValueText?`. **Uses `onInput` (Preact live), not `onChange`.** `[VERIFIED: Slider.tsx:38-68]` |
| `Pill` | `src/ui/Pill.tsx` | Display chip `variant: neutral\|ok\|tag`. Non-interactive `<span>`. `[VERIFIED: Pill.tsx:37-50]` |
| `Button` | `src/ui/Button.tsx` | `variant: primary\|save\|ghost`, native `type="button"`. `[VERIFIED: Button.tsx:36-50]` |
| `cn` | `src/ui/cn.ts` | Plain string-join classnames merge (primitives take literal strings only). `[VERIFIED: referenced by all primitives]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-screen `const` boolean flags | A typed `Record<Screen, boolean>` or env-var flag | Booleans are the simplest one-place switch (D-02 discretion); a record adds a type for no benefit at N=4. Recommend plain `const`s. |
| Native `<details>` for Advanced | Controlled disclosure via `useState` + `Pill` toggle | `<details>` is zero-JS, a11y-native, matches the "browser-native first" project directive. Recommend `<details>` unless the design contract needs animated collapse. |
| Prop-drilling each field | One grouped props object per screen | Grouped `<Screen>Props` interface keeps App's JSX readable and the contract explicit; matches the existing `Step*` prop-bag pattern. Recommend a single typed props object per screen. |

**Installation:** none — no `npm install` in this phase.

## Package Legitimacy Audit

**No external packages are installed in this phase.** All modules are in-repo (`src/engine/*`, `src/ui/*`, `src/features/*`) and Preact is already a project dependency. No registry lookup required.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
   user photo /          │                 App.tsx                     │
   recent project ──────▶│         (SOLE STATE OWNER, D-01)            │
                         │                                             │
                         │  image,cols,rows ─┐                         │
                         │  matchInputs ─────┼─(committed)             │
                         │  enableSmoothing/ │                         │
                         │   smoothingStrength                         │
                         │  enableReduce/    │  ┌──────────────────┐    │
                         │   targetColorCount├─▶│ useDiamondArtMatch│   │
                         │  drillStyle,kit,  │  │                  │    │
                         │   excludedColors  │  │ worker effect ───┼──▶ Web Worker
                         │                   │  │  keys: image,    │   (MatcherClient)
                         │                   │  │  cols,rows,       │    │  raw grid
                         │                   │  │  candidatesKey    │◀───┘
                         │                   │  │                  │    │
                         │                   │  │ matchResult memo: │    │
                         │                   │  │  raw→smooth→reduce │    │
                         │                   │  │ detectedColorCount │    │
                         │                   │  └────────┬─────────┘    │
                         │   matchResult.counts, symbolMap, detected    │
                         │        │                    │                │
                         │        ▼                    ▼                │
                         │  planOrderSupply ──▶ buildOrderQuote         │
                         │   (OrderSupplyPlan)   (OrderQuote)           │
                         │        │                    │                │
                         │        ├────────┬───────────┤                │
                         │        ▼        ▼           ▼                │
                         │   flags.ts gate each data-step-panel slot    │
                         └───┬────────┬────────┬────────┬───────────────┘
                             ▼        ▼        ▼        ▼
                        Upload   Refine   Supplies   Order    (pure props-only screens)
                          │        │  keystone │        │
                          │        │           │        └─▶ JSON order packet download
                          │        │           │            (ship-to embedded, no send)
                          └────────┴───────────┴─── compose src/ui/* primitives
                                     │
                          single-mount <CanvasViewer> in <main> (D-14, never remounts)
```

The four screens are always-mounted CSS-toggled siblings (`display:contents`/`hidden`) so the single `<CanvasViewer>` in `<main>` never remounts on step change (App.tsx:1401-1526).

### Recommended Project Structure
```
src/features/screens/          # NEW (D-01)
├── flags.ts                   # USE_NEW_UPLOAD/REFINE/SUPPLIES/ORDER const booleans (D-02)
├── UploadScreen.tsx           # + UploadScreenProps interface above component
├── RefineScreen.tsx           # keystone
├── SuppliesScreen.tsx
├── OrderScreen.tsx
└── __tests__/
    ├── UploadScreen.test.tsx  # jsdom render tests (mirror StepBar.test.tsx)
    ├── RefineScreen.test.tsx
    ├── SuppliesScreen.test.tsx
    └── OrderScreen.test.tsx
```

### Pattern 1: Pure props-only screen (mirror StepBar / primitives)
**What:** `<Screen>Props` interface immediately above a named-export function component; no `useState`, no engine imports beyond pure display selectors already computed by App; `cn()` for classes; Atelier tokens only.
**When to use:** all four screens.
**Example:**
```tsx
// Source: src/ui/SizeCard.tsx (pattern), src/features/wizard/StepBar.tsx (props-only precedent)
export interface RefineScreenProps {
  sizePresets: Array<{ label: string; cols: number; rows: number; tag?: string }>;
  cols: number; rows: number;
  onSelectSize: (cols: number, rows: number) => void;
  // custom size
  widthInput: string; heightInput: string;
  onWidthChange: (v: string) => void; onHeightChange: (v: string) => void;
  // edge-cleanup (maps to enableSmoothing + smoothingStrength)
  edgeCleanup: 0 | 1 | 2 | 3; onEdgeCleanupChange: (v: 0|1|2|3) => void;
  // color slider
  colorTarget: number; detectedColorCount: number; currentColorCount: number;
  onColorTargetChange: (n: number) => void;
  // advanced (kit / exclude / shape)
  selectedBaseKit: 'all' | '100' | '200'; onKitChange: (k: 'all'|'100'|'200') => void;
  drillStyle: 'square' | 'round'; onShapeChange: (s: 'square'|'round') => void;
  excludedColors: Set<string>; onToggleExclude: (code: string) => void;
  baseCandidates: DmcColor[];
  stale: boolean; onRecompute: () => void;
}
```

### Pattern 2: SizeCard derived values are computed in App, passed as props
```tsx
// Source: density.ts:38-61 + SizeCard.tsx:4-25 — App computes, card renders
const { widthIn, heightIn } = gridToInches(preset.cols, preset.rows);
<SizeCard
  label={preset.label}
  gridDims={`${preset.cols}×${preset.rows}`}
  inches={`${formatInches(widthIn)} × ${formatInches(heightIn)} in`}
  drillCount={preset.cols * preset.rows}
  selected={cols === preset.cols && rows === preset.rows}
  onSelect={() => onSelectSize(preset.cols, preset.rows)}
  tag={preset.tag}
/>
```

### Pattern 3: Strangler swap in the panel slot (leave legacy intact)
```tsx
// Source: App.tsx:1449-1475 (current Step2 slot); D-02 swap
<div data-step-panel="2" className={wizard.step === 2 ? 'contents' : 'hidden'}>
  {USE_NEW_REFINE
    ? <RefineScreen {...refineProps} />
    : <Step2Palette {...step2Props} /> /* untouched until Phase 25 */}
</div>
```

### Anti-Patterns to Avoid
- **New context/store or screen-local state for domain data** — App stays sole owner (D-01). Screens may hold only trivial presentational UI state if unavoidable; prefer none.
- **Recomputing totals in a screen** — Supplies/Order render `OrderQuote`/`OrderSupplyPlan` values verbatim (D-07). Never `.reduce` cents in a screen.
- **Wiring the color slider or edge-cleanup to `matchInputs`/worker** — that would re-fire the worker per tick (D-04). They must feed only the hook's post-process params.
- **Using `onChange` on the range input** — in Preact `onChange` fires on commit/blur, freezing a controlled slider mid-drag. The `Slider` primitive already uses `onInput` (Slider.tsx:58-59) — do not re-wrap it with `onChange`.
- **Unmounting a panel on step change** — breaks the single-mount viewer (D-14). Keep the always-mounted CSS-toggle.
- **Deleting/editing legacy `Step*` bodies** — that is Phase 25. This phase only adds the flag branch.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Inch/size labels | Manual `cols/10` string math per card | `gridToInches` + `formatInches` | Single density source; hard-coded labels desync from canvas cost (QUOTE-01). density.ts:38-61 |
| Itemized total | A screen-local cents reducer | `buildOrderQuote(...).lineItems`/`.totalCents` | Sum-by-construction; Supplies/Order can never diverge (D-07). quote.ts:134-139 |
| Bag/drill counts + "+10%" | Re-packing drills in the UI | `planOrderSupply(...)` rows/`totalPackets`/`totalDrills` | Shared aggregator already dye-lot + safety aware. bagPlanner.ts:493-547 |
| Color reduction / merge | New merge loop in the screen | Hook's `enableReduce`+`targetColorCount` → `reduceToColorCount` | Deterministic CIEDE2000 merge with guard already built (Phase 22). color.ts:265-271 |
| Edge smoothing | New spatial filter | Existing `enableSmoothing`/`smoothingStrength` → `smoothMatches` | Already wired + live. useDiamondArtMatch.ts:261-265 |
| Recent-projects list + thumbnails | New persistence | `projectStore.list()` + `loadProject(id)` | Frozen storage shapes; rehydrate path exists. projectStore.ts:112-125, App.tsx:292-354 |
| Feature flag mechanism | A config system / env plumbing | Four plain `const` booleans in `flags.ts` | Grep confirms none exists; N=4 needs nothing more (D-02). |
| Download trigger | New anchor/Blob code | Mirror `triggerCanvasDownload`'s anchor+`URL.createObjectURL`+revoke idiom for a JSON Blob | Proven client-side download pattern. export.ts:260-288 |
| CSPRNG id for packet | `Math.random()` | `generateUUID()` | CSPRNG, collision-safe (W9 lineage). projectStore.ts:75-84 |

**Key insight:** Nearly every "hard" thing in this phase is already solved in a frozen engine or primitive. The phase's real work is prop-interface design and the strangler swap discipline — not algorithms.

## The Two-Tier Reactivity Seam (D-03/D-04) — the keystone detail

**Worker tier (size → re-match):** the worker effect in `useDiamondArtMatch` keys ONLY on `[image, cols, rows, candidatesKey]` `[VERIFIED: useDiamondArtMatch.ts:236]`. App feeds it the **committed** `matchInputs` (not live cols/rows) `[VERIFIED: App.tsx:482-493]`. A Refine size selection sets live `cols`/`rows` (+ `widthInput`/`heightInput`), which diverges from `matchInputs` → `isStale` true (App.tsx:507-510) → the existing "This step is out of date / Recompute match" banner (App.tsx:1271-1288) → `handleRecomputeMatch` commits and re-fires the worker exactly once (App.tsx:522-532). **This machinery already exists** — Refine size cards reuse it; they do not add a new worker path.

**Post-process tier (edge-cleanup + color slider → live, no worker):** `smoothingStrength`, `enableReduce`, and `targetColorCount` appear only in the `matchResult` `useMemo` deps `[VERIFIED: useDiamondArtMatch.ts:279-290]`, never in the worker effect deps. So they recompute the grid on the main thread with no worker re-fire — exactly D-03/D-04.
- **Edge-cleanup control:** maps onto the **already-wired** `enableSmoothing` + `smoothingStrength` state (App.tsx:203-209). Off → `enableSmoothing=false` (or strength 0); Light/Med/Strong → strength 1/2/3. No new hook wiring.
- **Color slider:** the hook **already accepts** `enableReduce` + `targetColorCount` (useDiamondArtMatch.ts:40-47) but **App's current call omits them** (App.tsx:482-493) so the reduce step is a no-op today (SC5). Wiring REFINE-04 = add two App state vars and pass them into the hook. Slider `max` = `detectedColorCount` from the hook (stable under drag, keyed only on `rawMatchResult`, :241-244). The "live merged count beside the slider" = `Object.keys(matchResult.counts).length` (the post-reduce distinct count).

## App.tsx State → Screen Props Map

| Screen | App state / callbacks it needs (all already in App) | Source lines |
|--------|------------------------------------------------------|--------------|
| **Upload** | `image`, `imageName`, `isDragOver`, `recentImages` (+ `loadRecentImage`, `deleteRecentImage`), `projectsRegistry` (+ `loadProject`), `handleFileChange`/`handleDragOver`/`handleDragLeave`/`handleDrop`, `dropZoneRef`, `imageFitMode`/`setImageFitMode`. **NOT** size fields (moved to Refine). | :128,142,179,143,940,855-878,465,184 |
| **Refine** | `cols`/`rows`/`setCols`/`setRows`, `widthInput`/`heightInput` + change handlers, `STANDARD_SIZES` (or a curated preset list), `enableSmoothing`/`smoothingStrength` (edge-cleanup), NEW `enableReduce`/`targetColorCount`, `detectedColorCount` (new from hook return), `matchResult.counts` (current color count), `selectedBaseKit`/`setSelectedBaseKit`, `drillStyle`/`setDrillStyle`, `excludedColors`/`toggleColorExclusion`, `baseCandidates`, `isStale`/`handleRecomputeMatch`. | :129-130,157-160,186,185,188,469-480,507-532 |
| **Supplies** | `orderPlan` (`planOrderSupply` result), `sortedMatches` (joined rows w/ name+hex+symbol), `symbolMap`, `DYE_LOT_WHY_SENTENCE`, and the `buildOrderQuote` result (see note). | :1076-1123,26; quote.ts |
| **Order** | `buildOrderQuote` result (locked spec + itemized quote), `gridToInches(matchCols,matchRows)` for spec size, `selectedVendor`, NEW finish + ship-to local Order state, packet serializer using `matchResult`/`orderPlan`/quote snapshot + `generateUUID`. | quote.ts; density.ts; :216,515-516,75-84(projectStore) |

**Note — Supplies/Order both need the quote:** App does NOT currently call `buildOrderQuote` (it still uses the legacy inline `totalCostSafetyCents` assembly, App.tsx:1143-1148 — kept for the legacy Step3/Step4 bodies until Phase 25). The planner must add an App-level `const orderQuote = buildOrderQuote({ supplyPlan: orderPlan, canvasBaseCost, vendor: selectedVendor })` and pass it to the new Supplies + Order screens. `orderPlan` (planOrderSupply) is already computed once at App.tsx:1076. This satisfies D-07 without touching the legacy total.

## projectStore Recent-Projects API (UPLOAD-01)

Two distinct persisted lists exist — the planner must not conflate them:
- **Saved projects** (the "recent projects" of D-10): `projectStore.list(): ProjectSummary[]` → `{ id, name, thumbnail, dateModified, dateCreated }` `[VERIFIED: projectStore.ts:17-23,113-115]`. Selecting one calls `loadProject(id)` which rehydrates ALL state and calls `restore(...)` with the stored grid (no worker run) `[VERIFIED: App.tsx:292-354]`. Exposed today as `projectsRegistry` state (App.tsx:143). This is the inline list D-10 means ("selecting one rehydrates state and advances into the flow").
- **Recent images** (raw uploaded photos): `projectStore.recents.list(): RecentImage[]` → `{ id, name, dataUrl, width, height }` `[VERIFIED: projectStore.ts:54-60,166-197]`, driven by `loadRecentImage` (App.tsx:940). These are un-matched source photos, not projects.

D-10's "inline recent-projects list" = the saved-projects `ProjectSummary[]` (has thumbnails). The planner should surface `projectStore.list()` inline in Upload with `loadProject` on click. Recent raw images (`recents`) may also render as a browse shortcut per the design contract.

## buildOrderQuote / planOrderSupply Shapes (D-07)

`OrderQuote` `[VERIFIED: quote.ts:37-62]`:
- `lineItems: QuoteLineItem[]` where each = `{ key: 'drills'|'canvas'|'shipping'|'tax', label, cents, estimate: boolean, note? }`. Labels are fixed: `Drills`, `Canvas print`, `Shipping (est.)`, `Tax`.
- `totalCents` — `sumCents(lineItems)` by construction (never diverges).
- `ratesAsOf` — provenance string (`RATES_AS_OF = '2026-07-14'`, checkout.ts:171).
- `canvasPriced: boolean` — false when the canvas base cost was null/non-finite; the UI must surface this (not a silent $0).

`OrderSupplyPlan` `[VERIFIED: bagPlanner.ts:460-471]`:
- `rows: Array<{ code } & ColorSupplyRow>` — per color: `exact`, `safety` (both `ColorPack` with `bySize: Record<size,qty>`, `totalDrills`, `packets`), `costExact`, `costSafety`, `bagsText` (e.g. "1×2000, 1×500"), `hasUnpricedSize`, `unpricedSizes`.
- `totalPackets`, `totalDrills` (both on the +10% SAFETY basis), `optimizedCostCents`, `naiveCostCents`, `savingsCents` (clamped ≥0), `savingsPct`, `hasUnpricedSize`, `unpricedColorCodes[]`.
- The "+10%" safety count per row is `Math.ceil(Math.round(count*110)/100)` (App.tsx:1088). Bags = `row.safety.bySize` / `row.safety.packets`. "why these bags?" text source = the static `DYE_LOT_WHY_SENTENCE` (App.tsx:26).

For the Supplies table row, mirror the existing join (App.tsx:1079-1104): `DMC_PALETTE.find(c => c.dmc === code)` for name+hex, `symbolMap[code]` for the symbol glyph.

## Order Packet Serialization (D-08/ORDER-02)

There is no existing JSON export module — `export.ts` only draws canvases and downloads PNGs. Reuse only the **download idiom** (anchor + `URL.createObjectURL(blob)` + deferred revoke, export.ts:260-288) with a `application/json` Blob. Recommended self-contained versioned schema (naming at planner discretion, D-08):
```jsonc
{
  "schemaVersion": "1.0",            // forward-compat with v5.0 backend
  "packetId": "<generateUUID()>",    // CSPRNG, projectStore.ts:75
  "createdAt": "<ISO string>",
  "design": {                         // chart reference
    "cols": <matchCols>, "rows": <matchRows>,
    "gridData": [<DMC_PALETTE indices>], // same encoding loadProject reads (App.tsx:342,400-402)
    "drillShape": "square"|"round", "drillType": "standard"|...
  },
  "canvasSpec": {                     // LOCKED (D-08)
    "product": "Rolled Canvas",
    "widthIn": <gridToInches().widthIn>, "heightIn": <...>,
    "finish": "<selected finish>", "vendor": "<selectedVendor>"
  },
  "gemBags": [ { "dmc": "310", "name": "...", "bySize": {"200":2}, "packets": 2, "drills": 400 } ], // from OrderSupplyPlan.rows
  "quote": {                          // integer-cents snapshot from OrderQuote
    "lineItems": [ { "key":"drills","label":"Drills","cents":1234 }, ... ],
    "totalCents": <n>, "ratesAsOf": "2026-07-14"
  },
  "shipTo": { /* client-only; embedded, never transmitted (D-08) */ }
}
```
Filename suggestion: `gempixel-order-<packetId-short>.json`. Terminal UI = an honest "Packet downloaded — take this to the vendor" confirmation; **no order number, no receipt, no payment** (D-09).

## Common Pitfalls

### Pitfall 1: Wiring size selection as a "live" instant re-render
**What goes wrong:** Making a size card immediately re-fire the worker per click reintroduces the B2 abort-race churn Phase 20/22 explicitly designed out, and contradicts D-04 (size = stale + Recompute CTA).
**How to avoid:** Size cards set live `cols`/`rows` only; let the existing soft-invalidate/Recompute flow own the worker re-fire. See Open Question Q1 for the "live" tension.
**Warning signs:** worker `loading` spinner flickering on every size click; the stale banner never appearing.

### Pitfall 2: Slider frozen mid-drag
**What goes wrong:** Re-wrapping the native range with `onChange` (React habit) — Preact fires `onChange` only on commit.
**How to avoid:** Use the `Slider` primitive as-is (it uses `onInput`, Slider.tsx:58-59). Pass `value`/`onChange`(the primitive's prop, which is internally `onInput`)/`min`/`max`/`ariaLabel`.

### Pitfall 3: Color-slider max jumping under the user
**What goes wrong:** Deriving the slider max off `matchResult.counts` (post-reduce) makes the max shrink as the user drags, snapping the thumb.
**How to avoid:** `max = detectedColorCount` (keyed only on raw match, useDiamondArtMatch.ts:241-244). Show the live merged count as separate copy beside the slider.

### Pitfall 4: Supplies/Order divergence from a local reducer
**What goes wrong:** Recomputing a total in one screen creates a figure that disagrees with the other.
**How to avoid:** Both consume the SAME `buildOrderQuote` result App computes once (D-07). Render `lineItems`/`totalCents` verbatim.

### Pitfall 5: Breaking the single-mount viewer
**What goes wrong:** Conditionally mounting a screen (`{flag && <Screen/>}` at panel-root, or moving the viewer inside a screen) remounts `<CanvasViewer>`, losing zoom/pan and re-initializing the worker-fed canvas.
**How to avoid:** Keep the always-mounted `data-step-panel` CSS-toggle (App.tsx:1401-1526); the ternary swaps only the panel's inner content; the viewer stays in `<main>` (App.tsx:1583).

### Pitfall 6: `canvasPriced=false` / unpriced colors shown as $0
**What goes wrong:** A tampered/legacy price yields `canvasPriced:false` or `hasUnpricedSize` colors; rendering them as $0 lies about the total.
**How to avoid:** Surface them (the existing App banner already does for unpriced colors, App.tsx:1180-1201). Order/Supplies must show an "est./unpriced" affordance, never a silent $0 (Phase 15/22 honesty lineage).

### Pitfall 7: Flipping more than one flag per commit
**What goes wrong:** Two screens landing together can drop the suite red mid-phase — the exact v3.0 "two big UI reworks at once" failure the strangler ordering exists to prevent.
**How to avoid:** One flag `true` per plan/commit; run the full suite (`npm test`) + `npx tsc --noEmit` before each commit.

## Runtime State Inventory

This is an additive UI-wiring phase (new components + two new App state vars + a flag module). No rename, refactor of stored keys, or data migration.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — new screens read existing state; `projectStore` shapes are frozen and untouched (projectStore.ts:8-9 comment). | none |
| Live service config | None — 100% client-side app, no external services. | none |
| OS-registered state | None. | none |
| Secrets/env vars | None. | none |
| Build artifacts | None — no package renames; no new deps. | none |

**Nothing found in any category — verified by reading `projectStore.ts` (frozen shapes), config.json (no services), and the phase's additive scope (new files + flag branch only).**

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Size selection lived in Upload/Step1 | Size ownership moves to Refine (D-03/D-10) | Phase 23 | Upload loses the size fields; Refine SizeCards own it. |
| Inline `totalCostSafetyCents` in App | Single-source `buildOrderQuote` for the new screens | Phase 22 (built) → 23 (consumed) | Legacy total stays for legacy Steps until Phase 25; new screens use the quote. |
| Reduce step no-op (SC5) | Color slider flips `enableReduce`+`targetColorCount` on | Phase 23 | First real consumer of the Phase 22 reducer. |

**Deprecated/outdated:** nothing removed this phase — legacy `Step1..4` bodies remain live behind their flags (removal is Phase 25).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | D-10's "inline recent-projects list" means saved projects (`projectStore.list()`/`ProjectSummary`) with thumbnails, not the raw `recents` image list | projectStore API | If the design contract means raw recents, Upload wires `recents.list()`/`loadRecentImage` instead (both exist). Low risk — both paths documented. |
| A2 | Order-packet schema fields/naming as sketched (schemaVersion, design, canvasSpec, gemBags, quote, shipTo) | Order Packet | Field names are explicitly Claude's discretion (D-08); v5.0 backend schema is not yet defined. Confirm shape with the design handoff if it specifies one. |
| A3 | Edge-cleanup Off maps to `enableSmoothing=false` (vs strength 0) | Two-Tier Seam | Either produces an unsmoothed grid; pick one consistently. Trivial to change. |
| A4 | "Recommended" preset size list for SizeCards derives from `STANDARD_SIZES` grid entries | REFINE-01/02 | The design contract (A2-refine.png) may specify a specific curated set of preset cards; verify against it. |

## Open Questions

1. **REFINE-01 "changing size re-renders preview live" vs D-04 "size change → stale + Recompute CTA".**
   - What we know: Card drill counts + inches update live (pure). D-04 explicitly gates the worker re-match behind the Recompute CTA (abort-race safety, Phase 22 D-04); the stale/recompute machinery already exists.
   - What's unclear: whether the size-change **preview** (canvas grid) is expected to update instantly, or only after Recompute (showing the last-good grid + stale banner meanwhile).
   - Recommendation: follow D-04 (the explicit, more recent decision) — cards + counts are live, the full-grid preview updates on Recompute. Flag to the user in discuss/plan-review since it is load-bearing for the keystone's feel. If instant preview is required, a small grid re-match may be acceptable given typical grid sizes, but that reopens the abort-race concern D-04 closed.

2. **Where does the "recommended" SizeCard preset list come from?** `STANDARD_SIZES` (App.tsx:48-65) mixes cm/inch/grid units; SizeCards need cols×rows. The planner should define a curated preset list (grid dims) — verify count/labels against the A2-refine.png design contract.

3. **Finish options for Order (ORDER-01).** The set of finish choices (and whether finish affects the quote) is not in the engine. Assumed a fixed UI enum with no price impact (matches "locked spec"); confirm against the design contract.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node + npm | build/test toolchain | ✓ (project already builds) | existing | — |
| Vite / Vitest / TypeScript / Preact | dev, test, typecheck | ✓ (in `package.json`) | existing | — |

No new external dependency is introduced. Nothing blocks execution.

## Validation Architecture

Skipped — `workflow.nyquist_validation` is `false` in `.planning/config.json`.

**Testing conventions to follow** (from codebase TESTING.md + StepBar.test.tsx):
- New screen tests are `src/features/screens/__tests__/<Screen>.test.tsx` with `// @vitest-environment jsdom` pragma (default env is `node`).
- Mirror `StepBar.test.tsx`: `render(<Screen {...props} />, container)` into a `document.createElement('div')`, assert DOM/a11y, `render(null, container)` in `afterEach`. Props are stubbed (`vi.fn()` callbacks). No real worker/canvas.
- Run gate: `npm test` (`vitest run`) + `npx tsc --noEmit` green before each commit. Existing suite is 240+ `it` cases (STATE reports 255 after Phase 20); it must stay green at every flag flip.
- The strangler flag itself is testable: a test can import `flags.ts` and assert the panel renders the new screen when its flag is on (or simply that both branches type-check and render).

## Security Domain

`security_enforcement: true`, ASVS level 1. This is a client-side, no-network, no-auth phase; most categories are N/A.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts/auth in the app. |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | No server, no protected resources. |
| V5 Input Validation | yes | Custom size inputs clamped (reuse existing `handleWidthChange`/`handleHeightChange` clamp precedent); loaded-project money sanitized at the boundary (`sanitizeMoney`, App.tsx:323-324). Ship-to fields are free text embedded in a client-only file — no injection sink since never transmitted or `innerHTML`'d. |
| V6 Cryptography | yes (light) | Packet id via `generateUUID()` CSPRNG (projectStore.ts:75-84) — never `Math.random()` for the id. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tampered/imported project money reaching render (`.toFixed`/`toCents` throw) | Denial of Service (white-screen) | `sanitizeMoney` at load boundary already applied (App.tsx:323-324, 1143-1146); Order/Supplies read pre-sanitized values. |
| Unpriced/`canvasPriced=false` rendered as $0 | Tampering / integrity of quote | Surface via existing banner + "est./unpriced" affordance; never a silent $0 (quote.ts:60-61, bagPlanner PRICE-02). |
| Ship-to free text | Info disclosure | Client-only, embedded in the downloaded file, never sent (D-08). No XSS sink as long as it is rendered as text (Preact escapes by default) and not via `dangerouslySetInnerHTML`. |
| localStorage quota on save/recents | DoS | Already handled non-throwing (`SaveResult`/`recents.save` eviction, projectStore.ts:136-197). |

## Sources

### Primary (HIGH confidence — live source, this session)
- `src/features/match/useDiamondArtMatch.ts` — hook surface, worker-effect deps, post-process memo, `detectedColorCount`, `restore`.
- `src/engine/quote.ts`, `src/engine/bagPlanner.ts`, `src/engine/density.ts`, `src/engine/color.ts`, `src/engine/projectStore.ts`, `src/engine/export.ts`, `src/engine/checkout.ts` — engine signatures + shapes.
- `src/ui/{SizeCard,SegmentedControl,Slider,Pill,Button}.tsx` — primitive prop contracts.
- `src/App.tsx` — state ownership, `data-step-panel` slots (1406-1526), match-hook call (482-493), soft-invalidate/Recompute (507-532), supply/quote derivations (1076-1201), ingest/load handlers (292-354, 855-968), AtelierShell wiring (1257-1289).
- `src/features/wizard/{AtelierShell,stepMeta,useWizard,StepBar.test}.tsx` — shell seam, step meta, wizard machine, test conventions.
- `.planning/phases/23-.../23-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/codebase/TESTING.md`, `.planning/config.json`.

### Secondary (MEDIUM confidence)
- Design contract at `C:\Users\rickf\OneDrive\Desktop\GemPixel\GEM PIXEL design review\design_handoff_ui_redesign\` (external absolute path; referenced per CONTEXT `<canonical_refs>` but not read this session — planner/implementer should consult A2-refine.png for the keystone layout).

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack / signatures: HIGH — read verbatim from live source at cited lines; engine frozen.
- Architecture / two-tier seam: HIGH — worker-effect deps vs memo deps confirmed in source.
- Strangler mechanism: HIGH — slot structure read; grep confirms no existing flag system.
- Order-packet schema: MEDIUM — field naming is explicit Claude's-discretion; no existing JSON export to mirror (only the download idiom).
- Design-contract layout specifics: MEDIUM — external handoff not read this session.

**Research date:** 2026-07-14
**Valid until:** 2026-08-13 (stable — internal codebase, frozen engine; re-verify only if App.tsx line numbers shift before planning)

## RESEARCH COMPLETE
