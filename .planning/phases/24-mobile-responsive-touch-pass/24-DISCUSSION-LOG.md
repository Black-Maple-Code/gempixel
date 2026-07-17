# Phase 24: Mobile Responsive + Touch Pass - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 24-mobile-responsive-touch-pass
**Areas discussed:** Reflow container strategy, Refine mobile stacking, Touch gesture model, Legacy drawer CSS
**Mode:** Advisor (research-backed comparison tables; `standard` calibration tier — 2–4 options per area)

---

## Reflow container strategy

| Option | Description | Selected |
|--------|-------------|----------|
| A: `@container` on `AtelierShell` root, ~640px | Tailwind v4 `@container` on the existing shell root box; body flips `@max-[640px]:flex-col`, rail relaxes to `w-full`. No new DOM. | ✓ |
| B: Named `@container/shell` wrapper | Dedicated named container div around the body; self-documenting, +1 node. | |
| C: Body-as-container + inner flex | Restructure body into container + inner flex; re-homes `min-w-0`/`justify-center` (canvas-sizing regression risk). | |

**User's choice:** A — `@container` on shell root, ~640px flip.
**Notes:** Decisive constraint from research: container queries style *descendants*, never the element itself, and `display:contents` wrappers carry no box — so `container-type` must live on a real ancestor (the `AtelierShell` root). Threshold ~640px = 360px rail + ~280px min canvas can't coexist below it. Desktop provably unregressed (descendant-only overrides).

---

## Refine mobile stacking

| Option | Description | Selected |
|--------|-------------|----------|
| A: Canvas-first, sticky top (~45dvh) | Canvas + zoom HUD `sticky top-0`; controls scroll beneath, drill-count preview stays live. Pure CSS, single-mount preserved. | ✓ |
| B: Canvas-first, non-sticky | Canvas ~45vh on top, scrolls away as you reach the controls. | |
| C: Shrinking sticky hybrid | JS scroll listener collapses canvas to a mini strip; repaint-jank + single-mount fragility. | |

**User's choice:** A — canvas-first, sticky top pane.
**Notes:** Reinforces canvas-first identity + keeps the pinch-zoom target on-screen. Pure CSS reflow honors Phase 20 D-14 (viewer only reordered, never remounted). `position: sticky` works because the `h-dvh overflow-hidden` body is the single scroll region. Validated risk: custom-size numeric input vs. mobile keyboard under the pinned pane → fallback is dropping `sticky` (→ B), NOT the JS hybrid C.

---

## Touch gesture model

| Option | Description | Selected |
|--------|-------------|----------|
| A: Pointer Events + pointer `Map`, canvas-only `touch-action` | Extend existing pointer handlers with `activePointers` map; 2 pointers → pinch reusing `handleZoom`; 1 finger still pans. `touch-action:none` on the canvas element only. No deps. | ✓ |
| B: Parallel Touch Events API | `touchstart/move/end` alongside pointer events; second input paradigm, duplicated pan, desktop-regression risk. | |
| C: Gesture library (@use-gesture / Hammer) | Runtime dependency. | |

**User's choice:** A — Pointer Events + `activePointers` map, canvas-only `touch-action`.
**Notes:** Viewer is already 100% Pointer Events with guarded `setPointerCapture`, so pinch is additive. Reuse the cursor-anchored `handleZoom(midX,midY,ratio)` + `0.5–50` clamps; single-finger drag still pans; branch on `activePointers.size === 2`. `touch-action: none` scoped to the canvas element only (page never scrolls under gesture; surrounding UI stays scrollable). Desktop unreachable by pinch branch (mouse never yields 2 pressed pointers); jsdom green via the `size === 2` gate. Option C rejected — violates the project's browser-native/no-dependency convention (CLAUDE.md already rejects `panzoom`).

---

## Legacy drawer CSS

| Option | Description | Selected |
|--------|-------------|----------|
| 1: Full removal now | Delete dead `aside`/`.drawer-backdrop`/`aside.w-96`/`aside.w-0` rules this phase; preserve the live `.viewport-hud` mobile rule. | ✓ |
| 2: Defer all to Phase 25 | Keep Phase 24 strictly additive; cleanup phase grep-sweeps it. | |
| 3: Hybrid (neutralize conflicting only) | Remove broad overlay + `.drawer-backdrop` now, defer inert variants. | |

**User's choice:** 1 — full removal now.
**Notes:** Dead since Phase 23 removed all `<aside>` drawers. The CSS sits in Phase 24's exact `index.css` blast radius and encodes the "drawer" model MOBILE-01 abolishes. Cross-check: new screens use plain `<div>` and reflow A adds no `<aside>` → zero `<aside>` introduced, so Option 3's rationale evaporates. Execution guardrail: scope the edit to named `aside`/`.drawer-backdrop` selectors only; do NOT delete the adjacent live `.viewport-hud` rule.

---

## Claude's Discretion

- Exact Tailwind flip syntax: arbitrary `@max-[640px]` vs built-in `@max-2xl` (672px).
- Sticky canvas pane height (`~45dvh` starting value) and precise controls order in the reflowed column.
- On-screen zoom-button touch ergonomics: whether to bump `p-1.5` tap targets to ~44px and re-token the legacy `slate-*` classes to Atelier colors, or leave as-is (MOBILE-02 only requires the buttons exist and aid touch zoom).
- Pinch redraw throttling: `requestAnimationFrame` vs draw-per-`pointermove`.

## Deferred Ideas

- Deleting legacy `Step1..4` components, theme/dark-mode remnants, dead preset state → Phase 25.
- JS scroll-driven shrinking canvas hybrid on Refine → rejected; fallback is non-sticky canvas-first, not the hybrid.
- Re-tokening/enlarging zoom buttons to Atelier + 44px touch targets → in-phase discretion, else a Phase 25 cleanup candidate.
