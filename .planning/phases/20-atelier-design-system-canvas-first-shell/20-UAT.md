---
status: complete
phase: 20-atelier-design-system-canvas-first-shell
source: [20-01-SUMMARY.md, 20-02-SUMMARY.md, 20-03-SUMMARY.md, 20-04-SUMMARY.md, 20-05-SUMMARY.md]
started: 2026-07-14T04:46:51Z
updated: 2026-07-14T05:05:00Z
---

## Current Test

[testing complete]

<!-- Verification method: automated browser drive (mcp Browser pane) against the live
     dev server at localhost:5174. Checkpoints 1,2,3,5 auto-verified pass with DOM/console/
     network evidence. Checkpoint 4: chrome correct but TWO shell-layout issues found
     (duplicate wordmark + canvas-below-fold), confirmed by user, logged as gaps. -->


## Tests

### 1. Cold Start Smoke Test
expected: Fresh dev-server load boots with no console errors; the Atelier top-bar shell + first (Upload) panel render.
result: pass
source: automated-browser
evidence: "read_console_messages (onlyErrors) → none; preview_logs error → none; shell + Upload panel rendered at localhost:5174"

### 2. Self-hosted fonts, no layout shift (20-01 D2)
expected: No network request to fonts.googleapis.com; text renders in Newsreader/Archivo/JetBrains Mono with no visible reflow/jump on first paint (Fontaine fallback metrics).
result: pass
source: automated-browser
evidence: "computed font-family: wordmark='Newsreader Variable', body='Archivo Variable'; read_network_requests(googleapis) → none; self-hosted @fontsource + Fontaine fallback faces (build-proven in 20-01) so no external-swap CLS"

### 3. No dark-mode flash on reload (20-02 D3)
expected: A returning user with a stale gempixel_theme=dark localStorage key reloads and sees the Atelier light UI with no half-dark flash; the stale key is cleared on boot.
result: pass
source: automated-browser
evidence: "set gempixel_theme=dark → reload → key removed (null), no [data-theme] attr, body bg #F4F1E9, 0 [data-theme] CSS rules + 0 dark-bg rules in bundle (flash impossible by construction)"

### 4. Atelier top-bar chrome + shell (20-03 D4 / 20-04 D5)
expected: Top bar shows the green 3x3 pixel-tile mark + a single "GemPixel" Newsreader wordmark + the 4-step StepBar (Upload/Refine/Supplies/Order) + a dark "Save" pill. No duplicate wordmark. StepBar is the only navigator (no dot-nav / hamburger / sidebar).
result: issue
reported: "Duplicate GemPixel wordmark (top-bar span 21/600 at y=21 + legacy Step1 <h1> 23/700 at y=79). Separately: excessive spacing from the top bar means you must scroll to see the photo/canvas (canvas top=855px, below the 800px fold; page 2249px tall)."
severity: major
evidence: "StepBar OK (4 steps Upload/Refine/Supplies/Order in order, aria-current on step 1, 3 locked aria-disabled, green accent circle); Save pill bg #1B1A17 / text #F4F1E9 OK; light theme OK. wordmarkCount=3 (2 visible GemPixel + 1 print-only report title). main is flex-column; canvas vertically centered in a column stretched to the tall supply-list sidebar → canvas floats below fold."

### 5. Soft-invalidate + recompute stale behavior (20-05 D-13)
expected: After a match, editing an upstream step (re-upload / change size) marks downstream steps out-of-date (amber marker), keeps the last-good canvas on screen, blocks advancing past the stale step, and shows one "This step is out of date" / "Recompute match" banner that re-runs the match on click and clears the stale state.
result: pass
source: automated-browser
evidence: "injected 64x64 PNG → match ran (183 supply rows, all steps unlocked). Edited width 80→120 → 6 stale markers + '(out of date)' + 'This step is out of date' banner + 'Recompute match' CTA; last-good canvas + 183 rows retained; wizard-next-btn disabled. Clicked Recompute → markers/banner/CTA cleared, Next re-enabled, recomputed to 207 rows at committed width 120."

## Auto-Covered (deterministic — passing tests, not presented)

### A1. Self-hosted fonts, no external font request (20-01 D1)
result: pass
source: automated
coverage_id: 20-01-D1

### A2. Dual [data-theme] skins flattened to single Atelier light :root (20-01 D3)
result: pass
source: automated
coverage_id: 20-01-D3

### A3. Engine canvas symbol-font repointed to Archivo Variable; suite green (20-01 D4)
result: pass
source: automated
coverage_id: 20-01-D4

### A4. index.html dark-mode boot script + data-theme attribute removed (20-02 D1)
result: pass
source: automated
coverage_id: 20-02-D1

### A5. App.tsx theme hook + [data-theme] effect + toggle removed; boot removeItem added (20-02 D2)
result: pass
source: automated
coverage_id: 20-02-D2

### A6. STEP_META single ordered source of step labels/order + tooltips (20-03 D1)
result: pass
source: automated
coverage_id: 20-03-D1

### A7. StepBar is the single pure/props-only navigator, owns no state (20-03 D2)
result: pass
source: automated
coverage_id: 20-03-D2

### A8. Gating/a11y: aria-current, locked aria-disabled + out-of-tab-order + no dead-end (20-03 D3)
result: pass
source: automated
coverage_id: 20-03-D3

### A9. StepBar/AtelierShell single navigator; both legacy desktop nav surfaces deleted (20-04 D1)
result: pass
source: automated
coverage_id: 20-04-D1

### A10. Four always-mounted CSS-toggled step panels; single CanvasViewer never remounts (20-04 D2)
result: pass
source: automated
coverage_id: 20-04-D2

### A11. Locked-Next affordance + useWizard 1..4 indices unchanged (20-04 D3)
result: pass
source: automated
coverage_id: 20-04-D3

### A12. Existing viewer/legend/supply UI still functions; full suite green (20-04 D4)
result: pass
source: automated
coverage_id: 20-04-D4

### A13. Soft-invalidate/recompute + StepBar marker + false-positive guard + suite green (20-05, tested)
result: pass
source: automated
coverage_id: 20-05-tests

## Summary

total: 5
passed: 4
issues: 1
pending: 0
skipped: 0
blocked: 0
auto_covered: 13

## Gaps

<!-- YAML for plan-phase --gaps consumption. Two distinct shell-layout defects surfaced
     on checkpoint 4; both confirmed by the user, who asked to fix now. -->

- truth: "The Atelier top bar shows exactly one 'GemPixel' wordmark (Newsreader 21/600 beside the pixel tile); no duplicate wordmark elsewhere on the Upload screen."
  status: failed
  reason: "User-confirmed: a second visible 'GemPixel' heading (legacy Step1 <h1>, Newsreader 23/700 at y=79) renders directly below the top-bar wordmark. UI-SPEC copywriting contract specifies a single wordmark; 20-04 SUMMARY flagged this as a known transient duplicate."
  severity: major
  test: 4
  root_cause: ""     # Filled by diagnosis
  artifacts: []      # Filled by diagnosis
  missing: []        # Filled by diagnosis
  debug_session: ""  # Filled by diagnosis

- truth: "On a desktop viewport the photo/canvas is visible within the shell without scrolling (canvas-first shell — the canvas is the primary above-the-fold surface)."
  status: failed
  reason: "User-confirmed: 'so much spacing from the top bar you must scroll to see the photo.' Measured at 1280x800: header ends at 63px but canvas starts at y=855 (below the 800px fold); page scrollHeight 2249px. <main> is flex-column; the center canvas column stretches to the tall supply-list sidebar and vertically-centers the canvas, floating it below the fold."
  severity: major
  test: 4
  root_cause: ""     # Filled by diagnosis
  artifacts: []      # Filled by diagnosis
  missing: []        # Filled by diagnosis
  debug_session: ""  # Filled by diagnosis
