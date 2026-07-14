---
phase: 21-shared-ui-primitives
plan: 02
subsystem: ui
tags: [preact, tailwind, accessibility, wai-aria, radiogroup, range-input, vitest]

# Dependency graph
requires:
  - phase: 21-01
    provides: "cn() class-join helper + Button/Pill variant-map + className-last convention in src/ui/"
provides:
  - "SegmentedControl<T> — hand-built WAI-ARIA role=radiogroup with roving tabindex + wrapping Arrow/Home/End selection (src/ui/SegmentedControl.tsx)"
  - "Slider — controlled native input[type=range] with aria-label + aria-valuetext, onInput-wired (src/ui/Slider.tsx)"
  - "SegmentOption<T> + SegmentedControlProps<T> + SliderProps public types"
affects: [21-03, 23-refine-wiring, refine-screen, edge-cleanup-control, color-count-slider]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hand-built APG radiogroup: ref-array + imperative .focus() for roving-tabindex 'selection follows focus' (no headless lib)"
    - "Preact live-input: onInput (not onChange) + parseInt for controlled native range"
    - "className typed as string via Omit<ComponentProps<'el'>, ...|'className'> (Signalish workaround, matches Wave-1)"

key-files:
  created:
    - src/ui/SegmentedControl.tsx
    - src/ui/Slider.tsx
    - src/ui/__tests__/SegmentedControl.test.tsx
    - src/ui/__tests__/Slider.test.tsx
  modified: []

key-decisions:
  - "SegmentedControl arrow handler moves selection AND focus in the same tick via a ref-array (imperative focus is required — a tabIndex change alone never moves focus)."
  - "Slider wired with onInput not onChange — in Preact onChange fires only on commit/blur, freezing a controlled slider mid-drag."
  - "SliderProps Omit adds 'className' so the prop can be typed as plain string (cn() rejects Preact's Signalish<string>), matching the Wave-1 Button/Pill pattern."

patterns-established:
  - "Pattern 1: WAI-ARIA radiogroup by hand — role=radiogroup + aria-label; role=radio + aria-checked; roving tabindex; wrapping Arrow/Home/End; imperative focus via ref-array."
  - "Pattern 2: Controlled native range — onInput->parseInt->onChange(number), aria-label + aria-valuetext, accent-[var(--accent)] tint, ...rest passthrough."

requirements-completed: []

coverage:
  - id: D1
    description: "SegmentedControl exposes role=radiogroup + group aria-label and one role=radio per option with mutually-exclusive aria-checked reflecting the controlled value (SC2)."
    verification:
      - kind: unit
        ref: "src/ui/__tests__/SegmentedControl.test.tsx#exposes role=\"radiogroup\" with the group aria-label from the label prop"
        status: pass
      - kind: unit
        ref: "src/ui/__tests__/SegmentedControl.test.tsx#marks only the selected option aria-checked=\"true\" (mutually exclusive)"
        status: pass
    human_judgment: false
  - id: D2
    description: "SegmentedControl uses roving tabindex and wrapping Arrow/Home/End keyboard selection, moving selection + focus together (SC2, D-04 controlled)."
    verification:
      - kind: unit
        ref: "src/ui/__tests__/SegmentedControl.test.tsx#uses roving tabindex: selected option tabIndex 0, all others -1"
        status: pass
      - kind: unit
        ref: "src/ui/__tests__/SegmentedControl.test.tsx#ArrowRight on the last option wraps to the first (selection follows focus)"
        status: pass
      - kind: unit
        ref: "src/ui/__tests__/SegmentedControl.test.tsx#Home selects the first option and End selects the last"
        status: pass
    human_judgment: false
  - id: D3
    description: "Slider renders a native input[type=range] with aria-label + aria-valuetext and live-updates the controlled value via onInput -> onChange(number) (SC2, D-04)."
    verification:
      - kind: unit
        ref: "src/ui/__tests__/Slider.test.tsx#fires onChange(number) on a bubbling input event (onInput, not commit)"
        status: pass
      - kind: unit
        ref: "src/ui/__tests__/Slider.test.tsx#applies aria-label and aria-valuetext from props"
        status: pass
    human_judgment: false
  - id: D4
    description: "Zero new dependencies added; full Vitest suite green + tsc clean (SC3 / SC4)."
    verification:
      - kind: other
        ref: "git diff --exit-code -- package.json package-lock.json (empty)"
        status: pass
      - kind: unit
        ref: "npm test (vitest run) — 286 passed / 27 files"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit (exit 0)"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-07-14
status: complete
---

# Phase 21 Plan 02: SegmentedControl + Slider Primitives Summary

**Hand-built WAI-ARIA `role="radiogroup"` SegmentedControl (roving tabindex + wrapping Arrow/Home/End keyboard selection) and a controlled native `input[type=range]` Slider (aria-label + aria-valuetext, onInput-wired), both zero-dependency and fully controlled per D-04.**

## Performance

- **Duration:** ~6 min
- **Completed:** 2026-07-14
- **Tasks:** 2 (both TDD: RED → GREEN)
- **Files created:** 4

## Accomplishments
- `SegmentedControl<T extends string>` — accessible radiogroup: `role="radiogroup"` + group `aria-label`, one native `<button role="radio">` per option with mutually-exclusive `aria-checked`, roving tabindex (selected = tab stop), and ArrowRight/ArrowDown/ArrowLeft/ArrowUp/Home/End selection that wraps and moves selection + focus together via an imperative ref-array `.focus()`.
- `Slider` — controlled native `<input type="range">` with `aria-label` + `aria-valuetext`, `min`/`max`/`step` (step defaults 1), `accent-[var(--accent)]` tint, wired via **`onInput`** (Preact-correct live update) → `onChange(parseInt(...))`, with `...rest` passthrough.
- Both consume the Wave-1 `cn()` helper, merge consumer `className` last, and hold NO internal value state (D-04). 17 new unit tests (10 + 7) via the raw `preact` render() + jsdom harness — no `@testing-library`.

## Task Commits

Each task was committed atomically (TDD test → feat):

1. **Task 1 (RED): SegmentedControl failing test** - `5d7d59f` (test)
2. **Task 1 (GREEN): SegmentedControl implementation** - `c64eeed` (feat)
3. **Task 2 (RED): Slider failing test** - `552cdd6` (test)
4. **Task 2 (GREEN): Slider implementation** - `6414f5a` (feat)

**Plan metadata:** committed after this SUMMARY (docs).

## Files Created/Modified
- `src/ui/SegmentedControl.tsx` - Generic WAI-ARIA radiogroup primitive with roving tabindex + keyboard selection.
- `src/ui/Slider.tsx` - Controlled native range primitive with a11y strings + onInput wiring.
- `src/ui/__tests__/SegmentedControl.test.tsx` - 10 tests: roles, aria-checked, roving tabindex, click, wrapping Arrow/Home/End, className-last.
- `src/ui/__tests__/Slider.test.tsx` - 7 tests: native range, a11y strings, min/max/step, onInput→onChange(number), accent tint, className-last, ...rest.

## Decisions Made
- **Imperative focus in the arrow handler** — the APG "selection follows focus" rule requires calling `onChange(next)` AND `refs.current[next]?.focus()` in the same tick; a `tabIndex` change alone does not move focus. Ref callbacks use a block body (`{ refs.current[i] = el; }`) to return void under strict TS.
- **`onInput` over `onChange` for the Slider** — Preact keeps native DOM `change` semantics (commit/blur), so a controlled slider on `onChange` freezes mid-drag; `onInput` fires per tick (Pitfall 1, verified against Step2Palette).
- **`SliderProps` Omit includes `'className'`** — so it can be re-declared as a plain `string` (cn() rejects Preact's `Signalish<string>`), matching the Wave-1 Button/Pill typing convention exactly.

## Deviations from Plan

None - plan executed exactly as written. Both tasks followed the RESEARCH.md skeletons and Wave-1 conventions; no bugs, missing functionality, or blocking issues surfaced.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 21-03 (SizeCard) is the only remaining Phase 21 primitive; it depends on the same `cn()` + typing conventions now firmly established across four files.
- The full public UI surface for the Refine screen's edge-cleanup control (SegmentedControl) and color-count slider (Slider) is ready for Phase 23 wiring — decoupled and unit-tested, awaiting real values from Phase 22 engine work.

## Self-Check: PASSED

---
*Phase: 21-shared-ui-primitives*
*Completed: 2026-07-14*
