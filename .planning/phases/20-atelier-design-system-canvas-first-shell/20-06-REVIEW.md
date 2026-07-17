---
phase: 20-atelier-design-system-canvas-first-shell
reviewed: 2026-07-14T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/App.tsx
  - src/features/wizard/AtelierShell.tsx
  - src/__tests__/App.test.tsx
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: issues_found
warning_resolved: 1
resolution_note: "WR-01 fixed in commit following review (added print:h-auto print:overflow-visible to AtelierShell root). IN-01/IN-02 left as advisory trade-offs."
---

# Phase 20-06: Code Review Report

**Reviewed:** 2026-07-14
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Gap-closure review of the 20-06 delta only (diff `1ec3fb5..HEAD`): removal of the
legacy left-sidebar brand cluster in `src/App.tsx` (gem-logo tile + `<h1>GemPixel</h1>`
+ tagline) with the header row switched `justify-between` → `justify-end`; the shell-root
className change `min-h-screen` → `h-dvh overflow-hidden` in `AtelierShell.tsx`; and the
test retargeting of the two wordmark assertions to `header span.font-display` plus the
added no-`<h1>`-equals-'GemPixel' regression guards.

**Assessment: correct and safe.** The delta cleanly resolves the duplicate-wordmark defect
(the surviving wordmark is the single AtelierShell `<span>`), and the new regression guards
prevent reintroduction. I traced the two potential failure modes and both hold up:

- **Print not clipped.** Both in-app print flows (`printSupplyReport`, `printLegend`) add
  `print-only-report-mode` / `print-only-legend-mode` body classes, whose CSS overrides
  `#app > div` (the AtelierShell root) with `height: auto !important; overflow: visible
  !important` (index.css:379-388, 311-320). So the new `overflow-hidden` root does not clip
  the printed report/legend. The removal of `min-h-screen` also eliminates a prior
  specificity conflict between the `.min-h-screen { display:none }` print rule and the
  `#app > div { display:block }` rule.
- **On-screen content not clipped.** The child flex chain uses `min-h-0` at App.tsx:1290
  and `overflow-y-auto` on the sidebar (1309) and legend panels, so the fixed-height
  `h-dvh` root scrolls internally rather than truncating.
- **Test selector is unambiguous.** `header span.font-display` resolves only to the
  AtelierShell wordmark (App.tsx:1257 renders `<AtelierShell>`; the wordmark span is the
  sole `font-display` span inside any `<header>` — the other `font-display` nodes at
  App.tsx:1278/1757/1864 are not inside a `<header>`). The regression guard is accurate:
  the only remaining `<h1>` is the print-only "GemPixel Supply Plan Report" (App.tsx:2416),
  whose textContent ≠ `'GemPixel'`, so the filtered length is 0. `print.test.tsx:161` still
  asserts the report title independently and is unaffected.

No blocking or correctness defects. Three lower-severity items below.

## Warnings

### WR-01: Shell root lacks a print override, unlike its inner sibling — direct Ctrl+P can clip  ✅ RESOLVED

**Resolution:** Applied the suggested fix — `AtelierShell.tsx:52` now reads
`flex flex-col h-dvh overflow-hidden print:h-auto print:overflow-visible`, matching the
inner sibling at App.tsx:1290. tsc clean, full Vitest suite green (255/255) after the fix.


**File:** `src/features/wizard/AtelierShell.tsx:52`
**Issue:** The shell root changed to `h-dvh overflow-hidden` but carries no `print:`
escape hatch. Its own inner content container already uses the exact defensive pattern —
`print:h-auto print:overflow-visible` (App.tsx:1290) — so omitting it on the root is
inconsistent. The two in-app print buttons are safe because they add body-mode classes
that override `#app > div` via CSS, but a raw browser print (Ctrl+P with no app button)
carries no body-mode class; in that path the root stays `h-dvh overflow-hidden` and clips
output to a single viewport, whereas the previous `min-h-screen` grew to fit. This is a
behavioral delta introduced by this change. Impact is limited (the on-screen
`.print-canvas-sheet` is `height: 90vh` and mostly fits, and raw Ctrl+P is not a
first-class flow), hence WARNING not BLOCKER.
**Fix:**
```tsx
<div className="flex flex-col h-dvh overflow-hidden print:h-auto print:overflow-visible">
```
This matches the pattern already used one level down and needs no CSS change.

## Info

### IN-01: On-screen document now has no level-1 heading (accessibility outline)

**File:** `src/App.tsx:1297` (removal site) / `src/features/wizard/AtelierShell.tsx:61`
**Issue:** Removing the sidebar `<h1>GemPixel</h1>` leaves the on-screen view with no
`<h1>` — the visible wordmark is a plain `<span>`, and the only surviving `<h1>` is
print-only. Screen-reader heading navigation now starts at `<h2>` ("Photo → Diamond Chart",
App.tsx:1757), so the document outline no longer has a top-level heading (WCAG 1.3.1 /
2.4.6 heading-structure guidance). This is a deliberate design trade-off (the wordmark is
branding chrome), so it is Info, not a Warning.
**Fix:** Either promote the wordmark to a heading (`<h1 className="font-display …">GemPixel</h1>`
in AtelierShell — but then update the App.test.tsx regression guard, which asserts no
`<h1>` equals 'GemPixel'), or add a visually-hidden `<h1 class="sr-only">GemPixel — Diamond
Painting Planner</h1>` near the top of the shell.

### IN-02: Wordmark test selector is coupled to a Tailwind utility class

**File:** `src/__tests__/App.test.tsx:99,116`
**Issue:** `header span.font-display` binds the assertion to a presentational utility class.
If the wordmark's styling is refactored (font utility renamed, element changed, or another
`font-display` span is added earlier inside the header), the selector silently matches the
wrong node or none — a brittle, non-semantic anchor for a regression guard.
**Fix:** Prefer a stable hook, e.g. add `data-testid="wordmark"` to the AtelierShell span
and query `container.querySelector('header [data-testid="wordmark"]')`, decoupling the test
from styling.

---

_Reviewed: 2026-07-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
