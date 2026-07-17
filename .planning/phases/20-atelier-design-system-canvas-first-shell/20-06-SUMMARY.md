---
phase: 20-atelier-design-system-canvas-first-shell
plan: 06
subsystem: wizard-shell
tags: [ui, layout, shell, gap-closure, tailwind]
gap_closure: true
requires: [20-04, 20-05]
provides: [SHELL-01-gap-closed, SHELL-02-gap-closed]
affects: [src/App.tsx, src/features/wizard/AtelierShell.tsx, src/__tests__/App.test.tsx]
tech-stack:
  added: []
  patterns: ["definite viewport height (h-dvh) on shell root to engage flex-1 min-h-0 internal scroll"]
key-files:
  created: []
  modified:
    - src/App.tsx
    - src/features/wizard/AtelierShell.tsx
    - src/__tests__/App.test.tsx
decisions:
  - "Used justify-end (not ml-auto) to keep the lone collapse button right-aligned after removing the sidebar brand cluster."
  - "Used Tailwind v4 native h-dvh utility (dynamic viewport height) rather than the h-[100dvh] arbitrary fallback — h-dvh is available in this build."
  - "Left src/index.css body min-h-screen rule untouched — the root's exact 100dvh + overflow-hidden prevents page scroll, so no CSS change was needed."
metrics:
  duration: ~6m
  completed: 2026-07-13
  tasks: 2
  files: 3
status: complete
---

# Phase 20 Plan 06: Shell-Layout Gap Closure Summary

Closed the two Phase 20 UAT Test 4 shell-layout gaps: removed the duplicate "GemPixel" wordmark from the legacy left sidebar and gave the AtelierShell root a definite viewport height (`h-dvh`) so the canvas returns above the fold and sidebars scroll internally.

## What Was Built

### Task 1 — GAP 1: Duplicate wordmark removed (commit `1ad4b6b`)
- Removed the legacy sidebar brand cluster in `src/App.tsx` (the `.gem-logo` 3×3 pixel tile, the `<h1>GemPixel</h1>` wordmark, and the "Diamond Painting Planner" tagline `<p>`). The AtelierShell top-bar wordmark span is now the single intended wordmark.
- Kept the collapse button right-aligned by changing the header row from `justify-between` to `justify-end` (with the brand cluster gone the button is the row's only flex child; `justify-between` would have pushed it to the left edge). Button still collapses/expands the sidebar.
- Retargeted both wordmark assertions in `src/__tests__/App.test.tsx` from `container.querySelector('h1')` to `container.querySelector('header span.font-display')`, and added a regression guard in each test asserting no `<h1>` has `textContent === 'GemPixel'` (the surviving print-only `<h1>` is the full report title, not an exact match).

### Task 2 — GAP 2: Canvas above the fold (commit `0e2c6ab`)
- Changed the `AtelierShell` root `<div>` from the indefinite-height `flex flex-col min-h-screen` to the definite-height `flex flex-col h-dvh overflow-hidden`. This gives the whole flex chain a definite height so the already-correct row wrapper (`flex flex-1 min-h-0 overflow-hidden`, App.tsx:1290) caps to the viewport and both sidebars' inner `overflow-y-auto` engage — returning the canvas above the ~800px fold.
- `src/index.css` body rule left untouched (inspected per plan; no page-scroll regression because the root now sets an exact 100dvh + clip).

## Verification

- `npx tsc --noEmit` — clean (exit 0).
- `npx vitest run` (full suite) — 255/255 tests passed across 23 files, including the two retargeted App.test.tsx wordmark assertions.
- `grep -cE 'h-dvh|h-\[100dvh\]' src/features/wizard/AtelierShell.tsx` — returns 1.

The end-of-phase browser human-checks (single visible wordmark; canvas above the fold with a match loaded; internal sidebar scroll; StepBar/Save-pill/soft-invalidate unregressed) are handled at the orchestrator level (`human_verify_mode: end-of-phase`).

## Deviations from Plan

None — plan executed exactly as written. The optional `items-center -> items-start` canvas top-align (Task 2) was explicitly conditional and not applied, per the plan's instruction not to apply it speculatively. `src/index.css` was inspected but required no change.

## Known Stubs

None.

## Self-Check: PASSED
- FOUND: src/App.tsx (modified, committed 1ad4b6b)
- FOUND: src/__tests__/App.test.tsx (modified, committed 1ad4b6b)
- FOUND: src/features/wizard/AtelierShell.tsx (modified, committed 0e2c6ab)
- FOUND commit: 1ad4b6b
- FOUND commit: 0e2c6ab
