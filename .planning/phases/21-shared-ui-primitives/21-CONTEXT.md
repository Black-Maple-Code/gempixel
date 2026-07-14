# Phase 21: Shared UI Primitives - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 21 delivers the **hand-built, Atelier-tokened, accessible interactive primitives** the v4.0 redesign composes into the four screens — living in a new `src/ui/` directory, built from browser-native elements + Tailwind only, with **zero new dependencies** entering `package.json`.

The primitives to build: **SegmentedControl, Slider, SizeCard, Pill, Button** (5 components). The roadmap also names "StepNav" — that navigator **already ships** as `src/features/wizard/StepBar.tsx` (Phase 20) and is NOT rebuilt (see D-01).

These are **pure/props-only** presentational components: App.tsx stays the sole state owner (carried forward from Phase 20). This phase produces the reusable control layer only — it does NOT wire them into the actual Upload/Refine/Supplies/Order screens (that is Phase 23) and does NOT depend on the Phase 22 engine additions.

**Not in this phase:**
- The four-screen content/behavior that composes these primitives → **Phase 23**.
- The engine data some primitives will eventually display (derived inches, `detectedColorCount`, `reduceToColorCount`) → **Phase 22**. SizeCard is built as a dumb card that *receives* those values as props (D-04).
- Any `engine/*` signature change (strangler rule — Phase 22 only).
- Mobile/touch responsiveness → **Phase 24**.
- Deleting/refactoring the legacy Step1..4 components → **Phase 25**.

**No REQ-ID by design** — shared UI infrastructure that unblocks every screen. Success is measured by SC1–SC4 in ROADMAP §Phase 21.
</domain>

<decisions>
## Implementation Decisions

### StepNav vs the shipped StepBar (resolves the duplication risk)
- **D-01:** **StepBar *is* the StepNav — build no duplicate.** `src/features/wizard/StepBar.tsx` (shipped + tested in Phase 20) already fulfills the roadmap's "StepNav" primitive: a pure/props-only horizontal step navigator rendering from Atelier tokens with the full D-12 gating/a11y contract (`aria-current="step"`, locked `aria-disabled="true"` + `tabIndex -1` + tooltip, stale amber marker). Phase 21 ships **only the 5 new primitives** (SegmentedControl, Slider, SizeCard, Pill, Button). StepBar stays physically in `features/wizard/` — not relocated to `src/ui/` — to avoid churn on a green, tested component. (Chosen over move+rename to `src/ui/StepNav` and over extracting a generic StepNav that StepBar wraps; both re-touch working code for cosmetic tidiness, and rebuilding an already-working navigator is exactly the regression pattern to avoid.)

### Variant & styling API (avoids Tailwind-soup — SC1)
- **D-02:** **Variant-map + tiny local `cn()` helper + `className` passthrough.** Each primitive exposes a `variant` prop keyed into a local `Record<variant, string>` of Tailwind class strings; a small (~5-line) hand-rolled `cn(...classes)` join helper lives in `src/ui/` (**no `clsx`/`classnames` dependency** — D-03 constraint). Every primitive accepts an optional `className` (merged **last** so consumers can override) and spreads remaining `...rest` props onto the underlying native element. This keeps the established inline-Tailwind convention, centralizes variant styling in the primitive, and lets the four screens compose without duplicating class soup. (Chosen over inline Tailwind strings per call site — pushes the soup back onto screens, the very thing this phase prevents — and over `@apply` CSS component classes — splits styling away from the JSX-inline convention.)
- **D-03:** **Zero new dependencies — hard constraint (SC3).** No UI kit, no headless-component lib, no slider lib, no `clsx`/`cva`/`tailwind-merge`. Everything is browser-native elements + Tailwind + the local `cn()` helper. Enforced by a `package.json` diff check at verification.

### Controlled state + accessibility contract (SC2)
- **D-04:** **Fully controlled, native-a11y primitives.** Interactive primitives take `value` + `onChange` (or `selected`/`checked` + handler) and hold **no internal state** — App.tsx remains the state owner (carried from Phase 20). Specifics:
  - **SegmentedControl** — `role="radiogroup"` with option buttons as `role="radio"` / `aria-checked`, roving-tabindex + arrow-key selection, and an accessible group label. Used by the Refine edge-cleanup 4-segment control (Off/Light/Med/Strong) in Phase 23.
  - **Slider** — wraps the **native `input[type=range]`** (keyboard operability comes for free), styled via Tailwind, with `aria-label` and `aria-valuetext`. Used by the Refine color-count slider in Phase 23.
  - (Chosen over uncontrolled `defaultValue` — violates the state-owner rule and risks divergence — and over a custom-div slider — re-implements keyboard a11y by hand and contradicts the "native `input[type=range]`" criterion.)

### SizeCard contract (uncoupled from the not-yet-built Phase 22 engine)
- **D-05:** **SizeCard is a dumb presentational card.** Its props are fully-computed display values — e.g. `label`, `gridDims` (string like "120×160"), `inches` (formatted string), `drillCount` (number), `selected` (boolean), `onSelect` (handler). It imports **no engine module** and does no derivation; the parent formats and passes values in. Phase 23 feeds it Phase 22's real derived inches (2.5mm/dot density helper) and live merged drill count. This keeps the primitive buildable and unit-testable now, decoupled from an engine that doesn't exist yet, and honors the strangler build order. (Chosen over SizeCard importing density/count helpers — couples a Phase 21 primitive to Phase 22, breaking phase order — and over raw grid-dims + formatter-callback props — more API surface for a single consumer.)

### Claude's Discretion
- **`cn()` helper location/name** — `src/ui/cn.ts` vs a shared `src/ui/utils.ts`; planner's call (follow existing convention — named export, no default).
- **Exact `variant` value taxonomy per primitive** — infer from the design handoff (README §"Design Tokens" / top-bar spec): Button needs at least a **primary green CTA** and the **dark "Save" pill** treatment (`#1B1A17` bg / `#F4F1E9` text); Pill covers status/toggle chips (radius `--radius-pill` = 20px). Land the concrete variant names during planning against the handoff screenshots; do not invent variants no screen uses.
- **Whether to refactor `AtelierShell`'s existing inline "Save" pill to consume the new Button/Pill** — the primitives are **additive**; retrofitting existing Phase 20 chrome to use them is optional and only if it stays clean and keeps tests green. Do **not** force churn on working chrome (regression-averse).
- **Test granularity** — co-located `src/ui/__tests__/`, render tests asserting a11y roles (`radiogroup`/`radio`/native `range`) and that variant + `className` classes apply. Must keep the full Vitest suite green (SC4; currently ~255 tests after Phase 20).
- **Whether Button/Pill/SegmentedControl share a common base** — allowed if it reduces duplication cleanly; not required.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design contract (source of truth for the primitives' look/behavior)
- `C:\Users\rickf\OneDrive\Desktop\GemPixel\GEM PIXEL design review\design_handoff_ui_redesign\README.md` — the design contract: Atelier tokens (colors, typography, radius/shadow, spacing), the top-bar + step-nav chrome spec, and the per-screen controls (segmented control, color slider, size cards, pills, buttons) these primitives must recreate. (External to the repo — absolute path.)
- `…\design_handoff_ui_redesign\GemPixel Redesign.dc.html` — high-fidelity prototype. **Reference only — do NOT ship; `support.js` is a prototyping runtime, not a production dependency.** Recreate faithfully in Preact/Vite/Tailwind.
- `…\design_handoff_ui_redesign\screenshots\` — reference renders (`A2-refine.png` shows the segmented control, color slider, and size cards most directly).

### Milestone grounding
- `.planning/ROADMAP.md` §"Phase 21" — goal, success criteria SC1–SC4, and the strangler build constraints.
- `.planning/REQUIREMENTS.md` — no REQ-ID maps to this phase (infrastructure by design), but the v4.0 requirement language for REFINE-03/04 (segmented control, color slider) and REFINE-02 (size cards) describes what these primitives must support in Phase 23.
- `.planning/research/SUMMARY.md` — v4.0 research: browser-native + Tailwind only; Tailwind v4 has built-in container queries (do NOT add the plugin); self-hosted primitives, zero UI deps.

### Codebase maps + live touchpoints
- `.planning/codebase/CONVENTIONS.md` — naming (`PascalCase.tsx`, `<Component>Props` interface above the component, named exports only, no barrel files, co-located `__tests__/`), inline-Tailwind styling, string-literal unions over enums. New primitives must match.
- `.planning/codebase/STRUCTURE.md` — where `src/ui/` sits relative to `src/features/` and `src/engine/`.
- `src/index.css` — the established Atelier token layer + Tailwind v4 `@theme inline` block (semantic utilities `bg-panel`/`text-ink`/`bg-accent`/`text-on-accent`, and tokens `--radius-control` 8px / `--radius-pill` 20px / `--shadow-card`). Primitives consume these; they do NOT define new tokens.
- `src/features/wizard/StepBar.tsx` — the shipped "StepNav" (D-01) **and the reference pattern** for a pure, tokened, a11y-correct primitive: match its prop-interface style, token usage, and a11y wiring in the 5 new components.
- `src/features/wizard/steps/Step2Palette.tsx`, `Step4Export.tsx` — existing inline-Tailwind control usage; shows the class idioms the new primitives should encapsulate.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`StepBar.tsx` (+ `stepMeta.ts`)** — already the pure step navigator (D-01); no StepNav is built. Also the canonical example to mirror for the 5 new primitives (pure props-only, token-driven, a11y-complete).
- **Atelier token layer in `src/index.css`** — semantic Tailwind utilities and radius/shadow tokens already exist; primitives style entirely from these, introducing no new token mechanism.
- **`useWizard` / App.tsx state ownership** — the primitives plug into the existing "App owns state, children are pure" architecture as controlled components (D-04).

### Established Patterns
- **Pure/props-only children; App.tsx owns all state** (Phase 20 constraint) — drives the fully-controlled primitive API (D-04).
- **Inline Tailwind utilities, no formatter/linter beyond `tsc --strict`** — the `cn()` + variant-map approach (D-02) stays within this convention rather than introducing a styling library.
- **Named exports only, no default exports, no barrel files** — each primitive is imported directly by path (e.g. `import { Button } from '@/ui/Button'` or the relative-path equivalent the codebase predominantly uses).
- **`<Component>Props` interface declared immediately above the component**, string-literal unions for `variant` values (e.g. `'primary' | 'save' | 'ghost'`) rather than enums.

### Integration Points
- New `src/ui/` directory is created this phase; primitives are consumed by the four screens in **Phase 23** (not wired here).
- SizeCard's display props will be fed by Phase 22's density helper + reducer via Phase 23 wiring — the seam is the props interface only (D-05), no import coupling now.
- Optional: `AtelierShell`'s inline Save pill *could* later consume the new Button/Pill, but retrofitting is discretionary and must not churn working chrome.
</code_context>

<specifics>
## Specific Ideas

- The design handoff's guiding principle applies to the controls too: clean, token-consistent, no confusing overlapping states. SegmentedControl segments must read as clearly mutually-exclusive (avoid the "both look selected" ambiguity called out in the developer profile).
- Button needs a **primary green CTA** (accent `#0E6E5C` / `text-on-accent`) and the **dark "Save" pill** treatment (`#1B1A17` bg, `#F4F1E9` text) per the top-bar spec; Pill uses the 20px `--radius-pill`.
- Slider = native `input[type=range]` styled to the Atelier accent — not a custom-drawn track — so keyboard + screen-reader support is inherent.
</specifics>

<deferred>
## Deferred Ideas

- **Wiring the primitives into Upload/Refine/Supplies/Order screens** (the segmented control's edge-cleanup levels, the color slider's real detected-count max, the size cards' live data) → **Phase 23** (keystone: Refine).
- **The engine data the primitives display** — 2.5mm/dot density helper, `detectedColorCount`, `reduceToColorCount` → **Phase 22** (engine-only commits).
- **Mobile/touch adaptation of the primitives** (container-query reflow, touch targets) → **Phase 24**.
- **Refactoring legacy Step1..4 inline controls to use the new primitives** → **Phase 25** (strangler close), or discretionary/opportunistic if trivially clean.

None of the above were scope creep — all are already-mapped later phases; captured so nothing is lost.
</deferred>

---

*Phase: 21-shared-ui-primitives*
*Context gathered: 2026-07-14*
