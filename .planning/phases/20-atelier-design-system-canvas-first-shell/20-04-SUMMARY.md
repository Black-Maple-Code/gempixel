---
phase: 20-atelier-design-system-canvas-first-shell
plan: 04
subsystem: ui
tags: [preact, canvas-first-shell, wizard, stepbar, ateliershell, css-toggle, strangler]

# Dependency graph
requires:
  - phase: 20-03
    provides: Pure StepBar + AtelierShell chrome (STEP_META single-source labels, D-12 gating/a11y)
  - phase: 20-02
    provides: Atelier tokens / .gem-logo mark consumed by AtelierShell
provides:
  - App.tsx composes <AtelierShell> as the shell; StepBar is the sole step navigator (SHELL-01)
  - Both legacy desktop step-nav surfaces (dot-nav + top step bar) deleted
  - Four step panels are always-mounted CSS-toggled siblings (display:contents / display:none)
  - Single CanvasViewer never remounts on a step change (SC4/D-14) — proven by a canvas-identity test
  - Preserved id=wizard-next-btn + < Back linear CTAs with unchanged locked-Next semantics (D-04)
affects: [23-screens, 24-mobile, 25-strangler-cleanup, 21-ui-primitives]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Always-mounted CSS-toggled step panels: <div data-step-panel=n> visible=display:contents (layout-transparent), hidden=display:none — no unmount on step change"
    - "Money-typed project loads sanitized to a finite number at the App state boundary before reaching eagerly-mounted step panels"
    - "Tests scope panel-content queries to [data-step-panel=n] / the visible panel / the right <aside> now that all panels are always in the DOM"

key-files:
  created: []
  modified:
    - src/App.tsx
    - src/__tests__/App.test.tsx
    - src/__tests__/integration.test.tsx

key-decisions:
  - "Preserve the EXACT current #wizard-next-btn semantics (disabled={!canEnter(step+1)}, no isTestEnv bypass) — the plan text said to add '|| isTestEnv' but the locked-Next tests assert Next stays disabled with no image (Rule 1 correction)"
  - "Visible panel uses display:contents (layout-transparent wrapper) so the wrapper div does not alter the panel's flex layout; hidden panels use display:none"
  - "Content-checking tests query always-mounted panels directly by [data-step-panel=n] instead of navigating, since the strict StepBar/Next no longer allow free test-env jumps to gated steps"

patterns-established:
  - "Single-navigator (structural): exactly one nav[aria-label=Progress]; legacy surfaces proven gone by absence of bare dot-nav buttons"
  - "Single-mount identity: canvas DOM-node identity + CanvasViewer construction count stable across a step change"

requirements-completed: [SHELL-01, SHELL-02]

coverage:
  - id: D1
    description: "StepBar/AtelierShell is the single step navigator; both legacy desktop nav surfaces (dot-nav + top step bar) deleted"
    requirement: "SHELL-01"
    verification:
      - kind: unit
        ref: "src/__tests__/App.test.tsx#renders exactly one step navigator — the StepBar (SC3/D-03)"
        status: pass
      - kind: other
        ref: "grep -c on src/App.tsx: [1, 2, 3, 4].map=0, ['Upload','Size','Colors','Supplies']=0, AtelierShell>=1, wizard-next-btn>=1"
        status: pass
    human_judgment: false
  - id: D2
    description: "Four step panels are always-mounted CSS-toggled siblings; single CanvasViewer never remounts on a step change"
    requirement: "SHELL-02"
    verification:
      - kind: unit
        ref: "src/__tests__/App.test.tsx#keeps a single CanvasViewer mounted across step changes (SC4/D-14)"
        status: pass
      - kind: other
        ref: "grep -c on src/App.tsx: wizard.step === 1/2/4 &&=0, panel === 3 && (=0, each <StepN>=1, data-step-panel=4"
        status: pass
    human_judgment: false
  - id: D3
    description: "Locked-Next affordance preserved (id=wizard-next-btn) and useWizard 1..4 indices unchanged (D-04)"
    requirement: "SHELL-01"
    verification:
      - kind: unit
        ref: "src/__tests__/App.test.tsx (~30 #wizard-next-btn navigation + locked-Next assertions) + useWizard.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Existing viewer/legend/supply UI still functions inside the shell (full Vitest suite green)"
    requirement: "SHELL-02"
    verification:
      - kind: integration
        ref: "npx vitest run — 253 passed (23 files)"
        status: pass
      - kind: unit
        ref: "npx tsc --noEmit — exit 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "Atelier shell chrome renders correctly in the real browser (top bar layout, StepBar visuals, no duplicate-wordmark regression)"
    verification: []
    human_judgment: true
    rationale: "Visual/layout adequacy of the composed shell (and the transient duplicate GemPixel wordmark noted below) is not asserted by any test; needs a human glance in the dev server."

# Metrics
duration: 32min
completed: 2026-07-13
status: complete
---

# Phase 20 Plan 04: Wire Canvas-First Shell into App Summary

**App.tsx now renders through AtelierShell with a single StepBar navigator, both legacy desktop step-nav surfaces deleted, and the four step panels converted to always-mounted CSS-toggled siblings so the single CanvasViewer never remounts on a step change — suite green at 253.**

## Performance

- **Duration:** ~32 min
- **Started:** 2026-07-13T23:54:00Z
- **Completed:** 2026-07-14T00:26:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Composed `<AtelierShell step canEnter goTo onSave canSave>` at shell scope; `<StepBar>` (via AtelierShell) is now the ONLY step navigator (SHELL-01).
- Deleted BOTH legacy desktop nav surfaces: the sticky-footer dot-nav (`[1,2,3,4].map`) and the desktop top step bar (`['Upload','Size','Colors','Supplies'].map` + its Next/Save). The old top-bar Save moved into `AtelierShell.onSave`.
- Preserved the linear `id="wizard-next-btn"` (and `< Back`) CTAs with unchanged locked-Next semantics; `useWizard` 1..4 indices untouched (D-04) — ~30 navigation tests + the index/locked-Next assertions stay green.
- Converted the four `{wizard.step === n && <StepN…/>}` panels into always-rendered `<div data-step-panel=n>` siblings (visible = `display:contents`, hidden = `display:none`). The single `<CanvasViewer>` host in `<main>` stays above any step branch; its init/teardown/data-sync effects are unchanged. A new test asserts canvas-node identity + no CanvasViewer reconstruction across a step change (SC4/D-14).
- Reconciled the nav/panel tests to STEP_META and the new always-mounted DOM shape (App.test.tsx + integration.test.tsx); added single-navigator and single-mount identity assertions. Suite 251 → 253, all green; `tsc` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete both legacy step-nav surfaces, compose AtelierShell** - `047dc4c` (feat)
2. **Task 2: Convert step panels to always-mounted CSS-toggled siblings + CR-01 sanitize** - `bbdb69c` (feat)
3. **Task 3: Reconcile nav/panel tests + single-navigator/single-mount assertions** - `08a70a7` (test)

## Files Created/Modified
- `src/App.tsx` - AtelierShell composition; both legacy nav surfaces deleted; four step panels → CSS-toggled `data-step-panel` siblings; `onSave`/`canSave` wired; money-typed loads sanitized.
- `src/__tests__/App.test.tsx` - Step-tab lookups migrated off deleted top-bar labels; count/isolation queries scoped to visible/specific panel; two new assertions (single-navigator, single-mount identity) + a hoisted CanvasViewer construction counter.
- `src/__tests__/integration.test.tsx` - Right-sidebar interactions (Exclude Colors filter, DMC Supply List collapse, column sorting) scoped to the right `<aside>` now that the always-mounted Step2 duplicates that legend/exclude UI.

## Decisions Made
- **Preserved `#wizard-next-btn` exactly as it was** (`disabled={!wizard.canEnter(wizard.step + 1)}`, `onClick={wizard.next}`, no `isTestEnv` bypass). The plan's Task 1 text said to use `disabled={!(canEnter(step+1) || isTestEnv)}` "as the old top-bar Next did", but the current `#wizard-next-btn` (the footer Next) never had the bypass, and App.test asserts Next stays *locked* with no image (lines ~389/431). Adding the bypass would break those locked-Next assertions. Treated as a Rule 1 correction.
- **`display:contents` for the visible panel** so the wrapper div is layout-transparent and the panel keeps its exact flex behavior; only hidden panels get `display:none` (Tailwind `hidden`).
- **Content-checking tests query panels directly by `[data-step-panel=n]`** (no navigation), because the new StepBar and the preserved Next are strictly gating — with no image/project they will not jump to a locked step (the old top-bar/dot-nav had a test-env bypass that no longer exists). Since all panels are always mounted, direct scoping is both simpler and more robust.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved exact locked-Next semantics instead of adding an isTestEnv bypass**
- **Found during:** Task 1 (compose AtelierShell / preserve the forward CTA)
- **Issue:** The plan instructed the preserved CTA to be `disabled={!(canEnter(step+1) || isTestEnv)}`; that would make Next never-disabled in jsdom and break the locked-Next assertions (`nextBtn.disabled === true` with no image, App.test ~389/431), which the plan's own D-04 constraint requires to stay green.
- **Fix:** Kept the existing `disabled={!wizard.canEnter(wizard.step + 1)}` / `onClick={wizard.next}` unchanged.
- **Files modified:** src/App.tsx
- **Verification:** Locked-Next tests + ~30 `#wizard-next-btn` navigation tests pass.
- **Committed in:** `047dc4c` (Task 1)

**2. [Rule 1 - Bug] Sanitize money-typed project loads at the state boundary (CR-01)**
- **Found during:** Task 2 (always-mounting the step panels)
- **Issue:** With Step3Canvas now always mounted, a tampered project (`kitBaseCost: '1e999'`) reached `canvasBaseCost.toFixed()` in the eagerly-rendered panel and threw `TypeError: canvasBaseCost.toFixed is not a function`, destabilizing the render (print.test CR-01 white-screen guard failed). `setCanvasBaseCost(project.kitBaseCost ?? 15.0)` only guarded null/undefined.
- **Fix:** Wrapped the load in `sanitizeMoney(...)` for `canvasBaseCost` and `drillPacketCost` so the always-mounted panel always receives a finite number. No Step-body change (App.tsx state owner only).
- **Files modified:** src/App.tsx
- **Verification:** print.test.tsx CR-01 passes; full suite green.
- **Committed in:** `bbdb69c` (Task 2)

**3. [Rule 3 - Blocking] Test reconciliation spanned integration.test.tsx (not just App.test.tsx)**
- **Found during:** Task 3 (test reconciliation)
- **Issue:** The plan scoped test changes to App.test.tsx, but always-mounting the panels made Step2's legend/exclude UI coexist with the right-sidebar's, breaking three integration.test.tsx tests (sub-palette worker-match, DMC Supply List collapse, column sorting) via first-match/index DOM queries.
- **Fix:** Scoped those right-sidebar interactions to the right `<aside>` (asides[1]).
- **Files modified:** src/__tests__/integration.test.tsx
- **Verification:** integration.test.tsx green.
- **Committed in:** `08a70a7` (Task 3)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bug, 1 Rule 3 blocking).
**Impact on plan:** All three are necessary to satisfy the plan's own constraints (D-04 locked-Next, SC4 always-mounted panels, SC5 green suite). No scope creep — no new features, no engine signature changes, legacy Step1..4 bodies untouched.

## Issues Encountered
- **Per-task commit vs. green-every-commit tension.** The plan decomposes App.tsx work (Task 1 nav, Task 2 panels) and test reconciliation (Task 3) into separate files/commits, but always-mounting the panels breaks index/count/first-match DOM queries across App.test.tsx and integration.test.tsx that assumed single-panel mounting. Consequently the intermediate Task 1 and Task 2 commits carry transient test failures that Task 3 resolves; the plan-final state (`08a70a7`) is fully green (253/253). Task 1's own acceptance gate is `tsc` + greps (satisfied); Task 2/Task 3's `vitest` gate is satisfied at the Task 3 commit.
- **Single-mount counter timing.** The CanvasViewer construction counter is cumulative; the initial version compared across the async load/settle window and caught a delayed load-time construction. Resolved by settling fully before capturing the baseline count — the canvas-node-identity check (the deterministic SC4 signal) held throughout.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SHELL-01 (single navigator) and the single-mount half of SHELL-02/SC4 are satisfied structurally. Plan 20-05 wires the `stale` soft-invalidate / "Recompute match" flow (D-13); the `stale` prop is already accepted by StepBar as a no-op.
- **Known cosmetic item for Phase 23/25:** the app currently shows the "GemPixel" wordmark twice — once in the new AtelierShell top bar (span) and once in the legacy left-aside header (`<h1>`, kept so the existing `h1` test stays green). The legacy aside header is scheduled for the Phase 25 strangler cleanup; visual polish belongs to the Phase 23 screen work. Flagged for the human visual check (coverage D5).

## Self-Check: PASSED

- SUMMARY.md exists on disk.
- All three task commits present in git history (`047dc4c`, `bbdb69c`, `08a70a7`).
- `npx tsc --noEmit` exit 0; `npx vitest run` → 253 passed (23 files).

---
*Phase: 20-atelier-design-system-canvas-first-shell*
*Completed: 2026-07-13*
