---
id: 260717-f6b
title: "Order/Supplies/Refine polish batch (8 fixes incl. canvas pricing)"
status: complete
mode: quick
branch: claude/gsd-ui-phase-20-70b245
commits:
  - 699e60d  # Refine: drill shape promote + Drills label
  - dbfdb0b  # Order: remove wrap, Title-Case, width cap
  - 1937fff  # Back button + step-aware height (sticky fix)
  - 101a1ff  # canvas price floor
---

# Quick Task 260717-f6b — SUMMARY

All eight items done and verified live; 392 tests pass, tsc clean.

## Refine (`RefineScreen.tsx`, `ui/SizeCard.tsx`)
- **Drill shape promoted** out of the Advanced drawer into the main controls
  (Advanced hint now `kit · colors`).
- **"Drills" label** added above the drill count on each size card.
- **Advanced overflow** resolved — the rail's internal `overflow-y-auto` (from
  260717-dp8) plus the shorter Advanced content makes KIT + the exclude-colors
  list fully reachable above the control bar (verified by scrolling the rail).

## Order (`OrderScreen.tsx`)
- **Image wrap removed** — `FINISH_OPTIONS` now holds only Trimmed; the single
  finish card is width-capped (`sm:max-w-[340px]`) so it doesn't stretch.
- **Title-Case CTAs** — Download Canvas (Grid) / Download Grid + Legend / Download
  Legend / Download Order Packet / Open Drill Cart at Diamond Drills USA ↗.
- **Wide-screen flow** — section capped at `max-w-[1180px]` and centered
  (`self-start`); measured 1180px centered at a 1500px viewport (was edge-to-edge).

## Back button + Supplies sticky (`App.tsx`)
- **Back** is now a bordered button (border + padding + hover), matching the header
  NEW pill — no longer bare selectable text.
- **Supplies sticky fixed.** The order-summary panel already carried
  `md:sticky md:top-0 md:self-start`, but my earlier Refine fix had bounded the
  shared content wrapper to `h-full`, removing the natural-flow scroll sticky needs.
  Height is now **step-aware**: Refine (step 2) keeps `h-full` (fixed viewport);
  every other step uses `min-h-full` so Zone-2 scrolls the whole page. Verified: the
  summary now stays pinned while the drill table scrolls.

## Canvas pricing (`engine/checkout.ts`)
- Added a per-vendor **`minPrice` floor**; `calculateCanvasCost` clamps every result
  (tier / interpolated / per-sq-in) up to it, so a small canvas can't price below a
  realistic minimum. Raised the pricing-point curve + `sqInchRate`.
- Effect: the example ~9.7×11" canvas went **$3.73 → $14.00** (lumaprints min).
- **These are curated estimates** (carry a "rates as of" note) — meant to be tuned
  to real vendor rates. See the follow-up note below.

## Tests updated
OrderScreen (finish single-card + Title-Case labels), App (order-packet label),
RefineScreen (Advanced hint), Slider (`.gem-slider`), SizeCard (count figure among
two mono spans), checkout (new prices + a min-floor clamp test).

## Follow-up / needs confirmation
The new canvas prices (lumaprints min $14, points 15/21/33/80; finerworks min $19,
points 22/30/46/110) are my best-estimate market figures, not authoritative vendor
quotes. If you have target rates, they're a one-file change in `VENDOR_REGISTRY`.
