---
phase: quick-260716-tlu
plan: 01
subsystem: wizard-ui
tags: [layout, tailwind, preact, wizard]
status: complete
requires:
  - src/features/wizard/AtelierShell.tsx
  - src/App.tsx
provides:
  - "Header-hosted New + Save controls"
  - "Full-bleed, flush-right config panel on steps 2-4"
  - "Tightened top spacing under the step bar"
affects:
  - src/features/wizard/AtelierShell.tsx
  - src/App.tsx
tech-stack:
  added: []
  patterns:
    - "Header workspace controls grouped in a right-aligned flex row"
    - "Full-bleed frame (no width cap, no right gutter) for flush-right rail"
key-files:
  created: []
  modified:
    - src/features/wizard/AtelierShell.tsx
    - src/App.tsx
decisions:
  - "New button id (#new-project-btn) migrated from the deleted floating row into the AtelierShell header so App.test.tsx reset tests stay green"
  - "Header Save pill already ran the identical save-modal handler, so the floating Save-project button was removed with zero behavior loss"
metrics:
  duration: ~6min
  completed: 2026-07-16
---

# Quick Task 260716-tlu: Fix Three GemPixel Wizard Layout Issues Summary

Consolidated the wizard's New/Save controls into the header, deleted the floating action row, and full-bled the frame so the right-hand config panel sits flush to the browser edge with tightened top spacing — all via Tailwind class changes, no engine/worker/persistence changes and no new dependencies.

## What Was Built

**Task 1 — Header controls + delete floating row (`AtelierShell.tsx`, `App.tsx`):**
- Added a required `onNew: () => void` prop to `AtelierShellProps` and destructured it in the component signature.
- Replaced the lone header Save button with a right-aligned `flex items-center gap-2` group containing a new secondary/ghost "New" pill (`id="new-project-btn"`, always enabled, wired to `onNew`) followed by the unchanged Save pill.
- Wired `onNew={resetWorkspace}` from `App.tsx`.
- Deleted the entire floating action-row block (both the `#new-project-btn` New and `#save-project-btn` Save-project buttons) that sat over the top-right of the config panel. The header Save pill already ran the identical `setSaveProjectName` + `setSaveModalOpen(true)` handler under the same `canSave={!!matchResult}` gate, so no functionality was lost.

**Task 2 — Full-bleed frame + tighter top (`App.tsx`):**
- Frame wrapper class change: `mx-auto flex min-h-full w-full max-w-[1180px] flex-col px-4 py-4 print:p-0` → `flex min-h-full w-full flex-col pl-4 pr-0 pt-2 pb-4 print:p-0`.
  - Dropped `mx-auto` + `max-w-[1180px]` → workspace spans full viewport width; the right-most panel reaches the browser edge.
  - `px-4` → `pl-4 pr-0` → keeps the left gutter but removes the right gutter so the right rail is truly flush.
  - `py-4` → `pt-2 pb-4` → reduces the dead band under the step bar.
- No changes inside the screen components; RefineScreen / SuppliesScreen / OrderScreen right panels are each already the right-most flex child and now land flush-right. The `@max-[640px]:flex-col` reflow is untouched, so mobile still single-columns with no horizontal overflow.

## Verification

- `npx tsc --noEmit` → 0 type errors (new `onNew` prop typed and passed).
- `npx vitest run src/__tests__/App.test.tsx` (Task 1) → 24/24 pass; the two `#new-project-btn` reset tests pass with the id now in the header.
- `npx vitest run` (Task 2) → full suite **385 passed / 36 files** — above the ~355 prior floor.

**Manual browser walkthrough — DEFERRED:** The `preview_start` / dev-server browser verification tool is not available in this execution context, so the live visual walkthrough (flush-right rail on REFINE/SUPPLIES/ORDER at ~1280px, single-column reflow with no horizontal scrollbar at ~360px) is a manual follow-up for the operator. The structural changes are class-only and the automated gates (tsc + full Vitest suite) are green.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- FOUND: src/features/wizard/AtelierShell.tsx (modified, `onNew` + header New button)
- FOUND: src/App.tsx (modified, `onNew` wiring, floating row deleted, frame full-bled)
- FOUND commit e2726bf (Task 1)
- FOUND commit d32aef5 (Task 2)
