# Phase 21: Shared UI Primitives - Pattern Map

**Mapped:** 2026-07-14
**Files analyzed:** 11 new (6 source + 5 tests)
**Analogs found:** 11 / 11 (all have strong in-repo analogs)

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/ui/cn.ts` | utility | transform | (none — 3-line greenfield helper; convention from CONVENTIONS.md) | no-analog / convention-only |
| `src/ui/Button.tsx` | component (primitive) | request-response (onClick) | `src/features/wizard/AtelierShell.tsx` Save pill (L69-76) + `StepBar.tsx` | exact (recipe) |
| `src/ui/Pill.tsx` | component (primitive) | request-response / display | `StepBar.tsx` step-circle chip (L78-95) + AtelierShell Save pill | role-match |
| `src/ui/SegmentedControl.tsx` | component (primitive) | event-driven (radiogroup, keyboard) | `StepBar.tsx` (a11y/roving-tabindex idiom) | role-match |
| `src/ui/Slider.tsx` | component (primitive) | event-driven (onInput per tick) | `Step2Palette.tsx` range inputs (L152-159, L199-207) | exact (idiom) |
| `src/ui/SizeCard.tsx` | component (primitive) | request-response (onSelect) | `StepBar.tsx` (props-only button) + AtelierShell chrome | role-match |
| `src/ui/__tests__/Button.test.tsx` | test | — | `src/features/wizard/__tests__/StepBar.test.tsx` | exact (harness) |
| `src/ui/__tests__/Pill.test.tsx` | test | — | `StepBar.test.tsx` | exact (harness) |
| `src/ui/__tests__/SegmentedControl.test.tsx` | test | — | `StepBar.test.tsx` | exact (harness) |
| `src/ui/__tests__/Slider.test.tsx` | test | — | `StepBar.test.tsx` | exact (harness) |
| `src/ui/__tests__/SizeCard.test.tsx` | test | — | `StepBar.test.tsx` | exact (harness) |

## Pattern Assignments

### `src/ui/cn.ts` (utility, transform)

**No direct analog** — greenfield 3-line helper. Follow CONVENTIONS.md: named export only, no default, `camelCase.ts` filename allowed for a logic/util module. RESEARCH.md §Code Examples gives the exact target:

```typescript
// src/ui/cn.ts — named export, no dependency (D-02/D-03)
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
// NOTE: joins only — does NOT resolve Tailwind conflicts (see Shared Pattern: className override caveat).
```

---

### `src/ui/Button.tsx` (component, request-response)

**Analog:** `src/features/wizard/AtelierShell.tsx` Save pill (lines 69-76) — the exact `save` variant recipe; token usage and disabled/hover states carry directly.

**Save-variant recipe to encode** (AtelierShell.tsx L73, VERIFIED):
```tsx
className="bg-ink text-on-accent rounded-[20px] px-5 py-2 text-xs font-bold uppercase tracking-wide transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
```

**Props-interface style** (mirror StepBar.tsx L18-36): `<Component>Props` interface with prose JSDoc directly above the component; string-literal union for `variant`. Extend native attrs via Preact `ComponentProps<'button'>` (RESEARCH.md §Code Examples):
```typescript
import type { ComponentProps } from 'preact';
import { cn } from './cn';
export type ButtonVariant = 'primary' | 'save' | 'ghost';
export interface ButtonProps extends Omit<ComponentProps<'button'>, 'variant'> {
  variant?: ButtonVariant;
}
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:brightness-110',
  save:    'bg-ink text-on-accent rounded-[20px] px-5 py-2 uppercase tracking-wide font-bold hover:brightness-110',
  ghost:   'border border-border text-ink hover:bg-panel-2',
};
```
- **Token sources:** `bg-accent`/`text-on-accent`/`bg-ink` are real `@theme inline` utilities (index.css L61-64). `--accent = #0E6E5C`, `--ink = #1B1A17`, `--on-accent = #F4F1E9` (index.css L18/17/21).
- **Radius caveat:** use `rounded-[20px]` or `rounded-[var(--radius-pill)]` — `rounded-pill`/`rounded-control` do NOT exist (radius tokens at index.css L30-33 are outside the `@theme` block). Control radius = `rounded-[var(--radius-control)]` (8px).
- Always set `type="button"` (StepBar buttons all do — L66) and spread `...rest`; `className` merged LAST in `cn()`.

---

### `src/ui/Pill.tsx` (component, request-response / display)

**Analog:** `StepBar.tsx` step-circle chip (L78-95) for the rounded-token chip idiom; AtelierShell Save pill for the pill radius.

**Chip idiom** (StepBar L80-84):
```tsx
className={`relative w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
  isCompleted || isCurrent ? 'bg-accent text-on-accent' : 'border border-faint text-faint'
}`}
```
- Render as `<span>` (display) unless a toggle is needed (`<button>` if `onClick`/toggle). Use `rounded-[var(--radius-pill)]` (20px) per D-04 discretion note.
- Variant taxonomy (infer from handoff): status/toggle chips — e.g. `neutral | ok | tag`. Do not invent variants no screen uses.
- Same `ComponentProps<'span'>` + variant-map + `className`-last + `...rest` shape as Button.

---

### `src/ui/SegmentedControl.tsx` (component, event-driven radiogroup)

**Analog:** `StepBar.tsx` — the repo's canonical a11y-correct, pure/props-only, token-driven navigator. Mirror its role/tabIndex wiring style; the WAI-ARIA radiogroup keyboard logic is new (RESEARCH.md §Pattern 1 / §Code Examples has the full skeleton).

**a11y wiring to mirror from StepBar** (L65-77): `type="button"`, conditional `aria-*` attributes, and `tabIndex` driven purely by props:
```tsx
<button
  type="button"
  aria-current={isCurrent ? 'step' : undefined}
  aria-disabled={isLocked ? 'true' : undefined}
  tabIndex={isLocked ? -1 : undefined}
/>
```
Translate to radiogroup: container `role="radiogroup"` + `aria-label={label}`; each option `role="radio"` + `aria-checked` + roving `tabIndex` (selected = 0, rest = -1). Arrow/Home/End handler calls `onChange(next)` AND imperatively `refs.current[next]?.focus()` (ref-array via `preact/hooks` `useRef`). Wrap-around with `(next + len) % len`; `preventDefault()` on handled keys.
- **Mutually-exclusive styling** (avoids the "both look selected" ambiguity from the dev profile): `checked ? 'bg-accent text-on-accent' : 'bg-panel-2 text-muted'`.
- Controlled only (D-04) — no internal state.

---

### `src/ui/Slider.tsx` (component, event-driven — onInput)

**Analog:** `Step2Palette.tsx` range inputs (L152-159 and L199-207) — the exact `onInput` + `accent-*` + parseInt idiom. This is the single biggest Preact trap (Pitfall 1).

**Range idiom to encapsulate** (Step2Palette L152-159, VERIFIED):
```tsx
<input
  type="range"
  min="1" max="500"
  value={substitutionThreshold}
  onInput={(e) => setSubstitutionThreshold(parseInt((e.target as HTMLInputElement).value, 10) || 1)}
  className="flex-1 accent-indigo-500 cursor-pointer h-1 bg-slate-800 rounded appearance-none"
/>
```
- **CRITICAL:** use `onInput`, NOT `onChange` — Preact fires `onChange` only on commit/blur; `onInput` fires per drag tick. (`onChange` is correct only for the checkbox/select at Step2Palette L93/L116/L136.)
- **Accent tint:** `accent-indigo-500` remaps to `--accent` via `@theme` (index.css L100). For the new primitive prefer the semantic `accent-[var(--accent)]` (RESEARCH.md §Pattern 2, approach 1) for baseline thumb+fill tint, free keyboard + `role=slider` a11y.
- **a11y (D-04, must set):** `aria-label` (required prop) + `aria-valuetext` (e.g. "24 of 26 matched"). `min`/`max`/`step` drive keyboard increments.
- Typed passthrough: `Omit<ComponentProps<'input'>, 'value'|'onChange'|'onInput'|'type'>` with `value: number` + `onChange: (n:number)=>void` wired to `onInput`.

---

### `src/ui/SizeCard.tsx` (component, request-response — dumb card)

**Analog:** `StepBar.tsx` (props-only button, no state, token styling) + AtelierShell card chrome; `--radius-card` (12px) and `--shadow-card` tokens (index.css L31/33).

- **D-05 contract:** fully-computed display props only — `label`, `gridDims` (string e.g. "120×160"), `inches` (formatted string), `drillCount` (number), `selected` (boolean), `onSelect` (handler). Imports NO engine module; does no derivation.
- Selectable semantics (RESEARCH.md A2, LOW risk): `<button aria-pressed={selected}>` with `type="button"`. `selected ? 'border-accent' : 'border-border'` for clear selection state.
- Radius: `rounded-[var(--radius-card)]`; shadow only if handoff shows it (`shadow-[var(--shadow-card)]` is arbitrary since not in `@theme`).

---

### All 5 test files (`src/ui/__tests__/*.test.tsx`)

**Analog:** `src/features/wizard/__tests__/StepBar.test.tsx` — copy the harness verbatim. RESEARCH.md confirms there is NO `@testing-library/preact` (adding it breaks D-03/SC3); use raw `preact` `render()`.

**Harness to copy** (StepBar.test.tsx L1-31, VERIFIED):
```tsx
// @vitest-environment jsdom          <-- REQUIRED: global env is 'node'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';       // raw render — NO testing-library

let container: HTMLDivElement;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
afterEach(() => { render(null, container); container.remove(); vi.restoreAllMocks(); });
// render(<Component .../>, container); then query via container.querySelector(...)
```
- Assert roles/attrs via DOM: `container.querySelector('[role="radiogroup"]')`, `querySelectorAll('[role="radio"]')`, `querySelector('input[type=range]')`.
- Interactions: `.click()` and `el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))`. For Slider: set `input.value = '5'` then `input.dispatchEvent(new Event('input', { bubbles: true }))` to trigger `onInput`.
- Coverage per primitive: a11y roles/attrs present; controlled handler fires with expected value; arrow-key selection (SegmentedControl); variant class + consumer `className` both applied. Full suite (~255 after Phase 20) must stay green (SC4).

## Shared Patterns

### Variant map + `cn()` + typed passthrough (D-02)
**Source:** RESEARCH.md §Pattern 3; recipe realized from AtelierShell + StepBar.
**Apply to:** Button, Pill, SegmentedControl, Slider, SizeCard.
Each primitive: `Record<variant, string>` map of Tailwind strings; base classes + `VARIANTS[variant]` + `className` joined via `cn()` with **`className` last**; `...rest` spread onto the native element; props extend `ComponentProps<'element'>` (Preact export).

### Atelier tokens — consume, never define (SC1)
**Source:** `src/index.css` (`:root` L8-34; `@theme inline` L50-116).
**Apply to:** all 6 source files.
Real utilities: `bg-accent` `text-on-accent` `bg-ink` `text-ink` `bg-panel` `bg-panel-2` `border-border` `text-muted` `text-faint` `text-warn`. Radius/shadow are NOT `@theme` utilities → use arbitrary `rounded-[var(--radius-pill)]` (20), `rounded-[var(--radius-card)]` (12), `rounded-[var(--radius-control)]` (8), `shadow-[var(--shadow-card)]`. Legacy `accent-indigo-500`/`slate-*` remap to the same tokens; new code should prefer semantic names or `[var(--accent)]`.

### Pure/props-only, App owns state (D-04, Phase 20 carryover)
**Source:** `StepBar.tsx` (L36 — destructures props, renders, owns nothing); CONVENTIONS.md §Component Architecture.
**Apply to:** all interactive primitives — take `value` + `onChange` / `selected` + handler; hold no internal state.

### Naming / export conventions
**Source:** `.planning/codebase/CONVENTIONS.md` (L10-13, L24-27, L88-96).
**Apply to:** all files. `PascalCase.tsx` components; `<Component>Props` interface immediately above component with prose JSDoc; named exports only, no default, no barrel; string-literal unions for `variant`; co-located `__tests__/`; 2-space indent, single quotes, trailing commas. `tsc --strict` (+ `noUnusedLocals`/`noUnusedParameters`) is the lint gate — destructure only what you use, prefix intentionally-unused with `_`.

### className override caveat (Pitfall 3)
**Source:** RESEARCH.md §Pitfall 3.
**Apply to:** all primitives + `cn()` JSDoc.
Tailwind resolves conflicts by generated-stylesheet order, not class-attribute order — `className` last does NOT guarantee override. Do NOT add `tailwind-merge` (D-03). Keep variant maps minimal; document that consumers use `!` important modifier for hard overrides.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/ui/cn.ts` | utility | transform | No existing shared class-join helper; inline `[...].filter(Boolean).join(' ')` appears ad-hoc but is not extracted. Greenfield per convention (named export). |

The SegmentedControl radiogroup keyboard logic (arrow/Home/End + roving tabindex + imperative focus) has no existing implementation — it is hand-built to the WAI-ARIA APG pattern (RESEARCH.md §Pattern 1). StepBar provides the a11y-attribute *style* but not the roving-focus behavior.

## Metadata

**Analog search scope:** `src/features/wizard/` (StepBar, StepBar.test, AtelierShell, steps/Step2Palette), `src/index.css`, `.planning/codebase/CONVENTIONS.md`.
**Files scanned:** 6 (all VERIFIED against shipped source).
**Pattern extraction date:** 2026-07-14
</content>
</invoke>
