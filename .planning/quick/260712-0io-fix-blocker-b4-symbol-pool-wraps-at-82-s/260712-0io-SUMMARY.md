---
quick_id: 260712-0io
slug: fix-blocker-b4-symbol-pool-wraps-at-82-s
status: complete
date: 2026-07-12
requirements: [B4, CR-01]
commits:
  - cdac74e
files_modified:
  - src/engine/symbols.ts
  - src/engine/viewer.ts
  - src/engine/export.ts
  - src/engine/__tests__/symbols.test.ts
---

# Summary — Quick Task 260712-0io (Fix Blocker B4)

## Outcome

Fixed B4 (REVIEW-engine.md CR-01): symbol allocation wrapped at `index % 82`, so the
83rd-ranked color reused `'A'` and the exported chart/legend showed duplicate symbols for
distinct DMC codes on the 200-color kit — ambiguous and un-stitchable. Symbols are now
unique for any color count.

## Changes

- **`src/engine/symbols.ts`** — `generateSymbolAllocation`: index `< 82` keeps the single
  curated glyph; index `>= 82` emits a deterministic `base + suffix` symbol
  (`base = CURATED_SYMBOLS[index % 82]`, `suffix = floor(index / 82) >= 1`). Distinct
  indices → distinct `(base, suffix)` pairs and suffix ≥ 1 never collides with a
  single-glyph assignment, so all symbols are unique. Added `symbolFontPx(basePx, symbol)`
  helper that shrinks multi-char symbols to fit a single-glyph box.
- **`src/engine/viewer.ts`** — symbol overlay font is now set per-cell via `symbolFontPx`
  (was a single pre-loop font), so 2-char symbols render at a fitted size.
- **`src/engine/export.ts`** — all three draw sites (grid `drawCanvasOnly`, combined sheet,
  legend swatch) use `symbolFontPx` for the symbol font size.
- **`src/engine/__tests__/symbols.test.ts`** — replaced the old `index % 82` wraparound
  assertion with a >82-colors-all-unique test (200 colors → 200 unique symbols; first 82
  keep single glyphs; index-82 = `'A1'` ≠ `'A'`); added a `symbolFontPx` scaling test.

## Verification

- `npx tsc --noEmit` — clean.
- `npm run build` — success.
- `npm test` — **17 files, 145 tests passed** (was 144; one wraparound test rewritten,
  one `symbolFontPx` test added).

## Scope

Only B4 in `symbols.ts` plus the minimal per-site font tweak in `viewer.ts`/`export.ts`.
No regression to B1/W5 (260711-wvv), B2 (260711-x6p), or B3/W9 (260712-05k); no other
findings touched.

## Note

Implemented and committed inline by the orchestrator (the `gsd-planner`/`gsd-executor`
subagent spawns were blocked by a transient safety-classifier outage during this session).
Gates were run and passed exactly as an executor would; artifacts and commit conventions
match the other quick tasks.
