---
created: 2026-07-16T19:22:52.610Z
title: Consume or remove unused viewer isFitMode API
area: ui
resolves_phase: 26
files:
  - src/engine/viewer.ts
  - src/App.tsx
  - src/features/wizard/CanvasWorkspace.tsx
---

## Problem

From Phase 25 code review (25-REVIEW.md, WR-05 — warning). Plan 25-03 added a persistent
`isFitMode` boolean + `isInFitMode()` to `CanvasViewer` (engine/viewer.ts), with an 11-assertion
unit test — the intent (per 25-03) was to persist fit-vs-user-zoom so the canvas only *leaves*
"fit" on explicit user zoom, and re-fits cleanly on size changes.

But production never consumes it: the dimension-change re-fit path force-refits unconditionally
and ignores `isInFitMode()`. So a user who has manually zoomed in and then changes the canvas size
is snapped back to fit (losing their zoom), and the flag/getter are effectively dead API kept
green only by their own test.

ROADMAP SC8 wording: "the canvas defaults to fit-to-container and only leaves 'fit' on explicit
user zoom in/out; changing the canvas size ... re-fits cleanly." The auto-refit-on-size-change is
present and correct; the "respect a user's manual zoom" half is what `isFitMode` was meant to wire
and currently doesn't.

## Solution

TBD. Either:
- **Consume it** — gate the dimension-change re-fit on `isInFitMode()`: only auto-refit when the
  viewer is still in fit mode; if the user has manually zoomed, preserve their zoom/pan across a
  size change (or offer an explicit re-fit). Wire CanvasControlBar zoom in/out to clear isFitMode
  and "Fit to screen" to set it. Add a test asserting a zoomed viewport survives a SizeCard change.
- **Or remove it** — if the product decision is "always re-fit on size change", delete
  `isFitMode`/`isInFitMode()` and its test rather than ship an unused guard.

Coordinate with the short-viewport fit todo
(2026-07-16-tighten-refine-canvas-fit-at-short-viewports.md) since both touch the Refine fit path.
