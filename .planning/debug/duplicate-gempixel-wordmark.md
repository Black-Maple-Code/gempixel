---
status: diagnosed
trigger: "Phase 20 UAT Test 4 — TWO visible 'GemPixel' wordmarks on the Upload screen; top-bar span (21/600) at y=21 + legacy sidebar <h1> (23/700) at y=79. UI-SPEC specifies a single wordmark. Diagnose root cause only (no fix)."
created: 2026-07-14
updated: 2026-07-14
---

## Current Focus

hypothesis: CONFIRMED — the legacy left-sidebar control-panel header still renders its own <h1>GemPixel</h1> + "Diamond Painting Planner" tagline, which mounts simultaneously with the new AtelierShell top-bar wordmark.
test: grep of src/ for GemPixel + read of the two render sites
expecting: two distinct render sites, one intended (AtelierShell span), one redundant (legacy sidebar h1)
next_action: none — diagnose-only mode; root cause found, returned to caller

## Symptoms

expected: Atelier top bar shows exactly ONE "GemPixel" wordmark (Newsreader 21/600, beside the 3×3 pixel-tile mark). No duplicate on Upload screen.
actual: TWO visible "GemPixel" wordmarks stacked top-left — top-bar span (21/600) at ~y=21 AND a legacy <h1> (23/700) at ~y=79 with a "Diamond Painting Planner" tagline beneath. A third print-only "GemPixel Supply Plan Report" <h1> is width-0 and not the problem.
errors: none (visual regression, no console errors)
reproduction: load app at desktop width (1280×800), observe top-left of Upload step. Documented as Test 4 in 20-UAT.md.
started: introduced in Phase 20 (Plan 20-03/20-04 added the top-bar wordmark while keeping the legacy sidebar 1:1). 20-04 SUMMARY flagged it as a known transient duplicate.

## Eliminated

- hypothesis: The duplicate is the print-only supply report title
  evidence: <h1 class="supply-report-title"> is inside `.supply-report-print-container hidden` (App.tsx:2426-2427); rect width 0, not visible. Ruled out by the symptom report itself.
  timestamp: 2026-07-14

## Evidence

- timestamp: 2026-07-14
  checked: grep "GemPixel|Diamond Painting Planner" across src/
  found: two live render sites — src/features/wizard/AtelierShell.tsx:61 (<span> 21/600) and src/App.tsx:1305-1306 (<h1> 23/700 + tagline <p>). Plus print-only App.tsx:2427.
  implication: the top-bar span is the new intended wordmark; the sidebar h1 is the legacy one.

- timestamp: 2026-07-14
  checked: AtelierShell.tsx render (lines 50-82)
  found: top bar renders the wordmark as `<span className="font-display text-[21px] font-semibold text-ink leading-none">GemPixel</span>` (matches UI-SPEC 21/600). Wordmark is a <span>, NOT an <h1>.
  implication: matches UI-SPEC copywriting contract row "Wordmark: GemPixel (Newsreader 21/600)". This is the canonical one.

- timestamp: 2026-07-14
  checked: App.tsx structure lines 1256-1418
  found: <AtelierShell> (1257) wraps a shell body (1290 flex row) whose first child is a persistent legacy Left-Sidebar control panel <aside> (1292). Its header (1297-1318) renders the gem-logo tile (1299-1303) + <h1>GemPixel</h1> (1305) + "Diamond Painting Planner" tagline (1306) + a collapse button (1309-1317). The four CSS-toggled step panels (data-step-panel 1..4, lines 1417/1460/1488/1519) live INSIDE this sidebar's scroll body — so the sidebar header is always mounted and always visible regardless of step.
  implication: the duplicate is not gated by `step===1`; it is the persistent legacy control-panel header. It renders on every step, but is most obvious on Upload. Removing it is a surgical edit within the legacy body, not a deletion of Step 1.

- timestamp: 2026-07-14
  checked: src/__tests__/App.test.tsx lines 99-101, 109-111
  found: two assertions do `container.querySelector('h1')?.textContent === 'GemPixel'`. The FIRST <h1> in DOM order is the legacy sidebar h1 (App.tsx:1305) because AtelierShell's wordmark is a <span>. If the legacy h1 is removed/hidden, the first <h1> becomes the print-only "GemPixel Supply Plan Report" (App.tsx:2427) → both assertions would FAIL.
  implication: the fix must update these two assertions (target the top-bar wordmark span, or a stable selector) OR promote the AtelierShell wordmark to an <h1>. print.test.tsx:161 (report title) is unaffected.

## Resolution

root_cause: |
  Phase 20 (Plans 20-03/20-04) introduced the AtelierShell top-bar wordmark
  (src/features/wizard/AtelierShell.tsx:61, <span> Newsreader 21/600) but
  deliberately kept the legacy Step1..4 bodies 1:1, INCLUDING the legacy
  left-sidebar control-panel header, which still renders its own
  <h1>GemPixel</h1> (23/700) + "Diamond Painting Planner" tagline at
  src/App.tsx:1305-1306. Both are now always-mounted inside the shell, so two
  "GemPixel" wordmarks render simultaneously — violating the UI-SPEC
  copywriting contract (single wordmark). This is the known duplicate the
  20-04 SUMMARY flagged as transient. The top-bar span is the intended
  wordmark; the sidebar h1 is the redundant legacy one.
fix: "" # diagnose-only — fix planned separately via /gsd-plan-phase --gaps
verification: "" # n/a in diagnose-only mode
files_changed: []
