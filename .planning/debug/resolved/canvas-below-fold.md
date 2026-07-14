---
status: resolved
trigger: "Canvas-first shell (Phase 20): on desktop you must scroll to see the photo/canvas. Header ends at y=63 but canvas starts at y=855 (below the 800px fold); page scrollHeight 2249px at 1280x800. Diagnose root cause only — do NOT fix."
created: 2026-07-14T05:03:00Z
updated: 2026-07-14T06:04:01Z
resolved_by: 20-06-PLAN.md
resolution: "AtelierShell root (src/features/wizard/AtelierShell.tsx:52) swapped min-h-screen -> h-dvh overflow-hidden, giving the flex chain a definite viewport height. Browser re-verify with a real match loaded: page overflowPx=0 (no scroll beyond viewport), canvas top=131/bottom=733 (above the 800 fold), left control panel + supply aside scroll internally."
---

## Current Focus

hypothesis: CONFIRMED — the shell's outer flex column uses `min-h-screen` (min-height:100vh, an INDEFINITE height) instead of a definite viewport height. The `flex-1` row wrapper's `flex-basis: 0%` therefore resolves against an indefinite container → falls back to content height → the row grows to its tallest child (the always-mounted 183–207-row supply-list `<aside>`), ballooning the shell to 2249px. `overflow-hidden`/`min-h-0` never engage. The center canvas column stretches with it and `items-center` centers the canvas inside a 2186px-tall column → canvas floats to y≈855, below the 800px fold.
test: Static analysis of the flex chain (body → #app → AtelierShell root → row wrapper → main → center column) plus the documented `min-h-screen` vs `h-screen` flexbox gotcha. Matches the measured DOM geometry exactly.
expecting: Making the shell root a DEFINITE height (`h-screen`/`h-dvh`) caps the row wrapper to viewport; internal sidebar scroll (already wired via `flex-1 overflow-y-auto`) engages; canvas returns above the fold.
next_action: Return ROOT CAUSE FOUND to caller (find_root_cause_only — no fix applied).

## Symptoms

expected: On a desktop viewport (1280x800) the photo/canvas is visible within the canvas-first shell WITHOUT scrolling — the canvas is the primary above-the-fold surface (SHELL-01/SHELL-02).
actual: You must scroll to see the canvas. Header ends at y=63; visible canvas element starts at y=855 (below the 800px fold), canvas height 602px. document.documentElement.scrollHeight = 2249px. `<main>` is display:flex/flex-direction:column; its in-flow child `div.flex-1.relative.flex.items-center.justify-center` measures height 2186px, width 576px, and vertically centers the canvas within itself.
errors: None (layout issue, no console errors).
reproduction: Load app at desktop width; load an image so a match/supply list populates; observe the canvas sits below the fold. Documented as Test 4 in 20-UAT.md.
started: Discovered during Phase 20 UAT (2026-07-14). Introduced/surfaced by Plan 20-04 hoisting a single CanvasViewer to shell scope and converting the four step panels to always-mounted CSS-toggled siblings (so the tall supply-list aside is always mounted).

## Eliminated

- hypothesis: The center column's `items-center` vertical centering is itself the root cause.
  evidence: `items-center` only decides WHERE the canvas sits within the column; the defect is that the column is 2186px tall in the first place. Centering is a symptom amplifier, not the cause. Even top-aligning would still leave a 2186px column and a scrolling page.
  timestamp: 2026-07-14T05:03:00Z

- hypothesis: A print-mode / global CSS override (`overflow: visible !important`, `height: auto !important`) leaks into the normal (screen) layout.
  evidence: All such rules in src/index.css are scoped to `@media print`, `body.print-only-legend-mode`, or `body.print-only-report-mode` — none apply in the normal screen state. index.css:190-514.
  timestamp: 2026-07-14T05:03:00Z

## Evidence

- timestamp: 2026-07-14T05:03:00Z
  checked: Mount + outer shell height chain — index.html, src/main.tsx, src/features/wizard/AtelierShell.tsx, src/index.css body rule.
  found: `<body class="min-h-screen">` (index.html:8) mounts `<div id="app">` (a plain block, no height/flex). `#app` renders AtelierShell root `<div className="flex flex-col min-h-screen">` (AtelierShell.tsx:52). `body` also gets `min-h-screen` via index.css:120. NOTHING in the chain has a DEFINITE height — every level is `min-height:100vh` (a floor) with `height:auto`.
  implication: The flex column that is supposed to cap the layout is itself indefinite-height, so percentage/zero flex-basis children cannot resolve to a capped size.

- timestamp: 2026-07-14T05:03:00Z
  checked: The shell body row wrapper and its columns — App.tsx:1290 (row), 1292/1867 (left/right asides), 1594 (main), 1624 (center canvas column).
  found: Row wrapper `<div className="flex flex-1 min-h-0 w-screen ... overflow-hidden">` (1290). Left aside `flex flex-col ... shrink-0 w-80` with inner `flex-1 overflow-y-auto` (1293/1320). Right aside `flex flex-col overflow-hidden shrink-0 w-96` with inner supply table `flex-1 overflow-y-auto` (1867/1973). `<main className="flex-1 relative flex flex-col min-w-0">` (1594) whose only in-flow child is the center column `<div className="flex-1 relative flex items-center justify-center overflow-hidden ...">` (1624).
  implication: The layout is CORRECTLY authored for an internal-scroll, viewport-capped shell (row is `flex-1 min-h-0 overflow-hidden`; both sidebars scroll internally). The capping simply never activates because the parent column is indefinite-height.

- timestamp: 2026-07-14T05:03:00Z
  checked: Flexbox resolution of `flex-1` (`flex: 1 1 0%`) inside an indefinite-height column — the `min-h-screen` vs `h-screen` gotcha.
  found: When a flex column's height is indefinite (`min-height:100vh` + `height:auto`), a child's percentage flex-basis (`0%`) resolves as content-based rather than against a definite size. The row wrapper's base size therefore becomes its max-content height = the tallest child = the always-mounted supply-list aside (183–207 rows). The column grows to 63 (header) + 2186 (row) ≈ 2249px, exceeding the 100vh floor. Because the container GREW to fit rather than being capped, the row's `min-h-0` (shrink permission) and `overflow-hidden` (clip) never engage.
  implication: Root cause is the indefinite outer height, not the sidebars or the centering per se. The tall always-mounted aside is the content that the ballooning grows TO; the centering is what then pushes the canvas to y≈855.

- timestamp: 2026-07-14T05:03:00Z
  checked: Legacy Step 1 header block in the left setup column — App.tsx:1304-1307.
  found: The left column renders a second `<h1>GemPixel</h1>` (23/700) + "Diamond Painting Planner" tagline directly below the top-bar wordmark. This is also the separate "duplicate wordmark" UAT gap.
  implication: Minor/cosmetic contributor to top spacing only; it does NOT drive the page height or the below-fold canvas. Not the root cause of the scroll defect.

## Resolution

root_cause: |
  The canvas-first shell's flex chain has NO definite height. `<body>` (index.css:120) and the
  AtelierShell root (`src/features/wizard/AtelierShell.tsx:52`, `flex flex-col min-h-screen`) both use
  `min-h-screen` = `min-height:100vh` with `height:auto` — an INDEFINITE height (a floor, not a ceiling).
  The shell-body row wrapper (`src/App.tsx:1290`) is `flex flex-1 min-h-0 overflow-hidden`, i.e.
  `flex: 1 1 0%`. Against an indefinite-height column, a `0%` flex-basis resolves as content-based, so the
  row wrapper's base size becomes the max-content height of its tallest child — the always-mounted
  DMC Supply List `<aside>` (183–207 rows; always mounted since Plan 20-04 made the step panels
  CSS-toggled siblings). The shell column therefore GROWS to ≈2249px (header 63 + row 2186) rather than
  being capped at 100vh; its `min-h-0` (shrink permission) and `overflow-hidden` (clip) never engage
  because nothing forces the container to shrink. `<main>` (App.tsx:1594) inherits the 2186px height, and
  the center canvas column (App.tsx:1624, `flex items-center justify-center`) vertically centers the
  canvas within that 2186px column → canvas floats to y≈855, below the 800px fold, and the page scrolls.
fix: "(not applied — find_root_cause_only). Direction: give the shell a DEFINITE viewport height so flex-basis caps."
verification: ""
files_changed: []
