---
phase: 21-shared-ui-primitives
plan: 03
subsystem: ui
tags: [preact, tailwind, presentational-component, size-card, tdd, vitest]

# Dependency graph
requires:
  - phase: 21-shared-ui-primitives
    provides: "cn() class-join helper (21-01) + the Omit<ComponentProps<'el'>, 'className'> prop convention"
provides:
  - "SizeCard + SizeCardProps — dumb, props-only selectable size card (native <button aria-pressed>) in src/ui/"
  - "Phase-wide zero-dependency (SC3) + green-suite (SC4) verification sign-off"
affects: [phase-22-engine, phase-23-screen-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dumb presentational card: every displayed value is a fully-computed prop; component imports no engine module and derives nothing (D-05)"
    - "State-driven selected styling (border-accent + bg-[#EAF2EF]) instead of a variant prop; controlled onSelect (D-04)"

key-files:
  created:
    - src/ui/SizeCard.tsx
    - src/ui/__tests__/SizeCard.test.tsx
  modified: []

key-decisions:
  - "SizeCard is self-contained: the optional tag renders as an inline mono <span>, NOT an imported Pill — Phase 23 may swap Pill in later without a Phase 21 import edge."
  - "Selection exposed via aria-pressed (button toggle) rather than role=radio, matching the UI-SPEC primary option for a standalone selectable card."

patterns-established:
  - "D-05 no-engine-import seam: presentational primitives receive pre-formatted strings/numbers as the only coupling to future engine work."

requirements-completed: []

coverage:
  - id: D1
    description: "SizeCard renders a native <button type=button aria-pressed={selected}> exposing controlled selection with visually-distinct selected vs default styling"
    verification:
      - kind: unit
        ref: "src/ui/__tests__/SizeCard.test.tsx#reflects selected true/false via aria-pressed"
        status: pass
      - kind: unit
        ref: "src/ui/__tests__/SizeCard.test.tsx#selected applies accent border + tint / neutral border"
        status: pass
      - kind: unit
        ref: "src/ui/__tests__/SizeCard.test.tsx#fires onSelect exactly once on click"
        status: pass
    human_judgment: false
  - id: D2
    description: "SizeCard displays label/gridDims/inches/drillCount straight from props (D-05, no derivation) with drillCount in a font-mono data figure; optional tag renders only when provided"
    verification:
      - kind: unit
        ref: "src/ui/__tests__/SizeCard.test.tsx#renders label, gridDims, inches, drillCount straight from props"
        status: pass
      - kind: unit
        ref: "src/ui/__tests__/SizeCard.test.tsx#renders drillCount inside a font-mono data figure"
        status: pass
      - kind: unit
        ref: "src/ui/__tests__/SizeCard.test.tsx#renders tag when provided / no tag element when omitted"
        status: pass
    human_judgment: false
  - id: D3
    description: "Phase-wide gate: zero new dependencies (package.json/package-lock.json byte-unchanged, SC3), SizeCard imports no engine module (D-05), src/ui/ is state-free (useState==0), tsc clean, full suite green (SC4)"
    verification:
      - kind: automated_ui
        ref: "git diff --exit-code -- package.json package-lock.json && npx tsc --noEmit && npm test (297 passed)"
        status: pass
    human_judgment: false

# Metrics
duration: ~6min
completed: 2026-07-14
status: complete
---

# Phase 21 Plan 03: SizeCard + Zero-Dependency Gate Summary

**Dumb, props-only selectable SizeCard (native `<button aria-pressed>`, mono drill count, accent-tint selected recipe) added to `src/ui/` with zero engine coupling (D-05), closing the phase-wide zero-dependency (SC3) + green-suite (SC4) gate.**

## Performance

- **Duration:** ~6 min
- **Completed:** 2026-07-14
- **Tasks:** 2 (Task 1 TDD component; Task 2 verification-only gate)
- **Files created:** 2

## Accomplishments
- `SizeCard` — a pure presentational card that renders `label`, `gridDims`, `inches`, and a `font-mono` `drillCount` exactly as received from props; imports no engine module and derives nothing (D-05).
- Controlled selection via `aria-pressed`; selected state applies the UI-SPEC recipe (`border-accent` + `bg-[#EAF2EF]`), default applies `border-border` + `bg-panel-2` — visually distinct, non-ambiguous.
- Optional `tag` rendered self-contained (inline mono `<span>`, no Pill import); `className` merged LAST via `cn()`; native button attrs spread through `...rest`.
- Phase-wide SC3/SC4 gate passed: `package.json`/`package-lock.json` byte-unchanged, `src/ui/*` `useState` count 0, `npx tsc --noEmit` exit 0, `npm test` 297 passed (286 prior + 11 new).

## Task Commits

1. **Task 1 (RED): failing SizeCard contract test** - `60746e9` (test)
2. **Task 1 (GREEN): implement SizeCard** - `27ce436` (feat)
3. **Task 2: zero-dep + green-suite gate** - verification-only, no source change (no commit)

**Plan metadata:** _(this commit)_

_TDD task: test (RED) → feat (GREEN); no refactor needed — implementation matched the established Button/Pill convention on first pass._

## Files Created/Modified
- `src/ui/SizeCard.tsx` - Dumb selectable size card; `SizeCardProps extends Omit<ComponentProps<'button'>, 'onSelect' | 'className'>`.
- `src/ui/__tests__/SizeCard.test.tsx` - 11 jsdom raw-`render()` assertions covering both selection states, prop passthrough, mono figure, tag present/absent, onSelect, className-last.

## Decisions Made
- Tag renders as a self-contained inline mono `<span>` rather than importing `Pill`, keeping SizeCard free of intra-`src/ui` coupling; Phase 23 can substitute Pill without touching this file.
- Selection modeled as an `aria-pressed` button toggle (UI-SPEC primary option) rather than `role=radio`, since SizeCard is a standalone selectable card, not a managed radiogroup.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None. jsdom emits benign `getContext()`/canvas warnings from unrelated App/integration tests (pre-existing, not failures).

## Known Stubs
None.

## Threat Flags
None — no new network, storage, auth, or HTML-string sink introduced. All display props render as escaped text nodes (T-21-06 mitigated); zero dependencies added (T-21-07 mitigated, SC3 gate).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full Phase 21 primitive surface complete (Button, Pill, SegmentedControl, Slider, SizeCard) — all props-only, token-driven, zero new dependencies.
- SizeCard's `SizeCardProps` is the sole seam for Phase 22's density helper / merged drill count; Phase 23 formats and passes those values in with no import coupling.

---
*Phase: 21-shared-ui-primitives*
*Completed: 2026-07-14*
