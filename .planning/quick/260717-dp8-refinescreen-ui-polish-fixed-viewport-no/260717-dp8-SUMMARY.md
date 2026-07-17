---
id: 260717-dp8
title: "RefineScreen UI polish — fixed viewport, pinned hint, arrowless caps nav, visible slider track"
status: complete
mode: quick
branch: claude/gsd-ui-phase-20-70b245
commits:
  - eb115b2  # fix(20): code — viewport + nav + slider
  - 33bcbb3  # test(20): Back-button label lookups
---

# Quick Task 260717-dp8 — SUMMARY

Four Refine-screen (step 2) visual issues reported against the live preview, all
fixed on `claude/gsd-ui-phase-20-70b245`. The browser-capable orchestrator acted
as executor so the layout change (item 1) could be verified live.

## Changes

1. **Fixed viewport (removes the top gap) + pinned pan/zoom hint** — `src/App.tsx`,
   `src/features/screens/RefineScreen.tsx`.
   Root cause: the Zone-2 refine wrappers used `min-h-full`, so the tall right
   rail stretched the whole row and the content scrolled; the canvas `main` grew
   to match and centered the canvas with a large top gap. Fix: bound the wrappers
   to the viewport height (`h-full min-h-0`, keeping `print:h-auto`) and give the
   RefineScreen rail `min-h-0 overflow-y-auto` (desktop) so it scrolls internally.
   The canvas `main` is now a fixed-height viewport that fills the height, and the
   `absolute bottom-4` hint pill pins to the true viewport bottom. Mobile
   (`@max-[640px]`) path preserved (rail `overflow-visible`, sticky 45dvh canvas).

2. **Back/Next arrowless + uppercase** — `src/App.tsx` `bottomBar`.
   Removed the `<`/`→` glyphs; added `uppercase tracking-wide` so they render
   `BACK` / `NEXT STEP`, matching the header NEW/SAVE pills. Ids
   (`#wizard-back-btn` / `#wizard-next-btn`) and handlers unchanged.

3. **Pan/zoom hint pinned + visible while zooming** — delivered by item 1's
   bounded, `overflow-hidden` viewport. Verified: the pill stays at the viewport
   bottom-left through a 3× zoom-in.

4. **Visible slider track** — `src/index.css` (new `.gem-slider`), `src/ui/Slider.tsx`.
   `appearance-none` had left the range track invisible (thumb only). Added an
   explicit white track (`--panel-2`, 1px `--border`, 6px, rounded) + accent thumb
   for both `-webkit-*` and `-moz-*` pseudo-elements, and switched Slider to it.

## Test / verification updates
- `src/__tests__/App.test.tsx`: 4 Back-button lookups changed from
  `textContent === '< Back'` to `=== 'Back'` (the label changed intentionally).

## Verification
- `npx tsc --noEmit` → clean.
- `npx vitest run src/__tests__/App.test.tsx src/__tests__/integration.test.tsx
  src/features/screens/__tests__/RefineScreen.test.tsx` → 3 files, 48 tests passed.
- Live preview (portrait 600×900 test image on Refine): no top gap, canvas fills
  the viewport, rail scrolls internally while the canvas stays fixed, hint pill
  pinned and visible while zoomed 3×, BACK/NEXT STEP uppercase & arrowless, slider
  shows a white track + accent thumb and steps on input (68→63).
