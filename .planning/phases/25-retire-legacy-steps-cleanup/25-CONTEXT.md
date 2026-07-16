# Phase 25: Retire Legacy Steps + Cleanup - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 25 closes the v4.0 strangler **and** lands the accumulated Refine / viewport /
wizard-chrome UX fixes from the Phase 23 & 24 walkthroughs, then re-verifies the real-photo
journey (UAT Test 29) — all **frontend-only, 100% client-side**, App stays the sole state
owner, screens stay pure/props-only, and the 240+ Vitest suite ships green at every commit.

Two workstreams, both in this phase:

1. **Strangler cleanup (partial by design).** Delete the residual legacy `Step1Ingest`,
   `Step2Palette`, `Step4Export` component files + their now-dead ternary branches in App,
   the dark-mode / `slate-*` theme remnants that are **not** coupled to the still-live
   fulfillment path, and any leftover dead preset state. Retarget the legacy-Step-coupled
   tests (`App.test.tsx`, `integration.test.tsx`, `print.test.tsx`) as Phase 23 did for the
   asides.
2. **UX / viewport / wizard-chrome fixes** (roadmap items 1–10 / SC5–SC9): auto-advance on
   upload, auto-recompute on dimension change, fit-to-zoom default + no-zoom-jump on size
   change, rail-fits-browser, view-switcher bottom-snap, fixed wizard chrome, and the WR-01
   print fix.

**Explicitly preserved this phase (guardrail #11 / D-01):** `Step3Canvas.tsx` and its three
still-live fulfillment handlers (`handleShopifyCheckout`, `handleDownloadCanvasOnly`,
`handleDownloadCombinedCanvasSheet`) plus the `slate-*` modals coupled to them (curated
canvas-links modal, checkout modal). These are the ONLY live wiring for the Diamond Drills
USA cart (`engine/checkout.ts` `compileShopifyCartLink`) and the canvas/legend PNG export
(`engine/export.ts` `drawCanvasOnly`/`drawCombinedCanvasSheet`). **Phase 26 re-homes them into
the new Order step and owns their deletion (Phase 26 SC5).** Phase 25 does not touch them.

**Not in this phase:**
- Any `src/engine/*` **signature** change (engine froze in Phase 22). `viewer.ts` *interaction
  behavior* may be extended for fit-mode (precedent: Phase 24 D-05 pinch) but its public API
  signatures stay stable.
- Deleting / re-homing `Step3Canvas`, the fulfillment handlers, or the coupled slate modals →
  **Phase 26**.
- New capabilities beyond the roadmap's Phase 25 scope items.

</domain>

<decisions>
## Implementation Decisions

### Deletion scope & Phase 26 coupling
- **D-01:** **Preserve `Step3Canvas`, delete the rest.** Phase 25 deletes `Step1Ingest`,
  `Step2Palette`, `Step4Export` + their dead ternary branches (panels 1, 2, 4) in `App.tsx`,
  plus non-coupled theme/`slate-*` remnants and dead preset state. `Step3Canvas` + its 3
  fulfillment handlers + the coupled `slate-*` fulfillment modals stay **untouched** until
  Phase 26 re-homes and deletes them (matches roadmap guardrail #11 and Phase 26 SC5).
  Consequence: this phase does NOT yet reach a single UI tree — panel-3 keeps its
  `USE_NEW_SUPPLIES ? SuppliesScreen : Step3Canvas` ternary and the fulfillment modals live on.
  That final single-tree close falls out of Phase 26. This is intended, not a gap.
  - Flags: leave `flags.ts` as-is (all four `true`); do NOT delete the flags module this
    phase — panel 3 still reads `USE_NEW_SUPPLIES`. Flag cleanup lands with Phase 26.

### Auto-recompute model (revisits soft-invalidate → manual Recompute, P20 D-13 / P23 D-03/04)
- **D-02:** **Fully automatic recompute; remove the manual "Recompute match" button + amber
  stale CTA.** A dimension change auto-triggers the existing `handleRecomputeMatch` internally
  (reuse the proven soft-invalidate plumbing — auto-fire it, don't rip it out). SizeCard clicks
  fire immediately (discrete, 4–5 presets); custom-size input is **debounced (~400–600 ms after
  last keystroke)** so the worker never thrashes. Auto-fire is **clamp-guarded** — a half-typed
  value (e.g. "1") must not fire a garbage run. The canvas shows a **"recomputing…" pending
  state** while the worker runs. The `RefineScreen` `stale`/`onRecompute` props and the StepBar
  amber stale marker are retired.

### Print WR-01 (plain Ctrl+P prints blank off-Refine)
- **D-03:** **Restore canvas-grid print from every step.** Make the single-mount canvas `<main>`
  `print:block` on all four steps (not just step 2 — see `App.tsx:1619`) + a print rule that
  fits the raster to the page (`max-width:100%`, rides on the D-04 fit-to-container default so
  the printed raster already shows the whole grid). Ctrl+P produces the canvas grid from
  anywhere. The dedicated Print-Supply-Report and legend-print buttons target their own
  print-only DOM and stay **intact and independent** — a plain Ctrl+P prints the canvas grid;
  those buttons remain the way to print the supply/legend reports (no double-print conflict:
  they are separate button actions, not passive Ctrl+P output).

### Refine viewport & wizard chrome
- **D-04:** **Fit-to-container is the default zoom; no zoom-jump on size change.** Introduce a
  persistent `isFitMode` flag in `viewer.ts` (there is none today — `scale` just starts at
  `1.0`). Fit on: init, new image load, grid-dimension change, container resize. Drop out of
  fit ONLY on explicit user zoom in/out (or pinch). A SizeCard / custom-size change **re-fits
  cleanly** instead of preserving the prior scale. Public zoom API + `onZoomChange` signatures
  stay stable (behavior-only extension, precedent P24 D-05).
- **D-05:** **Full fixed app-shell for the wizard chrome (SC9 / item 10).** Restructure
  `AtelierShell` into 3 zones: **fixed top step-bar → `flex-1 min-h-0` internally-scrolling
  content region → fixed bottom action bar (Back/Next)**. The Back/Next footer (today in-flow
  at `App.tsx:1804`) moves into the fixed bottom zone so Next is always hittable; long lists
  (Supplies/drill) scroll inside the content region. **Desktop-scoped** so it composes with —
  not fights — the Phase 24 mobile container-query reflow + sticky-canvas pane (P24 D-01/D-03).
  Single-mount canvas (P20 D-14) preserved — the canvas is reordered/re-zoned, never remounted.
- **D-06:** **Rail fits the browser, canvas is the focus (item 7).** The Refine controls rail is
  width-capped and the canvas viewport is the `flex-1` focus; the layout fits the browser width
  and the rail never encroaches on the viewport. (Sharpens the earlier "narrow the rail" tidy
  into a fit constraint.)
- **D-07:** **View-mode switcher bottom-snap (item 9).** The Grid / Grid+Symbols / Original
  switcher docks to the bottom of the viewport (naturally, inside the D-05 bottom zone / above
  it) and never overlaps or obstructs the canvas.
- **D-08:** **Auto-advance Upload → Refine on successful ingest (item 1 / SC5).** A successful
  image upload advances to step 2 so upload no longer reads as a no-op (also unblocks UAT Test
  29's first step). Respect the existing validation-gating (Refine reachable only with an
  uploaded image — P20 SC criterion).
- **D-09:** **Dark-viewport re-token (folds into theme cleanup).** The canvas preview surface is
  still `bg-slate-950` (`CanvasWorkspace.tsx:81`) and the zoom buttons use legacy `slate-*`
  classes (flagged as a Phase 24 discretion carry-over). Re-token the viewport backdrop + zoom
  buttons to Atelier tokens as part of the D-01 theme-remnant sweep, and bump zoom buttons to
  touch-friendly targets (the P24 discretion item).

### Claude's Discretion
- **Fit-mode mechanism location** — whether the re-fit-on-dimension-change hook lives inside
  `viewer.ts` (on grid set) or is an App-level `fitToContainer()` call after recompute completes
  (D-04). Planner's call.
- **Debounce duration** (~400–600 ms) and the exact clamp-guard predicate for custom-size
  auto-fire (D-02).
- **Print raster fit** — pure CSS `max-width:100%` scale vs a light print-scale redraw (D-03).
  CSS-scale is the low-cost default; upgrade only if the grid preview is unacceptably soft.
- **SC3 open defaults are already resolved by Phase 23** (kit default `all`, drillStyle default
  `square`, color-exclusion housed in the Refine "Advanced" `<details>` — see 23-CONTEXT /
  23-PATTERNS). Phase 25 just confirms they survive the legacy-Step deletion; no re-decision
  needed.
- **Advanced disclosure affordance (item 4)** — Phase 23 already houses kit/exclude/shape in a
  native `<details>` with a caret; if UAT still finds it unclear, add an explicit
  clickable-affordance cue. Planner's judgment during the Refine re-touch.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone grounding
- `.planning/ROADMAP.md` §"Phase 25: Retire Legacy Steps + Cleanup" — the narrowed scope,
  the five scope-addition notes (Test 26 UX refinements, web viewport/zoom, static wizard +
  guardrail), Success Criteria 1–10, and the Phase 24→25→26 boundary.
- `.planning/ROADMAP.md` §"Phase 26" — the fulfillment re-home (ORDER-04/05) that OWNS the
  `Step3Canvas` deletion (SC5); the coupling note that gates D-01.
- `.planning/PROJECT.md` — v4.0 boundary (frontend-only, 100% client-side; fulfillment backend
  deferred to v5.0) and the strangler discipline.
- `.planning/REQUIREMENTS.md` — Phase 25 carries no new REQ-ID (strangler close by design);
  the UX items trace to the roadmap scope notes, not new requirements.

### Live targets (the edits this phase makes)
- `src/App.tsx` (~2460 lines) — the four `data-step-panel` ternaries (`:1641`, `:1705`, `:1737`,
  `:1772`); legacy Step imports (`:18–21`); the canvas `<main>` print gate (`:1619`, WR-01);
  the in-flow Back/Next footer (`:1804`, → fixed bottom zone, D-05); the soft-invalidate/
  Recompute plumbing (`:507–532`, auto-fire per D-02); the `slate-*` fulfillment modals
  (`:1836+`, `:1932+`, `:2030+` — PRESERVE the fulfillment-coupled ones per D-01, remove only
  non-coupled remnants); `removeItem('gempixel_theme')` (`:198`).
- `src/features/wizard/steps/Step1Ingest.tsx`, `Step2Palette.tsx`, `Step4Export.tsx` — **delete**
  (D-01). `Step3Canvas.tsx` — **preserve untouched** (D-01, guardrail #11).
- `src/features/wizard/AtelierShell.tsx` (82 lines) — the `flex flex-col h-dvh overflow-hidden`
  root → 3-zone fixed app-shell (D-05). Owns no step state.
- `src/features/wizard/CanvasWorkspace.tsx` — the `bg-slate-950 viewport-dots` preview surface
  (`:81`, re-token D-09), the view-mode switcher (`:85–113`, bottom-snap D-07), the zoom HUD
  (`onFit` → fit-mode D-04).
- `src/engine/viewer.ts` — `scale` (`:16`), `handleZoom` + `minScale 0.5`/`maxScale 50`
  (`:181–195`), `setViewportState` (`:207`), `fitToContainer()` (via `onFit`). Add persistent
  `isFitMode` (D-04) — behavior-only, no signature change.
- `src/features/screens/RefineScreen.tsx` — retire `stale`/`onRecompute` props (D-02); rail
  width-cap (D-06); Advanced affordance (discretion).
- `src/features/screens/flags.ts` — leave as-is (all `true`); do NOT delete this phase (D-01).

### Test retargeting (deletion blast radius)
- `src/__tests__/App.test.tsx`, `src/__tests__/integration.test.tsx`,
  `src/__tests__/print.test.tsx` — still reference the legacy Step files; re-point or retire
  their Step1/2/4 assertions when those components are deleted (mirror the Phase 23 aside
  test-retargeting approach). Do NOT retire assertions that exercise the preserved Step3Canvas
  fulfillment path.

### Codebase maps
- `.planning/codebase/ARCHITECTURE.md`, `CONVENTIONS.md`, `STRUCTURE.md`, `TESTING.md` — the
  pure-engine/thin-UI split, naming, and the Vitest+jsdom baseline the retargeted tests extend.

### Prior-phase decisions carried in
- `.planning/phases/24-mobile-responsive-touch-pass/24-CONTEXT.md` — P24 D-01/D-03 (container-
  query reflow + sticky-canvas pane) the D-05 fixed app-shell must compose with; D-05/D-06
  (pointer-events pinch + canvas-only `touch-action`) the fit-mode change must not break; the
  zoom-button re-token discretion carried into D-09.
- `.planning/phases/23-the-four-screens-in-flow-order/23-CONTEXT.md` and `23-PATTERNS.md` — the
  four pure/props-only screens, the single-mount viewer seam, the soft-invalidate/Recompute
  seam (D-02 reverses it), the Advanced-disclosure defaults (SC3 already resolved), and the
  "legacy Step deletion → Phase 25" boundary.
- `.planning/phases/20-atelier-design-system-canvas-first-shell/20-CONTEXT.md` — D-01 App-owns-
  state, D-13 soft-invalidate, D-14 single-mount viewer never remounts (the hard constraint the
  app-shell restructure + fit-mode must honor).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`handleRecomputeMatch` + `isStale`/`staleFromStep` (`App.tsx:507–532`)** — the proven
  soft-invalidate → commit flow; D-02 auto-fires it on a debounce rather than rewriting recompute.
- **`viewer.ts` `fitToContainer()` (via `onFit`) + `0.5–50` clamps** — the fit math already
  exists; D-04 adds a persistent `isFitMode` flag around it, not new fit math.
- **Dedicated print-only report DOM (Supply-Report / legend)** — already correct and independent;
  D-03 adds canvas-grid print without touching them.
- **Phase 23 aside test-retargeting precedent** — the pattern for severing test coupling to
  deleted UI (retarget vs intentional-retirement) applies verbatim to the Step1/2/4 deletion.

### Established Patterns
- **App owns state; screens pure/props-only** (P20 D-01) — cleanup + UX fixes change CSS/layout,
  App state, and `viewer.ts` behavior; never screen state ownership.
- **Single-mount viewer never remounts** (P20 D-14) — the D-05 app-shell re-zones the canvas,
  the D-04 fit-mode changes its scale; neither remounts it.
- **Browser-native, zero new deps** (CLAUDE.md) — fit-mode + fixed shell are hand-rolled
  CSS/flex + a viewer flag; no layout/scroll library.
- **Engine signatures froze in Phase 22** — `viewer.ts` gets a behavior-only extension (D-04),
  matching the P24 pinch precedent; no public signature change.
- **Strangler ships green every commit** — deletion + test-retargeting land together; suite
  stays green.

### Integration Points
- `App.tsx` panels 1/2/4 ← delete legacy branch, keep the `USE_NEW_*` ternary shell / or
  collapse to the new screen only (planner's call, but panel 3 MUST keep its ternary + Step3Canvas).
- `App.tsx` canvas `<main>` ← `print:block` on all steps (D-03); Back/Next footer ← fixed bottom
  zone (D-05); soft-invalidate ← auto-fire (D-02); `gempixel_theme` removeItem + slate remnants
  ← swept (D-01, preserving fulfillment-coupled modals).
- `AtelierShell.tsx` ← 3-zone fixed app-shell (D-05).
- `CanvasWorkspace.tsx` ← re-token viewport + zoom buttons (D-09); view-switcher bottom-snap (D-07).
- `viewer.ts` ← `isFitMode` (D-04).
- `RefineScreen.tsx` ← drop stale props (D-02); rail width-cap (D-06).

</code_context>

<specifics>
## Specific Ideas

- **"Ctrl+P prints the canvas you're making"** — the WR-01 fix (D-03) makes plain Ctrl+P work
  from every step, not a guided note; it's a real fix, not a paper-over.
- **"No dead-end no-op on upload"** — auto-advance Upload → Refine (D-08) so the upload action
  visibly progresses the flow.
- **"The canvas is the focus"** — rail fits the browser and never encroaches (D-06); fit-to-
  container is the resting zoom (D-04); the viewport stops being dark (D-09).
- **"Next always reachable"** — fixed app-shell (D-05); on the long drill/supply list the list
  scrolls internally while Next stays hittable.
- **Don't orphan live features** — Step3Canvas + the Diamond Drills USA cart + canvas PNG export
  survive this phase intact; Phase 26 re-homes them (D-01).

</specifics>

<deferred>
## Deferred Ideas

- **Delete `Step3Canvas.tsx`, its 3 fulfillment handlers, the coupled `slate-*` fulfillment
  modals, and the `flags.ts` module; reach the single UI tree** → **Phase 26** (owns it via
  SC5, after re-homing canvas PNG export + Diamond Drills USA cart into the new Order step).
- **Canvas PNG packet + Diamond Drills USA cart re-home into the Order step** → **Phase 26**
  (ORDER-04/05) — the functional counterpart to the deferred deletion above.
- **Service-fee line + order-ref/threshold flagging** (old v3.0 Phase 17 FEE-01) → still
  Backlog; not revived by v4.0.

None of the above are scope creep — all are the explicit Phase 26 / Backlog boundary; captured
so nothing is lost.

</deferred>

---

*Phase: 25-retire-legacy-steps-cleanup*
*Context gathered: 2026-07-16*
