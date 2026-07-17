# Phase 21: Shared UI Primitives - Research

**Researched:** 2026-07-14
**Domain:** Hand-built accessible UI primitives (Preact + Tailwind v4, browser-native, zero-dependency)
**Confidence:** HIGH (every finding verified against this repository's own source, not external docs)

## Summary

Phase 21 builds five pure/props-only primitives (SegmentedControl, Slider, SizeCard, Pill, Button) in a new `src/ui/` directory. CONTEXT.md and UI-SPEC.md already lock every design decision (component inventory, variants, tokens, a11y contract, controlled-state rule). This research answers only the *implementation subtleties* — the things a executor must get right once — and it does so almost entirely from patterns that **already exist and are tested in this codebase**. Nothing here requires reaching outside the repo's established conventions.

Three findings dominate and each overturns a naive assumption:

1. **Tests use RAW `preact` `render()` into a jsdom container — there is no `@testing-library/preact` in this project, and adding it would violate the zero-dependency constraint (D-03) and the `package.json` diff gate.** The research brief's mention of `@testing-library/preact` must be treated as *not applicable*: the shipped `StepBar.test.tsx` is the exact pattern to copy. `[VERIFIED: repo — package.json has no testing-library; StepBar.test.tsx imports `render` from `preact`]`

2. **The live-updating slider/input handler is `onInput`, NOT `onChange`.** In Preact `onChange` fires the native DOM `change` semantics (commit/blur), while `onInput` fires per drag tick. The codebase already proves this convention (Step2Palette uses `onInput` for range + number, `onChange` for checkbox + select). This is the single biggest Preact-vs-React trap in the phase. `[VERIFIED: repo — Step2Palette.tsx onInput usage]`

3. **The dark "Save" Button variant and the accent primary already have exact token recipes in the repo — no arbitrary hex needed.** `bg-ink text-on-accent rounded-[20px]` is the shipped Save pill; `bg-accent text-on-accent` is primary. But note the radius tokens (`--radius-pill` etc.) are on `:root` and are **NOT exposed to Tailwind via `@theme inline`**, so `rounded-pill` does not exist — the executor must write `rounded-[20px]` or `rounded-[var(--radius-pill)]`. `[VERIFIED: repo — AtelierShell.tsx line 73; index.css @theme block]`

**Primary recommendation:** Mirror `StepBar.tsx` for prop-interface style, token usage, and a11y wiring; mirror `StepBar.test.tsx` for the raw-render test harness; use `onInput` for controlled live inputs; type props with Preact's `ComponentProps<'button'>`; and implement the SegmentedControl roving-tabindex radiogroup with a ref-array + imperative `.focus()`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rendering interactive controls | Browser / Client (Preact component) | — | Pure presentational primitives; no server exists (fully client-side app) |
| Holding control state (value/selected) | Frontend state owner (App.tsx) | — | D-04: App.tsx is sole state owner; primitives are controlled, hold no state |
| Keyboard/focus a11y (radiogroup, range) | Browser-native + component | — | Native `input[type=range]` gives keyboard free; SegmentedControl hand-implements APG radio pattern |
| Styling / tokens | CSS (`src/index.css` token layer) | Component (Tailwind utilities) | Tokens defined once in `:root`/`@theme`; primitives consume, never define |
| Value derivation (inches, counts) | Engine (Phase 22) → App (Phase 23) | — | D-05: SizeCard receives fully-computed display strings; imports no engine module |

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01: StepBar *is* the StepNav — build no duplicate.** `src/features/wizard/StepBar.tsx` already fulfills the roadmap's "StepNav." Phase 21 ships only the 5 new primitives. StepBar stays physically in `features/wizard/` — not relocated to `src/ui/`.
- **D-02: Variant-map + tiny local `cn()` helper + `className` passthrough.** Each primitive exposes a `variant` prop keyed into a local `Record<variant, string>` of Tailwind class strings; a ~5-line hand-rolled `cn(...classes)` join helper lives in `src/ui/` (no `clsx`/`classnames`). Every primitive accepts an optional `className` merged **last** and spreads remaining `...rest` onto the underlying native element.
- **D-03: Zero new dependencies — hard constraint (SC3).** No UI kit, no headless lib, no slider lib, no `clsx`/`cva`/`tailwind-merge`. Browser-native elements + Tailwind + local `cn()` only. Enforced by a `package.json` diff check at verification. **This research reads this as covering devDependencies too — do NOT add `@testing-library/preact`.**
- **D-04: Fully controlled, native-a11y primitives.** Interactive primitives take `value` + `onChange` (or `selected`/`checked` + handler) and hold no internal state. SegmentedControl = `role="radiogroup"` + `role="radio"` options + roving-tabindex + arrow keys. Slider = native `input[type=range]` with `aria-label` + `aria-valuetext`.
- **D-05: SizeCard is a dumb presentational card.** Props are fully-computed display values (`label`, `gridDims` string, `inches` string, `drillCount` number, `selected`, `onSelect`). Imports no engine module; does no derivation.

### Claude's Discretion

- `cn()` helper location/name — `src/ui/cn.ts` vs `src/ui/utils.ts` (follow existing convention — named export, no default).
- Exact `variant` value taxonomy per primitive — infer from handoff; Button needs at least `primary` green CTA and dark `save` pill; Pill covers status/toggle chips. Do not invent variants no screen uses.
- Whether to refactor `AtelierShell`'s inline Save pill to consume new Button/Pill — additive/optional; do not force churn on working chrome.
- Test granularity — co-located `src/ui/__tests__/`, render tests asserting a11y roles and that variant + `className` classes apply. Keep full suite green.
- Whether Button/Pill/SegmentedControl share a common base — allowed if it reduces duplication cleanly; not required.

### Deferred Ideas (OUT OF SCOPE)

- Wiring primitives into Upload/Refine/Supplies/Order screens → **Phase 23**.
- Engine data the primitives display (2.5mm/dot density helper, `detectedColorCount`, `reduceToColorCount`) → **Phase 22**.
- Mobile/touch adaptation → **Phase 24**.
- Refactoring legacy Step1..4 inline controls to use new primitives → **Phase 25**.

## Phase Requirements

No REQ-ID maps to this phase by design (shared UI infrastructure). Success is measured by SC1–SC4 in ROADMAP §Phase 21:

| SC | Description | Research Support |
|----|-------------|------------------|
| SC1 | StepNav/SegmentedControl/Slider/SizeCard/Pill/Button render consistently from Atelier tokens | Variant-map + token recipes (§Code Examples); StepNav already ships (D-01) |
| SC2 | Interactive primitives keyboard-operable + screen-reader-labeled (SegmentedControl `role=radiogroup`, Slider native range) | APG radiogroup pattern (§Pattern 1); native range a11y (§Pattern 2) |
| SC3 | Browser-native + Tailwind only — no new dependency in `package.json` | Zero-dep `cn()` (§Pattern 3); raw-render tests need no testing-library (§Testing) |
| SC4 | 240+ Vitest suite stays green with new primitives covered | Raw `preact` render harness copied from StepBar.test.tsx (§Testing) |

## Standard Stack

**No packages are added this phase.** The entire stack already exists in `package.json` and is used as-is.

### Core (already installed — verified in package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `preact` | ^10.25.0 | Component runtime, hooks, JSX types | Project view framework; primitives are Preact components `[VERIFIED: repo package.json]` |
| `tailwindcss` + `@tailwindcss/vite` | ^4.0.0 | Utility styling + `@theme inline` token exposure | Established styling convention `[VERIFIED: repo]` |
| `typescript` | ^5.3.3 | Strict typing; `jsx: react-jsx`, `jsxImportSource: preact` | Prop interfaces + native-element extension typing `[VERIFIED: repo tsconfig.json]` |
| `vitest` | ^3.0.0 | Test runner (`globals: true`, env `node` per-file overridable) | Existing suite runner `[VERIFIED: repo vite.config.ts]` |
| `jsdom` | ^29.1.1 | DOM environment for render tests via `// @vitest-environment jsdom` pragma | Already used by StepBar.test.tsx `[VERIFIED: repo]` |

### Alternatives Considered (all REJECTED by D-03)
| Instead of | Would-be library | Why REJECTED |
|------------|------------------|--------------|
| Hand-rolled `cn()` | `clsx` / `classnames` | D-03 forbids; a 3-line filter+join is sufficient |
| Variant map | `cva` (class-variance-authority) | D-03 forbids; `Record<variant,string>` is enough |
| className override merge | `tailwind-merge` | D-03 forbids; documented caveat handled via source order + `!` modifier (§Pitfall 3) |
| Render tests | `@testing-library/preact` | **Not installed; adding it violates D-03/SC3.** Raw `preact` `render()` is the shipped pattern |
| SegmentedControl | `@radix-ui`, `react-aria`, headless kits | D-03 forbids; APG radiogroup is ~60 lines by hand |
| Slider | any range/slider lib | D-04 mandates native `input[type=range]` |

**Installation:** none. Any diff to `package.json` fails verification (SC3).

## Package Legitimacy Audit

Not applicable — **this phase installs zero packages** (D-03 hard constraint, enforced by `package.json` diff check). No registry lookups performed; nothing to vet.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                    App.tsx  (SOLE STATE OWNER — D-04)
                       │  owns: value, selected, onChange handlers
                       │  (Phase 23 wires real values; Phase 21 just defines the seam)
                       ▼
        ┌──────────────────────────────────────────────┐
        │            src/ui/  (NEW — this phase)         │
        │                                                │
        │  cn.ts ──────────► used by every primitive     │
        │                                                │
        │  Button ──┐                                    │
        │  Pill ────┤ variant → Record<variant,string>   │
        │  Segmented├─► + className (last) + ...rest      │
        │  Slider ──┤    spread onto native element       │
        │  SizeCard ┘                                    │
        └───────────────────────┬────────────────────────┘
                                 │ consume (read-only)
                                 ▼
        src/index.css  :root tokens  +  @theme inline utilities
        (bg-accent, text-on-accent, bg-ink, text-ink, bg-panel,
         border-border, text-warn ... ; radius tokens NOT in @theme)
                                 │
                                 ▼
                    Browser-native elements
        <button> · <span> · <input type="range"> · <div role="radiogroup">
```

Data flow for an interactive primitive (SegmentedControl example): user presses ArrowRight → keydown handler computes next index → calls `onChange(nextValue)` (App updates state) AND imperatively `.focus()`es the next option button via ref → App re-renders → new `value` prop flips `aria-checked` + roving `tabIndex`. The primitive itself never stores the value.

### Recommended Project Structure
```
src/ui/
├── cn.ts                    # ~3-line className join helper (named export)
├── Button.tsx               # <button>, variants: primary | save | ghost
├── Pill.tsx                 # <span> (or <button> if toggle), variants: neutral | ok | tag
├── SegmentedControl.tsx     # role=radiogroup + role=radio options (APG pattern)
├── Slider.tsx               # native <input type=range>, aria-label + aria-valuetext
├── SizeCard.tsx             # <button aria-pressed>, dumb display card (D-05)
└── __tests__/
    ├── Button.test.tsx
    ├── Pill.test.tsx
    ├── SegmentedControl.test.tsx
    ├── Slider.test.tsx
    └── SizeCard.test.tsx
```
Convention (from `.planning/codebase/CONVENTIONS.md` + observed): `PascalCase.tsx`, `<Component>Props` interface immediately above the component, named exports only (no default, no barrel), co-located `__tests__/`, string-literal unions for `variant`. `[VERIFIED: repo — StepBar.tsx, Step2Palette.tsx follow this exactly]`

### Pattern 1: SegmentedControl as WAI-ARIA radiogroup (hand-built)
**What:** Container `role="radiogroup"` with a group label; each option a `<button role="radio" aria-checked>`; roving tabindex (only selected option `tabIndex=0`, rest `-1`); ←/↑ previous, →/↓ next, Home/End first/last; selection follows focus (radios); fully controlled.
**When to use:** The Refine edge-cleanup 4-segment control (Off/Light/Med/Strong) — Phase 23 consumer.
**Key subtleties:**
- **Roving tabindex:** exactly one option is in the tab order. If a `value` is selected, that option is `tabIndex=0`; if none selected, the first option is `tabIndex=0`. Others `-1`. `[CITED: WAI-ARIA APG radio group pattern]`
- **Selection follows focus:** in a radiogroup, arrow keys both move focus and change selection in one step. So arrow handler calls `onChange(nextValue)` AND `.focus()`es the target.
- **Imperative focus is required** and does not come "for free" from changing `tabIndex`. Store a ref array (`refs.current[i]`) and call `refs.current[next]?.focus()` in the keydown handler. The DOM node at a given index is stable across Preact re-render (same position → same node), so focusing it in the same tick is safe even before the controlled re-render lands.
- **Wrap-around:** ArrowRight from last → first, ArrowLeft from first → last (APG behavior).
- **`preventDefault()`** on the handled arrow/Home/End keys so the page doesn't scroll.
- **Group label:** `aria-label` on the container (e.g. `aria-label="Edge cleanup"`), passed as a `label` prop.

### Pattern 2: Native `input[type=range]` styled with Tailwind v4
**What:** Wrap the native range; keyboard operability + screen-reader role=slider are inherent. Style track/thumb to the Atelier accent.
**When to use:** Refine color-count slider — Phase 23 consumer.
**Styling approaches (pick one; recommendation below):**
1. **Baseline (recommended minimum):** Tailwind `accent-*` utility → `accent-[var(--accent)]` (or the remapped `accent-accent`). This tints the native thumb + filled track with one class, zero pseudo-element code. **The codebase already does exactly this** (`accent-indigo-500`, which the `@theme` remap points at `--accent`). `[VERIFIED: repo — Step2Palette.tsx line 158]`
2. **Richer Atelier handle/track (arbitrary-variant, stays JSX-inline):** Tailwind v4 arbitrary variants can target vendor pseudo-elements, each generating a *separate* CSS rule (critical — see Pitfall 4):
   `[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--accent)] [&::-moz-range-track]:h-1 [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:bg-[var(--accent)]`
3. **Scoped CSS class in `src/index.css` (cleanest for heavy styling):** add a small `.slider-atelier` rule using `var(--accent)`. This matches the repo's existing scoped-component-class precedent (`.btn-chunk`, custom scrollbars). Trade-off: splits some styling out of JSX-inline convention.

**Recommendation:** start with approach 1 (`accent-[var(--accent)]`) as the baseline for correctness + a11y; add approach 2 arbitrary variants only for the specific thumb size/track height the handoff calls for. Avoid approach 3 unless the arbitrary-variant string becomes unreadable. All three are token-driven and add zero dependencies.

**A11y (must set):** `aria-label` (e.g. "Color count") and `aria-valuetext` (e.g. "24 of 26 matched") so the value announces meaningfully rather than as a bare number. `min`/`max`/`step` on the native element drive keyboard increments for free.

### Pattern 3: `cn()` helper + variant-map + typed passthrough
**What:** The D-02 styling API. `cn()` filters falsy and joins; each primitive has a `Record<variant, string>` map; `className` is concatenated **last**; `...rest` spreads onto the native element; props extend the native element's attribute type.
**Preact typing:** use `ComponentProps<'button'>` (Preact exports this from `'preact'`) or `JSX.IntrinsicElements['button']`. Both yield the full native attribute set including `className`, `onClick`, `disabled`, `children`. `[VERIFIED: repo — node_modules/preact/src/index.d.ts exports ComponentProps]`

### Anti-Patterns to Avoid
- **Reaching for `@testing-library/preact`** — not installed; adding it breaks SC3. Use raw `preact` `render()`.
- **Using `onChange` for a live slider/text input** — in Preact it won't fire per tick. Use `onInput`.
- **`rounded-pill` / `rounded-card` utilities** — they don't exist; radius tokens aren't in `@theme`. Use `rounded-[20px]` / `rounded-[var(--radius-pill)]`.
- **Trusting className "merged last" to always win** — Tailwind precedence is by generated-stylesheet order, not class-attribute order (Pitfall 3).
- **Custom-div slider** — violates D-04's "native `input[type=range]`" and re-implements keyboard a11y.
- **Combining `::-webkit-slider-thumb` and `::-moz-range-thumb` in one CSS selector** — browsers drop the entire rule if any selector is unknown (Pitfall 4).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slider keyboard + role=slider a11y | Custom div + pointer math + ARIA | Native `<input type="range">` | Keyboard, focus, `role=slider`, `aria-valuenow` all free; D-04 mandates it |
| Range thumb tinting | Pseudo-element gymnastics | `accent-[var(--accent)]` first | One class covers thumb + fill natively |
| Button/disabled semantics | `<div onClick>` | Native `<button type="button" disabled>` | Free focus, Enter/Space, disabled, a11y role |
| Test render harness | New test framework | Copy `StepBar.test.tsx` raw-render pattern | Already proven; no dependency |
| className joining | inline `[a, b].filter(Boolean).join(' ')` scattered everywhere | one shared `cn()` | Centralizes the D-02 convention |

**Key insight:** In this phase "don't hand-roll" points *back into the browser and the existing repo*, not toward libraries. The native `<button>` and `<input type=range>` already encapsulate the hard a11y; the only genuinely hand-built a11y is the SegmentedControl radiogroup, and that is dictated by D-04.

## Common Pitfalls

### Pitfall 1: `onChange` vs `onInput` (the Preact-vs-React trap)
**What goes wrong:** Executor writes `onChange` on the range/text input expecting per-keystroke/per-drag updates (React behavior). In Preact the controlled value only updates on commit/blur, so the slider appears frozen mid-drag.
**Why it happens:** Preact keeps native DOM semantics — `onChange` maps to the DOM `change` event; React aliases `onChange` to `input`.
**How to avoid:** Use `onInput` for any live-updating controlled input (range, text, number). Use `onChange` only where commit semantics are wanted (checkbox, select). **The repo already models this correctly** — Step2Palette.tsx: `onInput` on range + number, `onChange` on checkbox + select. `[VERIFIED: repo — Step2Palette.tsx lines 157, 164, 205 (onInput) vs 93, 136 (onChange)]`
**Warning signs:** Slider handle drags but the value/label doesn't move until you release.

### Pitfall 2: Radius/scale tokens are on `:root` but not exposed to Tailwind
**What goes wrong:** `rounded-pill`, `rounded-card`, `rounded-control` produce nothing (unknown utility → no class), so the pill renders with square corners.
**Why it happens:** `--radius-pill/-card/-control` and `--shadow-card` live on `:root` but the `@theme inline` block only remaps color/font tokens, not radius. Tailwind only generates utilities for tokens registered in `@theme`. `[VERIFIED: repo — index.css: radius tokens at lines 31-33 are outside the @theme block]`
**How to avoid:** Use arbitrary values that read the CSS var: `rounded-[var(--radius-pill)]` (or literal `rounded-[20px]`, `rounded-[12px]`, `rounded-[8px]`). The shipped Save pill uses `rounded-[20px]`. `[VERIFIED: repo — AtelierShell.tsx line 73]`
**Warning signs:** Pill/card corners look wrong; DevTools shows no matching class.

### Pitfall 3: `className` "merged last" does not guarantee override
**What goes wrong:** Consumer passes `className="bg-red-500"` to override a variant's `bg-accent`, but the base color still wins (or the result is nondeterministic).
**Why it happens:** Tailwind resolves conflicting utilities by their order in the *generated stylesheet*, not by order in the `class` attribute string. Putting `className` last in the joined string does not raise its specificity. This is precisely the gap `tailwind-merge` fills — which D-03 forbids.
**How to avoid:** (a) Keep variant maps minimal so consumers rarely need to override the same CSS property; (b) when a hard override is genuinely needed, document that consumers use the `!` important modifier (`!bg-red-500`) which does win; (c) do NOT add `tailwind-merge`. Note this limitation in the `cn()`/primitive JSDoc so Phase 23 authors aren't surprised.
**Warning signs:** A `className` override "sometimes works" depending on which utilities happen to be emitted.

### Pitfall 4: Vendor pseudo-elements can't share a selector
**What goes wrong:** A single CSS rule like `input::-webkit-slider-thumb, input::-moz-range-thumb { ... }` is dropped entirely by both browsers.
**Why it happens:** If any selector in a grouped selector list is unparseable to the engine, the whole rule is discarded. Webkit doesn't know `::-moz-range-thumb` and vice-versa.
**How to avoid:** Emit them as separate rules. Tailwind arbitrary variants do this automatically — each `[&::-webkit-slider-thumb]:...` and `[&::-moz-range-thumb]:...` is a distinct rule. If using scoped CSS in index.css, write separate `::-webkit-slider-thumb {}` and `::-moz-range-thumb {}` blocks. `[CITED: MDN — styling cross-browser range inputs]`
**Warning signs:** Thumb styled in Chrome but plain in Firefox (or neither).

### Pitfall 5: Strict TS unused-locals/params on `...rest` and destructuring
**What goes wrong:** `noUnusedLocals`/`noUnusedParameters` (both on) fail the build if a destructured prop or param is unused.
**Why it happens:** `tsconfig.json` sets both to `true`. `[VERIFIED: repo — tsconfig.json]`
**How to avoid:** Destructure only what you use; keep the remainder in `...rest` and actually spread it. Prefix intentionally-unused params with `_`. `build` runs `tsc` first (`tsc && vite build`), so this is a hard gate.

## Runtime State Inventory

Not applicable — Phase 21 is a **greenfield additive phase** (new `src/ui/` directory, new components). No rename/refactor/migration of existing runtime state occurs. StepBar is explicitly NOT relocated (D-01), and retrofitting AtelierShell's Save pill is discretionary and must not churn working chrome. No stored data, live-service config, OS-registered state, secrets, or build artifacts are touched. Verified by scope reading of CONTEXT.md (§domain, §deferred).

## Code Examples

Verified patterns — sources are this repository's own shipped code unless noted.

### `cn()` helper (zero-dependency, D-02/D-03)
```typescript
// src/ui/cn.ts  — ~3 lines, no dependency. Named export (repo convention).
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
// NOTE: this only joins — it does NOT resolve Tailwind conflicts (see Pitfall 3).
```

### Button with variant map + typed passthrough (Preact)
```typescript
// src/ui/Button.tsx
import type { ComponentProps } from 'preact';   // Preact exports this. [VERIFIED: repo]
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'save' | 'ghost';

// Extend native <button> attributes; override `variant` locally.
export interface ButtonProps extends Omit<ComponentProps<'button'>, 'variant'> {
  variant?: ButtonVariant;
}

// Tokens already exist in index.css — no arbitrary hex needed for primary/save.
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:brightness-110',
  // Dark "Save" pill — exact recipe from the shipped AtelierShell pill.
  save:    'bg-ink text-on-accent rounded-[20px] px-5 py-2 uppercase tracking-wide font-bold hover:brightness-110',
  ghost:   'border border-border text-ink hover:bg-panel-2',
};

export function Button({ variant = 'primary', className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'text-xs font-semibold rounded-[var(--radius-control)] px-3 py-1.5 transition-all cursor-pointer',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        VARIANTS[variant],
        className,            // merged LAST (see Pitfall 3 caveat)
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
```
Token recipe sources: `bg-ink text-on-accent rounded-[20px] ... disabled:opacity-40 ... hover:brightness-110` is copied from `AtelierShell.tsx` line 73. `[VERIFIED: repo]`

### Controlled Slider — `onInput`, native range, a11y strings
```typescript
// src/ui/Slider.tsx
import type { ComponentProps } from 'preact';
import { cn } from './cn';

export interface SliderProps
  extends Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'onInput' | 'type'> {
  value: number;
  onChange: (value: number) => void;      // named for the app; wired to onInput below
  min: number;
  max: number;
  step?: number;
  ariaLabel: string;                       // REQUIRED (D-04)
  ariaValueText?: string;                  // e.g. "24 of 26 matched"
}

export function Slider({ value, onChange, min, max, step = 1, ariaLabel, ariaValueText, className, ...rest }: SliderProps) {
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      aria-label={ariaLabel}
      aria-valuetext={ariaValueText}
      // Preact: onInput fires per drag tick; onChange would only fire on commit. [VERIFIED: repo Step2Palette]
      onInput={(e) => onChange(parseInt((e.currentTarget as HTMLInputElement).value, 10))}
      className={cn(
        'w-full h-1 cursor-pointer appearance-none rounded',
        'accent-[var(--accent)]',          // baseline accent tint (thumb + fill), free a11y
        className,
      )}
      {...rest}
    />
  );
}
```

### SegmentedControl — APG radiogroup skeleton (roving tabindex + arrow keys)
```typescript
// src/ui/SegmentedControl.tsx
import { useRef } from 'preact/hooks';   // repo hook-import convention. [VERIFIED: repo]
import { cn } from './cn';

export interface SegmentOption<T extends string> { value: T; label: string; }
export interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  label: string;                          // group label (aria-label)
  className?: string;
}

export function SegmentedControl<T extends string>({ value, onChange, options, label, className }: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = Math.max(0, options.findIndex(o => o.value === value));

  const move = (to: number, e: KeyboardEvent) => {
    e.preventDefault();                                  // stop page scroll
    const next = (to + options.length) % options.length; // wrap-around (APG)
    onChange(options[next].value);                        // selection follows focus
    refs.current[next]?.focus();                          // imperative focus (does not come free)
  };

  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex gap-1', className)}>
      {options.map((opt, i) => {
        const checked = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={i === selectedIndex ? 0 : -1}       // roving tabindex
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') move(i + 1, e);
              else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') move(i - 1, e);
              else if (e.key === 'Home') move(0, e);
              else if (e.key === 'End') move(options.length - 1, e);
            }}
            className={cn(
              'px-3 py-1.5 text-xs rounded-[var(--radius-control)] transition-all',
              checked ? 'bg-accent text-on-accent' : 'bg-panel-2 text-muted',  // clearly mutually-exclusive
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
```
APG behavior (arrow moves focus + selection, wrap-around, Home/End, roving tabindex) `[CITED: WAI-ARIA APG radio group pattern]`. Preact ref-callback + `preact/hooks` `useRef` usage matches repo. `[VERIFIED: repo — App.tsx useRef, ref-callback idioms]`

### Testing — raw `preact` render into jsdom (NO testing-library)
```typescript
// src/ui/__tests__/SegmentedControl.test.tsx
// @vitest-environment jsdom          <-- REQUIRED: global env is 'node'. [VERIFIED: repo vite.config.ts]
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';       // raw render — the shipped StepBar.test.tsx pattern. [VERIFIED: repo]
import { SegmentedControl } from '../SegmentedControl';

describe('SegmentedControl a11y + interaction', () => {
  let container: HTMLDivElement;
  beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
  afterEach(() => { render(null, container); container.remove(); vi.restoreAllMocks(); });

  const opts = [{ value: 'off', label: 'Off' }, { value: 'light', label: 'Light' }, { value: 'strong', label: 'Strong' }];

  it('exposes radiogroup + radio roles and marks the selected option', () => {
    render(<SegmentedControl value="light" onChange={vi.fn()} options={opts} label="Edge cleanup" />, container);
    expect(container.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe('Edge cleanup');
    const radios = Array.from(container.querySelectorAll('[role="radio"]'));
    expect(radios).toHaveLength(3);
    expect(radios[1].getAttribute('aria-checked')).toBe('true');
    expect((radios[1] as HTMLButtonElement).tabIndex).toBe(0);   // roving tabindex
    expect((radios[0] as HTMLButtonElement).tabIndex).toBe(-1);
  });

  it('ArrowRight selects the next option (selection follows focus, wraps)', () => {
    const onChange = vi.fn();
    render(<SegmentedControl value="strong" onChange={onChange} options={opts} label="Edge cleanup" />, container);
    const radios = container.querySelectorAll('[role="radio"]');
    radios[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(onChange).toHaveBeenCalledWith('off');                 // wrap-around
  });

  it('applies variant + consumer className classes', () => {
    render(<SegmentedControl value="off" onChange={vi.fn()} options={opts} label="x" className="my-extra" />, container);
    expect(container.querySelector('[role="radiogroup"]')?.className).toContain('my-extra');
  });
});
```
Harness copied verbatim from `src/features/wizard/__tests__/StepBar.test.tsx` (create container → `render` → query DOM → `render(null, container)` cleanup). `.click()` and `dispatchEvent(new KeyboardEvent(...))` work because Preact attaches listeners directly on the node. For the Slider, set `input.value = '5'` then `input.dispatchEvent(new Event('input', { bubbles: true }))` to trigger `onInput`. `[VERIFIED: repo — StepBar.test.tsx render+query pattern; viewer.test.ts dispatchEvent pattern]`

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| Reach for a headless UI kit / slider lib for a11y | Native `<input type=range>` + hand-built APG radiogroup | This project (D-03/D-04) | Zero bundle cost; a11y stays correct |
| `clsx` + `cva` + `tailwind-merge` styling stack | `cn()` join + `Record<variant,string>` map | This project (D-02) | ~3 lines vs 3 dependencies; override caveat (Pitfall 3) accepted |
| `@testing-library/*` for component tests | Raw framework `render()` into jsdom container | This repo's existing suite | No test-lib dependency; queries via DOM APIs |
| Tailwind config file + `theme.extend` | Tailwind v4 `@theme inline` in CSS | Tailwind v4 (repo on ^4.0.0) | Tokens live in `index.css`; radius tokens deliberately NOT exposed (Pitfall 2) |

**Deprecated/outdated for this repo:**
- React `onChange`-fires-on-every-keystroke mental model — wrong in Preact; use `onInput` (Pitfall 1).
- `tailwind.config.js` content/theme conventions — v4 uses CSS-first `@theme`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | D-03's "zero new dependencies" extends to **devDependencies** (blocks `@testing-library/preact`). | Standard Stack / Testing | LOW — even if devDeps were technically allowed, the repo has an established raw-render pattern that needs no test lib, so the recommendation stands regardless. Reinforced by the `package.json` diff gate wording (any diff fails). |
| A2 | SizeCard's selectable semantics = `<button aria-pressed={selected}>` (vs `role=radio` in a group). | Component notes | LOW — UI-SPEC explicitly allows either; group-level radiogroup wiring (if wanted) is Phase 23 composition. Planner's call per D-05 discretion. |

Only two assumptions, both LOW risk. Everything else is verified against repo source. No compliance/security/retention assumptions were made.

## Open Questions

1. **Slider fill on the *left* of the thumb (progress fill), cross-browser.**
   - What we know: `accent-color` tints the Firefox filled portion (`::-moz-range-progress`) automatically; Webkit has no progress pseudo-element, so a left-fill requires a `linear-gradient` background computed from the value (inline style).
   - What's unclear: whether the handoff actually requires a two-tone filled track or just an accent thumb on a neutral track (screenshot `A2-refine.png` should settle it during planning).
   - Recommendation: default to accent thumb + neutral track (approach 1). Only add the value-driven gradient if the handoff shows a filled track — and if so, isolate it in a small helper so it stays token-driven.

2. **Whether Button/Pill/SegmentedControl share a common base component.**
   - What we know: D-04 discretion allows it if it cleanly reduces duplication.
   - Recommendation: do NOT force a shared base up front; the variant-map pattern is already the shared mechanism. Introduce a base only if two primitives end up with substantial identical class strings.

## Environment Availability

Not applicable — Phase 21 is pure client-side TypeScript/Preact code with no external tools, services, or runtimes beyond the already-installed toolchain (Vite/Vitest/tsc, all present per `package.json`). No CLI utilities, databases, or network dependencies are introduced.

## Validation Architecture

Nyquist validation is **disabled for this run** (per orchestrator note), so the full formal section is omitted. The essential, non-obvious testing facts a planner needs are captured above and summarized here:

- **Framework:** Vitest ^3.0.0, `globals: true`, global environment `node`. `[VERIFIED: repo vite.config.ts]`
- **Per-file jsdom:** component tests MUST start with the pragma `// @vitest-environment jsdom`. `[VERIFIED: repo StepBar.test.tsx]`
- **Render harness:** raw `render` from `preact` into a manual container div; cleanup with `render(null, container)`. NO `@testing-library` (not installed; forbidden by D-03). `[VERIFIED: repo]`
- **Assert roles via DOM:** `container.querySelector('[role="radiogroup"]')`, `querySelectorAll('[role="radio"]')`, `querySelector('input[type=range]')`; interactions via `.click()` and `element.dispatchEvent(new KeyboardEvent(...))` / `new Event('input')`.
- **Run:** `npm test` (`vitest run`). Full suite (~255 after Phase 20) must stay green (SC4).
- **Coverage targets per primitive:** a11y roles/attributes present; controlled `onChange`/`onInput`/`onSelect` fires with expected value; arrow-key selection (SegmentedControl); variant class + consumer `className` both applied.

## Security Domain

No applicable security surface. These are presentational client-side primitives with no authentication, session, network, storage, or cryptography concerns (V2/V3/V4/V6 ASVS: N/A). The only input-handling (V5) is numeric range parsing and controlled string values, both bounded by native element `min`/`max`/`step` and string-literal union types — no injection sink exists (no `dangerouslySetInnerHTML`, no DOM string interpolation). App remains fully offline/client-side (no image or data leaves the browser — project invariant). No threat pattern from STRIDE materially applies at the primitive layer.

## Sources

### Primary (HIGH confidence — this repository's shipped, tested source)
- `src/features/wizard/StepBar.tsx` — reference pattern: pure props-only, token usage, a11y wiring (aria-current, aria-disabled, roving-ish tabIndex, tooltip).
- `src/features/wizard/__tests__/StepBar.test.tsx` — the raw `preact` `render()` + jsdom-pragma test harness to copy.
- `src/features/wizard/steps/Step2Palette.tsx` — `onInput` vs `onChange` convention; inline-Tailwind control idioms; `accent-*` range styling.
- `src/features/wizard/AtelierShell.tsx` (line 73) — exact dark "Save" pill recipe (`bg-ink text-on-accent rounded-[20px] ...`).
- `src/index.css` — Atelier token layer + `@theme inline`; confirms radius tokens are NOT exposed as Tailwind utilities.
- `package.json`, `tsconfig.json`, `vite.config.ts` — stack versions, strict flags, JSX config, Vitest env.
- `node_modules/preact/src/index.d.ts` — confirms Preact exports `ComponentProps`; `jsx.d.ts` exports `TargetedEvent`/`TargetedKeyboardEvent`.

### Secondary (MEDIUM confidence — external, standard references)
- WAI-ARIA Authoring Practices Guide — radio group keyboard interaction pattern (arrow moves focus+selection, wrap-around, Home/End, roving tabindex).
- MDN — styling range inputs cross-browser (vendor pseudo-elements can't share a selector).

### Tertiary (LOW confidence)
- None — all critical claims cross-checked against repo source.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no packages added; all versions read from `package.json`.
- Architecture / patterns: HIGH — every pattern mirrors shipped repo code; APG radiogroup cross-checked against WAI-ARIA.
- Pitfalls: HIGH — each pitfall is demonstrated or contradicted by an exact repo line reference.
- Testing approach: HIGH — copied from the shipped StepBar test; corrects the brief's `@testing-library/preact` assumption.

**Research date:** 2026-07-14
**Valid until:** ~2026-08-14 (stable; tied to repo conventions, not fast-moving external libs). Re-verify only if Preact/Tailwind majors change or the test harness is refactored.
