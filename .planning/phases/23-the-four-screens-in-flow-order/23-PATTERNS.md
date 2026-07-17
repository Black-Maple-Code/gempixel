# Phase 23: The Four Screens in Flow Order - Pattern Map

**Mapped:** 2026-07-14
**Files analyzed:** 11 (6 new components/modules + 4 new tests + 1 modified App.tsx)
**Analogs found:** 10 / 11 (only `flags.ts` has no in-repo analog — by design)

> All four screens are **pure / props-only** (Phase 23 D-01). The dominant analog for
> the whole phase is the shipped `StepBar.tsx` (props-only, `<Component>Props` interface
> immediately above a named-export function, no `useState`, no engine imports) plus the
> `src/ui/*` primitives (identical prop-interface + `cn()` conventions). Every displayed
> figure is **computed in App and passed as a prop** — screens derive nothing.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/features/screens/UploadScreen.tsx` | component (screen) | file-I/O + event-driven | `src/features/wizard/steps/Step1Ingest.tsx` (props-bag) + `StepBar.tsx` (pure shape) | role-match |
| `src/features/screens/RefineScreen.tsx` | component (keystone) | request-response (worker) + transform (post-process) | `Step2Palette.tsx`/`Step3Canvas.tsx` (controls) composing `src/ui/SizeCard.tsx`, `SegmentedControl.tsx`, `Slider.tsx`, `Pill.tsx` | role-match |
| `src/features/screens/SuppliesScreen.tsx` | component (screen) | transform (read-only aggregation) | supply-table join in `src/App.tsx:1079-1104` + `Step4Export.tsx` | partial (markup lives inline in App today) |
| `src/features/screens/OrderScreen.tsx` | component (screen) | file-I/O (download) + transform | `Step4Export.tsx` + `export.ts:260-288` download idiom | role-match |
| `src/features/screens/flags.ts` | config (module) | — | **none in repo** (no feature-flag system) | no analog |
| `src/App.tsx` (modified) | container / state owner | — | existing `data-step-panel` slots `:1406-1526` | exact (edit-in-place) |
| `src/features/screens/__tests__/*.test.tsx` (×4) | test | — | `src/features/wizard/__tests__/StepBar.test.tsx` | exact |

## Shared Conventions (apply to ALL four screens)

Extracted from `StepBar.tsx` and every `src/ui/*` primitive — replicate exactly:

1. **`<Component>Props` interface immediately above the component**, named export, no default export.
   Source: `StepBar.tsx:18-36`, `SizeCard.tsx:4-25`.
2. **Pure / props-only** — no `useState` for domain data, no engine imports beyond types.
   Prefer zero local state; trivial presentational UI state (e.g. a `<details>` is native, needs none).
   Source: `StepBar.tsx:1-2` (imports only `STEP_META`), doc comment `:6-9`.
3. **`cn()` from `src/ui/cn.ts`** for class merging (plain string join, no tailwind-merge). Primitives take **literal string** classNames only. Source: `cn.ts:12-14`; every primitive imports `import { cn } from './cn'` (`SizeCard.tsx:2`).
4. **Atelier tokens only** — `text-ink`/`text-muted`/`text-faint`, `bg-panel`/`bg-panel-2`, `bg-accent`/`text-on-accent`, `border-border`/`border-border-2`, `bg-warn`. Radius via `rounded-[var(--radius-card|control|pill)]` (the `--radius-*` tokens are NOT exposed via `@theme inline`). Source: `Pill.tsx:22-26`, `Button.tsx:21-25`, `SizeCard.tsx:58-59`.
5. **JSDoc block above the component** stating PURE/props-only + which D-* decision it satisfies. Source: `StepBar.tsx:3-17`, `SizeCard.tsx:27-40`.
6. **a11y native-first** — `aria-current`, `aria-pressed`, `aria-disabled`, `role="radiogroup"`, native `<button type="button">`. Source: `StepBar.tsx:70-72`, `SizeCard.tsx:53-55`, `SegmentedControl.tsx:62`.
7. **JetBrains Mono for data/labels** — `font-mono uppercase tracking-wider text-[10px]/[11px]` for micro-labels; accent green (`text-accent`) for key figures. Source: `StepBar.tsx:74`, `SizeCard.tsx:67,72`.

## Pattern Assignments

### `src/features/screens/UploadScreen.tsx` (component, file-I/O + event-driven)

**Analog (shape):** `src/features/wizard/StepBar.tsx` · **Analog (prop-bag + ingest handlers):** `src/features/wizard/steps/Step1Ingest.tsx` (see the prop-drill list at `App.tsx:1407-1446`).

**Props-bag pattern** — App already passes the full ingest surface to `Step1Ingest`; UploadScreen takes the SAME props MINUS the size fields (moved to Refine, D-10). Reuse these from `App.tsx:1406-1446`:
```tsx
// KEEP for UploadScreen:
image, imageName, dropZoneRef, isDragOver,
recentImages, loadRecentImage, deleteRecentImage,   // raw recents (App.tsx:179,940,465)
handleFileChange, handleDragOver, handleDragLeave, handleDrop,   // ingest (App.tsx:855-938)
imageFitMode, setImageFitMode,
// ADD: projectsRegistry (App.tsx:143) + loadProject (App.tsx:292-354) for the D-10 recent-projects chips
// DROP: standardSizes, selectedPreset, unit, width/heightInput, cols/rows, drillStyle, preset/size handlers
```

**Recent-projects list (D-10, UPLOAD-01):** inline list from `projectStore.list(): ProjectSummary[]` (`{ id, name, thumbnail, dateModified }`), exposed today as `projectsRegistry` state. Clicking a chip calls `loadProject(id)` → rehydrates + `restore(...)` (no worker run). See RESEARCH §"projectStore Recent-Projects API".

**Interface style** — copy `StepBarProps` verbatim shape (`StepBar.tsx:18-36`): interface above component, doc-commented props.

---

### `src/features/screens/RefineScreen.tsx` (keystone — worker tier + post-process tier)

**Analogs:** `Step2Palette.tsx`/`Step3Canvas.tsx` (control groupings), composing `src/ui/SizeCard.tsx`, `SegmentedControl.tsx`, `Slider.tsx`, `Pill.tsx`, `Button.tsx`.

**SizeCard composition (D-05, Pattern 2 — App derives, card renders):**
```tsx
// App computes via gridToInches + formatInches (density.ts), passes as strings:
<SizeCard
  label={preset.label}
  gridDims={`${preset.cols}×${preset.rows} grid`}
  inches={`${formatInches(widthIn)} × ${formatInches(heightIn)} in`}
  drillCount={preset.cols * preset.rows}
  selected={cols === preset.cols && rows === preset.rows}
  onSelect={() => onSelectSize(preset.cols, preset.rows)}
  tag={preset.tag}   // "BEST" → Pill variant="tag" recipe inside SizeCard
/>
```
`SizeCard` contract (`SizeCard.tsx:4-25,41-74`): dumb, `aria-pressed={selected}`, selected = `border-accent bg-[#EAF2EF]` (`:59`). NO derivation in the card.

**Edge-cleanup — `SegmentedControl<'0'|'1'|'2'|'3'>` (`SegmentedControl.tsx:10-46`):** controlled `value`/`onChange`/`options`/`label`. Maps onto the already-wired `enableSmoothing`+`smoothingStrength` App state (`App.tsx:491-492`). Off→`enableSmoothing=false`; 1/2/3→strength. Worker never re-fires (post-process tier).

**Color slider — `Slider` (`Slider.tsx:38-68`):** controlled native range using **`onInput`** (not `onChange` — Preact freezes mid-drag, `Slider.tsx:58-59`). Props: `value`, `onChange` (primitive's numeric callback), `min={8}`, `max={detectedColorCount}`, `ariaLabel`, `ariaValueText`. **`max = detectedColorCount`** from the hook (stable under drag — `useDiamondArtMatch.ts:49-57`), NOT `matchResult.counts` length.

**Advanced disclosure (D-06):** native `<details>` + `.caret-icon` (zero-JS, a11y-native — matches project "browser-native first" directive). Holds kit (`selectedBaseKit`, default 'all'), color-exclusion (`excludedColors`/`toggleColorExclusion`), drill-shape (`drillStyle`, default 'square'). Existing state at `App.tsx:185-188`.

**Two-tier reactivity seam (D-03/D-04) — the load-bearing wiring:**
- **Size = worker tier.** `onSelectSize` sets live `cols`/`rows` only. It must NOT re-fire the worker per click. The existing soft-invalidate flow owns re-match: divergence of live vs committed `matchInputs` → `isStale` (`App.tsx:507-510`) → `staleFromStep=2` → "Recompute match" CTA (`handleRecomputeMatch`, `App.tsx:522-532`) commits once. RefineScreen takes `stale`/`onRecompute` props (mirror `StepBar`'s `stale` prop, `StepBar.tsx:33`).
- **Edge-cleanup + color slider = post-process tier.** Live every tick, no worker re-fire, no staleness. `smoothingStrength`/`enableReduce`/`targetColorCount` live only in the hook's `matchResult` memo deps.

---

### `src/features/screens/SuppliesScreen.tsx` (component, read-only aggregation)

**Analog:** the supply-table join currently inline in `App.tsx:1079-1104` (`sortedMatches`) + `Step4Export.tsx`.

**Row join pattern (SUPPLIES-01) — replicate `App.tsx:1079-1104` (do not recompute, consume props):**
```tsx
// App computes orderPlan = planOrderSupply(matchResult.counts, drillStyle, priceDb)  (App.tsx:1076)
// then joins each row → { code, name, hex, safety, packets, bagsText, hasUnpricedSize }:
const colorInfo = DMC_PALETTE.find(c => c.dmc === code);   // name + hex
const safety = Math.ceil(Math.round(count * 110) / 100);   // +10% safety (App.tsx:1088)
// symbol glyph from symbolMap[code]
```
SuppliesScreen renders these pre-joined rows verbatim: symbol chip · swatch (`hex`) · DMC code (mono bold) + name (muted) · drills incl. +10% · bags (`bagsText`, accent mono).

**"Why these bags?" (D-07):** native `<details>`, body = static `DYE_LOT_WHY_SENTENCE` (`App.tsx:26`).

**Order-summary panel (SUPPLIES-02, D-07):** render `buildOrderQuote(...).lineItems` **verbatim** + `.totalCents`. **App must add** `const orderQuote = buildOrderQuote({ supplyPlan: orderPlan, canvasBaseCost, vendor: selectedVendor })` (App does NOT call this today — legacy inline total at `App.tsx:1143-1148` stays for legacy Steps). `OrderQuote` shape: `lineItems: QuoteLineItem[]` (`{ key, label, cents, estimate, note? }`), `totalCents` (sum-by-construction), `canvasPriced`, `ratesAsOf` (`quote.ts:37-62`). **Zero local `.reduce` on cents** (D-07 anti-pattern).

**Honesty:** `canvasPriced === false` / `hasUnpricedSize` → "est./unavailable" affordance, never `$0`.

---

### `src/features/screens/OrderScreen.tsx` (component, file-I/O download + transform)

**Analog:** `Step4Export.tsx` (export/confirmation) + the download idiom in `export.ts:260-288`.

**Download idiom (ORDER-02) — mirror `triggerCanvasDownload` (`export.ts:260-288`) with a JSON Blob:**
```tsx
const blob = new Blob([JSON.stringify(packet, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const anchor = document.createElement('a');
anchor.href = url; anchor.download = `gempixel-order-${packetId.slice(0,8)}.json`;
document.body.appendChild(anchor); anchor.click(); document.body.removeChild(anchor);
setTimeout(() => URL.revokeObjectURL(url), 100);   // deferred revoke (export.ts:282-285)
```
> There is NO existing JSON-export module — `export.ts` only draws canvases/PNGs. Reuse ONLY the anchor+Blob+deferred-revoke idiom, not a serializer.

**Packet id:** `generateUUID()` (CSPRNG, `projectStore.ts:75-84`) — never `Math.random()`.

**Locked spec (ORDER-01):** size from `gridToInches(matchCols, matchRows)` (`density.ts`), "Rolled Canvas" fixed via `Pill variant="neutral"` "LOCKED", finish = new local Order UI state, itemized quote = same `buildOrderQuote` result as Supplies. Schema per RESEARCH §"Order Packet Serialization" (`schemaVersion`, `design`, `canvasSpec`, `gemBags`, `quote`, `shipTo`); field naming is Claude's discretion (D-08).

**Terminal state (D-09):** honest "Packet downloaded — take this to the vendor." **No order number, no receipt, no payment UI.** The mock's "Place order · $57.00" is explicitly NOT shipped.

---

### `src/features/screens/flags.ts` (config module — NO ANALOG)

No feature-flag system exists in the repo (grep-confirmed in RESEARCH). Simplest valid form — four plain `const` booleans (D-02 discretion):
```ts
// src/features/screens/flags.ts
export const USE_NEW_UPLOAD = false;
export const USE_NEW_REFINE = false;
export const USE_NEW_SUPPLIES = false;
export const USE_NEW_ORDER = false;
```
Each plan flips exactly ONE flag to `true` per commit (Pitfall 7). No typed record, no env plumbing.

---

### `src/App.tsx` (modified — strangler swap, edit-in-place)

**Analog:** the existing `data-step-panel` sibling slots at `App.tsx:1406-1526` (exact structure to preserve).

**Swap pattern (D-02, Pattern 3) — ternary INSIDE the always-mounted slot, legacy body untouched:**
```tsx
<div data-step-panel="2" className={wizard.step === 2 ? 'contents' : 'hidden'}>
  {USE_NEW_REFINE
    ? <RefineScreen {...refineProps} />
    : <Step2Palette {...step2Props} />}   {/* untouched until Phase 25 */}
</div>
```
**Critical (Pitfall 5):** keep the always-mounted CSS-toggle (`contents`/`hidden`, `App.tsx:1406`); the ternary swaps only inner content. The single `<CanvasViewer>` in `<main>` must NOT move into a screen or remount.

**Two new App state vars to add (REFINE-04 wiring):** `enableReduce` + `targetColorCount`, passed into the `useDiamondArtMatch({...})` call at `App.tsx:482-493` (currently omits them → reduce is a no-op, SC5). Also destructure `detectedColorCount` from the hook return (`useDiamondArtMatch.ts:49-57`) — App does not read it today.

**Add one derived value:** `const orderQuote = buildOrderQuote({ supplyPlan: orderPlan, canvasBaseCost, vendor: selectedVendor })` (`orderPlan` already at `App.tsx:1076`) for Supplies + Order (D-07). Do not touch the legacy `totalCostSafetyCents` (`App.tsx:1143-1148`).

---

### `src/features/screens/__tests__/*.test.tsx` (tests)

**Analog:** `src/features/wizard/__tests__/StepBar.test.tsx` (exact template).

**Test harness pattern (`StepBar.test.tsx:1-35`):**
```tsx
// @vitest-environment jsdom          ← REQUIRED pragma (default env is node)
import { render } from 'preact';
let container: HTMLDivElement;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
afterEach(() => { render(null, container); container.remove(); vi.restoreAllMocks(); });
const setup = (props) => { render(<Screen {...props} />, container); return { ...vi.fn()s, els: container.querySelectorAll(...) }; };
```
Assert DOM/a11y (`aria-*`, labels), stub callbacks with `vi.fn()`, no real worker/canvas. A flags test can import `flags.ts` and assert the correct branch renders. Run gate: `npm test` + `npx tsc --noEmit` green before each commit.

## Shared Patterns

### Derived-in-App, passed-as-prop (density / quote / supply)
**Sources:** `density.ts` `gridToInches`/`formatInches`, `quote.ts` `buildOrderQuote`, `bagPlanner.ts` `planOrderSupply`.
**Apply to:** all four screens. Screens render pre-computed strings/numbers; they import NO engine module (except types). SizeCard inches (Refine), line items (Supplies+Order), bag counts (Supplies) — all computed in App. (`SizeCard.tsx:27-40` doc explicitly forbids in-card derivation.)

### Client-side download (anchor + Blob + deferred revoke)
**Source:** `export.ts:260-288`.
**Apply to:** OrderScreen JSON packet. Reuse the idiom only; id via `generateUUID()` (`projectStore.ts:75-84`).

### Soft-invalidate / Recompute (Phase 20 D-13)
**Source:** `App.tsx:507-532` (`isStale`, `staleFromStep`, `handleRecomputeMatch`) + `StepBar.tsx:33,46,87-94` (amber stale marker).
**Apply to:** RefineScreen size tier only — takes `stale`/`onRecompute` props, never fires the worker itself.

### Honesty (never a silent $0)
**Source:** existing unpriced banner `App.tsx:1180-1201`; `quote.ts` `canvasPriced`; `bagPlanner` `hasUnpricedSize`.
**Apply to:** Supplies + Order — surface est./unavailable, never `$0`.

## No Analog Found

| File | Role | Reason |
|------|------|--------|
| `src/features/screens/flags.ts` | config | No feature-flag system exists in the repo; simplest form is four plain `const` booleans (D-02). Planner should NOT introduce a config/env system. |

Also note: the **Order JSON packet serializer** has no in-repo analog for the *serialization* (only the download idiom exists in `export.ts`). Schema is Claude's discretion per D-08 — use the RESEARCH §"Order Packet Serialization" sketch.

## Metadata

**Analog search scope:** `src/features/wizard/` (StepBar, steps, tests, AtelierShell), `src/ui/` (all primitives), `src/engine/` (export, quote, bagPlanner, density, projectStore, useDiamondArtMatch surfaces), `src/App.tsx` (panel slots 1406-1526, supply join 1076-1123, hook call 482-493, soft-invalidate 507-532).
**Files scanned:** 12 read + context from 23-CONTEXT.md / 23-RESEARCH.md / 23-UI-SPEC.md.
**Pattern extraction date:** 2026-07-14
</content>
</invoke>
