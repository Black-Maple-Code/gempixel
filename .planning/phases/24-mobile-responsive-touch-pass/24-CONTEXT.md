# Phase 24: Mobile Responsive + Touch Pass - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 24 makes the **already-built** Atelier 4-step journey (Upload → Refine → Supplies → Order, wired in Phase 23) work on a phone: the same screens reflow to a **single portrait column at ~300px via CSS container queries** with **every control inline (never a drawer)**, and the chart gains **touch pinch-zoom + pan** with **`touch-action: none`** so the page never scrolls under the gesture. It is a **purely additive layout + touch pass** — no engine signature changes (engine froze in Phase 22), no new screens, no state-ownership changes.

Requirements delivered: **MOBILE-01** (single portrait column, every control inline, nothing overflows) and **MOBILE-02** (pinch-to-zoom + pan on touch, aided by the existing on-screen zoom buttons, `touch-action: none` on the canvas).

The only subtractive edit in scope is deleting the **dead legacy `@media (max-width:767.98px)` drawer CSS** (D-04) — it is inside this phase's exact CSS blast radius and encodes the "drawer" model MOBILE-01 abolishes.

**Not in this phase:**
- Any `src/engine/*` signature change — engine frozen since Phase 22.
- Deleting legacy `Step1..4` components / theme remnants / dead preset state → **Phase 25** (strangler close). Only the dead *drawer CSS* is removed here (D-04); the legacy Step bodies stay live behind their flags.
- New controls or new screen behavior — this phase reflows and adds touch to what Phase 23 shipped; it does not add capability.
- Desktop redesign — desktop layout must stay **unregressed** (container queries add descendant-only overrides; base `flex-row`/`w-[360px]` classes are untouched).

</domain>

<decisions>
## Implementation Decisions

### Reflow mechanism — CSS container queries (MOBILE-01)
- **D-01:** **Put Tailwind v4 `@container` (`container-type: inline-size`) on the existing `AtelierShell` root box** (`src/features/wizard/AtelierShell.tsx` — the `<div className="flex flex-col h-dvh overflow-hidden">`). The shell body then flips to a column with `@max-[640px]:flex-col` and the Refine rail relaxes with `@max-[640px]:w-full`. **No new DOM nodes.** (Chosen over a dedicated named `@container/shell` wrapper — no extra node needed yet — and over restructuring the body into container+inner-flex, which would re-home the `min-w-0`/`justify-center` canvas-sizing utilities and risk a regression.)
  - **Hard constraint (why not the shell body itself):** a container query styles a container's **descendants, never the element itself**, and **`display:contents` wrappers generate no box** so they cannot carry `container-type`. The `container-type` MUST live on a real ancestor box (the `AtelierShell` root). The query still reaches `RefineScreen`'s root because that root is a genuine flex-item descendant. Do **not** attempt to put `container-type` on the flex-row shell body and flip that same element — it can't query its own width.
- **D-02:** **Breakpoint ≈ 640px.** The Refine controls rail is 360px and the canvas needs ~280px minimum to stay usable, so they cannot coexist below ~640px — the natural flip point. Use an arbitrary `@max-[640px]` (valid in Tailwind v4) or the nearest built-in container size `@max-2xl` (672px); planner's call. Well below any real desktop container width, so only the max-variant overrides fire on the ~300px phone.
  - The other three screens (Upload / Supplies / Order) are already single-panel (canvas is `display:none` on those steps), so the same flip makes their sole panel full-width — no per-screen work beyond the shared reflow.

### Refine keystone mobile stacking (MOBILE-01, keystone screen)
- **D-03:** **Canvas-first with a sticky top pane (~45dvh).** On `@max-[640px]` the Refine layout stacks `flex-col` with the **canvas + zoom HUD in a `sticky top-0` wrapper (~`h-[45dvh]`)** at the head of the single scroll region, and the controls rail (SizeCards → custom-size → edge-cleanup SegmentedControl → color Slider → Advanced disclosure) scrolling beneath it. This keeps the live drill-count / color preview visible while the user drags controls, and keeps the pinch-zoom target on-screen.
  - **Single-mount preserved (Phase 20 D-14):** this is a pure CSS reflow — the one `<CanvasViewer>` is only **reordered**, never conditionally mounted/unmounted per breakpoint. `position: sticky` works because the `h-dvh overflow-hidden` body is the single scroll region.
  - **Validated risk + fallback:** the custom-size numeric input may collide with the mobile keyboard under a 45dvh pinned pane. **If testing shows cramping, drop `sticky` (→ non-sticky canvas-first)** rather than reaching for a JS scroll-driven shrinking hybrid (repaint jank + single-mount fragility on a 40k-dot canvas — explicitly avoided).

### Touch gesture model + touch-action scope (MOBILE-02)
- **D-05:** **Extend the existing Pointer Events model in `src/engine/viewer.ts` with an `activePointers = Map<pointerId, {x,y}>`.** Update entries on `pointermove`, delete on `pointerup`/`pointercancel`. When **exactly two pointers are down (`activePointers.size === 2`)**, branch from pan into pinch: compute the two-pointer Euclidean distance + midpoint (in canvas-local coords via `clientX - rect.left`, matching the existing `handleWheel`), and feed them into the **existing cursor-anchored `handleZoom(midX, midY, currentDist / prevPinchDist)`** so pinch reuses the proven zoom math and the same `minScale 0.5 / maxScale 50` clamps; apply the midpoint delta between frames as a two-finger pan. **Single-finger drag keeps panning** through the existing `isDragging` path. (Chosen over a parallel Touch Events API — that adds a second input paradigm and duplicated pan logic with desktop-regression risk — and over a gesture library, which violates the project's browser-native / no-dependency convention; CLAUDE.md already rejects `panzoom` for the same reason.)
- **D-06:** **`touch-action: none` scoped to the canvas element ONLY** (`this.canvas.style.touchAction = 'none'` or a Tailwind `touch-none` utility), **not** the whole workspace frame — this stops the page scrolling/zooming under the gesture while leaving surrounding scroll UI natively scrollable, and (with Pointer Events) is the declarative mechanism guaranteeing continuous `pointermove` delivery for touch. The existing `wheel` listener stays the only place needing `{passive:false}` + `preventDefault` (wheel is not covered by `touch-action`).
  - **Desktop unregressed:** the pinch branch is unreachable for mouse (`pointerType === 'mouse'` never yields two concurrent pressed pointers).
  - **jsdom suite stays green:** gate the pinch branch on `activePointers.size === 2` (jsdom dispatches at most synthetic single pointers, never two live entries); keep all `setPointerCapture` calls in the existing try/catch; read `getBoundingClientRect()` defensively. Capture caveat: when a 2nd pointer arrives, don't let the 1st pointer's capture swallow it (skip capture while pinching, or capture both ids; release on up/cancel).

### Legacy drawer CSS cleanup (scope boundary)
- **D-04:** **Remove the dead `@media (max-width:767.98px)` drawer CSS now, in this phase.** Delete the orphaned `aside { position:fixed; width:100vw; ... }`, `aside.w-96`, `aside.w-0`, and `.drawer-backdrop` rules in `src/index.css` (dead since Phase 23 removed all `<aside>` drawer elements from the render tree). **Preserve the still-live `@media (max-width:767.98px) .viewport-hud {…}` rule** in the same block — scope the edit to the named `aside`/`.drawer-backdrop` selectors only, do NOT delete the whole media block. (Chosen over deferring to Phase 25: the dead CSS is inside Phase 24's exact CSS blast radius and encodes the "drawer" model MOBILE-01 abolishes. The hybrid "neutralize-only" option's rationale evaporates because the new layout introduces **zero `<aside>` elements** — verified: the new screens use plain `<div>`, and reflow D-01 adds no `<aside>`.)

### Claude's Discretion
- Exact Tailwind syntax for the flip: arbitrary `@max-[640px]` vs built-in `@max-2xl` (672px) — either is well below desktop; planner picks.
- The exact sticky canvas pane height (`~45dvh` is a starting value) and the precise controls order within the reflowed column (follow the existing desktop rail order).
- **On-screen zoom-button touch ergonomics:** the zoom buttons already exist in `CanvasWorkspace.tsx` but use small `p-1.5` tap targets and legacy dark-theme `slate-*` classes. Whether to bump them to ~44px touch targets / re-token them to Atelier colors as part of the mobile pass, or leave as-is — planner's judgment; MOBILE-02 only requires the buttons exist and aid touch zoom (they do).
- Whether pinch uses `requestAnimationFrame` throttling for the redraw or draws per `pointermove` (the existing pan draws per-move) — planner's call based on the LOD renderer's cost.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone grounding
- `.planning/ROADMAP.md` §"Phase 24" — goal, Success Criteria 1–3 (single portrait column via container queries; pinch/pan + on-screen zoom + `touch-action:none`; desktop unregressed + 240+ Vitest green), and the Phase 23→24→25 boundary.
- `.planning/REQUIREMENTS.md` — **MOBILE-01** (single portrait column, every control inline, never a drawer) and **MOBILE-02** (pinch-to-zoom + pan on touch, `touch-action: none` on the canvas). Both Pending → delivered here.

### Live touch/viewer target (the pinch-zoom edit)
- `src/engine/viewer.ts` (~438 lines) — the `CanvasViewer` class. Already 100% Pointer Events: `handlePointerDown/Move/Up/Cancel` (L70–111) with `isDragging`/`lastPointerX/Y` single-drag pan; `handleWheel` (L113–122) `{passive:false}` cursor-anchored; `handleZoom(mouseX, mouseY, zoomFactor)` (L124–141) with `minScale 0.5`/`maxScale 50` + `onZoomChange`; `setupListeners`/`destroy` (L54–68). Extend with `activePointers` map + pinch branch (D-05); add canvas-only `touch-action` in the constructor/`setupListeners` (D-06). `setPointerCapture` already try/catch-guarded for jsdom.

### Live layout targets (the container-query reflow)
- `src/features/wizard/AtelierShell.tsx` (82 lines) — the `<div className="flex flex-col h-dvh overflow-hidden">` root box that receives `@container` (D-01). Pure/props-only; owns no step state.
- `src/App.tsx` (~2460 lines) — the shell body `<div className="flex min-h-0 flex-1 flex-row justify-center">` (~L1612) that flips to `flex-col` (D-01), the single-mount canvas `<main>` (~L1619) and the display-toggled `data-step-panel` sibling wrappers (`display:contents`, ~L1641+). App stays the sole state owner (Phase 20 D-01). The sticky Refine canvas wrapper (D-03) lives here.
- `src/features/screens/RefineScreen.tsx` — root is `flex w-[360px] max-w-full flex-col ... border-l` (L108); relaxes to `w-full` on `@max-[640px]` (D-01). Controls order: SizeCards → custom-size → edge-cleanup SegmentedControl → color Slider → Advanced disclosure.
- `src/features/wizard/CanvasWorkspace.tsx` — carries the on-screen zoom HUD (zoom in/out/fit buttons, L112+) and low-zoom warning; the zoom buttons satisfy MOBILE-02's "on-screen zoom buttons" (touch-ergonomics is Claude's discretion).
- `src/index.css` — the `@media (max-width:767.98px)` blocks: dead `aside`/`.drawer-backdrop` rules to delete (D-04, ~L497–536) and the **live `.viewport-hud` mobile rule to preserve** (~L565–575).

### Codebase maps
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/TESTING.md` — pure-engine/thin-UI split, naming, and the Vitest+jsdom baseline the mobile/touch tests extend.

### Prior-phase decisions carried in
- `.planning/phases/23-the-four-screens-in-flow-order/23-CONTEXT.md` — the four screens' structure, the single-mount viewer seam, and the explicit "mobile responsive/touch → Phase 24" and "legacy Step deletion → Phase 25" boundaries.
- `.planning/phases/20-atelier-design-system-canvas-first-shell/20-CONTEXT.md` — **D-01** App-owns-state, **D-14** single-mount viewer never remounts (the hard constraint the reflow + sticky pane must honor).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`viewer.ts` `handleZoom` (cursor-anchored) + `0.5–50` clamps** — the pinch focal-point math reuses it directly; pinch is additive, not a rewrite (D-05).
- **`viewer.ts` Pointer Events + guarded `setPointerCapture`** — already the one input model for mouse/pen/touch; multi-touch extends the same handlers (D-05).
- **On-screen zoom HUD (`CanvasWorkspace.tsx`)** — zoom in/out/fit buttons already exist; MOBILE-02's "on-screen zoom buttons" requirement is already met.
- **`AtelierShell` root box** — a real full-width box one level above the shell body; the correct, DOM-free home for `container-type` (D-01).
- **Single scroll region (`h-dvh overflow-hidden` body)** — makes `position: sticky` on the Refine canvas pane work without extra scroll plumbing (D-03).

### Established Patterns
- **App owns state; screens pure/props-only** (Phase 20 D-01) — the mobile pass changes CSS/layout + the viewer engine, not state ownership.
- **Single-mount viewer never remounts** (Phase 20 D-14) — the reflow only *reorders* the `<CanvasViewer>`; nothing is conditionally mounted per breakpoint.
- **Browser-native, no dependencies** (CLAUDE.md; rejects `panzoom`/Fabric/etc.) — pinch is hand-rolled Pointer Events (D-05), not a gesture lib.
- **Desktop base classes untouched; responsive adds overrides only** — container queries add descendant-only `@max-[640px]:*` variants, so desktop is provably unregressed.
- **jsdom test discipline** — guard real-touch paths behind `activePointers.size === 2`; keep capture in try/catch (D-05).

### Integration Points
- `viewer.ts` ← pinch/pan multi-touch + canvas-only `touch-action` (D-05/D-06); public zoom API + `onZoomChange` unchanged.
- `AtelierShell.tsx` root ← `@container` (D-01); `App.tsx` shell body ← `@max-[640px]:flex-col` + Refine sticky canvas wrapper (D-01/D-03).
- `RefineScreen.tsx` root ← `@max-[640px]:w-full` (D-01).
- `index.css` ← delete dead drawer rules, preserve `.viewport-hud` (D-04).

</code_context>

<specifics>
## Specific Ideas

- **Container queries, not viewport media queries** — the roadmap mandates the mechanism; the reflow must be container-driven so it responds to the shell's own width, not the raw viewport (D-01).
- **"Never a drawer"** — every control stays inline in the portrait column; no side menu, no overlay. This is why the dead drawer CSS is removed in the same pass (D-04).
- **Canvas-first stays true on mobile** — the sticky canvas pane keeps the preview + zoom HUD visible while the user tunes controls beneath it (D-03).
- **Pinch reuses the proven zoom math** — the midpoint feeds the existing cursor-anchored `handleZoom`, so touch zoom behaves identically to wheel zoom (same clamps, same anchoring) (D-05).
- **`touch-action: none` on the canvas only** — not the frame; the page must never scroll under the gesture, but surrounding UI stays natively scrollable (D-06).

</specifics>

<deferred>
## Deferred Ideas

- **Deleting legacy `Step1..4` components, theme/dark-mode remnants, dead preset state** — the strangler flags flip fully on and the old bodies are removed → **Phase 25** (only the dead *drawer CSS* is removed in Phase 24, per D-04).
- **JS scroll-driven shrinking canvas hybrid on Refine** — rejected for repaint jank + single-mount fragility; not revisited unless the sticky pane (D-03) proves to cramp controls, in which case the fallback is the simpler non-sticky canvas-first, not the hybrid.
- **Re-tokening / enlarging the zoom buttons to Atelier colors + 44px touch targets** — captured as Claude's discretion within this phase; if not done here it is a natural Phase 25 cleanup candidate.

None of the above were scope creep — all are already-mapped later phases or in-phase discretion; captured so nothing is lost.

</deferred>

---

*Phase: 24-mobile-responsive-touch-pass*
*Context gathered: 2026-07-15*
