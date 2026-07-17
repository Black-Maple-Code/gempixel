---
created: 2026-07-16T19:22:52.610Z
title: Retire remaining dark-slate modal and error-banner remnants
area: ui
resolves_phase: 26
files:
  - src/App.tsx
---

## Problem

From Phase 25 code review (25-REVIEW.md, WR-04 — warning; related info IN-04). Phase 25's SC2
re-tokened the canvas *viewport* off dark slate to the Atelier cream (verified: surface behind
canvas = rgb(244,241,233)), but dark-mode remnants survive elsewhere on the light shell:

- The **Artist Resources modal** (App.tsx ~1660) — `bg-slate-950/80` backdrop, `bg-slate-900`
  card, `text-white`, indigo/violet gradient headings. Dormant (no visible trigger in the
  canvas-first flow), kept "for Phase 25 grep-clean" per 23-08 but not yet removed.
- The **Checkout Warning modal** (App.tsx ~1756) — same dark slate treatment. Reachable only via
  the dormant Step3Canvas checkout path.
- **Both error banners** (frame-scope, hoisted in 23-08) — still `bg-slate-900/950` / `rose-950`
  `text-white`. Unlike the modals these CAN show on the light shell during a real match/worker
  error, so this one is user-visible on an error.

These are the exact dark-theme remnants Phase 20/25 set out to retire (developer is explicitly
regression-averse about re-introducing removed patterns).

## Solution

TBD. Sequence with the Phase 26 Step3Canvas re-home:
- Re-token the two modals to Atelier light tokens, OR delete them outright when Step3Canvas /
  Artist Resources are removed in Phase 26 (the Checkout Warning modal dies with the dormant
  checkout path).
- Re-token the frame-scope error banners to light Atelier tokens (this one matters most — it's
  the only user-visible remnant on the happy-adjacent error path).
- Grep-gate: no `bg-slate-9(00|50)` / `text-white` / `rose-950` left on any live surface.
