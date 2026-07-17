---
created: 2026-07-16T19:22:52.610Z
title: Cancel debounced custom-size recompute timer on select/reset/load
area: ui
resolves_phase: 26
files:
  - src/App.tsx
---

## Problem

From Phase 25 code review (25-REVIEW.md, WR-02 — warning). The custom-size (Custom size input)
auto-recompute added in 25-04 uses a debounced ~500ms timer, but that timer is **not cancelled**
when the user takes a competing action before it fires:

- Selecting a preset SizeCard (Small/Medium/Large/XL),
- Pressing "New" / reset,
- Loading a saved project.

A pending custom-size timer can fire *after* the new commit and clobber it: the SizeCard
selection silently reverts to the old custom grid dimensions, or reset/load re-fires the worker
against the previous image. Not hit in the primary preset-only flow (Phase 25 UAT used SizeCards),
so it escaped the walkthrough — but it is a real state race.

## Solution

TBD. Cancel/clear the pending custom-size debounce timer (clearTimeout on the stored timer id,
or an AbortController / effect-cleanup) at the start of every competing commit path: SizeCard
select handler, reset/New handler, and project-load handler. Add a regression test that starts a
custom-size debounce, fires a SizeCard select before 500ms, and asserts the committed grid matches
the SizeCard, not the stale custom value.
