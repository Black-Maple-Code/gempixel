---
phase: 26-interim-customer-fulfillment-canvas-png-packet-diamond-drill
plan: 04
subsystem: ui
tags: [d-08, atelier-light, re-token, grep-gate, strangler-close]
requires: [26-03]
provides:
  - "Atelier-light error banners (match + action) — warn-on-light recipe"
  - "Atelier-light Save Project Modal (ids/behavior preserved)"
  - "Hard D-08 grep-gate: zero live dark-slate/white/rose remnants"
  - "Render-level dark-shell guard tightened to the single-skin invariant"
affects:
  - src/App.tsx
  - src/__tests__/App.test.tsx
tech-stack:
  added: []
  patterns:
    - "warn-on-light error recipe: border border-warn text-warn bg-panel-2"
    - "neutral bg-ink/70 scrim (outside slate 900/950 family) for modal dimming"
key-files:
  created: []
  modified:
    - src/App.tsx
    - src/__tests__/App.test.tsx
decisions:
  - "Save Project Modal re-tokened too (D-08 'any live surface' reading, beyond the two enumerated coupled modals)"
  - "Stale ~1500 shell comment reworded to drop the literal bg-slate-950 class name so the source grep-gate is file-wide clean"
metrics:
  duration: 0h20m
  completed: 2026-07-16
  tasks: 2
  files-changed: 2
  tests-passing: 385
status: complete
---

# Phase 26 Plan 04: D-08 Cleanup — Re-token Last Dark Remnants + Hard Grep-Gate Summary

Re-tokened the last dark-slate/rose remnants of the retired fulfillment path (both frame-scope error banners + the still-live Save Project Modal) to the Atelier light system and enforced the hard D-08 grep-gate — `bg-slate-9(00|50)`, `text-white`, and `rose-950` now return ZERO matches on any live (non-print) surface, closing the phase's SC5/D-08 strangler.

## What Was Built

- **Both frame-scope error banners** (match error + action error) re-tokened to the UI-SPEC warn-on-light recipe `border border-warn text-warn bg-panel-2`. Layout utilities (positioning, spacing, `no-print`, rounding, the action-error dismiss button + behavior) preserved; the dismiss "×" recolored from rose to `text-warn` with `hover:text-ink`.
- **Save Project Modal** re-tokened to Atelier light (class tokens only — ids `save-project-name-input` / `save-project-submit` / `save-project-cancel` and all handlers untouched): light card panel (`bg-panel-2` / `border-border` / `rounded-[var(--radius-card)]`), plain `text-ink` heading (gradient-clip white heading dropped), `text-muted` body, Atelier input recipe (`border-border bg-panel text-ink focus:border-accent`), accent-primary Save button (`bg-accent text-on-accent`), neutral-light Cancel. Overlay scrim switched from `bg-slate-950/80` to a neutral `bg-ink/70` so it still dims the background while clearing the gate.
- **Stale ~1500 shell comment** reworded to describe the removed dark 3-column shell by role, not by its old `bg-slate-950` utility class.
- **Dark-shell render guard** (App.test) strengthened to the post-re-token invariant: no live rendered element carries the dark-slate 900/950 background family; the obsolete "retained modal backdrops out of scope" exemption removed. It now complements the source-level grep-gate one-to-one.

## Enumerate-First Verification (Task 1 opening step)

Ran the D-08 enumeration grep over live source BEFORE re-tokening. Every live occurrence was confined to `src/App.tsx` — the two error banners, the Save Project Modal, and the stale ~1500 comment — exactly the surfaces this plan owns (`Step3Canvas.tsx` and the two coupled modals were already deleted by 26-03). No out-of-scope match existed, so `files_modified` did not need widening and the hard gate was reachable entirely within scope.

## Deviations from Plan

None — plan executed exactly as written. The Save-Project-Modal re-token was pre-anticipated by the planner note (the D-08 "any live surface" discovery beyond the two enumerated coupled modals) and is documented here per the plan's `<output>` instruction.

## Verification

- `npx tsc --noEmit` — exits 0.
- `npx vitest run` — 36 files / 385 tests passing (>= 240 required).
- Hard D-08 grep-gate: `grep -rnE 'bg-slate-9(00|50)|text-white|rose-950' src --include='*.tsx' --include='*.ts' | grep -v __tests__ | grep -v '\.test\.'` returns ZERO lines.
- `git diff --exit-code package.json package-lock.json` — clean (no new dependency).
- `@media print` rules in index.css untouched (out of grep-gate scope).

## Commits

- `ece3d55` refactor(26-04): re-token error banners + Save Modal to Atelier light (D-08)
- `5fecb42` test(26-04): strengthen dark-shell guard to post-re-token invariant (D-08)

## Self-Check: PASSED

- Files exist: src/App.tsx, src/__tests__/App.test.tsx — FOUND
- Commits exist: ece3d55, 5fecb42 — FOUND
