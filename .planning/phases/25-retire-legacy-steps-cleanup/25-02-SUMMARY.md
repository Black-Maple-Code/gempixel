---
phase: 25-retire-legacy-steps-cleanup
plan: 02
subsystem: wizard-viewport
tags: [ui, re-token, atelier, canvasworkspace, d-07, d-09, a11y]
status: complete
requires:
  - "Atelier semantic token layer in src/index.css (bg-bg, bg-panel, border-border, bg-border, text-ink, text-muted, text-faint, bg-accent, text-on-accent)"
provides:
  - "Atelier-cream canvas viewport (no slate-* on-screen)"
  - "bottom-snapped view-mode switcher (D-07 / SC8)"
  - "labelled 44px zoom HUD preserved through the re-token"
affects:
  - "src/features/wizard/CanvasWorkspace.tsx"
tech-stack:
  added: []
  patterns:
    - "D-09 legacy-scale -> semantic-token re-token (stop depending on the @theme remap shim)"
    - "hint-pill glass/positioning idiom reused for the bottom-snapped switcher dock"
key-files:
  created: []
  modified:
    - "src/features/wizard/CanvasWorkspace.tsx"
decisions:
  - "Zoom-button idle icon color set to text-muted (hover text-ink) rather than the map's literal text-ink, matching the switcher idle idiom for a consistent two-tone icon-button feel"
  - "Top viewport-hud gated to grid/symbols modes so it never renders as an empty glass box once the switcher moved out; zoom-control left divider dropped (no longer preceded by the switcher)"
  - "Added aria-pressed to each switcher segment (was absent) — a11y enhancement aligned with the plan's Task-2 acceptance wording"
metrics:
  duration: "~20m"
  tasks: 2
  files-changed: 1
  completed: 2026-07-16
---

# Phase 25 Plan 02: CanvasWorkspace re-token + switcher bottom-snap Summary

Re-tokened the dark `slate-*/sky-*/indigo-*` canvas viewport, view-switcher, zoom HUD, canvas
border, and two-phase loading overlay to semantic Atelier tokens (D-09), and relocated the
Grid / Grid+Symbols / Original switcher from the top `viewport-hud` to a bottom-snapped centered
dock (D-07 / SC8) — the viewport now renders on the cream `bg-bg` backdrop and the switcher never
obstructs the canvas raster.

## What was built

**Task 1 — D-09 re-token (commit 23b6fad).** Applied the UI-SPEC re-token map to every on-screen
class in `CanvasWorkspace.tsx`:
- viewport surface `bg-slate-950` → `bg-bg`; loading overlay `bg-slate-950/80` → `bg-bg/80`
- active switcher segment `bg-sky-500 text-white` → `bg-accent text-on-accent`
- progress fill `bg-indigo-500` → `bg-accent`; progress track `bg-slate-800` → `bg-border`
- canvas / HUD / reference-image borders `border-slate-800` → `border-border`
- HUD/hint text `text-slate-300/400/500` → `text-ink` / `text-muted` / `text-faint`
- zoom buttons keep `min-h-[44px] min-w-[44px]`; aria-labels aligned to
  "Zoom in" / "Zoom out" / "Fit to screen"
- indeterminate loading-overlay label set to the UI-SPEC pending copy **"Recomputing…"**
  (determinate phase kept as "Matching colors: {progress}%")
- print-legend `slate-*` rules left intact (print-only DOM, explicitly out of the D-09 on-screen scope)

**Task 2 — switcher bottom-snap (commit a18fc5c).** Moved the switcher out of the top
`viewport-hud` into an `absolute bottom-16 left-1/2 -translate-x-1/2 z-30 no-print` dock that
mirrors the hint-pill glass idiom (`bg-panel/80 border border-border backdrop-blur`). It stacks
≥8px above the `bottom-4` hint pill and renders in all view modes (including reference). The top
`viewport-hud` is now gated to grid/symbols so it never appears as an empty glass box; the zoom
controls dropped their orphaned left divider. Added `aria-pressed={isActive}` to each segment.

## Verification

- `npx tsc --noEmit` — clean
- `npm test` (full vitest suite) — 36 files, 355 passed, 7 skipped (pre-existing skips); integration
  suite green
- On-screen `bg-slate-950 / border-slate-800 / bg-slate-800 / text-slate-3|4|5 / bg-sky-500 / bg-indigo-500`
  count == 0; remaining `slate-*` is print-legend only (allowed)
- `min-h-[44px] min-w-[44px]` count == 3; `aria-label` count == 3; switcher `aria-pressed` present
- `git diff` for this plan touches only `src/features/wizard/CanvasWorkspace.tsx`

## Deviations from Plan

### Auto-added functionality

**1. [Rule 2 - Missing a11y] Added `aria-pressed` to switcher segments**
- **Found during:** Task 2
- **Issue:** Task-2 acceptance requires the switcher keep "three aria-pressed segment buttons", but
  the pre-existing markup had no `aria-pressed` attribute at all.
- **Fix:** Added `aria-pressed={isActive}` to each mapped segment button.
- **Files modified:** src/features/wizard/CanvasWorkspace.tsx
- **Commit:** a18fc5c

### Minor scope adjustments (within re-token spirit)

**2. Top `viewport-hud` gated to grid/symbols + zoom-control divider dropped**
- After the switcher moved out, the top HUD would have rendered as an empty glass box in reference
  mode (only zoom/warning remained, both hidden there). Gated the HUD on `grid || symbols` and
  removed the now-orphaned `border-l border-border pl-3` from the zoom-control container. Structural
  positioning of the zoom HUD itself is unchanged. Documented as a token/layout-consistency follow-on
  of the D-07 move, not new behavior.

## Threat surface

No new surface. Purely presentational token remap + reposition on a pure/props-only component; no
input, network, storage, or engine-signature change. The fulfillment-coupled `slate-*` modals in
`App.tsx` and `engine/checkout.ts`/`export.ts` were not touched (scope confined to CanvasWorkspace.tsx).

## Known Stubs

None.

## Self-Check: PASSED
- FOUND: src/features/wizard/CanvasWorkspace.tsx
- FOUND commit: 23b6fad (Task 1 re-token)
- FOUND commit: a18fc5c (Task 2 bottom-snap)
