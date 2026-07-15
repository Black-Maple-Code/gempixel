---
status: complete
phase: 23-the-four-screens-in-flow-order
source: 23-01-SUMMARY.md, 23-02-SUMMARY.md, 23-03-SUMMARY.md, 23-04-SUMMARY.md, 23-05-SUMMARY.md
started: 2026-07-15T14:33:49Z
updated: 2026-07-15T14:38:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

<!-- Automated-covered deliverables (uat classify-coverage → auto_passed). Not presented; proven by passing tests / tsc. -->

### 1. flags.ts exports all four USE_NEW_* (23-01 D1)
expected: USE_NEW_UPLOAD/REFINE/SUPPLIES/ORDER exported as plain const booleans
result: pass
source: automated
coverage_id: 23-01-D1

### 2. Four pure/props-only screen shells compile, no useState/engine imports (23-01 D2)
expected: screens are pure; tsc --noEmit exit 0
result: pass
source: automated
coverage_id: 23-01-D2

### 3. Each data-step-panel renders a USE_NEW_* ternary; suite green (23-01 D3)
expected: legacy bodies render when flags false; full suite green
result: pass
source: automated
coverage_id: 23-01-D3

### 4. UploadScreen: title + native Browse button + dropzone handlers (23-02 T1)
expected: renders title and a native Browse-files button; dropzone binds handlers
result: pass
source: automated
coverage_id: 23-02-T1

### 5. Recent-projects chips render + loadProject(id) on click (23-02 T2)
expected: one chip per project; clicking calls loadProject(id)
result: pass
source: automated
coverage_id: 23-02-T2

### 6. Empty registry omits RECENT row (23-02 T3)
expected: no RECENT label / empty-state card when registry empty
result: pass
source: automated
coverage_id: 23-02-T3

### 7. Crafted markup project name escaped, no XSS sink (23-02 T4)
expected: markup name renders as escaped text, never injected element
result: pass
source: automated
coverage_id: 23-02-T4

### 8. UploadScreen renders NO canvas-size control (23-02 T5)
expected: size selection moved out of Upload into Refine (SC1/D-10)
result: pass
source: automated
coverage_id: 23-02-T5

### 9. USE_NEW_UPLOAD swap; panel-1 renders UploadScreen; suite green (23-02 D-swap)
expected: one flag flipped, suite + tsc green
result: pass
source: automated
coverage_id: 23-02-Dswap

### 10. RefineScreen: one SizeCard per preset with inches + drill count (23-03 T1)
expected: each preset shows App-derived inch string + drill count; selected aria-pressed
result: pass
source: automated
coverage_id: 23-03-T1

### 11. Size-card click calls onSelectSize, never onRecompute (23-03 T2)
expected: worker tier is App's soft-invalidate (D-03/D-04)
result: pass
source: automated
coverage_id: 23-03-T2

### 12. Color Slider max === detectedColorCount, numeric input (23-03 T3)
expected: max stable under drag (Pitfall 3); reports number to onColorTargetChange
result: pass
source: automated
coverage_id: 23-03-T3

### 13. Edge cleanup is a radiogroup of four (23-03 T4)
expected: role=radiogroup; selecting a segment calls onEdgeCleanupChange
result: pass
source: automated
coverage_id: 23-03-T4

### 14. Advanced <details> closed by default; kit=all, shape=square (23-03 T5)
expected: sensible defaults under Advanced disclosure (REFINE-05/D-06)
result: pass
source: automated
coverage_id: 23-03-T5

### 15. Recompute affordance only when stale; click calls onRecompute (23-03 T6)
expected: renders only when stale
result: pass
source: automated
coverage_id: 23-03-T6

### 16. Re-homed size coverage against RefineScreen (23-03 T7)
expected: custom-size edit, card select+dims, aspect auto-adjust, soft-invalidate
result: pass
source: automated
coverage_id: 23-03-T7

### 17. USE_NEW_REFINE swap; panel-2 renders RefineScreen; suite green (23-03 D-swap)
expected: one flag flipped, suite + tsc green
result: pass
source: automated
coverage_id: 23-03-Dswap

### 18. Supply table: symbol·swatch·DMC·drills(+10%)·bags + "Why these bags?" (23-04 D1)
expected: one row per color; native disclosure body = DYE_LOT_WHY_SENTENCE (SUPPLIES-01)
result: pass
source: automated
coverage_id: 23-04-D1

### 19. Inline order-summary from buildOrderQuote verbatim, no local math (23-04 D2)
expected: lineItems + totalCents verbatim; no cents summation in screen (SUPPLIES-02)
result: pass
source: automated
coverage_id: 23-04-D2

### 20. Honesty: unpriced canvas/row surfaces est./unavailable, never silent $0 (23-04 D3)
expected: unavailable affordance instead of $0.00
result: pass
source: automated
coverage_id: 23-04-D3

### 21. USE_NEW_SUPPLIES swap; panel-3 renders SuppliesScreen; suite green (23-04 D4)
expected: one flag flipped, suite + tsc green
result: pass
source: automated
coverage_id: 23-04-D4

### 22. buildOrderPacket: versioned, self-contained, deterministic, locked spec (23-05 D1)
expected: schemaVersion, JSON-round-trippable, only expected keys, Rolled Canvas locked (ORDER-02)
result: pass
source: automated
coverage_id: 23-05-D1

### 23. OrderScreen: locked spec + finish cards + ship-to + single-source quote (23-05 D2)
expected: LOCKED pill, gridToInches size, finish cards, quote.totalCents verbatim (ORDER-01)
result: pass
source: automated
coverage_id: 23-05-D2

### 24. Completion = packet download, honest terminal, ship-to stays client-side (23-05 D3)
expected: "Download order packet" CTA (no price), no receipt/order#/payment, no network egress (ORDER-02)
result: pass
source: automated
coverage_id: 23-05-D3

### 25. USE_NEW_ORDER swap; all four flags true; suite green (23-05 D4)
expected: 347 passed / 12 skipped / 0 failed; tsc exit 0
result: pass
source: automated
coverage_id: 23-05-D4

<!-- Human-judgment checkpoints (uat classify-coverage → present, + integrated UI verification) -->

### 26. Desktop presentation of the new journey (integrated layout)
expected: each new screen is the primary Atelier-shell content in a centered ~1180px frame (UI-SPEC dimensions); no legacy dark chrome dominating; no duplicate upload prompts
result: issue
reported: "This is not expected state - we are moving to a simplified UI where the user can live within the viewport. We are looking to retire the left hand menu and move those options into the viewport."
severity: major

### 27. Single-source total agreement: Supplies === Order (23-04 D5 / 23-05 D5)
expected: Supplies "Est. total" and Order "Total" render the SAME buildOrderQuote total
result: pass
source: automated
note: DOM-verified — Supplies Est. total $24.99 === Order Total $24.99 (empty-project default state)

### 28. Honest handoff end-to-end (ORDER-02)
expected: Order CTA is "Download order packet" (no price, not "Place order"); terminal state has no receipt/order#/payment; ship-to labeled "stays on your device"
result: pass
source: automated
note: DOM-verified on Order panel (default state)

### 29. End-to-end journey with a real photo (Upload → Refine → Supplies → Order)
expected: upload a photo → auto-advance to Refine → pick a size (preview + counts update live) → edge-cleanup + color slider re-render live → Supplies table + summary → Order packet downloads
result: skipped
reason: Deferred until the viewport-hosting rework (Test 26 gap) lands — the full journey will be re-verified visually against the new in-viewport layout, since the fix re-touches how every screen is presented.

## Summary

total: 29
passed: 27
issues: 1
pending: 0
skipped: 1
blocked: 0

## Gaps

<!-- YAML format for plan-phase --gaps consumption -->
- truth: "Each new screen (Upload/Refine/Supplies/Order) is the primary content of the Atelier shell, hosted in the viewport as a centered full-frame layout; the left-hand legacy control menu is retired and its options live in the viewport."
  status: failed
  reason: "User reported: This is not expected state - we are moving to a simplified UI where the user can live within the viewport. We are looking to retire the left hand menu and move those options into the viewport."
  severity: major
  test: 26
  root_cause: "App.tsx (~L1544) renders the four new screens INSIDE the legacy dark 3-column layout: <div bg-slate-950> → <aside class='w-80 bg-slate-900/60'> (left menu: Collapse Sidebar + My Images drawer) wraps the data-step-panel 1-4 slots (App.tsx:1660-1810). So each new cream Atelier screen is constrained to the 320px dark left rail, while the legacy CanvasViewer (<main>, App.tsx:1870) and right Color-Legend/DMC-supply <aside> (App.tsx:2143) plus the bottom SETUP/CANVAS/COLORS nav still render. Result: new screens crammed to ~277px, duplicate upload prompts (new UploadScreen title + legacy viewer empty-state), cream-on-dark visual clash. Unit tests pass because each screen is mounted in isolation (jsdom); nothing asserts the integrated App layout, so the miss was invisible to the suite."
  artifacts:
    - path: "src/App.tsx"
      issue: "New screens (data-step-panel 1-4, ~L1660-1810) are nested inside the legacy <aside class='w-80'> left menu inside the <div bg-slate-950> 3-column shell (~L1544-2160); legacy left menu (My Images/Collapse), center CanvasViewer, right legend aside, and bottom nav all still render alongside the new screens."
  missing:
    - "Host the four new screens as the shell's primary viewport content (centered frame per UI-SPEC: ~1180px; Refine 360px rail, Supplies 320px panel, Order 470px proof column) instead of inside the legacy 320px <aside>."
    - "Retire the left-hand legacy control menu and relocate its still-needed options (My Images / saved-projects, reset/new, save) into the viewport screens."
    - "Remove/quarantine the legacy dark 3-column chrome (bg-slate-950 shell, right Color-Legend/DMC-supply aside, bottom SETUP/CANVAS/COLORS nav) so no legacy chrome dominates or duplicates the new journey."
    - "Add an integrated layout assertion (full-App render) so 'new screens host the viewport, legacy menu retired' is regression-guarded, not just per-component unit coverage."
  debug_session: ""
