---
phase: 20-atelier-design-system-canvas-first-shell
reviewed: 2026-07-13T00:00:00Z
depth: deep
files_reviewed: 11
files_reviewed_list:
  - src/App.tsx
  - src/features/wizard/AtelierShell.tsx
  - src/features/wizard/StepBar.tsx
  - src/features/wizard/stepMeta.ts
  - src/features/wizard/useWizard.ts
  - src/features/match/useDiamondArtMatch.ts
  - src/engine/money.ts
  - src/engine/viewer.ts
  - src/engine/export.ts
  - src/engine/symbols.ts
  - src/index.css
  - src/main.tsx
  - vite.config.ts
  - index.html
findings:
  blocker: 0
  high: 1
  medium: 2
  low: 1
  info: 2
  total: 6
status: resolved
resolution_commit: 0d1f8d8
---

> **Resolution (2026-07-13, commit `0d1f8d8`):** The 3 correctness findings — HI-01
> (Save persists mismatched dims during the stale window), ME-01 (imageless Recompute
> silently clears stale), and ME-02 (re-upload silently re-fires the worker via the
> exclusion reset) — were verified against the code and fixed. The imageless-recompute
> D-13 test was corrected to assert the fixed behavior. `tsc` clean; `vitest` 255/255
> deterministic. The remaining LOW/INFO items are left as advisory (see below).

# Phase 20: Code Review Report

**Reviewed:** 2026-07-13
**Depth:** deep (cross-file: App state ↔ match hook ↔ viewer ↔ projectStore)
**Files Reviewed:** 11 production files
**Status:** issues_found (1 HIGH)

## Summary

Phase 20's chrome/token/font work is clean and the constraints hold: no engine
signature changes (viewer/export/symbols are string-literal + comment edits only),
no external font request remains in source (`fonts.googleapis.com` appears only in
`.planning/` docs, never in `src/` or `index.html`), no `dangerouslySetInnerHTML`
or injection surface in the new chrome, and the `@fontsource`/Fontaine wiring
resolves to installed packages (`wght.css` targets and `fontaine` all present).
`sanitizeMoney` is correct and correctly applied at both the load boundary and the
render total; `bagPlanner` already guards `priceDb` against non-finite values via
`isUnpriced`, so the unsanitized `priceDb` load path is *not* a throw vector.

The defects all live in the **new D-13 committed-input / soft-invalidate model**,
specifically the states it did *not* fully account for: the divergence window
between *live* `cols/rows/image` and *committed* `matchInputs`. One HIGH-severity
data-integrity bug lets a user persist a project whose stored dimensions disagree
with its stored grid. Two MEDIUM issues cover a false-affordance Recompute on
imageless projects and a silent worker re-fire on re-upload. None crash — all
degrade to a cosmetic grid mismatch, consistent with the non-throwing invariant.

## Structural Findings (fallow)

No `<structural_findings>` block was provided for this review; none to reconcile.

## Narrative Findings (AI reviewer)

## High

### HI-01: Saving during the stale window persists mismatched `dimensions` vs `gridData`

**File:** `src/App.tsx:400-402, 418` (also the always-enabled Save pill: `AtelierShell` `canSave={!!matchResult}`, App.tsx:~1249)

**Issue:** `handleSaveProject` writes `dimensions: { cols, rows }` from the **live**
size (line 418) but derives `gridData` from `matchResult.matches` (lines 400-402),
whose length corresponds to the **committed** `matchCols × matchRows`. Phase 20
introduced a window where these diverge: upload → match → return to Step 1 → change
size ⇒ `isStale` is true and the grid still reflects the committed dims. The Save
pill in the top bar stays enabled during this window (`canSave = !!matchResult`
only; it does not consider `staleFromStep`). A user who clicks **Save** instead of
**Recompute** persists a project whose `dimensions` (new size) do not match its
`gridData` (old-size grid). On reload, `loadProject` sets `matchInputs` to the saved
(new) dims while `restore()` injects the old-length matches, so the viewer draws the
old grid at the new `gridWidth` — a permanently mismatched project. This is a
regression: pre-phase-20 the match keyed on live dims, so `dimensions` and
`gridData` were always consistent. Non-crashing (viewer reads past array end as
`undefined` and skips), but it is silent persisted data corruption.

**Fix:** Block Save while stale, and/or persist the committed dims. Simplest, and
consistent with the "recompute first" model:
```tsx
// App.tsx — Save pill wiring
canSave={!!matchResult && staleFromStep === null}
```
Alternatively (or additionally) persist the dims the grid actually corresponds to:
```tsx
dimensions: { cols: matchCols, rows: matchRows },
```

## Medium

### ME-01: "Recompute match" on an imageless (project-loaded) grid clears staleness without recomputing

**File:** `src/App.tsx:517-520` (`handleRecomputeMatch`) with `useDiamondArtMatch.ts:129` (`if (!image) return`)

**Issue:** A loaded project restores its grid via `restore()` with `image === null`.
If the user then edits `cols/rows` in Step 1, `isStale` becomes true and the banner
appears. Clicking **Recompute match** runs `setMatchInputs({ image, cols, rows })`
with `image === null`. The match effect immediately bails (`if (!image) return`),
so no worker runs and `matchResult` stays the old restored grid — but `matchInputs`
now equals the live inputs, so `isStale` flips to false (banner disappears, marker
clears) and `matchCols/matchRows` advance to the new size. The viewer redraws the
old-length matches at the new dimensions (cosmetic mismatch). The user sees the
banner vanish and reasonably believes the recompute succeeded, when in fact nothing
recomputed. False affordance + silent grid mismatch.

**Fix:** Make Recompute a no-op UI-wise when there is no in-memory image to resample,
e.g. disable/hide the CTA when `!image`, or gate the commit:
```tsx
const handleRecomputeMatch = () => {
  if (!image) return; // nothing to resample for a grid restored without its source image
  setActionError(null);
  setMatchInputs({ image, cols, rows });
};
```
(If imageless resize is meant to be supported at all, it needs its own path; today
it cannot recompute.)

### ME-02: Re-uploading over an existing match silently re-fires the worker via the exclusion reset

**File:** `src/App.tsx:874-906` (`loadImageFile` onload) and `:929-957` (`loadRecentImage`); interacts with `useDiamondArtMatch.ts:125,215` (`candidatesKey` dep)

**Issue:** The D-13 gate only defers the worker on `image/cols/rows` changes; the
match effect *also* keys on `candidatesKey` (active color set), which is passed
**live**, not committed. Both image-load handlers call `setExcludedColors(new Set())`
unconditionally in `img.onload`. So if a match already exists **and** the user had
excluded some colors, re-uploading a new image resets exclusions → `candidatesKey`
changes → the match effect fires with the still-committed **old** image and the new
(full) palette. This contradicts two stated phase invariants: "no silent worker
re-fire on upstream edits" and "the last-good match stays on screen." The frozen
preview visibly re-renders (exclusions dropped, old image rematched) even though the
user just uploaded a new image and has not pressed Recompute. Not incorrect for the
committed inputs and it does not crash, but it is a silent worker run plus a
surprising mutation of the supposedly-frozen last-good grid.

**Fix:** Only reset exclusions when the upload actually commits (mirrors the
`matchInputs` guard already in these handlers):
```tsx
if (!matchResult) {
  setExcludedColors(new Set());
  setHighlightedColor(null);
  setMatchInputs({ image: img, cols, rows: newRows });
}
```
(Or defer the exclusion reset to `handleRecomputeMatch`, so a re-upload never
re-fires the worker until the user recomputes.)

## Low

### LO-01: Chrome uses hardcoded hex fallback colors instead of tokens

**File:** `src/App.tsx:~1258` (banner `backgroundColor: '#F7EFD8'`) and `src/features/wizard/StepBar.tsx:60` (connector `backgroundColor: '#D8D0BC'`)

**Issue:** The soft-invalidate banner background and the ahead-of-progress connector
use inline hardcoded hex values rather than CSS custom properties, unlike the rest
of the token-driven Atelier system. The code comments acknowledge "no semantic
token." This is a maintainability wart for a design-system phase: a future palette
change would miss these two literals. No functional impact.

**Fix:** Promote both to `:root` tokens (e.g. `--warn-surface`, `--connector-idle`)
in `src/index.css` and reference `var(--…)`.

## Info

### IN-01: Constraints verified clean

**Files:** `src/engine/{viewer,export,symbols}.ts`, `src/index.css`, `index.html`, `vite.config.ts`, `src/main.tsx`

- **Strangler rule (no engine signature changes):** confirmed — the three engine
  files change only the `'Outfit'` → `'Archivo Variable'` font literal and comments.
- **Privacy (no external font CDN):** confirmed — the two `fonts.googleapis.com`
  `@import`s are removed from `src/index.css`; remaining matches are `.planning/`
  docs only. Fonts are self-hosted via `@fontsource*` + Fontaine.
- **Non-throwing money boundary:** `sanitizeMoney` (`money.ts:54-57`) correctly
  collapses NaN/±Infinity/negative to 0 and is applied at `loadProject`
  (App.tsx:323-324) and the render total (App.tsx:1127-1130). `priceDb` load is
  *not* sanitized but `bagPlanner.isUnpriced` already filters non-finite entries
  before `toCents`, so it is not a white-screen vector.
- **D-13 guard soundness:** `guardedGoTo`/`nextBlockedByStale` correctly refuse
  forward nav past the stale index while allowing backward nav; no soft-lock path
  exists because staleness can only be produced from Step 1 controls (where the
  user can always Recompute or navigate back).

### IN-02: `useDiamondArtMatch` abort/supersede protection intact

**File:** `src/features/match/useDiamondArtMatch.ts:149-209`

The monotonic `seqRef` supersede guard (B2) is preserved on both the success path
(`if (mySeq !== seqRef.current) { bitmap.close(); return; }`) and the late-reject
path (`if (mySeq !== seqRef.current) return;` before touching shared state), and the
null-client teardown guard closes orphan bitmaps. The committed-input gating does not
weaken this: `handleRecomputeMatch` sets `matchInputs` atomically, producing a single
effect run — no double-fire.

---

_Reviewed: 2026-07-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
