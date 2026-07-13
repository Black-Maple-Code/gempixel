---
phase: 16-optimized-supply-plan-savings
plan: 04
subsystem: ui
tags: [preact, savings-headline, accessibility, aria, print-css, dye-lot, money-cents]

# Dependency graph
requires:
  - phase: 16-optimized-supply-plan-savings
    provides: "planOrderSupply aggregator (16-02) exposing savingsCents/savingsPct + naive baseline; sole render-path call wired in 16-03"
provides:
  - "Always-on savings headline next to Total Cost in Step3Canvas, sourced from planOrderSupply savings (BAG-03, D-08)"
  - "a11y-safe 'Why these bags?' expander (real <button>, aria-expanded/aria-controls, one static dye-lot sentence) in the Step 3 Cost & Order panel (BAG-02, D-09)"
  - "Isolated print-only 'GemPixel Supply Plan Report' mirroring savings headline + dye-lot sentence + per-color table + proposed total, preserving the separate Print Legend Sheet button (D-10)"
affects: [17-service-fee-and-order-packet, 18-viewport-native-wizard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "print-only-report-mode / .supply-report-print-container: isolated print container mirroring the proven print-only-legend-mode pattern, so each print button renders its own self-contained document"
    - "Static-copy mirror: on-screen expander state never affects the printed report — both savings headline and dye-lot sentence render statically at print time"

key-files:
  created: []
  modified:
    - src/features/wizard/steps/Step3Canvas.tsx
    - src/App.tsx
    - src/index.css
    - src/__tests__/print.test.tsx

key-decisions:
  - "16-04: Savings headline is always-on static text next to Total Cost; zero-savings renders a truthful 'No bulk savings at this size' line rather than hiding — honest signal for small-color plans (D-08)."
  - "16-04: 'Why these bags?' relocated (developer choice) from the right-sidebar legend <aside> INTO the Step 3 Cost & Order panel, directly under the savings headline; unused whyBagsOpen App.tsx state removed."
  - "16-04: Print Supply Report given its own isolated print-only-report-mode container instead of repurposing .legend-checklist-print-container, so the separate 'Print Legend Sheet (Paper)' button is preserved with no regression — two distinct print buttons."

patterns-established:
  - "Isolated per-button print containers: each print action owns a dedicated .*-print-container + @media print rule, avoiding the earlier bug where window.print() printed the canvas grid."
  - "Savings + dye-lot copy are static string constants (DYE_LOT_WHY_SENTENCE), keeping the print path a trivial mirror with no per-row computation (D-10)."

requirements-completed: [BAG-02, BAG-03]

coverage:
  - id: D1
    description: "Always-on savings headline renders next to Total Cost from planOrderSupply.savingsCents/savingsPct (integer cents, clamped >=0), formatted via money.ts; truthful zero-state at small sizes"
    requirement: "BAG-03"
    verification:
      - kind: manual_procedural
        ref: "human-verify checkpoint Task 3 — developer ran npm run dev, confirmed 'Save $X (Y%) vs per-color' next to Total Cost and truthful $0 zero-state"
        status: pass
    human_judgment: true
    rationale: "On-screen savings placement/copy and the truthful zero-state are visual/UX judgments verified live by the developer; no automated UI assertion covers the headline placement."
  - id: D2
    description: "a11y-safe 'Why these bags?' expander: real <button type=button>, accessible name 'Why these bags?', aria-expanded bound to open state, aria-controls=why-these-bags-explainer, one static dye-lot sentence, keyboard + touch operable"
    requirement: "BAG-02"
    verification:
      - kind: manual_procedural
        ref: "human-verify checkpoint Task 3 — developer keyboard-tabbed to the control, toggled via Enter/Space and tap, confirmed single sentence"
        status: pass
    human_judgment: true
    rationale: "Keyboard focusability and touch toggling require live interaction the developer performed at the checkpoint."
  - id: D3
    description: "Isolated print-only 'GemPixel Supply Plan Report' mirrors savings headline + dye-lot sentence statically, plus per-color table (swatch, DMC code, name, exact dots, +10% safety, recommended bags) and money.ts proposed total; separate Print Legend Sheet button preserved"
    requirement: "BAG-02"
    verification:
      - kind: unit
        ref: "src/__tests__/print.test.tsx — asserts populated .supply-report-print-container with mirrored savings + dye-lot strings and relocated expander"
        status: pass
      - kind: manual_procedural
        ref: "human-verify checkpoint Task 3 — developer confirmed print preview shows the report (not the canvas grid) and both print buttons work"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-07-13
status: complete
---

# Phase 16 Plan 04: Savings Headline & "Why These Bags?" Expander Summary

**Always-on savings headline and an a11y-safe "Why these bags?" expander in the Step 3 Cost & Order panel, backed by an isolated print-only "GemPixel Supply Plan Report" that mirrors both statically — replacing a broken window.print() that had been printing the canvas grid.**

## Performance

- **Duration:** ~25 min (incl. human-verify checkpoint + fix-forward cycle)
- **Completed:** 2026-07-13
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint, approved)
- **Files modified:** 4

## Accomplishments
- **Savings headline (BAG-03, D-08):** always-on one-line "Save $X (Y%) vs per-color" next to Total Cost in `Step3Canvas`, sourced from `planOrderSupply.savingsCents/savingsPct` (integer cents, clamped >=0), formatted via `money.ts`. Zero-savings renders a truthful "No bulk savings at this size" line rather than hiding.
- **"Why these bags?" expander (BAG-02, D-09):** a real `<button type="button">` with accessible name "Why these bags?", `aria-expanded` bound to open state, `aria-controls="why-these-bags-explainer"`, revealing one static `DYE_LOT_WHY_SENTENCE` constant. Keyboard- and touch-operable (native button semantics).
- **Print Supply Report (D-10):** a dedicated isolated `print-only-report-mode` / `.supply-report-print-container` renders a real report — header "GemPixel Supply Plan Report" -> static savings headline + dye-lot "why" banner -> per-color table (swatch, DMC code, name, exact dots, +10% safety, recommended bags) -> money.ts proposed total.
- **Verified green:** `npx tsc --noEmit` exit 0; `npx vitest run` 237/237 passing across 22 files.

## Task Commits

1. **Task 1: Always-on savings headline next to Total Cost** — `55934ad` (feat)
2. **Task 2: "Why these bags?" a11y expander + static print mirror** — `a8a5838` (feat)
3. **Fix-forward (from Task 3 human-verify checkpoint findings)** — `7dc49e1` (fix)
4. **Task 3: human-verify checkpoint** — APPROVED by developer (no commit; approval gate)

**Plan metadata:** docs(16-04) commit (this SUMMARY + STATE + ROADMAP + REQUIREMENTS)

## Files Created/Modified
- `src/features/wizard/steps/Step3Canvas.tsx` — savings headline near Total Cost; relocated "Why these bags?" expander directly under the headline (fix-forward).
- `src/App.tsx` — passes `savingsCents`/`savingsPct` to Step3Canvas; removed sidebar expander copy and unused `whyBagsOpen` state; added the isolated print-only report block; removed the redundant hidden `<aside>` savings mirror.
- `src/index.css` — `print-only-report-mode` / `.supply-report-print-container` print CSS (mirrors the proven print-only-legend-mode isolation), preserving the separate legend-checklist print path.
- `src/__tests__/print.test.tsx` — retargeted to `.supply-report-print-container` with populated-report + relocated-expander assertions.

## Decisions Made
- **Expander placement:** relocated from the right-sidebar legend `<aside>` into the Step 3 Cost & Order panel, directly under the savings headline (developer's explicit choice "by the savings headline"). Removed the now-unused `whyBagsOpen` App.tsx state.
- **Print isolation over reuse:** gave the report its own `print-only-report-mode` container rather than repurposing `.legend-checklist-print-container`, preserving the separate "Print Legend Sheet (Paper)" checkbox-checklist button with no regression. Net result: two distinct, self-contained print buttons.

## Deviations from Plan

### Fix-forward from human-verify checkpoint

The checkpoint (Task 3) surfaced two live-app issues the developer found; all fixed in `7dc49e1` and re-approved:

**1. [Rule 1 - Bug] "Why these bags?" expander was in the wrong panel**
- **Found during:** Task 3 (human-verify)
- **Issue:** The Task 2 expander mounted in the right-sidebar legend `<aside>`, not next to the savings context in the Step 3 Cost & Order panel.
- **Fix:** Relocated the expander into `Step3Canvas`, directly under the savings headline; removed the sidebar copy and the unused `whyBagsOpen` App.tsx state.
- **Committed in:** `7dc49e1`

**2. [Rule 1 - Bug] "Print Supply Report" printed the canvas grid, not a report**
- **Found during:** Task 3 (human-verify)
- **Issue:** `printReport` was a plain `window.print()`; with `@media print aside{display:none}` it actually printed the CANVAS GRID rather than any supply report.
- **Fix:** Added an isolated `print-only-report-mode` / `.supply-report-print-container` (mirroring the proven print-only-legend-mode pattern) rendering the header, static savings headline, dye-lot "why" banner, per-color table, and money.ts proposed total. Removed the redundant hidden `<aside>` savings mirror.
- **Committed in:** `7dc49e1`

**3. [Rule 1 - Test] print.test.tsx retargeted**
- **Found during:** Fix #2
- **Issue:** Existing assertions pointed at the old print structure.
- **Fix:** Retargeted to `.supply-report-print-container` with populated-report + relocated-expander assertions.
- **Committed in:** `7dc49e1`

### Accepted deviation (developer-approved)

The report lives in a NEW isolated container rather than repurposing `.legend-checklist-print-container`, so the separate "Print Legend Sheet (Paper)" checkbox-checklist button is preserved with no regression. **Net: two distinct print buttons** — accepted by the developer at approval.

---

**Total deviations:** 3 auto-fixed (2 bugs + 1 test) surfaced by the human-verify checkpoint, plus 1 developer-accepted structural deviation.
**Impact on plan:** All fixes were necessary for correctness (the report was printing the wrong content; the expander was in the wrong panel). No scope creep — no per-color tooltips/columns/info icons were added (D-09/D-10 prohibitions respected).

## Issues Encountered
None beyond the checkpoint-surfaced bugs documented above (all resolved and re-approved).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BAG-01/02/03 fully delivered across Phase 16 (16-01 optimizer, 16-02 aggregator + naive baseline, 16-03 sole-render-path wiring, 16-04 savings surface + explainer + print report).
- Phase 16 is now 4/4 plans complete. Phase-level completion is owned by the orchestrator.
- Ready for Phase 17 (Service Fee & Customer Order Packet) — the printable report container establishes a reusable isolated-print pattern the order packet can follow.

---
*Phase: 16-optimized-supply-plan-savings*
*Completed: 2026-07-13*
