---
phase: 25-retire-legacy-steps-cleanup
plan: 01
subsystem: wizard-ui
tags: [strangler-cleanup, dead-code-removal, test-retargeting]
requires:
  - Phase 23 four-screens (UploadScreen/RefineScreen/SuppliesScreen/OrderScreen) live behind USE_NEW_* flags (all true)
provides:
  - Panels 1/2/4 render only their new Atelier screens (no legacy Step ternary else-branch)
  - steps/ folder holds only the preserved Step3Canvas.tsx
affects:
  - src/App.tsx (panel ternaries, orphaned state/handlers)
  - src/__tests__/App.test.tsx (legacy-panel skip retirement)
tech-stack:
  added: []
  patterns:
    - "tsc noUnusedLocals/noUnusedParameters as the deterministic orphan-detection gate"
    - "Strangler deletion + test retargeting land together, suite green every commit"
key-files:
  created: []
  modified:
    - src/App.tsx
    - src/__tests__/App.test.tsx
  deleted:
    - src/features/wizard/steps/Step1Ingest.tsx
    - src/features/wizard/steps/Step2Palette.tsx
    - src/features/wizard/steps/Step4Export.tsx
decisions:
  - "selectedPreset setter retained (const [, setSelectedPreset]) because live size-change handlers still reset it; only the orphaned getter was removed"
  - "Panel-3 Step3Canvas skips retargeted TODO(25)->TODO(26) rather than retired — Step3Canvas is preserved this phase (D-01), Phase 26 owns its deletion"
metrics:
  duration: ~35m
  completed: 2026-07-16
  tasks: 3
  files_changed: 5
status: complete
---

# Phase 25 Plan 01: Retire Legacy Steps (Strangler Close) Summary

Completed the v4.0 strangler close for panels 1/2/4: deleted the residual `Step1Ingest`,
`Step2Palette`, `Step4Export` component files, collapsed their now-dead `USE_NEW_* ? Screen : <StepN>`
ternary else-branches in `App.tsx` to the new screen only, removed every App-level state/handler
that `tsc` proved orphaned by the deletion, and retired the deleted-Step skipped tests — all while
the Vitest suite stays green (355 passing) and the preserved Step3Canvas fulfillment path is
verifiably untouched.

## What Was Built

- **Task 1 (264c264):** `git rm` of the three legacy Step files; removed their imports from
  `App.tsx` (Step3Canvas import preserved); collapsed panels 1/2/4 to `<UploadScreen/>` /
  `<RefineScreen {...refineProps}/>` / `<OrderScreen {...orderProps}/>`. Panel-3
  (`USE_NEW_SUPPLIES ? SuppliesScreen : Step3Canvas`) left verbatim.
- **Task 2 (8b927d7):** Removed the tsc-flagged orphaned symbols (all surfaced by
  `noUnusedLocals`/`noUnusedParameters`): state `saveSuccessMsg`, `imageSourceOpen`,
  `excludeListOpen`, `recsOpen`, `recentUploadsOpen`, `imageFitMode`; dropped the unused
  `setEnableSubstitution`/`setSubstitutionThreshold` setters; removed the orphaned `selectedPreset`
  getter; deleted handlers `showSaveSuccess`, `handleUnitChange`, `handlePresetChange`,
  `handleSelectAll`, `handleDeselectAll`, `handleRowClick`, `loadRecentImage`, `deleteRecentImage`
  and their dead `setImageSourceOpen` call sites; reduced the flags import to `USE_NEW_SUPPLIES`.
  Retained `safeStorage.removeItem('gempixel_theme')` startup cleanup. `npx tsc --noEmit` exits 0.
- **Task 3 (3a67873):** Retired the 5 `it.skip` `TODO(25)` blocks whose legacy DOM lived in the
  now-deleted `Step2Palette` (drill-type select, auto-substitution UI) and `Step4Export` (inline
  save/Update/Copy, Start-New reset, save-quota banner), replacing each with a `RETIRED(25-01)` note;
  dropped the now-unused `projectStore` import; retargeted the 6 preserved panel-3 Step3Canvas skips
  from `TODO(25)`/"retire in Phase 25" to `TODO(26)`/Phase 26 (D-01). The D-02 stale-test block
  (Plan 04's) was left untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reduced the flags import in App.tsx**
- **Found during:** Task 2
- **Issue:** Collapsing the panel-1/2/4 ternaries orphaned `USE_NEW_UPLOAD`, `USE_NEW_REFINE`,
  `USE_NEW_ORDER` from the `flags` import, which `noUnusedLocals` flagged.
- **Fix:** Reduced the import to `import { USE_NEW_SUPPLIES } from './features/screens/flags'`.
  The `flags.ts` module itself was NOT touched (guardrail preserved).
- **Files modified:** src/App.tsx (Task 1 commit 264c264 / Task 2 264c264→8b927d7)

**2. [Rule 3 - Blocking] Removed orphaned projectStore import in App.test.tsx**
- **Found during:** Task 3
- **Issue:** Removing the save-quota test (block K) dropped the only `vi.spyOn(projectStore, 'save')`
  usage, leaving the `projectStore` import unused (tsc error TS6133).
- **Fix:** Removed the unused import.
- **Files modified:** src/__tests__/App.test.tsx (commit 3a67873)

### Judgment calls (within plan discretion)

- **`selectedPreset`:** tsc flagged only the getter as unused; the setter is still called by live
  size-change handlers (`handleWidthChange`/`handleHeightChange`/`loadProject`/`resetWorkspace`/
  `img.onload`). Kept the setter via `const [, setSelectedPreset]` (plan said remove only what tsc
  flags; the setter is not flagged). Confirmed `selectedPreset` is not read by the match pipeline
  (candidatesKey uses `activeCandidates` = selectedBaseKit + excludedColors).
- **Panel-3 skip retargeting vs deletion:** the 6 remaining skipped tests (price grid, unmapped-log,
  W4/W5/WR-02 checkout/download guards) exercise the *preserved* Step3Canvas fulfillment path, which
  the SC10 guardrail protects. They cannot be retargeted (Step3Canvas is not rendered while
  `USE_NEW_SUPPLIES` is true) and must not be retired this phase — so their `TODO(25)` annotations
  were corrected to point at Phase 26, which owns the Step3Canvas deletion (D-01).

## Guardrail (SC10) Verification

`git diff --name-only HEAD` for the protected files is empty — `src/engine/export.ts`,
`src/engine/checkout.ts`, `src/features/wizard/steps/Step3Canvas.tsx`, and
`src/features/screens/flags.ts` are all untouched. The three fulfillment handlers
(`handleShopifyCheckout`, `handleDownloadCanvasOnly`, `handleDownloadCombinedCanvasSheet`) and the
frame-scope `slate-*` fulfillment modals (Checkout Warning, Save Project, Artist Resources) remain
in `App.tsx`. Only `App.tsx` and `App.test.tsx` were modified (plus the three file deletions).

## Verification Results

- `test ! -f` for Step1Ingest/Step2Palette/Step4Export — all gone; `Step3Canvas.tsx` present.
- `npx tsc --noEmit` exits 0 (no dangling import, no unused state).
- `npm test` — 36 test files passed, 355 passing, 7 skipped (>= 240 baseline held).
- `grep -c gempixel_theme src/App.tsx` >= 1 (startup cleanup retained).
- `git diff --name-only HEAD` excludes export.ts, checkout.ts, Step3Canvas.tsx, flags.ts.

## Commits

- `264c264` refactor(25-01): delete Step1/2/4, collapse panels 1/2/4 to new screens
- `8b927d7` refactor(25-01): remove tsc-orphaned Step state/handlers, typecheck green
- `3a67873` test(25-01): retire deleted-Step panel-2/4 skipped tests, retarget panel-3 notes

## Self-Check: PASSED

- FOUND: src/features/wizard/steps/Step3Canvas.tsx (preserved)
- MISSING (intentionally deleted): Step1Ingest.tsx, Step2Palette.tsx, Step4Export.tsx
- FOUND commit 264c264, 8b927d7, 3a67873
