---
phase: 21-shared-ui-primitives
reviewed: 2026-07-14T17:19:04Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/ui/cn.ts
  - src/ui/Button.tsx
  - src/ui/Pill.tsx
  - src/ui/SegmentedControl.tsx
  - src/ui/Slider.tsx
  - src/ui/SizeCard.tsx
  - src/ui/__tests__/Button.test.tsx
  - src/ui/__tests__/Pill.test.tsx
  - src/ui/__tests__/SegmentedControl.test.tsx
  - src/ui/__tests__/Slider.test.tsx
  - src/ui/__tests__/SizeCard.test.tsx
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-07-14T17:19:04Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Five zero-dependency Preact + Tailwind v4 UI primitives (`Button`, `Pill`, `SegmentedControl`,
`Slider`, `SizeCard`) plus a `cn()` join helper, with a companion jsdom test per component.

Overall the implementation is clean, well-documented, and the a11y contracts requested for
review are met: `SegmentedControl` is a genuine `role="radiogroup"` with roving tabindex,
wrapping Arrow/Home/End that moves both selection and focus in one tick, and mutually-exclusive
`aria-checked`; `Slider` correctly uses `onInput` (Preact live semantics) and exposes
`aria-label` + `aria-valuetext`; `SizeCard` exposes `aria-pressed`. No XSS/injection surface
exists — all consumer content flows through JSX children/text nodes (Preact-escaped) and there
is no `dangerouslySetInnerHTML`, `eval`, or raw HTML sink. No BLOCKER-class defects were found.

The findings below are all consequences of one structural pattern — spreading `{...rest}` *after*
fixed attributes — plus one numeric-parse edge case and two minor consistency notes. None
violate the locked phase constraints (zero-dep, raw `preact` render tests, `onInput`, arbitrary
radius values, props-only SizeCard).

## Warnings

### WR-01: `Button` documented `type="button"` invariant is overridable via `...rest`

**File:** `src/ui/Button.tsx:36-45`
**Issue:** The JSDoc guarantees "Always renders a native `<button type="button">` so it never
submits a form." But `ButtonProps` only omits `'variant' | 'className'` from
`ComponentProps<'button'>` — `type` remains a valid prop — and `{...rest}` is spread on line 45
*after* `type="button"` on line 39. A consumer may therefore pass `<Button type="submit">`,
which overrides the hard-coded value and defeats the stated "never submits a form" invariant.
The guarantee is documented but not enforced.
**Fix:** Enforce the invariant by either omitting `type` from the props surface or spreading
`rest` before the fixed attribute:
```tsx
// Option A — remove the escape hatch from the type:
export interface ButtonProps
  extends Omit<ComponentProps<'button'>, 'variant' | 'className' | 'type'> {

// Option B — make the fixed value win regardless of rest:
<button {...rest} type="button" className={cn(...)}>
```

### WR-02: `SizeCard` `onClick`/`aria-pressed` can be clobbered by `...rest`, silently breaking selection

**File:** `src/ui/SizeCard.tsx:52-63`
**Issue:** `SizeCardProps` omits only `'onSelect' | 'className'`, so native `onClick`,
`aria-pressed`, and `type` all remain in the accepted prop surface. Because `{...rest}` is spread
on line 62 *after* `onClick={onSelect}` (line 56) and `aria-pressed={selected}` (line 55), a
consumer who passes `onClick` would clobber the internal `onSelect` wiring — the card would stop
firing its selection callback — and a consumer passing `aria-pressed` could desync the announced
state from the `selected` prop. This is the same spread-order hazard as WR-01, but higher-impact
because it can silently disable the component's primary behavior.
**Fix:** Omit the props the component owns, or spread `rest` first:
```tsx
export interface SizeCardProps
  extends Omit<ComponentProps<'button'>, 'onSelect' | 'className' | 'onClick' | 'aria-pressed' | 'type'> {
// ...
<button {...rest} type="button" aria-pressed={selected} onClick={onSelect} className={cn(...)}>
```

### WR-03: `Slider` uses `parseInt`, truncating any fractional `step`

**File:** `src/ui/Slider.tsx:59`
**Issue:** `onInput` parses the value with `parseInt(..., 10)`, but the component advertises a
generic numeric `step?: number` (line 42) and a numeric `value`. If a consumer configures a
fractional step (e.g. `step={0.5}` or `step={0.1}`), each tick's DOM value like `"2.5"` is
truncated to `2`, so `onChange` reports the wrong number and the control cannot express
non-integer positions. The current expected callers (color counts, grid sizes) are integers so
this is latent, but the prop contract permits fractional steps that the parser silently corrupts.
**Fix:** Parse as a real number so integer and fractional steps both round-trip:
```tsx
onInput={e => onChange(Number((e.currentTarget as HTMLInputElement).value))}
// or parseFloat(...) if you prefer explicit float semantics
```

## Info

### IN-01: `SegmentedControl` silently defaults focus to index 0 when `value` matches no option

**File:** `src/ui/SegmentedControl.tsx:48-51, 74`
**Issue:** `selectedIndex = Math.max(0, options.findIndex(...))` collapses the "not found" case
(`findIndex` → `-1`) to `0`. When the controlled `value` matches no option, the first option
receives `tabIndex={0}` while *no* radio is `aria-checked="true"` — a radiogroup with a tab stop
but no checked member. This is a benign fallback (keyboard nav still recovers on first Arrow
press), but the mismatch between "focusable index" and "checked index" is silent and could mask a
caller passing a stale/invalid value.
**Fix:** Optionally surface the mismatch during development, e.g. guard the render or warn when
`options.findIndex(o => o.value === value) === -1`, so an out-of-range controlled value is not
hidden.

### IN-02: `SizeCard` mixes `class` (inner spans) with `className` (root)

**File:** `src/ui/SizeCard.tsx:64-72`
**Issue:** The root `<button>` uses `className={cn(...)}` while the four inner `<span>`s use the
`class` attribute. Both work in Preact, but the inconsistency diverges from the `className`
convention used everywhere else in these primitives and in the merged-class contract the file
otherwise documents.
**Fix:** Use `className` on the inner spans for consistency with the rest of `src/ui/`.

---

_Reviewed: 2026-07-14T17:19:04Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
