---
phase: 23-the-four-screens-in-flow-order
plan: 01
subsystem: ui
tags: [preact, strangler-fig, feature-flags, wizard, canvas-first]

# Dependency graph
requires:
  - phase: 20-canvas-first-shell
    provides: "Always-mounted CSS-toggled data-step-panel siblings + single-mount CanvasViewer (D-14); StepBar pure/props-only analog"
provides:
  - "src/features/screens/flags.ts — four USE_NEW_* compile-time booleans (all false) gating the per-screen strangler swap (D-02)"
  - "Four pure/props-only screen shells (Upload/Refine/Supplies/Order) mirroring StepBar conventions"
  - "App.tsx data-step-panel ternaries wiring each slot to USE_NEW_* ? <Screen /> : <legacy Step>"
affects: [23-02-upload, 23-03-refine, 23-04-supplies, 23-05-order, 25-strangler-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Strangler swap: legacy body wrapped in USE_NEW_* ternary inside the untouched always-mounted slot"
    - "Per-screen shell: <Screen>Props interface immediately above named-export function, no useState, no engine imports"

key-files:
  created:
    - src/features/screens/flags.ts
    - src/features/screens/UploadScreen.tsx
    - src/features/screens/RefineScreen.tsx
    - src/features/screens/SuppliesScreen.tsx
    - src/features/screens/OrderScreen.tsx
    - src/features/screens/__tests__/flags.test.ts
  modified:
    - src/App.tsx

key-decisions:
  - "flags are plain const booleans (no typed record / no env plumbing) — no feature-flag system exists in the repo and none introduced (D-02)"
  - "Screen Props interfaces intentionally empty for now; full prop surfaces land per-screen in 23-02..23-05"

patterns-established:
  - "Strangler ternary lives INSIDE the always-mounted data-step-panel slot; contents/hidden CSS-toggle and single CanvasViewer mount untouched (Pitfall 5, D-14)"
  - "flags.test.ts is the swap guard: flipping a flag updates its assertion in the same commit (one flag per commit, Pitfall 7)"

requirements-completed: [UPLOAD-01, REFINE-01, REFINE-05, SUPPLIES-01, ORDER-01]

coverage:
  - id: D1
    description: "flags.ts exports USE_NEW_UPLOAD/REFINE/SUPPLIES/ORDER, all defaulting false"
    verification:
      - kind: unit
        ref: "src/features/screens/__tests__/flags.test.ts#defaults every USE_NEW_* flag to false"
        status: pass
    human_judgment: false
  - id: D2
    description: "Four pure/props-only screen shells compile with no useState / no engine imports"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Each data-step-panel slot renders a USE_NEW_* ternary; with all flags false the legacy Step bodies render byte-identically and the full suite stays green"
    verification:
      - kind: integration
        ref: "npm test — 326 passed (31 files)"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-07-14
status: complete
---

# Phase 23 Plan 01: Strangler Foundation for the Four-Screen Swap Summary

**Established the per-screen strangler swap mechanism: a flags.ts with four all-false compile-time booleans, four pure/props-only screen shells, and App.tsx data-step-panel ternaries — all flags off, so runtime behavior is byte-identical and the 326-test Vitest suite stays green.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-14T14:18Z
- **Completed:** 2026-07-14T14:21Z
- **Tasks:** 3
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments
- `flags.ts` with four `USE_NEW_*` const booleans (all `false`) — the single swap mechanism every later plan flips one-per-commit (D-02, Pitfall 7).
- Four pure/props-only screen shells (`UploadScreen`, `RefineScreen`, `SuppliesScreen`, `OrderScreen`) mirroring `StepBar.tsx` conventions (interface above named export, no `useState`, no engine imports).
- App.tsx wired: each `data-step-panel` slot now renders `USE_NEW_* ? <Screen /> : <legacy Step>`; the `contents`/`hidden` CSS-toggle and the single `<CanvasViewer>` mount are untouched (D-14 preserved).
- Strangler guard test asserting all four flags default `false`.

## Task Commits

Each task was committed atomically:

1. **Task 1: flags.ts + four pure screen shells** - `450c1ed` (feat)
2. **Task 2: wire four data-step-panel slots to per-flag ternaries** - `3fb84a0` (feat)
3. **Task 3: flags.test.ts asserting all-false default** - `ae24b94` (test)

## Files Created/Modified
- `src/features/screens/flags.ts` - Four `USE_NEW_*` compile-time booleans, all `false`.
- `src/features/screens/UploadScreen.tsx` - Minimal pure shell + empty `UploadScreenProps` (expanded in 23-02).
- `src/features/screens/RefineScreen.tsx` - Minimal pure shell + empty `RefineScreenProps` (expanded in 23-03).
- `src/features/screens/SuppliesScreen.tsx` - Minimal pure shell + empty `SuppliesScreenProps` (expanded in 23-04).
- `src/features/screens/OrderScreen.tsx` - Minimal pure shell + empty `OrderScreenProps` (expanded in 23-05).
- `src/features/screens/__tests__/flags.test.ts` - Strangler guard asserting all four flags `false`.
- `src/App.tsx` - Imported flags + shells; wrapped each legacy Step body in a `USE_NEW_*` ternary inside the existing always-mounted slot.

## Decisions Made
- Kept flags as plain `const` booleans (no typed record, no env plumbing) per D-02 discretion — no feature-flag system exists in the repo and none was introduced.
- Screen `Props` interfaces are intentionally empty in this plan; the full prop surfaces are added per-screen in 23-02..23-05 when each flag flips.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The jsdom `getContext()` "Not implemented" lines in the test output are pre-existing environment noise from canvas-download tests, not failures — 326/326 pass.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Swap mechanism is in place; 23-02 flips `USE_NEW_UPLOAD` to `true`, expands `UploadScreenProps`, wires the ingest + recent-projects surface, and updates the flags test assertion in the same commit.
- Strangler invariant holds: tsc 0, vitest 326/326 green at every commit. Single `<CanvasViewer>` mount and `contents`/`hidden` toggle preserved.

## Self-Check: PASSED

- All six created files present on disk; App.tsx modified.
- Commits present: `450c1ed`, `3fb84a0`, `ae24b94`.
- `npx tsc --noEmit` exit 0; `npm test` 326/326 passed.

---
*Phase: 23-the-four-screens-in-flow-order*
*Completed: 2026-07-14*
