---
phase: 20-atelier-design-system-canvas-first-shell
plan: 03
subsystem: ui
tags: [preact, tailwind, a11y, wizard, step-nav, design-tokens]

# Dependency graph
requires:
  - phase: 20-01
    provides: Atelier light tokens (bg-accent/text-ink/text-muted/border-border/text-on-accent/font-display) on :root + @theme inline
  - phase: 20-02
    provides: self-hosted Newsreader wordmark face via --font-display / .font-display
provides:
  - STEP_META single-source label/order map (Upload/Refine/Supplies/Order) + locked-step tooltip copy (D-02)
  - Pure StepBar navigator enforcing the full D-12 gating/a11y contract (aria-current/aria-disabled/out-of-tab-order/tooltip)
  - Pure AtelierShell top-bar chrome (pixel-logo + Newsreader wordmark + StepBar + dark Save pill)
  - StepBar a11y/gating unit tests (5, additive)
affects: [20-04, 20-05, 21-ui-primitives, 23-screens]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure/props-only chrome children (D-01): read {step,canEnter,goTo,stale?} via props, own no state; App stays state owner"
    - "STEP_META single-source for step labels/order (D-02) — Phase 23 semantic remap is a data edit here"
    - "D-12 gating via aria-disabled + tabIndex -1 + static tooltip + no-op locked click (upgrades legacy disabled=)"
    - "Reserved cross-plan prop (stale?) declared in 03, consumed in 05"

key-files:
  created:
    - src/features/wizard/stepMeta.ts
    - src/features/wizard/StepBar.tsx
    - src/features/wizard/AtelierShell.tsx
    - src/features/wizard/__tests__/StepBar.test.tsx
  modified: []

key-decisions:
  - "StepBar/AtelierShell are pure props-only; no useWizard import, no App wiring (that is Plan 04)"
  - "Save pill uses semantic tokens (bg-ink/text-on-accent) rather than literal #1B1A17/#F4F1E9 — token values are byte-identical to the spec's fixed dark accent"
  - "Ahead-of-progress connector uses inline #D8D0BC (handoff fixed value, no semantic token); passed connectors use bg-accent"

patterns-established:
  - "Pure chrome child contract (props in, no state) applied to StepBar + AtelierShell"
  - "Single STEP_META label/order source replaces the three inline label arrays in App.tsx"

requirements-completed: [SHELL-01, SHELL-02]

coverage:
  - id: D1
    description: "STEP_META is the single ordered source of step labels/order (Upload/Refine/Supplies/Order) + locked tooltip copy"
    requirement: SHELL-01
    verification:
      - kind: unit
        ref: "src/features/wizard/__tests__/StepBar.test.tsx#renders exactly 4 steps labeled Upload/Refine/Supplies/Order in order"
        status: pass
    human_judgment: false
  - id: D2
    description: "StepBar is the single pure/props-only navigator (no sidebars/hamburger/page-flip); owns no state"
    requirement: SHELL-01
    verification:
      - kind: unit
        ref: "src/features/wizard/__tests__/StepBar.test.tsx#renders exactly 4 steps labeled Upload/Refine/Supplies/Order in order"
        status: pass
      - kind: other
        ref: "grep -c useState src/features/wizard/StepBar.tsx == 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-12 gating/a11y: current step aria-current=step; locked steps aria-disabled + out-of-tab-order + static tooltip; locked tap never navigates"
    requirement: SHELL-02
    verification:
      - kind: unit
        ref: "src/features/wizard/__tests__/StepBar.test.tsx#marks the current step with aria-current=step and no others"
        status: pass
      - kind: unit
        ref: "src/features/wizard/__tests__/StepBar.test.tsx#locks upcoming steps: aria-disabled=true and removed from tab order"
        status: pass
      - kind: unit
        ref: "src/features/wizard/__tests__/StepBar.test.tsx#does NOT call goTo when a locked step is clicked (no dead-end)"
        status: pass
      - kind: unit
        ref: "src/features/wizard/__tests__/StepBar.test.tsx#calls goTo(index) when an enabled/completed step is clicked"
        status: pass
    human_judgment: false
  - id: D4
    description: "AtelierShell renders the Atelier top-bar chrome (pixel-logo + Newsreader wordmark + StepBar + dark Save pill), pure/props-only"
    requirement: SHELL-01
    verification:
      - kind: other
        ref: "npx tsc --noEmit exits 0; grep useState/Pixelify/dangerouslySetInnerHTML == 0"
        status: pass
    human_judgment: true
    rationale: "Visual/typographic fidelity of the top bar (wordmark in Newsreader 21/600, dark Save pill, logo tile) is not asserted by a test — App wiring lands in Plan 04 and visual sign-off is a UI-review concern"

# Metrics
duration: 8min
completed: 2026-07-13
status: complete
---

# Phase 20 Plan 03: Canvas-First Shell Chrome (StepBar + AtelierShell) Summary

**Pure/props-only single-navigator chrome: a STEP_META-driven 4-step StepBar enforcing the full D-12 gating/a11y contract, plus the AtelierShell top bar (pixel-logo + Newsreader wordmark + dark Save pill), with 5 additive a11y tests keeping the suite green at 251.**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-07-13
- **Tasks:** 3
- **Files created:** 4

## Accomplishments
- `STEP_META` (stepMeta.ts) is now the single ordered source of the four step labels/order (Upload · Refine · Supplies · Order) plus the locked-step tooltip copy — the Phase 23 semantic remap becomes a data edit here (D-02).
- `StepBar` is a pure props-only navigator reading `{step, canEnter, goTo, stale?}` and owning no state (D-01). It implements the full D-12 contract: `aria-current="step"` on the current step; locked steps get `aria-disabled="true"` + `tabIndex={-1}` (out of tab order) + a static tooltip; a locked tap never calls `goTo` (no dead-end). Visual states consume Atelier tokens only (`bg-accent`, `text-on-accent`, `text-ink`, `text-muted`, `border-faint`).
- `AtelierShell` renders the top-bar chrome — `.gem-logo` 3×3 pixel tile + "GemPixel" wordmark in `font-display` (Newsreader 21/600, D-10) + centered StepBar + dark Save pill (`bg-ink`/`text-on-accent`) — and its `children` below, pure/props-only.
- `stale?` is reserved on `StepBarProps` for Plan 05 (accepted, renders nothing now) — clean cross-plan contract.
- 5 additive StepBar tests; full Vitest suite green at **251 passed** (was 246 baseline).

## Task Commits

Each task was committed atomically:

1. **Task 1: STEP_META map + pure StepBar navigator (D-12 gating/a11y)** - `a531c40` (feat)
2. **Task 2: AtelierShell top-bar chrome** - `4ffc958` (feat)
3. **Task 3: StepBar a11y + gating unit tests** - `9f94d85` (test)

## Files Created/Modified
- `src/features/wizard/stepMeta.ts` - Single STEP_META label/order source + locked tooltip copy (D-02)
- `src/features/wizard/StepBar.tsx` - Pure 4-step navigator with the full D-12 gating/a11y contract
- `src/features/wizard/AtelierShell.tsx` - Pure top-bar chrome (logo + Newsreader wordmark + StepBar + dark Save pill)
- `src/features/wizard/__tests__/StepBar.test.tsx` - 5 a11y/gating unit tests

## Decisions Made
- Kept both components strictly pure — no `useWizard` import, no App wiring (Plan 04 owns wiring).
- Save pill styled with semantic tokens (`bg-ink`/`text-on-accent`) whose values are byte-identical to the UI-SPEC's fixed dark accent (#1B1A17 / #F4F1E9), avoiding a hard-coded hex while honoring the spec.
- Ahead-of-progress connector uses an inline `#D8D0BC` (the handoff's fixed muted-line value, which has no semantic token); passed connectors use the `bg-accent` token.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Pre-existing benign jsdom warnings ("HTMLCanvasElement's getContext() not implemented") appear in the full-suite run from unrelated App tests; all 251 tests pass.

## Known Stubs
None. `stale?` is a deliberately reserved prop (documented cross-plan contract for Plan 05), not a stub.

## Threat Flags
None. Labels/tooltips render as plain text from the static STEP_META map (no `dangerouslySetInnerHTML`, grep-verified 0); locked-step gating is enforced both by not calling `goTo` and by `useWizard.canEnter` (defense-in-depth, T-20-06/T-20-07 mitigated).

## Next Phase Readiness
- Chrome components are ready for App.tsx wiring in Plan 20-04 (mount AtelierShell, delete the two legacy nav surfaces, pass `{step, canEnter, goTo}` through).
- `stale?` prop reserved for Plan 20-05 soft-invalidate/recompute.

## Self-Check: PASSED
- Files exist: stepMeta.ts, StepBar.tsx, AtelierShell.tsx, __tests__/StepBar.test.tsx — all present on disk.
- Commits present: a531c40 (Task 1), 4ffc958 (Task 2), 9f94d85 (Task 3).
- `npx tsc --noEmit` exits 0; `npx vitest run` → 251 passed (23 files).

---
*Phase: 20-atelier-design-system-canvas-first-shell*
*Completed: 2026-07-13*
