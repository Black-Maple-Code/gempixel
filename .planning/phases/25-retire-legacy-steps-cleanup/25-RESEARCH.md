# Phase 25: Retire Legacy Steps + Cleanup - Research

**Researched:** 2026-07-16
**Domain:** Client-side Preact/Tailwind-v4 wizard UI — strangler cleanup + viewport/zoom/print/chrome UX refinements (frontend-only, zero new deps)
**Confidence:** HIGH (all findings verified against the live codebase; no external dependency surface)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Deletion scope & Phase 26 coupling**
- **D-01:** Preserve `Step3Canvas`, delete the rest. Phase 25 deletes `Step1Ingest`,
  `Step2Palette`, `Step4Export` + their dead ternary branches (panels 1, 2, 4) in `App.tsx`,
  plus non-coupled theme/`slate-*` remnants and dead preset state. `Step3Canvas` + its 3
  fulfillment handlers + the coupled `slate-*` fulfillment modals stay **untouched** until
  Phase 26 re-homes and deletes them (matches roadmap guardrail #11 and Phase 26 SC5).
  Consequence: this phase does NOT yet reach a single UI tree — panel-3 keeps its
  `USE_NEW_SUPPLIES ? SuppliesScreen : Step3Canvas` ternary and the fulfillment modals live on.
  This is intended, not a gap.
  - Flags: leave `flags.ts` as-is (all four `true`); do NOT delete the flags module this
    phase — panel 3 still reads `USE_NEW_SUPPLIES`. Flag cleanup lands with Phase 26.

**Auto-recompute model (revisits soft-invalidate → manual Recompute, P20 D-13 / P23 D-03/04)**
- **D-02:** Fully automatic recompute; remove the manual "Recompute match" button + amber
  stale CTA. A dimension change auto-triggers the existing `handleRecomputeMatch` internally
  (reuse the proven soft-invalidate plumbing — auto-fire it, don't rip it out). SizeCard clicks
  fire immediately (discrete, 4–5 presets); custom-size input is **debounced (~400–600 ms after
  last keystroke)** so the worker never thrashes. Auto-fire is **clamp-guarded** — a half-typed
  value (e.g. "1") must not fire a garbage run. The canvas shows a **"recomputing…" pending
  state** while the worker runs. The `RefineScreen` `stale`/`onRecompute` props and the StepBar
  amber stale marker are retired.

**Print WR-01 (plain Ctrl+P prints blank off-Refine)**
- **D-03:** Restore canvas-grid print from every step. Make the single-mount canvas `<main>`
  `print:block` on all four steps (not just step 2 — see `App.tsx:1619`) + a print rule that
  fits the raster to the page (`max-width:100%`, rides on the D-04 fit-to-container default so
  the printed raster already shows the whole grid). Ctrl+P produces the canvas grid from
  anywhere. The dedicated Print-Supply-Report and legend-print buttons target their own
  print-only DOM and stay **intact and independent**.

**Refine viewport & wizard chrome**
- **D-04:** Fit-to-container is the default zoom; no zoom-jump on size change. Introduce a
  persistent `isFitMode` flag in `viewer.ts` (there is none today — `scale` just starts at
  `1.0`). Fit on: init, new image load, grid-dimension change, container resize. Drop out of
  fit ONLY on explicit user zoom in/out (or pinch). A SizeCard / custom-size change **re-fits
  cleanly** instead of preserving the prior scale. Public zoom API + `onZoomChange` signatures
  stay stable (behavior-only extension, precedent P24 D-05).
- **D-05:** Full fixed app-shell for the wizard chrome (SC9 / item 10). Restructure
  `AtelierShell` into 3 zones: **fixed top step-bar → `flex-1 min-h-0` internally-scrolling
  content region → fixed bottom action bar (Back/Next)**. The Back/Next footer (today in-flow
  at `App.tsx:1804`) moves into the fixed bottom zone so Next is always hittable; long lists
  (Supplies/drill) scroll inside the content region. **Desktop-scoped** so it composes with —
  not fights — the Phase 24 mobile container-query reflow + sticky-canvas pane (P24 D-01/D-03).
  Single-mount canvas (P20 D-14) preserved — the canvas is reordered/re-zoned, never remounted.
- **D-06:** Rail fits the browser, canvas is the focus (item 7). The Refine controls rail is
  width-capped and the canvas viewport is the `flex-1` focus; the layout fits the browser width
  and the rail never encroaches on the viewport.
- **D-07:** View-mode switcher bottom-snap (item 9). The Grid / Grid+Symbols / Original
  switcher docks to the bottom of the viewport (naturally, inside the D-05 bottom zone / above
  it) and never overlaps or obstructs the canvas.
- **D-08:** Auto-advance Upload → Refine on successful ingest (item 1 / SC5). A successful
  image upload advances to step 2 so upload no longer reads as a no-op (also unblocks UAT Test
  29's first step). Respect the existing validation-gating (Refine reachable only with an
  uploaded image — P20 SC criterion).
- **D-09:** Dark-viewport re-token (folds into theme cleanup). The canvas preview surface is
  still `bg-slate-950` (`CanvasWorkspace.tsx:81`) and the zoom buttons use legacy `slate-*`
  classes. Re-token the viewport backdrop + zoom buttons to Atelier tokens as part of the D-01
  theme-remnant sweep, and bump zoom buttons to touch-friendly targets (the P24 discretion item).

### Claude's Discretion
- **Fit-mode mechanism location** — whether the re-fit-on-dimension-change hook lives inside
  `viewer.ts` (on grid set) or is an App-level `fitToContainer()` call after recompute completes
  (D-04). Planner's call.
- **Debounce duration** (~400–600 ms) and the exact clamp-guard predicate for custom-size
  auto-fire (D-02).
- **Print raster fit** — pure CSS `max-width:100%` scale vs a light print-scale redraw (D-03).
  CSS-scale is the low-cost default; upgrade only if the grid preview is unacceptably soft.
- **SC3 open defaults are already resolved by Phase 23** (kit default `all`, drillStyle default
  `square`, color-exclusion housed in the Refine "Advanced" `<details>`). Phase 25 just confirms
  they survive the legacy-Step deletion; no re-decision needed.
- **Advanced disclosure affordance (item 4)** — Phase 23 already houses kit/exclude/shape in a
  native `<details>` with a caret; if UAT still finds it unclear, add an explicit
  clickable-affordance cue. Planner's judgment during the Refine re-touch.

### Deferred Ideas (OUT OF SCOPE)
- **Delete `Step3Canvas.tsx`, its 3 fulfillment handlers, the coupled `slate-*` fulfillment
  modals, and the `flags.ts` module; reach the single UI tree** → **Phase 26** (owns it via SC5,
  after re-homing canvas PNG export + Diamond Drills USA cart into the new Order step).
- **Canvas PNG packet + Diamond Drills USA cart re-home into the Order step** → **Phase 26**
  (ORDER-04/05) — the functional counterpart to the deferred deletion above.
- **Service-fee line + order-ref/threshold flagging** (old v3.0 Phase 17 FEE-01) → still Backlog;
  not revived by v4.0.
</user_constraints>

<phase_requirements>
## Phase Requirements

Phase 25 carries **no v4.0 REQ-ID** (strangler close by design — CONTEXT `<canonical_refs>`,
ROADMAP line 285). The work items trace to ROADMAP Phase 25 Success Criteria SC5–SC10 and the
five scope-addition notes, mapped through CONTEXT decisions D-01..D-09. There is nothing to map
into a REQ→test table; the acceptance surface is the SC list plus the D-decisions.
</phase_requirements>

## Summary

Phase 25 is a **frontend-only, zero-new-dependency** phase with two intertwined workstreams:
(A) a final grep-clean deleting the residual legacy `Step1/2/4` components, their dead `App.tsx`
ternary branches, dark-mode/`slate-*` theme remnants, and dead preset state; and (B) a batch of
desktop-web UX refinements to the Refine viewport (fit-to-container zoom), the print path
(Ctrl+P from any step), the wizard chrome (fixed 3-zone shell), and the upload/recompute flow
(auto-advance + auto-recompute). Every UX decision (D-01..D-09) and the whole `25-UI-SPEC.md`
layout/token contract are **locked** — this research does not re-open them; it grounds each one
in the exact live code the planner must edit.

The load-bearing discovery is that **most of the "hard" machinery already exists** and each
refinement is a small, behavior-only extension of a proven seam: `viewer.ts` already has
`fitToContainer()` and clamped `handleZoom`; the `beforeprint` handler already re-fits the
canvas before printing (`App.tsx:706`); `handleRecomputeMatch` already commits `matchInputs`
via the soft-invalidate plumbing (`App.tsx:590`); and the single-mount canvas is already a
display-toggled `<main>` sibling (`App.tsx:1619`). The print bug (WR-01) is not a raster bug —
it is one Tailwind class: the canvas `<main>` is `'hidden'` (no `print:block`) on every step
except Refine. The engine signatures froze in Phase 22, so `viewer.ts` gets an `isFitMode` flag
that is **behavior-only** (no public signature change), matching the Phase 24 pinch precedent.

The single highest-risk area is the **SC10 fulfillment guardrail**: `Step3Canvas`, its three
handlers (`handleShopifyCheckout`, `handleDownloadCanvasOnly`, `handleDownloadCombinedCanvasSheet`
at `App.tsx:1289/1078/1102`), and the frame-scope `slate-*` fulfillment modals are **still-live
wiring** for the Diamond Drills USA cart and the canvas/legend PNG export. They must NOT be
swept by the theme-remnant cleanup — Phase 26 owns their deletion. The theme sweep must be
scoped to the deleted Step files, the `CanvasWorkspace.tsx` re-token (D-09, fully specified in
the UI-SPEC), and the `gempixel_theme` removeItem — and must trace every `slate-*` modal to its
trigger before touching it.

**Primary recommendation:** Execute as small, independently-green commits — delete-a-Step
(with its ternary + test-retarget) and each D-refinement as its own slice — reusing
`fitToContainer()`, `handleRecomputeMatch`, and the `beforeprint` hook rather than rewriting
them. Treat any `slate-*` outside `CanvasWorkspace.tsx` and the deleted Step files as
guardrail-protected until proven non-fulfillment.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Legacy Step deletion + dead-branch removal | Browser / Client (App.tsx compose layer) | — | Pure view-composition cleanup; no engine/logic change |
| Fit-to-container zoom + `isFitMode` (D-04) | Browser / Client (`engine/viewer.ts` interaction) | App.tsx (fit triggers) | Canvas interaction state lives in the viewer class; App owns *when* to fit |
| Auto-recompute on dimension change (D-02) | Browser / Client (App.tsx state) | Web Worker (existing match) | App owns `matchInputs` commit; worker already does the matching — only the *trigger* changes |
| Auto-advance on upload (D-08) | Browser / Client (App.tsx ingest handler) | — | Wizard step is App state; advance = one `goTo`/`next` call inside `img.onload` |
| Print canvas from any step (D-03) | Browser / Client (App.tsx class + `index.css` `@media print`) | — | Pure CSS visibility gate; the `beforeprint` fit hook already exists |
| Fixed 3-zone wizard shell (D-05) | Browser / Client (`AtelierShell.tsx` + App layout) | — | Layout-only flex restructure; App stays state owner |
| Rail width-cap + view-switcher bottom-snap (D-06/07) | Browser / Client (`RefineScreen.tsx`, `CanvasWorkspace.tsx`) | — | CSS/Tailwind class changes on pure props-only screens |
| Viewport re-token (D-09) | Browser / Client (`CanvasWorkspace.tsx`) | — | Class-name remap to semantic tokens; no behavior change |

All work is a single tier: **the in-browser Preact view layer + the `viewer.ts` canvas
interaction class.** No API, no server, no persistence-layer change. `src/engine/*` public
signatures are frozen (Phase 22); `viewer.ts` gets a behavior-only extension only.

## Standard Stack

No new libraries. This phase is bound by the CLAUDE.md / GEMINI.md **"browser-native,
zero-new-deps, do NOT use full React"** constraint and the `25-UI-SPEC.md` "hand-rolled Preact
primitives, no component registry" contract. Every refinement is hand-rolled CSS/flex + a
`viewer.ts` boolean.

### Core (already in the tree — versions from package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Preact | ^10.25.0 | View layer | Locked stack; App owns state, screens are pure/props-only [CITED: CLAUDE.md] |
| Tailwind CSS | ^4.0.0 | Utility styling + `@media print` + semantic token layer | Locked; `@theme inline` remap shim is what D-01/D-09 sweep [CITED: 25-UI-SPEC.md] |
| TypeScript | ^5.0.0 | Types (incl. `viewer.ts` `isFitMode`) | Locked stack |
| Vite | ^6.0.0 | Bundler; picks up deleted files on rebuild | Locked stack |
| Vitest + jsdom | (in devDeps) | The 240+ suite that must stay green every commit | Existing baseline [VERIFIED: codebase grep, src/__tests__/] |

### Supporting
None. No layout library, no scroll library, no pan/zoom library — CLAUDE.md §5 explicitly
forbids `panzoom`, Fabric.js, jsPDF, etc. The fixed shell (D-05) is `flex flex-col` + `min-h-0`
+ `overflow-y-auto`; the print fit (D-03) is `max-width:100%`; the fit-mode (D-04) is a boolean.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled `isFitMode` flag | (no library exists that fits this bespoke canvas) | N/A — a library would violate zero-dep and can't know the offscreen-raster geometry |
| CSS fixed 3-zone shell | JS scroll-lock / sticky library | Violates zero-dep; `min-h-0` + `overflow-y-auto` is the idiomatic Tailwind answer |

**Installation:** none — `npm install` unchanged.

## Package Legitimacy Audit

**Not applicable.** This phase installs **zero** external packages (deletion + CSS/flex + a
`viewer.ts` boolean, under a hard zero-new-deps constraint). No registry lookup was performed
because no package is added. **Packages removed due to [SLOP]:** none. **Packages flagged
[SUS]:** none.

## Architecture Patterns

### System Data-Flow (the seams this phase touches)

```
                 ┌────────────────────────────────────────────────────────┐
   upload file → │ App.tsx  (SOLE STATE OWNER — P20 D-01)                  │
                 │                                                         │
                 │  loadImageFile → img.onload ──(D-08)──▶ wizard.next()   │
                 │      │  sets image, clamps rows                         │
                 │      ▼                                                  │
                 │  matchInputs (committed)  ◀──(D-02 auto-fire)── size Δ  │
                 │      │                         SizeCard: immediate      │
                 │      │                         custom input: debounced  │
                 │      ▼                                                  │
                 │  useDiamondArtMatch (Web Worker) ──▶ matchResult        │
                 │      │                                                  │
                 │      ▼                                                  │
                 │  CanvasViewer (engine/viewer.ts, SINGLE MOUNT P20 D-14) │
                 │      setData(matchCols,matchRows,…)                     │
                 │      fitToContainer() ◀─(D-04)─ init / newImage /       │
                 │           │  isFitMode=true      dimΔ / resize / step-2  │
                 │           │  handleZoom→isFitMode=false (user zoom only) │
                 │           ▼                                             │
                 │  <main print:block ALL steps> (D-03)  ─Ctrl+P─▶ printer │
                 │      beforeprint → fitToContainer() (already wired)     │
                 └────────────────────────────────────────────────────────┘
   AtelierShell (D-05): [fixed step-bar] · [flex-1 min-h-0 scroll content] · [fixed Back/Next]
```

### Component Responsibilities (live targets — verified line numbers)

| File | Responsibility this phase | Verified anchors |
|------|---------------------------|------------------|
| `src/App.tsx` (~2460 ln) | Delete Step1/2/4 imports + ternary else-branches; auto-advance in `img.onload`; auto-fire recompute; move footer to shell bottom zone; `print:block` on `<main>`; sweep `gempixel_theme` | imports `:18–21`; panels `:1641/1705/1737/1772`; `<main>` `:1619`; footer `:1804`; ingest `:958–998`; recompute `:575–609`; `gempixel_theme` `:198` [VERIFIED: Read] |
| `src/engine/viewer.ts` (495 ln) | Add persistent `isFitMode` (set `true` in `fitToContainer`, `false` in `handleZoom`); no signature change | `scale=1.0` `:16`; `handleZoom` `:180` (0.5–50 clamp `:184`); `fitToContainer()` `:475`; `onZoomChange` `:9` [VERIFIED: Read] |
| `src/features/wizard/AtelierShell.tsx` (82 ln) | Restructure root into 3 zones; host relocated Back/Next in fixed bottom | root `h-dvh overflow-hidden` `:52`; owns no step state [VERIFIED: Read] |
| `src/features/wizard/CanvasWorkspace.tsx` (254 ln) | D-09 re-token map; D-07 view-switcher bottom-snap; keep 44px touch targets + aria-labels | `bg-slate-950` `:81`; switcher `:84–110`; zoom HUD `:113–149`; loading overlay `:233–250` [VERIFIED: Read] |
| `src/features/screens/RefineScreen.tsx` | Drop `stale`/`onRecompute` props + rail stale cue; cap rail width `w-[360px]`→`max-w-[320px]` | `stale`/`onRecompute` props `:69–70,96–97`; rail `w-[360px] max-w-full` `:108`; stale cue `:175–187` [VERIFIED: Read] |
| `src/features/screens/flags.ts` | **Leave as-is** (all `true`); do not delete (D-01) | all four `true` `:16–19` [VERIFIED: Read] |
| `src/index.css` | `@media print` canvas fit rule (already has `.print-canvas-wrapper canvas { max-width:100% }` `:280`) | `@media print` `:184`; report/legend modes `:364/295` [VERIFIED: Read] |
| `src/features/wizard/steps/Step1Ingest.tsx`, `Step2Palette.tsx`, `Step4Export.tsx` | **Delete** | exist [VERIFIED: Glob] |
| `src/features/wizard/steps/Step3Canvas.tsx` | **Preserve untouched** (guardrail SC10) | exists; imported `:20` [VERIFIED] |

### Pattern 1: Behavior-only viewer extension (`isFitMode`) — D-04
**What:** Add a private `isFitMode` boolean to `CanvasViewer`. It is the *only* state added; no
method signature changes, so the P22 engine-freeze and P24-precedent hold.
**When to use:** the fit-vs-user-zoom distinction D-04 requires.
**Example (grounded in the real class):**
```typescript
// Source: src/engine/viewer.ts (VERIFIED live code) — proposed minimal extension
private isFitMode = true;               // NEW — resting default is fit

private handleZoom(mouseX, mouseY, zoomFactor) {   // :180 unchanged signature
  // ...existing clamp math (minScale 0.5 / maxScale 50)...
  this.isFitMode = false;               // NEW — explicit user zoom leaves fit
  // ...existing this.draw() + onZoomChange...
}

public fitToContainer() {               // :475 unchanged signature
  // ...existing fit math...
  this.isFitMode = true;                // NEW — re-entering fit
  // ...existing this.draw() + onZoomChange...
}
```
App then calls `fitToContainer()` on grid-dimension change (new re-fit trigger). Because
`zoomIn`/`zoomOut`/wheel/pinch all funnel through `handleZoom` (`:462/468/177/125`), one line
covers every "user zoomed" path. **Container-resize re-fit** (D-04's 4th trigger) needs a
`ResizeObserver` on the canvas host that calls `fitToContainer()` only when `isFitMode` — this
is the one genuinely new listener; keep it optional/discretionary if it risks the green suite.

### Pattern 2: Auto-fire the existing recompute — D-02
**What:** Do not rewrite recompute. `handleRecomputeMatch` (`App.tsx:590`) already commits
`setMatchInputs({ image, cols, rows })`, which the match hook keys on to fire the worker exactly
once. D-02 just calls it automatically instead of from a button.
**When to use:** on any committed dimension change.
**Example:**
```typescript
// SizeCard (discrete) → fire immediately inside the size-set handler.
// Custom-size input → debounce ~500ms, clamp-guard before firing:
const debouncedRecompute = useRef<number>();
const onCustomSizeCommit = (nextCols: number, nextRows: number) => {
  window.clearTimeout(debouncedRecompute.current);
  debouncedRecompute.current = window.setTimeout(() => {
    if (nextCols >= MIN && nextRows >= MIN && image) handleRecomputeMatch();  // clamp-guard
  }, 500);  // 400–600ms band — discretion
};
```
Then **delete** the stale surfaces: the page-level banner (`App.tsx:1524–1540`), the
`stale`/`onRecompute` refineProps (`:1408–1409`), the RefineScreen rail cue + props
(`RefineScreen.tsx:69–70,175–187`), the StepBar amber marker, and the `nextBlockedByStale`
advance-block (`:609`). The `"Recomputing…"` pending state reuses the existing two-phase loading
overlay (`CanvasWorkspace.tsx:233–250`) — no new surface (UI-SPEC copy contract).

### Pattern 3: One-class print fix — D-03 / WR-01
**What:** The blank-print bug is `App.tsx:1619` — the `<main>` className is
`wizard.step === 2 ? '…print:block…' : 'hidden'`. Off-Refine it is `'hidden'` with no print
override, so plain Ctrl+P prints nothing. Make `<main>` always `print:block`.
**Why it is low-risk:** (1) The plain `@media print` block in `index.css` does **not** hide
`main` (only `print-only-legend-mode`/`print-only-report-mode` body classes do, `:326/394`), so
no CSS fights the change. (2) `.print-canvas-wrapper canvas { max-width:100% }` already exists
(`:280`) — the raster already fits the page. (3) `beforeprint` **already calls
`fitToContainer()`** (`App.tsx:706–714`), and `fitToContainer()` measures the canvas *backing
store* (`this.canvas.width`=800, `:481`), not layout — so it fits correctly even while the
canvas is `display:none` off-Refine. Riding on the D-04 fit default makes the printed grid whole.
**Keep independent:** the Supply-Report / legend buttons set `body.print-only-*-mode` and target
their own DOM — plain Ctrl+P (no body class) prints the canvas sheet; those buttons print their
reports. No double-print conflict (they are separate actions).

### Pattern 4: Fixed 3-zone shell — D-05
**What:** `AtelierShell` root today is `flex flex-col h-dvh overflow-hidden` with `{children}`
rendered flat below the header (`:52,79`). Restructure to three flex children: **Zone 1** the
existing `<header>`/StepBar (`shrink-0 no-print`), **Zone 2** `flex-1 min-h-0 overflow-y-auto`
wrapping the step panels + single-mount `<main>`, **Zone 3** a `shrink-0` bottom bar hosting the
relocated Back/Next (moved from `App.tsx:1804`). `min-h-0` on Zone 2 is the load-bearing detail
that lets an inner scroll region shrink inside a flex column. Desktop-scoped so it composes with
the P24 `@max-[640px]` mobile reflow already present (`App.tsx:1612,1619`). The canvas `<main>`
is re-zoned, never remounted (P20 D-14).

### Anti-Patterns to Avoid
- **Sweeping `slate-*` globally.** A blanket `slate-*` find-replace would hit the guardrail-
  protected fulfillment modals. Re-token only `CanvasWorkspace.tsx` (per the UI-SPEC D-09 map)
  and remove classes only inside the deleted Step files.
- **Ripping out the soft-invalidate plumbing.** D-02 *reuses* `handleRecomputeMatch`; deleting
  `matchInputs`/commit logic would break the worker-fire-once guarantee and the B2 abort-race
  protection noted at `App.tsx:588`.
- **Remounting the canvas** when restructuring the shell (D-05) — the viewer must never be
  gated behind a step conditional (P20 D-14).
- **Adding a scroll/layout/zoom library** — forbidden by CLAUDE.md §5 and the zero-dep rule.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fit-on-print for a hidden canvas | A new print-render pipeline | The existing `beforeprint`→`fitToContainer()` hook (`App.tsx:706`) | Already wired; measures backing store, works while `display:none` |
| Re-fire the worker on size change | A new match trigger / effect | `handleRecomputeMatch` + `setMatchInputs` (`App.tsx:590`) | Proven fire-once, abort-race-safe path |
| Fit math | New fit computation | `viewer.ts fitToContainer()` (`:475`) | Correct offscreen-raster geometry + 5% padding already implemented |
| "Recomputing…" pending UI | A new overlay component | The two-phase loading overlay (`CanvasWorkspace.tsx:233`) | UI-SPEC mandates reuse; no new surface |
| Debounce | A debounce library | `setTimeout` + `clearTimeout` in a ref | One-off, browser-native, zero-dep |

**Key insight:** Nearly every "new" behavior in this phase is a *trigger* or *class* change over
machinery that already exists and is tested. The research value is in **not rebuilding** — and in
correctly scoping the deletion around the SC10 guardrail.

## Runtime State Inventory

> This is a deletion + refactor phase (files removed, theme remnants swept). Categories checked
> explicitly:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | `localStorage['gempixel_theme']` — a **dark-mode preference** left by the retired theme system; already defensively cleared at `App.tsx:198` (`safeStorage.removeItem('gempixel_theme')`). No other persisted key encodes a deleted Step identifier; the project store (`projectStore`) persists design data, not step/theme symbols. [VERIFIED: grep] | **Code edit only** — keep/confirm the one-time `removeItem` cleanup; no data migration needed (it is a *removal* of stale prefs, and re-running is idempotent). |
| **Live service config** | None — 100% client-side app, no external services, no server config, no dashboards. [VERIFIED: CLAUDE.md, no network calls in scope except the preserved Diamond Drills cart *link* which is not config] | None. |
| **OS-registered state** | None — browser app; no Task Scheduler / pm2 / systemd / launchd. | None. |
| **Secrets / env vars** | None — no secret keys or env var names reference the deleted Steps or theme; no `.env` consumed by the deleted code. [VERIFIED: no env reads in the targeted files] | None. |
| **Build artifacts / installed packages** | Deleting `Step1Ingest.tsx`/`Step2Palette.tsx`/`Step4Export.tsx` — Vite rebuilds from source (`npm run build`), so no stale compiled artifact persists. No snapshot-test artifacts pin the deleted components (tests assert by DOM query/text, not snapshots). [VERIFIED: grep of __tests__] | **Code edit** — remove imports at `App.tsx:18,19,21`; run `npx tsc --noEmit` + `npm test` to confirm no dangling reference. |

**Canonical question — "after every file is updated, what runtime state still holds the old
symbols?":** Only the `gempixel_theme` localStorage key, and it is already cleared idempotently
at startup. Nothing else survives.

## Common Pitfalls

### Pitfall 1: Sweeping a guardrail-protected `slate-*` modal (SC10 violation)
**What goes wrong:** The theme-remnant cleanup deletes/re-tokens a `slate-*` modal at frame
scope (`App.tsx:1836+`, `:1932+`, `:2030+`) that is actually the **curated canvas-links modal or
checkout modal** wired to the still-live Diamond Drills USA cart / canvas-PNG export — orphaning
a live feature Phase 26 depends on.
**Why it happens:** The Artist Resources modal at `App.tsx:1836` renders "print custom canvas
layouts and purchase bulk DMC replacement drills" and uses `slate-*` classes — visually
indistinguishable from a dead theme remnant, but potentially fulfillment-coupled.
**How to avoid:** For **each** `slate-*` modal, trace its trigger. The protected set is anything
reachable via `handleShopifyCheckout` (`:1289`), `handleDownloadCanvasOnly` (`:1078`), or
`handleDownloadCombinedCanvasSheet` (`:1102`), all passed into `Step3Canvas` (`:1763–1765`).
**When in doubt, PRESERVE** — the UI-SPEC says the sweep "must not touch the fulfillment-coupled
`slate-*` modals," and deleting them is explicitly Phase 26. Scope the confident sweep to
`CanvasWorkspace.tsx` (D-09 map) + deleted Step files + `gempixel_theme`.
**Warning signs:** any diff hunk removing a `slate-*` class outside `CanvasWorkspace.tsx` or the
three deleted Step files.

### Pitfall 2: The D-02 test that asserts the stale banner
**What goes wrong:** `App.test.tsx:1473` ("marks downstream stale, keeps last-good match, blocks
advancing; imageless Recompute prompts re-upload (ME-01)") asserts `"This step is out of date"`
and a `Recompute match` button (`:1490–1526`). D-02 removes both → the test red-fails.
**Why it happens:** D-02 reverses the P20 D-13 soft-invalidate UX; the test encodes the old UX.
**How to avoid:** Retarget this test in the *same commit* that lands D-02 — assert the new
contract (size change auto-fires a recompute; last-good grid stays until the fresh one lands; no
stale banner appears). Mirror the Phase 23 aside test-retargeting precedent (retarget vs
intentional-retirement). Keep the ME-01 imageless-guard assertion (re-upload prompt) — that
guard still exists inside `handleRecomputeMatch:595`.
**Warning signs:** grep `"out of date"` / `"Recompute match"` in `src/__tests__/` after the D-02
commit — any surviving hit is an un-retargeted test.

### Pitfall 3: Deleting a Step import but leaving the ternary else-branch
**What goes wrong:** Removing `import { Step2Palette }` (`:19`) but leaving the `: (<Step2Palette
… />)` else-branch (`:1708–1733`) → TypeScript build break.
**Why it happens:** The panels are `USE_NEW_* ? Screen : <LegacyStep>` ternaries; the flag is
`true`, so the else-branch is dead but still compiled.
**How to avoid:** For panels 1, 2, 4: delete the import **and** collapse the ternary to the new
screen only (drop the `USE_NEW_* ? … : <Step>` wrapper). **Panel 3 is the exception** — keep its
`USE_NEW_SUPPLIES ? SuppliesScreen : Step3Canvas` ternary and the `Step3Canvas` import (`:20`)
intact (D-01). Run `npx tsc --noEmit` after each Step deletion.
**Warning signs:** `tsc` "declared but never read" or "cannot find name Step2Palette".

### Pitfall 4: Fixed shell breaks the canvas 0-measure / mobile reflow
**What goes wrong:** The D-05 restructure changes the flex tree so the step-2 canvas re-fit
effect (`App.tsx:737`) or the P24 `@max-[640px]` sticky-canvas reflow (`:1612,1619`) stops
firing/measuring, leaving a blank or mis-sized canvas.
**Why it happens:** The re-fit effect depends on the canvas being measurable when Refine becomes
visible; `min-h-0`/`overflow` changes can zero the measured height.
**How to avoid:** Keep the `@max-[640px]` classes intact (desktop-scope the D-05 change); keep
the `<main>` a display-toggled sibling (never remount); verify the step-2 `fitToContainer()`
effect still runs post-restructure. The integrated layout regression test (added in Phase 23,
`23-08-PLAN`) is the guard — keep it green.
**Warning signs:** blank canvas on entering Refine; failing layout regression test.

### Pitfall 5: D-09 re-token strips aria-labels / touch targets
**What goes wrong:** Class-name churn on the zoom HUD replaces the buttons and drops
`aria-label="Zoom In/Out"` / `"Fit Viewport"` or the `min-h-[44px] min-w-[44px]` targets
(`CanvasWorkspace.tsx:119,130,141`).
**Why it happens:** Re-tokening touches the same className strings that carry a11y + sizing.
**How to avoid:** The UI-SPEC mandates the aria-labels survive (align to "Zoom in"/"Zoom
out"/"Fit to screen" if touched) and the 44px targets stay. Change only color tokens per the
D-09 map; leave structural/sizing/aria attributes.
**Warning signs:** a zoom button rendered glyph-only, or `min-h-[44px]` missing after the re-token.

## Code Examples

### D-08 auto-advance (inside the existing ingest success path)
```typescript
// Source: src/App.tsx loadImageFile → img.onload (VERIFIED :963–998).
// Add the advance AFTER setImage/commit, respecting the validity gate.
img.onload = () => {
  // ...existing: setImageName, aspect-ratio rows clamp, setRows(newRows), setImage(img)...
  if (!matchResult) {
    setExcludedColors(new Set());
    setSelectedPreset('custom');
    setMatchInputs({ image: img, cols, rows: newRows });
  }
  // D-08: advance Upload → Refine. useWizard gates canEnter(2) on hasImage — now true.
  wizard.goTo(2);   // or wizard.next(); the gate already enforces "image required"
};
```
Note the same handler runs for recent-image load (`App.tsx:1042`) — decide whether re-loading a
recent image should also advance (likely yes for parity; planner's call).

### D-03 the one-line class fix
```tsx
// Source: src/App.tsx:1619 (VERIFIED). BEFORE:
<main className={wizard.step === 2 ? 'relative flex … print:block …@max-[640px]:…' : 'hidden'}>
// AFTER: keep the on-screen step-2 gating for layout, but ensure print:block ALWAYS applies.
// e.g. compose: base 'print:block' + (step===2 ? on-screen-flex-classes : 'hidden')
//   className={`print:block ${wizard.step === 2 ? 'relative flex … @max-[640px]:…' : 'hidden'}`}
// 'hidden print:block' → display:none on screen, block in print. Screens stay no-print.
```

## State of the Art

| Old Approach (pre-P25) | New Approach (P25) | When | Impact |
|------------------------|--------------------|----|--------|
| Manual "Recompute match" button + amber stale banner (P20 D-13) | Auto-recompute on size change (SizeCard immediate / custom debounced) | D-02 | Removes a click; retires stale UX + its test |
| `scale` starts at `1.0`, fit only on new-image/step-2 | Persistent `isFitMode`; re-fit on init/newImage/dimΔ/resize; leave fit only on user zoom | D-04 | No zoom-jump on size change; fit is the resting state |
| Canvas `<main>` `print:block` on step 2 only → blank Ctrl+P elsewhere | `print:block` on all steps | D-03 | Ctrl+P prints the grid from any step |
| Back/Next in-flow footer (`App.tsx:1804`) | Fixed bottom action bar in 3-zone shell | D-05 | Next always hittable; content scrolls internally |
| Viewport `bg-slate-950` + `slate-*` zoom HUD (remap shim) | Semantic Atelier tokens (`bg-bg`, `bg-accent`, etc.) | D-09 | Stops depending on the legacy remap shim |

**Deprecated/removed this phase:** `Step1Ingest.tsx`, `Step2Palette.tsx`, `Step4Export.tsx`;
their `App.tsx` ternary else-branches + imports; the `stale`/`onRecompute` RefineScreen props;
the page-level stale banner; the StepBar amber stale marker; dead preset state feeding only the
deleted Steps. **Explicitly NOT removed (Phase 26):** `Step3Canvas.tsx`, the 3 fulfillment
handlers, the coupled `slate-*` modals, `flags.ts`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Artist Resources modal (`App.tsx:1836`) and the other frame-scope `slate-*` modals (`:1932+`, `:2030+`) may be fulfillment-coupled; the planner must trace each trigger before touching. Research did not fully resolve which are coupled vs. pure remnants. | Pitfall 1 | HIGH — deleting a coupled modal orphans a live Phase 26 dependency (SC10 breach). Mitigation: preserve-when-in-doubt. |
| A2 | Container-resize re-fit (D-04's 4th trigger) needs a new `ResizeObserver`; none exists today. | Pattern 1 | LOW — if omitted, resize simply doesn't re-fit (init/dimΔ/step-2 still do); can be added later. Verify jsdom test impact. |
| A3 | The custom-size debounce should live in the App-level width/height change handlers (`handleWidthChange`/`handleHeightChange`); exact commit point is discretion. | Pattern 2 | LOW — behavioral tuning; band 400–600ms is UI-SPEC-sanctioned. |
| A4 | Re-loading a *recent* image should also auto-advance (parity with fresh upload). Not explicitly stated in D-08. | Code Examples | LOW — cosmetic parity; planner's call. |

## Open Questions (Resolved)

1. **Which frame-scope `slate-*` modals are fulfillment-coupled?**
   - What we know: the protected set is anything reached via the 3 handlers passed to
     `Step3Canvas`; the UI-SPEC lists "curated canvas-links modal" + "checkout modal" as coupled.
   - What's unclear: whether the Artist Resources modal at `:1836` is one of those two or a
     separable theme remnant.
   - Recommendation: planner traces each modal's `open` state + trigger during planning; preserve
     all three unless a modal is provably unreachable from the 3 handlers. Defer any uncertain
     deletion to Phase 26.
   - **RESOLVED (2026-07-16, user decision):** Preserve all three this phase; **defer the Artist
     Resources modal to Phase 26.** Pattern-mapping (`25-PATTERNS.md`) confirmed Checkout Warning
     (`:1931`) and Save Project (`:2029`) are fulfillment-coupled → preserve, and that Artist
     Resources (`:1836`) has no `setResourcesModalOpen(true)` trigger anywhere in `src/`
     (provably unreachable). Despite being dead, it is held under preserve-when-in-doubt because
     of residual ambiguity over whether it is the UI-SPEC's fulfillment-coupled "curated
     canvas-links modal"; Phase 26 re-homes fulfillment and will delete it with full context.
     Plans unchanged — the confident theme sweep stays scoped to `CanvasWorkspace.tsx` (D-09 map)
     + the 3 deleted Step files + the `gempixel_theme` `removeItem` only.

2. **Container-resize re-fit — in scope now or defer?**
   - What we know: D-04 lists it as a re-fit trigger; no `ResizeObserver` exists.
   - What's unclear: whether adding one risks the jsdom suite (jsdom has no layout).
   - Recommendation: implement behind an `isFitMode` guard; if it destabilizes tests, ship the
     other three triggers now and note resize as a fast-follow.
   - **RESOLVED (2026-07-16, user decision):** **Defer to fast-follow.** Ship the other three
     D-04 triggers this phase (init + new-image via the existing step-2 `fitToContainer` effect;
     grid-dimension change via Plan 25-04's unconditional `fitToContainer()`); do NOT add a
     `ResizeObserver` now, to avoid destabilizing the 240+ jsdom suite over a minor UX nicety.
     The `isFitMode` accessor (Plan 25-03) still lands as additive foundation so the fast-follow
     needs no engine-signature change. D-04 is honestly represented as 3-of-4 triggers shipping,
     1 deferred (no `must_have`/verification asserts container-resize behavior). Plans unchanged.

## Environment Availability

**Skipped — no external dependencies.** This phase is code/CSS-only inside the existing
Vite/Preact/Vitest toolchain already present in the repo (`npm run dev`, `npm run build`,
`npm test`, `npx tsc --noEmit` per CLAUDE.md). No new tool, service, runtime, or CLI is required.

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` in config. This is a client-side-only
> UI cleanup with **no** new input parsing, network calls, auth, storage of secrets, or
> serialization. Scope is deletion + CSS/flex + a viewer boolean.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in a client-only tool |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | No server/resources |
| V5 Input Validation | marginal | The custom-size auto-recompute (D-02) already **clamp-guards** numeric input before firing the worker (`App.tsx` clamp at ingest `:970–984`, and the D-02 clamp predicate) — a half-typed value must not fire. No new untrusted-input surface is introduced. |
| V6 Cryptography | no | No crypto (the order packet's `generateUUID` is untouched Phase 26 territory) |
| V7 Error Handling / Logging | marginal | Existing shared `actionError` banner remains the non-throwing surface; no new throw paths |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| DoM/worker thrash from unbounded input | Denial of Service (self) | D-02 debounce + clamp-guard on custom-size (already required by CONTEXT) |
| Orphaning a live fulfillment path (data-integrity of the user's order flow) | Tampering (functional regression) | SC10 guardrail — preserve `Step3Canvas` + handlers + coupled modals; trace before delete |
| `dangerouslySetInnerHTML` / injection | Tampering | N/A — no HTML injection in scope; all rendered values are typed props (privacy-first, no image leaves client) |

**No new security controls required.** The only security-adjacent care is the D-02 clamp-guard
(already mandated) and not regressing the privacy/no-upload invariant (nothing in scope adds a
network call).

## Sources

### Primary (HIGH confidence — verified via Read/Grep this session)
- `src/App.tsx` — imports `:18–21`, `gempixel_theme` `:198`, recompute plumbing `:575–609`,
  ingest `:958–998`, viewer effects `:653–741`, refineProps stale `:1408–1409`, `<main>` print
  gate `:1619`, panel ternaries `:1641/1705/1737/1772`, footer `:1804`, stale banner `:1524`.
- `src/engine/viewer.ts` — `scale` `:16`, `handleZoom` + 0.5–50 clamps `:180–197`,
  `fitToContainer()` `:475–493`, `onZoomChange` `:9`.
- `src/features/wizard/AtelierShell.tsx` — 82-line shell root `:52`.
- `src/features/wizard/CanvasWorkspace.tsx` — `bg-slate-950` `:81`, switcher `:84`, zoom HUD +
  aria-labels + 44px targets `:113–149`, loading overlay `:233`.
- `src/features/screens/RefineScreen.tsx` — stale props `:69,96`, rail width `:108`, rail cue `:175`.
- `src/features/screens/flags.ts` — all four flags `true`.
- `src/index.css` — `@media print` `:184`, `.print-canvas-wrapper canvas` max-width `:280`,
  print-only-legend/report modes `:295/364`.
- `src/__tests__/` — Step/Recompute/stale references (App.test.tsx `:1473–1526`, print.test.tsx,
  integration.test.tsx) via grep.
- `.planning/config.json` — `nyquist_validation:false`, `security_enforcement:true`,
  `commit_docs:true`.

### Secondary (MEDIUM confidence — design intent, not code)
- `.planning/phases/25-retire-legacy-steps-cleanup/25-CONTEXT.md` (D-01..D-09, guardrails).
- `.planning/phases/25-retire-legacy-steps-cleanup/25-UI-SPEC.md` (locked token/layout contract).
- `.planning/ROADMAP.md` §Phase 25 / §Phase 26 (SC list, coupling note lines 68–311).
- CLAUDE.md / `.agents/GEMINI.md` (zero-new-deps, browser-native, do-NOT-use-React).

### Tertiary (LOW confidence)
- None — no external/web sources were needed (config disables all search providers; scope is
  entirely internal).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps by hard constraint; all libs already in package.json.
- Architecture / live targets: HIGH — every line number verified by Read/Grep this session.
- Pitfalls: HIGH — derived from actual code (test assertions, ternary structure, guardrail
  wiring) plus the explicit CONTEXT/UI-SPEC guardrails.
- SC10 modal-coupling resolution: MEDIUM — flagged as A1/Open-Q1 for the planner to trace.

**Research date:** 2026-07-16
**Valid until:** 2026-08-15 (stable — internal codebase, no fast-moving external surface). Re-verify
line numbers if `App.tsx` is edited before planning.

## Validation Architecture

> **Omitted** — `.planning/config.json` sets `workflow.nyquist_validation: false`. Per the
> researcher contract this section is skipped. The relevant test-integrity guidance (keep the
> 240+ Vitest suite green every commit; retarget the D-02 stale test; retarget deleted-Step
> assertions; run `npx tsc --noEmit` + `npm test` per commit) is captured inline under Common
> Pitfalls 2–4 and Runtime State Inventory, which the planner should fold into verification steps.
