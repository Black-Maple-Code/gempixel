---
phase: 25-retire-legacy-steps-cleanup
verified: 2026-07-16T00:00:00Z
status: passed
score: 10/10 must-haves verified
behavior_unverified: 0
overrides_applied: 0
deferred:
  - truth: "Dormant Step3Canvas export/legend/checkout affordances are reachable in the shipped build (WR-01/IN-01)"
    addressed_in: "Phase 26"
    evidence: "ROADMAP Phase 26 goal + SC1/SC3/SC5 — re-homes canvas PNG packet + Diamond Drills USA cart into the new Order step; Phase 25 SC10 explicitly preserves (does not delete) these until re-homed."
  - truth: "Dark-slate remnants removed from the three dormant modals + both error banners (WR-04)"
    addressed_in: "Phase 26"
    evidence: "25-REVIEW.md WR-04 logged as Phase-26 follow-up per developer decision; SC2 as scoped for Phase 25 targets the canvas viewport surface, which is clean."
  - truth: "isFitMode guard consumed by production re-fit (WR-05) / debounced recompute timer cancelled on select/reset/load (WR-02)"
    addressed_in: "Phase 26"
    evidence: "25-REVIEW.md WR-02/WR-05 logged as Phase-26 follow-up todos per developer decision (advisory, non-blocking)."
  - truth: "Whole grid visible without any scroll at very short (~800px) desktop viewport heights (SC8 nuance)"
    addressed_in: "Phase 26"
    evidence: "UAT Test 29 sign-off: grid bottom needs a small scroll only at ~800px viewport; logged as a Phase-26 todo. Normal heights show the whole grid."
---

# Phase 25: Retire Legacy Steps + Cleanup Verification Report

**Phase Goal:** Final grep-clean of residual Step1..4 component files, dark-mode/theme remnants, and leftover dead preset state — only the new Atelier canvas-first journey remains — PLUS the desktop-web viewport/zoom refinements and static-wizard fixes folded in from the Phase 24 walkthrough, WITHOUT deleting the still-live fulfillment path (preserved for Phase 26).
**Verified:** 2026-07-16
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria SC1–SC10)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| SC1 | Legacy Step1/2/4 component files deleted; only Atelier journey remains | ✓ VERIFIED | `Step1Ingest.tsx`, `Step2Palette.tsx`, `Step4Export.tsx` absent on disk; `steps/` dir holds only `Step3Canvas.tsx` (preserved by design, SC10) |
| SC2 | Canvas viewport surface re-tokened off dark slate | ✓ VERIFIED | No `bg-slate-950`/`bg-slate-900` in `CanvasWorkspace.tsx`, `AtelierShell.tsx`, `CanvasControlBar.tsx`. Residual dark slate exists only in dormant modals + error banners (WR-04) — deferred to Phase 26 |
| SC3 | Phase-23 Refine defaults survive deletion (kit `all`, drillStyle `square`, exclusion in Advanced) | ✓ VERIFIED | `App.tsx:208` `selectedBaseKit` default `'all'`; `App.tsx:207` `drillStyle` default `'square'`; `RefineScreen.tsx:220` `<details>` Advanced disclosure with `excludedColors` wired (line 284 checkbox) |
| SC4 | Build + full test suite green (>= 240 passing) | ✓ VERIFIED | `tsc --noEmit` exit 0; `vitest run` 37 files, 373 passed / 7 skipped (380 total) — re-run this session, matches executor gate |
| SC5 | Upload auto-advances to Refine; SizeCard change auto-recomputes + re-fits (no Recompute button) | ✓ VERIFIED | `App.tsx:747` D-08/SC5 auto-advance effect; `scheduleCustomRecompute` (586) + `handleRecomputeMatch` (570); zero user-facing "Recompute" button in `src/**/*.tsx`; behavior confirmed live in UAT Test 29 (human-approved) |
| SC6 | Plain Ctrl+P prints canvas grid from any step (print-canvas-sheet @media print; main not hidden) | ✓ VERIFIED | `index.css:184` `@media print`, `:213` `.print-canvas-sheet` grid; `App.tsx:1572` `<main>` carries `print:block` UNCONDITIONALLY (D-03/WR-01); print `@media` hides `nav/aside/button/footer` but NOT `main`; confirmed live in UAT Test 29 |
| SC7 | Real-photo E2E (UAT Test 29) re-verified against final in-viewport layout | ✓ VERIFIED | 25-06-SUMMARY.md: UAT Test 29 (Upload→Refine→Supplies→Order, 1280px desktop, real photo) APPROVED by developer — SC7 signed off this session |
| SC8 | Canvas defaults to fit; re-fits without zoom jump; rail fits width; view switcher is a bottom strip that does not obscure canvas | ✓ VERIFIED | `viewer.ts:24` `isFitMode = true` default + `fitToContainer`; `App.tsx:683` `fitDimsKey` re-fit on committed dims only (no post-slider re-fit); `CanvasControlBar` (view switcher Grid Colors/Grid+Symbols/Original + zoom) rendered in-flow in `AtelierShell` Zone 3a (`shrink-0`, no absolute/fixed → never obscures canvas); UAT-confirmed. Minor ~800px short-height scroll deferred to Phase 26 |
| SC9 | Fixed wizard chrome — Next always reachable without page scroll; step content scrolls internally | ✓ VERIFIED | `AtelierShell.tsx:66` 3-zone `h-dvh overflow-hidden` shell: header `shrink-0` → Zone 2 `flex-1 min-h-0 overflow-y-auto` (internal scroll) → Zone 3 `shrink-0` Back/Next pinned; `SuppliesScreen.tsx:161` order-summary `md:sticky md:top-0` (GAP-2) keeps Next in view while drill list scrolls; UAT-confirmed |
| SC10 | No orphaned functionality — strangler does NOT delete Diamond Drills USA cart handoff or canvas/legend PNG export (Step3Canvas + handlers preserved for Phase 26) | ✓ VERIFIED | `Step3Canvas.tsx` present (23.7 KB); `engine/export.ts` `drawCanvasOnly`/`drawCombinedCanvasSheet` intact; `engine/checkout.ts` `compileShopifyCartLink` intact; `handleShopifyCheckout` x3 in App.tsx; `git diff 9dd61b1..HEAD` touches NONE of these 4 files. Dormant-by-design (all `USE_NEW_*` flags true) — accepted per ROADMAP SC10; live re-home is Phase 26 |

**Score:** 10/10 truths verified (0 present, behavior-unverified)

### Deferred Items

Items not part of the Phase 25 contract but explicitly scheduled for Phase 26 (advisory follow-ups accepted by the developer). These do NOT affect Phase 25 status.

| # | Item | Addressed In | Evidence |
| --- | --- | --- | --- |
| 1 | Reachable canvas PNG / legend / checkout affordances (WR-01, IN-01/02/03 dead-code cluster) | Phase 26 | ROADMAP Phase 26 re-homes export + Diamond Drills USA cart into the Order step; SC10 preserves them meanwhile |
| 2 | Dark-slate remnants in dormant modals + error banners (WR-04) | Phase 26 | 25-REVIEW.md WR-04 logged as Phase-26 follow-up |
| 3 | `isFitMode` production guard (WR-05); debounced recompute timer cancel on select/reset/load (WR-02) | Phase 26 | 25-REVIEW.md WR-02/WR-05 advisory follow-ups |
| 4 | Whole grid visible with no scroll at ~800px viewport height (SC8 nuance) | Phase 26 | UAT Test 29 note — small scroll only at ~800px; normal heights clean |

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/features/wizard/steps/Step1Ingest.tsx` | DELETED | ✓ VERIFIED | Absent |
| `src/features/wizard/steps/Step2Palette.tsx` | DELETED | ✓ VERIFIED | Absent |
| `src/features/wizard/steps/Step4Export.tsx` | DELETED | ✓ VERIFIED | Absent |
| `src/features/wizard/steps/Step3Canvas.tsx` | PRESERVED | ✓ VERIFIED | Present, untouched since phase base (SC10) |
| `src/engine/export.ts` | PRESERVED | ✓ VERIFIED | `drawCanvasOnly`/`drawCombinedCanvasSheet` intact |
| `src/engine/checkout.ts` | PRESERVED | ✓ VERIFIED | `compileShopifyCartLink` intact |
| `src/features/wizard/AtelierShell.tsx` | Fixed 3-zone shell | ✓ VERIFIED | `h-dvh overflow-hidden`; internal-scroll Zone 2; pinned Zone 3 |
| `src/features/wizard/CanvasControlBar.tsx` | Bottom view/zoom strip | ✓ VERIFIED | In-flow Zone 3a strip, no absolute/fixed positioning |
| `src/features/screens/RefineScreen.tsx` | Advanced disclosure + exclusion | ✓ VERIFIED | `<details>` + `excludedColors` |
| `src/features/screens/SuppliesScreen.tsx` | Sticky order summary | ✓ VERIFIED | `md:sticky md:top-0` (GAP-2/SC9) |
| `src/engine/viewer.ts` | Persistent fit mode | ✓ VERIFIED | `isFitMode = true` + `isInFitMode()` + `fitToContainer` |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `App.tsx` | `CanvasControlBar` | `canvasControls` prop (step 2 only) | ✓ WIRED | `App.tsx:1445` render → `AtelierShell.tsx:102` Zone 3a slot |
| `CanvasControlBar` | `viewer` | `onZoomIn/onZoomOut/onFit` → `viewerRef` | ✓ WIRED | `App.tsx:1450-1453` |
| `App.tsx` | `viewer.fitToContainer` | `lastFitDimsRef` dim-change effect | ✓ WIRED | `App.tsx:683-692` re-fit on committed dims only (no zoom-jump) |
| upload ingest | Refine step | auto-advance effect | ✓ WIRED | `App.tsx:747` |
| `<main>` | print sheet | `print:block` unconditional + `.print-canvas-sheet` | ✓ WIRED | `App.tsx:1572` + `index.css:213` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Typecheck clean | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Full suite green | `npx vitest run` | 373 passed / 7 skipped (37 files) | ✓ PASS |
| Real-photo E2E (SC5/SC6/SC8/SC9/SC10) | Live UAT Test 29 walkthrough | APPROVED by developer | ✓ PASS (human) |

### Requirements Coverage

Phase 25 carries no REQ-ID by design (REQUIREMENTS.md:126 explicitly lists Phase 25 as a no-REQ-ID cleanup phase alongside Phase 21). No orphaned requirements map to this phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| — | — | No `TBD`/`FIXME`/`XXX` debt markers in phase-modified files | ℹ️ Info | Clean — completion is auditable |
| `src/App.tsx` | 993-1062, 1615-1646 | Unreachable Step3Canvas branch (dead code) | ⚠️ Warning | Accepted SC10 dormancy-by-design; re-home deferred to Phase 26 (WR-01) |
| `src/App.tsx` | 1661-1890 | Dark-slate modals/banners | ⚠️ Warning | Cosmetic remnant in dormant surfaces; deferred to Phase 26 (WR-04) |

### Human Verification Required

None outstanding. UAT Test 29 (the only human-verify item, SC7) was completed and APPROVED by the developer this session (recorded in 25-06-SUMMARY.md). All behavior-dependent truths (SC5/SC6/SC8/SC9) carry live-browser behavioral evidence via that approved walkthrough.

### Gaps Summary

No gaps block the Phase 25 goal. All ten success criteria (SC1–SC10) hold against the actual codebase:
the three legacy step files are deleted; the canvas viewport surface is re-tokened off dark slate; the
Refine defaults (kit `all`, drillStyle `square`, Advanced/excludedColors) survived the deletion; the
build + 373-test suite are green; upload auto-advances and SizeCard changes auto-recompute + re-fit with
no manual Recompute button; plain Ctrl+P prints the canvas grid from any step; the real-photo E2E was
human-approved; the canvas defaults to fit with a bottom control strip and browser-fitting rail; the
wizard chrome is fixed with internally-scrolling content; and the still-live fulfillment path
(Step3Canvas + export + Diamond Drills USA cart) is preserved untouched for Phase 26.

The advisory code-review findings (WR-01/02/04/05, IN-01..05) and the ~800px short-height scroll nuance
are all documented, non-blocking, and explicitly scheduled for Phase 26 per the developer's decision.
They are recorded as `deferred` items above, not gaps.

---

_Verified: 2026-07-16_
_Verifier: Claude (gsd-verifier)_
