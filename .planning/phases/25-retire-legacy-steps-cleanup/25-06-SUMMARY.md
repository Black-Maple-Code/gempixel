---
phase: 25-retire-legacy-steps-cleanup
plan: 06
subsystem: testing
tags: [regression-gate, uat, vitest, verification, strangler-cleanup]

# Dependency graph
requires:
  - phase: 25-02
    provides: legacy Step1/2/4 deletion + panel-ternary collapse (SC1)
  - phase: 25-05
    provides: RefineScreen re-token + rail cap + recompute auto-fire (SC2/SC3/SC8)
provides:
  - Phase-close regression gate (build + test) green on the composed Phase 25 result
  - SC1/SC2/SC3/SC10 code-invariant verification across all prior plans
  - UAT Test 29 (real-photo Upload→Refine→Supplies→Order) re-verified and signed off (SC7)
affects: [phase-26-fulfillment-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase-close = automated build/test gate + code-invariant greps + human UAT walkthrough; writes no source"

key-files:
  created:
    - .planning/phases/25-retire-legacy-steps-cleanup/25-06-SUMMARY.md
  modified: []

key-decisions:
  - "SC10 intent = fulfillment PRESERVED-INTACT, not UI-reachable: all USE_NEW_* flags true → Step3Canvas dormant; honest order packet is the live path (matches 23-05). Developer confirmed intent MET; the plan's literal 'Order step exposes the cart' wording is stale vs the 23-05 dormancy design."
  - "SC8 approved with a logged residual: at ~800px content height the canvas grid bottom tucks behind the fixed control bar and needs a small Zone-2 scroll (nothing lost). Developer chose Approve + log; deferred to Phase 26."

patterns-established:
  - "Verification-only phase-close plan produces zero source commits — a green gate + a signed UAT re-verification is the deliverable."

requirements-completed: []

coverage:
  - id: D1
    description: "npm run build (tsc && vite build) exits 0 and npm test is green (>= 240 passing) on the composed phase (SC4)"
    verification:
      - kind: automated_ui
        ref: "npm run build (exit 0, built in 1.18s) && npm test (exit 0)"
        status: pass
      - kind: unit
        ref: "vitest run — 373 passed / 7 skipped across 37 files"
        status: pass
    human_judgment: false
  - id: D2
    description: "SC1/SC2/SC3/SC10 code invariants hold across all prior plans (legacy Steps absent, Step3Canvas present, viewport re-tokened, fulfillment preserved, Phase-23 Refine defaults survive)"
    verification:
      - kind: automated_ui
        ref: "grep/test invariants: Step1/2/4 absent; Step3Canvas present; no bg-slate-9(00|50) in CanvasWorkspace; handleShopifyCheckout=3; git diff 9dd61b1..HEAD excludes export.ts/checkout.ts/Step3Canvas.tsx/flags.ts; kit 'all'=1; drillStyle 'square'=1; RefineScreen Advanced=6 + excludedColors=3"
        status: pass
    human_judgment: false
  - id: D3
    description: "UAT Test 29 real-photo E2E (SC5/SC6/SC8/SC9/SC10) re-verified against the final in-viewport layout (SC7)"
    verification:
      - kind: manual_procedural
        ref: "Live 1280px desktop dev-server walkthrough: auto-advance, fit+no-zoom-jump recompute, cream re-token, bottom-snap switcher, internal Supplies scroll, Ctrl+P canvas print, fulfillment preserved"
        status: pass
    human_judgment: true
    rationale: "Real-photo end-to-end layout/print/zoom behavior on a live browser cannot be fully proven by jsdom unit tests; requires human visual sign-off (T-25-12/T-25-13)."

# Metrics
duration: 12min
completed: 2026-07-16
status: complete
---

# Phase 25 Plan 06: Phase-Close Regression Gate + UAT Test 29 Re-Verification Summary

**Composed Phase 25 ships green: build/test gate clean (373 passed / 7 skipped), all SC1–SC10 invariants hold, and the real-photo Upload→Refine→Supplies→Order journey is human-approved against the final in-viewport layout (SC7).**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-07-16
- **Tasks:** 2 (Task 1 automated gate; Task 2 human-verify checkpoint — APPROVED)
- **Files modified:** 0 source (verification-only plan)

## Accomplishments

- **Regression gate green:** `npm run build` (`tsc && vite build`) exits 0 (`✓ built in 1.18s`, worker bundled to hashed `.js`); `npm test` exits 0 with **373 passed / 7 skipped** across 37 files — far above the SC4 floor of ≥240.
- **SC1/SC2/SC3/SC10 code invariants all PASS** across the composed phase (see Task 1 evidence below).
- **UAT Test 29 APPROVED:** live real-photo walkthrough on the 1280px desktop dev server confirmed SC5/SC6/SC8/SC9/SC10 behaviors on the final layout — SC7 signed off.
- **Two Phase-26 follow-ups logged** (SC8 short-viewport fit; SC10 dormant-fulfillment deletion) — neither blocks phase close.

## Task Commits

Task 1 was verification-only and produced **no source commit** (correct — the plan modifies no source). Task 2 was a human-verify checkpoint resolved by developer approval.

**Plan metadata:** `docs(25-06): complete phase-close regression gate + UAT Test 29 re-verification (SC7)`

## Regression Gate (Task 1)

| Gate | Result | Evidence |
|------|--------|----------|
| `npm run build` (`tsc && vite build`) | PASS (exit 0) | tsc clean; `✓ built in 1.18s`; `dist/assets/index-tx5_VE74.js 199.83 kB`; matcher.worker bundled to hashed `.js` |
| `npm test` (vitest run) | PASS (exit 0) | 373 passed / 7 skipped (380 total) across 37 test files |

### SC1 / SC2 / SC3 / SC10 code invariants

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| SC1 | `Step1Ingest.tsx`, `Step2Palette.tsx`, `Step4Export.tsx` absent | PASS | all ABSENT on disk (deleted; appear in phase diff as deletions) |
| SC10 | `Step3Canvas.tsx` present | PASS | PRESENT on disk (preserved for Phase 26) |
| SC2 | no `bg-slate-950` / no `bg-slate-9(00\|50)` on CanvasWorkspace viewport | PASS | grep returns nothing — viewport re-tokened to Atelier cream |
| SC10 | `handleShopifyCheckout` in App.tsx > 0 | PASS | count = 3 (all 3 fulfillment handlers intact) |
| SC10 diff guard | `git diff --name-only 9dd61b1..HEAD` excludes the 4 preserved files | PASS | `export.ts`, `checkout.ts`, `Step3Canvas.tsx`, `flags.ts` all EXCLUDED |
| SC3 | kit default `all` | PASS | `useState<'all' \| '100' \| '200'>('all')` count = 1 |
| SC3 | drillStyle default `square` | PASS | `useState<'square' \| 'round'>('square')` count = 1 |
| SC3 | Refine `Advanced` disclosure + `excludedColors` wired | PASS | `Advanced` = 6, `excludedColors` = 3 (color-exclusion still housed in the Refine Advanced disclosure) |

## UAT Test 29 — Live Re-Verification (Task 2, APPROVED)

Orchestrator drove a live real-photo journey (real photo → Upload → Refine → Supplies → Order) on the composed Phase 25 app at 1280px desktop dev server. Developer **APPROVED**.

- **SC5 auto-advance:** PASS — upload auto-advanced to Refine (Upload→done, Refine `aria-current`). SizeCard change (Large → 110×73) auto-recomputed with a pending overlay and **no "Recompute" button**; grid stayed framed within the canvas (no zoom-into-corner jump).
- **SC2 re-token:** PASS — surface behind canvas = `rgb(244,241,233)` Atelier cream (not dark slate); canvas letterbox transparent.
- **SC6 print:** PASS (mechanism) — plain `@media print` shows the `.print-canvas-sheet` grid (canvas + margin legends); `main` is not hidden, so it prints from any step; chrome is `no-print`; dedicated legend/report print modes intact; `print.test.tsx` green. (Literal print-preview image not machine-captured.)
- **SC9 Supplies scroll:** PASS — Zone 2 `overflow-y-auto` (scrollHeight ~1081 > clientHeight ~680); step bar (top) + Next (bottom) stayed fixed during a 300px scroll. GAP-2/25-08 confirmed.
- **SC8 canvas fit / switcher:** PASS with a minor note — switcher + zoom correctly relocated to the fixed bottom control strip (GAP-1/25-07 confirmed; no raster overlap); no horizontal scroll; whole grid fully visible at normal desktop heights (verified ~1040px: grid bottom 95px above the bar). **Residual:** at ~800px content height the grid bottom tucks behind the fixed control bar and needs a small scroll (Zone 2 scrolls, nothing lost). Non-blocking; developer chose "Approve + log".
- **SC10 fulfillment preserved:** PASS (as code, by design) — `Step3Canvas.tsx` + all 3 fulfillment handlers (`handleShopifyCheckout`, `handleDownloadCanvasOnly`, `handleDownloadCombinedCanvasSheet`) intact and unmodified. All `USE_NEW_*` flags = true → Step3Canvas is **not rendered**, so the Diamond Drills USA Shopify cart + canvas/legend PNG export are **PRESERVED-BUT-DORMANT** (not UI-reachable). The live Order step uses the honest "Download order packet". This matches decision 23-05.

## Decisions Made

- **SC10 intent reconciled with 23-05 dormancy:** the 25-06 checkpoint's literal "Order step exposes the cart" wording is stale — under all-flags-on, legacy checkout is dormant by design (23-05: "legacy checkout stays dormant for Phase 25; honest packet replaces it; preserved for Phase 26"). Developer confirmed the SC10 **intent** — fulfillment code preserved intact, not orphaned — is MET.
- **SC8 residual accepted as Approve + log**, not a blocker (Zone 2 scrolls; nothing lost).

## Deviations from Plan

None — plan executed exactly as written (verification-only; no source changed).

## Issues Encountered

None blocking. One minor UX residual (SC8 short-viewport fit) logged as a Phase-26 follow-up.

## Follow-ups (Phase 26)

1. **SC8 short-viewport canvas fit** — tighten Refine canvas fit so the grid bottom clears the fixed control bar at ~800px content heights. Todo: `.planning/todos/pending/2026-07-16-tighten-refine-canvas-fit-at-short-viewports.md` (resolves_phase: 26).
2. **SC10 dormant fulfillment deletion** — Step3Canvas + the 3 fulfillment handlers + `flags.ts` remain preserved-but-dormant; Phase 26 owns their removal.

## Next Phase Readiness

- Phase 25 composes SC1–SC10 with no regression and the SC10 fulfillment guardrail intact; SC7 signed off.
- Phase 26 inherits two explicit follow-ups (above), both non-blocking.

## Self-Check: PASSED

- SUMMARY file created at `.planning/phases/25-retire-legacy-steps-cleanup/25-06-SUMMARY.md` — FOUND.
- Regression gate re-run this session: build exit 0; vitest exit 0 (373 passed / 7 skipped).
- All SC1/SC2/SC3/SC10 invariant greps re-run and PASS (evidence above).

---
*Phase: 25-retire-legacy-steps-cleanup*
*Completed: 2026-07-16*
