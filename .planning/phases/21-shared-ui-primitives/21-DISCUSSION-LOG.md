# Phase 21: Shared UI Primitives - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-14
**Phase:** 21-shared-ui-primitives
**Areas discussed:** StepNav vs shipped StepBar, Variant & styling API, Controlled state + a11y contract, SizeCard contract vs Phase 22 data

---

## StepNav vs shipped StepBar

| Option | Description | Selected |
|--------|-------------|----------|
| A. StepBar is the StepNav — build no duplicate | Phase 21 ships only the 5 new primitives; StepBar stays in features/wizard as the step navigator. Zero churn, zero regression risk. | ✓ |
| B. Move + rename to src/ui/StepNav | Relocate the tested StepBar into src/ui for a tidy "all primitives together" story. Small mechanical churn on green code. | |
| C. Extract generic StepNav, StepBar wraps it | Split pure visuals from wizard coupling. Over-engineered for one consumer. | |

**User's choice:** A. StepBar is the StepNav (Recommended)
**Notes:** StepBar was surfaced from Phase 20 as an already-complete, tested, token-driven, a11y-correct pure navigator. Rebuilding or relocating it re-touches working code — the regression pattern the developer explicitly dislikes. → D-01.

---

## Variant & styling API

| Option | Description | Selected |
|--------|-------------|----------|
| A. Variant-map + cn() + className passthrough | variant prop keyed to a local class map, a ~5-line cn() join helper (no dep), className merged last + ...rest spread. Kills duplication, zero deps. | ✓ |
| B. Inline Tailwind strings per call site | No variant prop; consumers write classes. Simplest primitive but pushes soup onto the four screens. | |
| C. CSS component classes via @apply | .btn-primary etc. in index.css. Splits styling from the JSX-inline convention. | |

**User's choice:** A. Variant-map + cn() + className passthrough (Recommended)
**Notes:** Only option that delivers "compose without Tailwind-soup duplication" (SC1) while honoring the inline-Tailwind convention and the zero-deps rule. → D-02, D-03.

---

## Controlled state + a11y contract

| Option | Description | Selected |
|--------|-------------|----------|
| A. Fully controlled + native a11y | value+onChange only, no internal state. SegmentedControl role=radiogroup w/ roving arrow keys; Slider wraps native input[type=range] + aria labels. | ✓ |
| B. Uncontrolled (defaultValue + onChange) | Component holds internal state. Violates App-owns-state; risks divergence. | |
| C. Controlled but custom-div slider | Re-implement slider without native range. Re-does keyboard a11y by hand; contradicts the native-range criterion. | |

**User's choice:** A. Fully controlled + native a11y (Recommended)
**Notes:** Matches the Phase 20 "App owns all state, children pure" architecture and hits SC2's a11y criteria (radiogroup + native range) directly. → D-04.

---

## SizeCard contract vs Phase 22 data

| Option | Description | Selected |
|--------|-------------|----------|
| A. Dumb presentational card | Props are fully-computed display values (label, gridDims, inches, drillCount, selected, onSelect). No engine imports; parent formats. Zero coupling, testable now. | ✓ |
| B. SizeCard imports density/count helpers | Computes inches/drills itself. Couples to a Phase 22 engine that doesn't exist yet; breaks strangler order. | |
| C. Raw grid dims + formatter callbacks | Parent passes cols/rows + format fns. More flexible, more API surface for one consumer. | |

**User's choice:** A. Dumb presentational card (Recommended)
**Notes:** Keeps a Phase 21 UI primitive decoupled from the not-yet-built Phase 22 engine; Phase 23 wiring feeds it derived inches + live drill count via props. → D-05.

---

## Claude's Discretion

- `cn()` helper file location/name (`src/ui/cn.ts` vs `src/ui/utils.ts`).
- Exact per-primitive `variant` value taxonomy — inferred from the design handoff (Button: primary green CTA + dark Save pill; Pill: status/toggle chips).
- Whether to retrofit AtelierShell's inline Save pill to consume the new Button/Pill (additive, optional, no forced churn).
- Test granularity (co-located `src/ui/__tests__/`, assert a11y roles + variant/className application; keep full suite green).
- Whether Button/Pill/SegmentedControl share a common base.

## Deferred Ideas

- Wiring primitives into the Upload/Refine/Supplies/Order screens → Phase 23.
- The engine data the primitives display (density helper, detectedColorCount, reduceToColorCount) → Phase 22.
- Mobile/touch adaptation of the primitives → Phase 24.
- Refactoring legacy Step1..4 inline controls to use the new primitives → Phase 25 (or opportunistic if trivially clean).
