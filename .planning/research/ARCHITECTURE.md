# Architecture Research

**Domain:** Client-side image → diamond-art planner — v4.0 canvas-first redesign inside an existing Preact/Vite codebase (integration, not rewrite)
**Researched:** 2026-07-13
**Confidence:** HIGH (grounded in the actual source: `src/App.tsx`, `src/features/*`, `src/engine/*`; the design handoff README)

## TL;DR (for the roadmapper)

The engine and the hook layer are already clean, pure seams and do **not** need to change to support the redesign — with three small, additive exceptions (detected-color-count exposure, a color-count target reducer, and a quote selector). The redesign is overwhelmingly a **presentation/shell rework**: dissolve the three-column (left control panel · canvas · right legend) shell into a canvas-first top-bar-navigated 4-step flow, and re-slice the existing four "steps" into the design's four (Upload → Refine → Supplies → Order).

**Recommended approach:** strangler. Keep `App.tsx` as the single state owner (it already is), keep the `Step*` children pure/props-only (they already are), build **new** screen components alongside the old ones, and swap the render tree behind a flag. The existing pure engine boundary (worker → substitution → smoothing → `planOrderSupply`) is preserved verbatim.

---

## Standard Architecture

### System Overview (target after redesign)

```
┌──────────────────────────────────────────────────────────────────────┐
│  DESIGN-SYSTEM LAYER  (src/styles/atelier.css + Tailwind v4 @theme)    │
│  Atelier tokens (bg #F4F1E9, accent #0E6E5C), fonts, radii, shadow     │
├──────────────────────────────────────────────────────────────────────┤
│  UI PRIMITIVES  (src/ui/)                                              │
│  ┌──────────┐ ┌───────────────┐ ┌────────┐ ┌─────────┐ ┌───────────┐  │
│  │ StepNav  │ │SegmentedControl│ │ Slider │ │ SizeCard│ │ Pill/Btn  │  │
│  └──────────┘ └───────────────┘ └────────┘ └─────────┘ └───────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│  SCREENS  (src/features/journey/) — pure, props-only                   │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌─────────┐                   │
│  │ Upload  │  │ Refine  │  │ Supplies │  │  Order  │                   │
│  │ Screen  │  │ Screen★ │  │  Screen  │  │  Screen │                   │
│  └─────────┘  └─────────┘  └──────────┘  └─────────┘                   │
├──────────────────────────────────────────────────────────────────────┤
│  SHELL + STATE OWNER  (src/App.tsx)                                    │
│  owns all useState; useWizard (step machine); wires handlers as props  │
├──────────────────────────────────────────────────────────────────────┤
│  HOOKS  (composition seams — mostly UNCHANGED)                         │
│  ┌────────────────────┐  ┌───────────┐  ┌───────────────────┐         │
│  │ useDiamondArtMatch  │  │ useWizard │  │ usePersistentState│         │
│  │ (worker→sub→smooth) │  │           │  │                   │         │
│  └─────────┬──────────┘  └───────────┘  └───────────────────┘         │
├────────────┼───────────────────────────────────────────────────────── ┤
│  ENGINE  (pure, no Preact/DOM — UNCHANGED except additive)             │
│  color.ts · smoothing.ts · ingest(worker) · palette · variants ·      │
│  bagPlanner(planOrderSupply)★ · money.ts★ · viewer.ts · symbols ·     │
│  checkout.ts · projectStore · safeStorage    (★ = single-SoT anchors)  │
└──────────────────────────────────────────────────────────────────────┘
       new engine additions: quote.ts (NEW) · color-count target reducer
```

### Component Responsibilities (target)

| Component | Responsibility | New / Modified / Unchanged |
|-----------|----------------|----------------------------|
| `engine/*` (color, smoothing, palette, variants, bagPlanner, money, viewer, symbols, worker) | Pure logic; the matching pipeline + supply/cost single source | **UNCHANGED** (worker contract intact) |
| `engine/quote.ts` | cols→inches + curated canvas cost table + shipping + tax estimate, integer-cents; the one order-total source | **NEW** |
| color-count target reducer (add to `engine/color.ts`) | Merge rarest colors into nearest neighbor until N distinct remain | **NEW** (sits beside `substituteLowCountColors`) |
| `useDiamondArtMatch` | image→grid pipeline; **also expose `detectedColorCount`** and accept a color-count target | **MODIFIED (additive)** |
| `useWizard` | 4-step machine (`step`, `canEnter`, `next/back/goTo`) | **UNCHANGED** (already models exactly the 4 steps) |
| `App.tsx` | State owner + handler factory; render-tree swap to canvas-first shell | **MODIFIED** (shell only; state stays) |
| `features/journey/UploadScreen` | Centered dropzone + recents | **NEW** (re-slice of Step1's ingest half) |
| `features/journey/RefineScreen` ★ | Canvas hero + always-open rail: size cards, edge-cleanup seg, color-count slider | **NEW** (fuses Step1 size + smoothing + substitution) |
| `features/journey/SuppliesScreen` | Supply/legend table + order-summary panel | **NEW** (re-slice of right `<aside>` + Step3 cost) |
| `features/journey/OrderScreen` | Confirm: locked spec + finish + address + price breakdown | **NEW** (re-slice of Step3 order + Step4) |
| `ui/*` primitives | StepNav, SegmentedControl, Slider, SizeCard, Pill, Button | **NEW** |
| `styles/atelier` tokens | Light-only Atelier tokens + fonts | **NEW** (partly present already) |
| existing `Step1Ingest…Step4Export`, left/right `<aside>` chrome, theme toggle | — | **RETIRED** at the end of strangle |

---

## Recommended Project Structure

```
src/
├── styles/
│   └── atelier.css          # NEW: @theme tokens, @font-face, global light theme
├── ui/                      # NEW: shared, pure, dumb primitives
│   ├── StepNav.tsx          #   the ONLY navigator (desktop bar + mobile progress)
│   ├── SegmentedControl.tsx #   edge-cleanup Off/Light/Med/Strong (+ any seg)
│   ├── Slider.tsx           #   color-count slider
│   ├── SizeCard.tsx         #   size option w/ live drill count + BEST tag
│   ├── Pill.tsx  Button.tsx SpecRow.tsx
├── features/
│   ├── journey/             # NEW: the 4 canvas-first screens (pure, props-only)
│   │   ├── UploadScreen.tsx
│   │   ├── RefineScreen.tsx     ★ canvas + always-open refine rail
│   │   ├── SuppliesScreen.tsx
│   │   ├── OrderScreen.tsx
│   │   └── AppShell.tsx         # top bar + StepNav + <Save>; renders active screen
│   ├── wizard/              # useWizard stays; old steps retired at end
│   └── match/               # useDiamondArtMatch (additive change only)
├── engine/                  # unchanged + quote.ts (NEW) + color-count reducer
│   └── quote.ts             # NEW single-source order quote (integer cents)
├── hooks/
│   ├── usePersistentState.ts
│   └── useOrderQuote.ts     # NEW thin selector: (orderPlan, cols, rows) → quote
└── App.tsx                  # state owner; render tree swaps to <AppShell/>
```

### Structure Rationale

- **`ui/` vs inline:** the segmented control appears in Refine (edge cleanup) and again on mobile; the slider, step-nav, size card, and pills all recur. Extracting them once kills the Tailwind-soup duplication that made the old `Step*` files hard to read, and gives one place to apply Atelier tokens. **Recommend shared primitives, not inline.**
- **`features/journey/` (new) beside `features/wizard/` (old):** strangler isolation — the two trees never fight; the old one is deleted only after the new one passes UAT. Screens stay pure/props-only, exactly like today's `Step*`.
- **`engine/quote.ts` (new module, not inline in App):** mirrors the `planOrderSupply` precedent — a pure aggregator is the *only* place numbers are computed, so Supplies and Order literally read the same object.

---

## Architectural Patterns

### Pattern 1: Strangler shell swap, state owner unchanged

**What:** `App.tsx` keeps owning every `useState`/`useMemo`/handler (it already does — ~2450 lines of state + derivations). Only the JSX return changes: replace the `<aside>left · <main>canvas · <aside>right` three-column tree with `<AppShell>` that renders one journey screen per `wizard.step`. New screens receive the same props the old `Step*` received.

**When:** subsequent-milestone redesigns where the state model is sound but the layout is being reimagined.

**Trade-offs:** App.tsx stays large during transition (acceptable; optionally extract a `useProjectController()` hook later to shrink it — not required for the redesign). Zero engine risk.

```tsx
// AppShell renders exactly one screen; StepNav is the sole navigator.
<AppShell step={wizard.step} nav={wizard}>
  {wizard.step === 1 && <UploadScreen {...uploadProps} />}
  {wizard.step === 2 && <RefineScreen {...refineProps} />}   {/* canvas + rail */}
  {wizard.step === 3 && <SuppliesScreen {...suppliesProps} />}
  {wizard.step === 4 && <OrderScreen {...orderProps} />}
</AppShell>
```

### Pattern 2: Pure transforms inside the match hook (already the law here)

**What:** edge-cleanup (`smoothing.smoothMatches`) and color reduction (`color.substituteLowCountColors`) are **already** pure engine functions run in a `useMemo` *after* the worker returns, in `useDiamondArtMatch`. The worker contract (raw match) is never touched. The redesign's "edge cleanup" and "color count" controls are just new UI over inputs that already flow into this exact seam.

**When:** any Refine transform that must re-render the chart. Add it as a pure `engine/` function invoked in the same post-worker `useMemo`; never move it into the worker, never make it stateful.

**Trade-offs:** transforms re-run on every relevant input change (cheap; grids are ≤ ~10k cells and this already ships). Keeps determinism + testability.

```ts
// useDiamondArtMatch.ts (existing pipeline — DO NOT restructure):
let { matches, counts } = rawMatchResult;             // worker output
if (enableSubstitution) ({matches,counts} = substituteLowCountColors(...)); // color reduce
if (enableSmoothing)   ({matches,counts} = smoothMatches(matches,cols,rows,strength)); // edges
```

**Mapping the design controls onto existing inputs:**
- **Edge cleanup 4-seg** `Off/Light/Med/Strong` → `enableSmoothing=false` / `smoothingStrength = 1|2|3`. Already fully supported — pure UI wiring, no engine change.
- **Color-count slider** → see Pattern 3 (needs one additive engine function).

### Pattern 3: Color-count slider = new target reducer (the one real engine addition for Refine)

**What:** today's `substituteLowCountColors(matches, counts, candidates, threshold)` merges every color with `count ≤ threshold` into its nearest-Lab high-count neighbor. The design's slider is a **target count N** (floor 8 → detected max), not a threshold. Add a sibling pure function that iteratively merges the currently-rarest color into its nearest used neighbor until exactly `N` distinct colors remain, reusing the same `getColorDistance(lab,lab)` machinery.

**Detected color count (drives the slider max):** = number of distinct codes in the **raw** worker output, *before* substitution/smoothing: `Object.keys(rawMatchResult.counts).length`. Expose it from `useDiamondArtMatch` as `detectedColorCount`. The caption "24 of 26 matched" = `target 24` of `detected 26`.

```ts
// engine/color.ts (NEW, additive — leave substituteLowCountColors intact):
export function reduceToColorCount(
  gridCodes: string[], counts: Record<string,number>,
  activeCandidates: DmcColor[], targetCount: number
): { codes: string[]; counts: Record<string,number> } { /* merge rarest→nearest until N */ }
```

**When:** wire the slider value as `targetColorCount` through the hook; when `target >= detected`, it's a no-op (all colors kept). Default the handle near the top (merge only the rarest one-offs), matching the design.

**Trade-offs:** keeps the existing threshold substitution available (or retire it once the slider ships); the reducer is O(merges × colors), trivial for tens of colors.

### Pattern 4: Single-source quote selector (numbers can't diverge)

**What:** create `engine/quote.ts` + `useOrderQuote(orderPlan, cols, rows, opts)` — the *only* place the order total is assembled: drill cost (`orderPlan.optimizedCostCents`) + canvas print (cols→inches curated cost table) + shipping + tax estimate, all in **integer cents via `money.ts`**. Both `SuppliesScreen` (Est. total) and `OrderScreen` (Total today) read the same returned object. This is the `planOrderSupply` pattern extended to the whole order.

**When:** always — the design explicitly requires Supplies "Est. total" and Order "Total today" to be identical.

```ts
// engine/quote.ts (NEW):
export interface OrderQuote {
  canvasCents: number; shippingCents: number; taxCents: number;
  drillsCents: number; totalCents: number; sizeIn: { w: number; h: number };
}
export function buildQuote(orderPlan: OrderSupplyPlan, cols: number, rows: number, ...): OrderQuote
```

**Trade-offs:** cols→inches uses the established 10-dots/inch rule (`cols/10`), already used in `sizingAdviceData` and `calculateCanvasCost(unit='grid')`. For v4.0 the product is a single locked "Rolled Canvas" price (curated table), replacing the vendor dropdown for the customer flow — but `calculateCanvasCost` can be reused as the table backend. Tax is an *estimate* line (design says "calculated next"), not a real tax engine.

### Pattern 5: One responsive tree via container queries (mobile)

**What:** Storyboard B is literally Storyboard A's four screens in one portrait column — "everything inline, never in a drawer." Because the redesign *already* dissolves side menus into the inline flow, desktop and mobile differ only in layout (side rail vs stacked). Build **one component tree** per screen; collapse the rail to a stacked column at a breakpoint using Tailwind v4 container queries (`@container`).

**When:** here. **Recommend one tree, not separate mobile components** — separate trees double the maintenance and invite the exact "inline vs drawer" divergence the design forbids (and the dev profile flags regressions/divergence as a top frustration).

**Trade-offs:** a few `@container` breakpoints per screen; the canvas viewer already fits-to-container so it adapts for free.

---

## Data Flow

### Design shapes → existing state (the mapping the roadmapper needs)

```
DESIGN "project draft"              EXISTING state (App.tsx)                         action
──────────────────────────────────────────────────────────────────────────────────────────
image                             → image: HTMLImageElement                         unchanged
size (cards + custom)             → selectedPreset / cols / rows / unit             re-skin as SizeCards
  size → grid dims → inches       → cols/rows ; inches = cols/10 (sizingAdviceData) reuse
cleanup level (Off/Light/Med/Str) → enableSmoothing + smoothingStrength (0..3)      re-skin as SegmentedControl
color-count value                 → NEW targetColorCount  (was substitutionThreshold) new input → reducer
detected palette / detected count → NEW detectedColorCount = |raw worker counts|    expose from hook
──────────────────────────────────────────────────────────────────────────────────────────
DESIGN "computed chart/legend/supply"
computed chart                    → matchResult (post substitution+smoothing)       unchanged
legend rows {symbol,hex,dmc,name, → sortedMatches (built from planOrderSupply.rows   unchanged
   drills, safety, bags}              + symbolMap + DMC_PALETTE join)
supply plan / totals              → orderPlan = planOrderSupply(counts,shape,priceDb) unchanged (SoT)
──────────────────────────────────────────────────────────────────────────────────────────
DESIGN "resolved order"
spec (product LOCKED, size, finish)→ product='rolled_canvas' const; size from grid;  NEW finish state
                                     finish: NEW local state (default 'trimmed')
address                           → NEW local state (client-side only this milestone) NEW
price breakdown                   → useOrderQuote(orderPlan,cols,rows) (integer cents) NEW selector
```

### Refine live-update flow (the key screen)

```
size card / custom  ─┐
edge-cleanup seg    ─┤
color-count slider  ─┴─→ App state ─→ useDiamondArtMatch
                                        worker(match)              [only re-runs on image/dims/palette]
                                        → reduceToColorCount()     [pure, on target change]
                                        → smoothMatches()          [pure, on cleanup change]
                                        → matchResult, detectedColorCount, symbolMap
                                        → viewer.setData(...)      [canvas re-renders]
                                        → planOrderSupply(counts)  [drives Supplies + quote]
```

Note: changing size (cols/rows) *does* re-run the worker; changing cleanup or color-count only re-runs the pure post-worker `useMemo`. This is already how the hook is keyed (`[image,cols,rows,candidatesKey]`), so drill-count-per-size updates and cleanup/color live-preview are both already cheap.

---

## Integration Points

### Internal boundaries (respect these — they already exist and work)

| Boundary | Communication | Notes |
|----------|---------------|-------|
| App ↔ Screens | props only (state + handlers down) | keep `Step*`/screens pure; no engine imports for state, only types |
| App ↔ `useDiamondArtMatch` | inputs object → `{matchResult, symbolMap, detectedColorCount★, loading, restore}` | add `detectedColorCount` + `targetColorCount` input; do not touch worker seam |
| Hook ↔ worker | `MatcherClient` inline `new Worker(new URL('./matcher.worker.ts', import.meta.url))` | **DO NOT** decouple the URL — that regression shipped the worker as raw `.ts` (see CLAUDE/memory). Keep inline. |
| Any screen ↔ money | via `orderPlan` + `useOrderQuote` only | never re-add floats; `money.ts` integer cents is the invariant |
| Supplies ↔ Order totals | both read one `OrderQuote` | single source — the design's hard requirement |

### External services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Print lab (Lumaprints) API + payments | — | **OUT OF SCOPE (v5.0).** Order step is a client-side confirm/handoff only. |
| Server-side chart render, asset storage, shipment tracking, sourcing (Storyboard C) | — | **OUT OF SCOPE (v5.0).** |
| Canvas cost | curated cost table (`engine/quote.ts` / `calculateCanvasCost`) | no live vendor rate API this milestone |
| Fonts | Newsreader / Pixelify Sans / Archivo / JetBrains Mono | Google Fonts link or self-host in `styles/atelier.css` |

---

## Anti-Patterns

### Anti-Pattern 1: Rewriting the pipeline / moving transforms into the worker
**What people do:** "refactor" edge-cleanup or color reduction into `matcher.worker.ts` for speed.
**Why it's wrong:** breaks the pure, synchronously-testable post-worker `useMemo` seam; forces the worker to re-run on every slider tick (it currently only re-runs on image/dims/palette). Reintroduces the exact worker-bundling fragility called out in memory.
**Do this instead:** add pure `engine/` functions to the existing post-worker `useMemo` (Patterns 2–3).

### Anti-Pattern 2: A second place that computes money
**What people do:** OrderScreen re-sums canvas + drills locally to show "Total today."
**Why it's wrong:** guaranteed divergence from Supplies "Est. total" (the v3.0 pricing bugs were exactly this class).
**Do this instead:** one `useOrderQuote`/`planOrderSupply` object, integer cents, read by both (Pattern 4).

### Anti-Pattern 3: Separate mobile component tree / any drawer
**What people do:** build `MobileRefine.tsx` with a bottom-sheet for the rail.
**Why it's wrong:** the design's guiding principle is "never open a side menu"; two trees drift.
**Do this instead:** one tree, container queries collapse the rail to a stacked inline column (Pattern 5).

### Anti-Pattern 4: Editing `Step1..4` in place
**What people do:** mutate the existing steps toward the new look.
**Why it's wrong:** the re-slice is non-1:1 (Refine fuses size+cleanup+color; Supplies fuses the right aside+cost), and in-place edits make rollback impossible and mix dark-`slate-*` with Atelier.
**Do this instead:** new `features/journey/` screens; delete old steps only after UAT (strangler).

---

## Suggested Build Order (dependency-ordered)

1. **Atelier design-system tokens + fonts (foundation).** `styles/atelier.css` with Tailwind v4 `@theme` tokens (bg `#F4F1E9`, surface `#FCFAF4/#FFF`, ink `#1B1A17`, accent `#0E6E5C`, borders, radii, shadow) + the four fonts. **Retire dark mode**: drop the `theme` persistent state + `data-theme` effect + the theme toggle; delete `slate-*` usage as screens are built. *(Note: partial Atelier aliases — `bg-panel`, `text-ink`, `text-accent`, `btn-chunk`, `gem-logo`, `--gem-*` — already exist and default `theme='light'`; consolidate, don't reinvent.)*
2. **Shared UI primitives (`src/ui/`).** StepNav, SegmentedControl, Slider, SizeCard, Pill, Button, SpecRow. Depends on (1). Unblocks every screen.
3. **New canvas-first shell (`AppShell`) + StepNav-only navigation.** Strangler swap: render `<AppShell>` instead of the three-column tree, behind a flag. App.tsx stays the state owner; `useWizard` already provides `step/canEnter/next/back/goTo`. Retire the left/right `<aside>` chrome and the dual step-navs. Depends on (2).
4. **Engine additions (parallelizable with 2–3).**
   - `useDiamondArtMatch`: expose `detectedColorCount` (raw distinct); accept `targetColorCount`.
   - `engine/color.ts`: add `reduceToColorCount` (target-based merge).
   - `engine/quote.ts` + `hooks/useOrderQuote.ts`: single-source integer-cents order total (cols→inches + curated canvas table + shipping + tax estimate).
5. **Screens, in flow order (depend on 2 + 4):**
   - **UploadScreen** — centered dropzone + recents (re-slice Step1 ingest half). Move size OUT of Upload into Refine.
   - **RefineScreen ★** — canvas hero + always-open rail: SizeCards (live drill counts), edge-cleanup SegmentedControl, color-count Slider (`min 8 … max detectedColorCount`). The rail is a panel, **not a drawer** — its inputs are lifted App state (already are). Depends on the (4) color-count reducer + detected count.
   - **SuppliesScreen** — supply/legend table from `orderPlan.rows` (+ `symbolMap` + DMC join) + 320px order-summary reading `useOrderQuote`.
   - **OrderScreen** — locked spec (product=Rolled Canvas const, size from grid, finish default Trimmed), finish selection (new state), address card (new local state), price card from the **same** `useOrderQuote`.
6. **Mobile responsive pass.** Container-query breakpoints per screen collapse rails to stacked columns; verify zero drawers. Depends on (5).
7. **Retire & clean up.** Delete `Step1Ingest…Step4Export`, the old asides, the theme toggle, and the resources modal if unused. **Open decisions to route** (not obvious from the 4 design screens): where do **kit selection** (`selectedBaseKit` 100/200/all) and **color exclusions** (`excludedColors`, Step2Palette) go? — the customer flow has no palette step; recommend sane defaults (kit `all`) and either drop the exclude UI or tuck it under a Refine "advanced" disclosure. Same question for **drillStyle** (square/round, still needed for bag variant mapping) and **drillType** — default `square`/`standard`, optionally surface minimally in Refine or Order.

---

## Scaling Considerations

Not a user-scale problem — 100% client-side, one user, one image at a time. The only "scale" axis is **grid size** (cols×rows), already handled: off-main-thread worker decode/match, box-sampling, and pure O(n) transforms. The redesign adds no new hot paths; the color-count reducer and quote selector are O(colors) (tens), not O(cells). No architectural change needed for size.

## Sources

- `src/App.tsx`, `src/features/wizard/{useWizard,steps/*}`, `src/features/match/useDiamondArtMatch.ts` — actual state/handler/prop surfaces (HIGH)
- `src/engine/{bagPlanner,color,smoothing,checkout,money}.ts` — pure pipeline + single-source aggregators (HIGH)
- Design handoff `README.md` — per-screen State/Data shapes + canvas-first principle (HIGH)
- `.planning/PROJECT.md` + memory — milestone scope boundary (frontend-only, backend→v5.0), worker-bundling regression note (HIGH)

---
*Architecture research for: GemPixel v4.0 canvas-first redesign (integration inside existing Preact/Vite codebase)*
*Researched: 2026-07-13*
