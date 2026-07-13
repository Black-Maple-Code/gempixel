# Project Research Summary

**Project:** GemPixel — v4.0 Canvas-First Redesign (Atelier)
**Domain:** Client-side photo -> diamond-art (gem-art) configurator + canvas-first quote/handoff flow, redesigned inside an existing Preact/Vite/Tailwind-v4 codebase
**Researched:** 2026-07-13
**Confidence:** HIGH

## Executive Summary

v4.0 is **not a greenfield build — it is ~90% presentation/shell rework of a tool that already works.** The color-matching worker, supply optimizer (planOrderSupply), pricing (money.ts), vendor cost table, symbols, exports, and persistence all ship today and stay untouched. The job is to dissolve the three-column (left controls, canvas, right legend) sidebar shell into a canvas-first, top-bar-navigated **4-step flow (Upload -> Refine -> Supplies -> Order)** in the new Atelier light-only design system, make it work on mobile, and quote accurately. All four research dimensions converged on the same verdict: keep the engine, re-skin the shell.

The recommended approach is a **strangler-fig, not a rewrite**. App.tsx remains the single state owner (it already is ~2,449 lines of state + derivations); the Step* children stay pure/props-only; new features/journey/ screen components are built alongside the old ones and swapped in behind a flag; old steps are deleted only after UAT. The 240+ Vitest baseline must stay green at every commit, and engine/* signatures must never change inside a UI phase. Near-zero new dependencies: the **only** runtime additions are three self-hosted @fontsource-variable/* webfonts (replacing external Google Fonts — a net privacy/perf win); every interactive primitive (segmented control, color-count slider, pills, step-nav) is hand-built from Tailwind + native elements, and PNG export uses native canvas.toBlob.

The two marquee Refine controls **already exist in the engine** and mostly need rewiring: edge cleanup = smoothing.ts::smoothMatches; drill-merge = color.ts::substituteLowCountColors. Only ~three *additive* engine changes are genuinely new: expose detectedColorCount, add a target-N reduceToColorCount (vs the existing threshold merge), and a single-source engine/quote.ts + selector so Supplies and Order totals cannot diverge. The key risks are all "recreating the mock too literally": a **load-bearing density decision** (the design inch labels contradict the engine 10 dots/inch density — drill counts are right, inches are fantasy), a **money single-source** requirement (canvas/shipping/tax must route through money.ts, not float sums), an **honesty constraint** on the Order step (no real payment/lab submission this milestone -> confirm/handoff only, tax labeled estimate, no fake receipt), and a **mobile gap** (canvas zoom is wheel-only; phones need pinch + touch-action).

## Key Findings

### Recommended Stack

Almost nothing new is needed at runtime. The validated base stack (Preact 10, Vite 6, TypeScript strict, Tailwind v4, culori, native Web Worker, money.ts, planOrderSupply, Canvas 2D viewer.ts) is fixed and NOT re-researched. The redesign is a re-skin + re-layout; the only genuinely new dependency is self-hosted webfonts, and every UI primitive the design calls for is browser-native or a few lines of Preact + Tailwind — consistent with the project documented "avoid heavy UI/font/util libs" and "browser-native first" stance.

**Core technologies:**
- @fontsource-variable/newsreader@5.2.10 + archivo@5.2.8 + jetbrains-mono@5.2.8 (self-host): the **only** new deps — replace the two external Google-Fonts @import lines; Vite bundles/fingerprints the woff2. (pixelify-sans optional — likely defer to v5.0 ops console.)
- Tailwind v4 (4.3.2) @theme tokens + **built-in container queries**: Atelier palette/radii/shadow tokens + component-level responsive reflow — do NOT install @tailwindcss/container-queries (redundant on v4).
- Native input type=range, hand-built SegmentedControl/StepNav/Pill/SizeCard, native canvas.toBlob('image/png'): zero-JS-dependency primitives; +0 KB JS runtime. Reject rc-slider, Radix/Headless (React-only), html2canvas, jsPDF.

### Expected Features

This is a UI/UX redesign of a working tool: most "new" customer features are re-presentations of existing engine capabilities. Only three are genuinely new computations: target-N color reduction, a customer quote breakdown, and an order packet/handoff.

**Must have (table stakes):**
- Horizontal 4-step nav as the *only* navigator (Upload->Refine->Supplies->Order) + validation gating (no Refine without image; no Supplies without a computed match) — new shell, pure UI state machine.
- Upload (drag-drop/browse + recent projects), live chart preview re-rendering on every control change — existing ingest.ts/projectStore.ts/useDiamondArtMatch.
- Supply/legend table (symbol, swatch, DMC, drills+10%, bags) + itemized price breakdown (canvas + shipping + tax estimate + total) before an honest order artifact — existing planOrderSupply/calculateCanvasCost/money.ts.
- Mobile single-column journey (same 4 steps inline, never a drawer) + Atelier light theme (retire dark mode).

**Should have (differentiators):**
- **Color-count slider, max = real DETECTED count** (Object.keys(rawMatch.counts).length); lowering merges orphan one-off drills into the CIEDE2000-nearest already-used shade with no visible change — the keystone honest-simplification feature.
- Live per-size drill counts on size cards; edge-cleanup 4-segment (Off/Light/Med/Strong -> strength 0/1/2/3); "Why these bags?" savings explainer; auto-filled LOCKED lab spec; detected-vs-matched transparency ("24 of 26 matched").

**Defer (v4.x / v5.0):**
- Delta-E guard on merges, custom-size input with clamps, richer finish-visualization proof (v4.x, add on validation).
- Real payment + Lumaprints API submission, server-side print render, real tax, order status/tracking, ops console (v5.0 — backend).

### Architecture Approach

Strangler shell swap: App.tsx keeps owning all state; only the JSX return changes — replace the three-column tree with an AppShell that renders one journey screen per wizard.step (useWizard already models exactly the 4 steps). New pure features/journey/ screens receive the same props the old Step* received. Extract shared src/ui/ primitives once (StepNav, SegmentedControl, Slider, SizeCard, Pill, Button). Post-worker transforms (edge cleanup, color reduction) stay pure engine/ functions in the existing useMemo — never moved into the worker.

**Major components:**
1. engine/* (color, smoothing, bagPlanner, money, viewer, worker) — **UNCHANGED**; the matching pipeline + supply/cost single source of truth.
2. Three additive engine changes — detectedColorCount exposure from useDiamondArtMatch; reduceToColorCount (target-N merge, sibling to substituteLowCountColors); engine/quote.ts + useOrderQuote selector (single integer-cents order total read by both Supplies and Order).
3. New presentation layer — styles/atelier.css tokens/fonts, src/ui/ primitives, features/journey/ screens (Upload, Refine*, Supplies, Order) + AppShell; old Step1..4, side asides, and theme toggle retired at the end.

### Critical Pitfalls

1. **Big-bang rewrite of the 2,449-line App.tsx** detaches engine wiring and never ships green — use strangler, keep engine/* untouched, land one step body at a time, never diff engine/* + UI in the same commit.
2. **Copying the mock illustrative inch numbers** (24x16 in / 80x53) ships a quote that contradicts the engine real 10-dots/inch density (80x53 = 8x5.3 in, not 24x16; drill counts ARE correct) — derive every inch/drill figure from grid dims via one helper; **resolve the density decision before building size cards.**
3. **Color-count merge breaks** (non-deterministic, visibly changes the picture, or de-syncs legend/cart/quote) — implement as a pure Delta-E-guarded function with the legend exact tie-break (frequency desc, localeCompare), feed one merged counts to viewer + legend + cart + planOrderSupply.
4. **Quote drifts / double-rounds** because canvas/shipping/tax bypass money.ts — one computeQuote() routing every input through toCents/sanitizeMoney/sumCents; assert Supplies total === Order total === sum of line items.
5. **Dishonest Order step** — a "Place order" button that cannot charge/submit, "Tax calculated next" with no next step, and canvas zoom dead on mobile (wheel-only, no touch-action) — reframe to confirm/handoff, label estimates, add pinch + touch-action none. Plus: dark mode is not retired by deleting only the toggle (persisted gempixel_theme dark + [data-theme] CSS resurrect it).

## Implications for Roadmap

Based on the convergent dependency-ordered build order from all four dimensions, suggested phase structure:

### Phase A: Atelier Design System + App Shell (foundation)
**Rationale:** Everything hangs on the tokens, fonts, and the strangler shell; retiring dark mode and mounting the canvas viewer ONCE must happen first. Ships green around the existing body.
**Delivers:** styles/atelier.css (@theme tokens, self-hosted fonts, light-only), dark-mode fully retired (state + persisted key + [data-theme] CSS + viewer dep), AppShell + StepNav-only nav wrapping the *existing* viewer/legend/supply UI unchanged.
**Addresses:** 4-step shell + gating, Atelier light theme.
**Avoids:** Pitfall 1 (big-bang), 2 (viewer remount/zoom loss — mount once), 9 (dark mode leftovers), 13 (font FOUT/CLS + reconcile canvas Outfit symbol font).

### Phase B: Shared UI Primitives
**Rationale:** StepNav, SegmentedControl, Slider, SizeCard, Pill, Button, SpecRow recur across every screen and mobile; extract once to kill Tailwind-soup duplication.
**Delivers:** src/ui/ primitives (hand-built, native elements + Atelier tokens). Unblocks every screen.
**Uses:** Native input type=range, role=radiogroup buttons, Tailwind utilities.

### Phase C: Additive Engine Changes (parallelizable with B/D)
**Rationale:** The three engine additions are independent of the screens and can land with their own tests before the UI depends on them; do them in their own commits (never inside a UI phase).
**Delivers:** detectedColorCount from useDiamondArtMatch; reduceToColorCount (target-N merge, Delta-E-guarded, deterministic tie-break); engine/quote.ts + useOrderQuote single-source integer-cents total (cols->inches + curated canvas table + shipping + tax estimate). **The cols->inches density decision is resolved here.**
**Implements:** Single-source quote selector; the color-count reducer.
**Avoids:** Pitfall 3 (density), 4 (merge determinism/sync), 5 (slider max), 6 (money single-source).

### Phase D: The Four Screens, in Flow Order (Refine is the keystone)
**Rationale:** Screens depend on B + C; build in journey order so the app is walkable at each step. Refine fuses size + cleanup + color-count and carries the highest-value + highest-risk feature.
**Delivers:** UploadScreen (dropzone + recents; size moves OUT of Upload into Refine); **RefineScreen*** (canvas hero + always-open rail: SizeCards with live drills, edge-cleanup segmented, color-count slider min 8 -> max detected); SuppliesScreen (table + summary from useOrderQuote); OrderScreen (locked Rolled-Canvas spec + finish + address + honest quote + client-side handoff).
**Addresses:** All P1 features.
**Avoids:** Pitfall 7 (estimates-as-exact + stale rate provenance), 8 (honest Order semantics — no Place order/receipt), 12 (worker thrash — merge is post-process, debounce).

### Phase E: Mobile Responsive + Touch Pass
**Rationale:** One responsive tree (container queries) collapsing rails to stacked columns; plus the real gap — pinch-zoom + touch-action.
**Delivers:** Container-query breakpoints per screen (verified at 300px, no drawers), pinch-to-zoom in the pointer handlers, touch-action none on canvas, on-screen zoom buttons.
**Avoids:** Pitfall 10 (mobile zoom dead), 11 (inline overflow at 300px).

### Phase F: Retire Old Steps + Cleanup
**Rationale:** Delete Step1..4, old asides, theme toggle, dead sidebar/preset state only after UAT (strangler close).
**Delivers:** Removed dead code; routed open decisions (kit selection, color-exclude, drillStyle default) into sane defaults or a Refine "advanced" disclosure.

### Phase Ordering Rationale
- **Dependencies:** tokens/shell (A) -> primitives (B) -> engine additions (C, parallel) -> screens (D) -> mobile (E) -> cleanup (F). Screens cannot build without primitives; Refine cannot build without the color-count reducer + detected count; both totals need the quote selector.
- **Grouping:** engine changes isolated into their own phase/commits so engine/* never diffs alongside UI (the strangler core discipline).
- **Pitfall avoidance:** shell-first + one-step-at-a-time keeps the 240+ suite green and prevents the v3.0 "two big UI reworks at once -> force-closed at 40%" failure.

### Research Flags

Phases likely needing deeper research/careful design during planning:
- **Phase C:** the density decision (keep 10 dots/inch and recompute size cards, vs change calculateCanvasCost density if 24x16-in physical canvases are the real product) is a load-bearing open question with quoting consequences; the target-N reducer needs a Delta-E guard + tie-break design.
- **Phase D (Order):** the handoff mechanism is unresolved (packet download vs lab deep-link via uploadUrl vs summary), plus tax-estimate policy and whether "Custom size" is in the v4.0 MVP.
- **Phase D (Refine):** where kit selection (100/200/all) and color-exclude live in a 4-step flow with no palette step; drillStyle default (square/round).

Phases with standard patterns (lighter research):
- **Phase A/B:** well-trodden token/font wiring + hand-built primitives; established Tailwind-v4 + Fontsource patterns.
- **Phase E:** container queries + pinch-zoom are documented; the viewer already fits-to-container.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | npm-pinned versions; base stack is fixed/shipped; only new deps are webfonts (authoritative Fontsource + npm sources). |
| Features | HIGH (engine-feasibility) / MEDIUM (market expectation) | Feasibility read against shipped src/engine/; market/UX claims from the design handoff (itself the feature contract) — no external web research. |
| Architecture | HIGH | Grounded in actual source (App.tsx, features/*, engine/*) + design handoff; seams verified. |
| Pitfalls | HIGH | Grounded in direct code review + grep audits (zero dark: classes, zero touch-action) + v2.1/v3.0 retrospectives. |

**Overall confidence:** HIGH

### Gaps to Address

- **Density decision (cols->inches):** LOAD-BEARING — resolve in Phase C before size cards. The mock inch labels contradict the engine 10 dots/inch; drill counts are correct, inches are not.
- **Kit selection + color-exclude placement:** the customer flow has no palette step — default kit all, tuck exclude under a Refine "advanced" disclosure or drop it; confirm in Phase D planning.
- **drillStyle/drillType default:** still needed for bag-variant mapping — default square/standard, decide whether to surface.
- **Order handoff mechanism:** packet download vs lab deep-link vs summary — pick during Phase D discuss; the v3.0 ORDER-04/05 packet schema is reusable + v5.0-forward-compatible.
- **Tax-estimate policy:** flat curated rate vs "estimated — finalized by lab", plus a dated RATES_AS_OF provenance constant.
- **Custom size in MVP?** Defer to v4.x with clamps unless presets prove too limiting.

## Sources

### Primary (HIGH confidence)
- Existing codebase — src/App.tsx, src/features/{wizard,match}/*, src/engine/{color,smoothing,bagPlanner,money,checkout,viewer,matcher.worker}.ts, src/index.css, index.html, package.json, vite.config.ts — actual state/handler/prop surfaces + pure pipeline (direct read).
- npm registry (npm view, 2026-07-13) — pinned webfont + Tailwind versions.
- Fontsource docs + Tailwind v4 container-query docs — self-host + @container patterns.
- .planning/PROJECT.md, milestones/v3.0-REQUIREMENTS.md, v2.1/v3.0 retrospectives — scope boundary (frontend-only, backend->v5.0), ORDER-04/05 packet contract, regression frustration, worker-bundling regression note.

### Secondary (MEDIUM confidence)
- Design handoff README.md (Atelier tokens/fonts, 4-step flow, Refine rail, mobile 300x620) — the feature/behavior contract, but by its own statement uses "illustrative mock data — wire to real sources" (corrected: density, tax copy, slider max).

### Tertiary (LOW confidence)
- Domain-standard photo->product configurator UX (Shutterfly/CanvasPop/POD builders) — comparative framing only.

---
*Research completed: 2026-07-13*
*Ready for roadmap: yes*
