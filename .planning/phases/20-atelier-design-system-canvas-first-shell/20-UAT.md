---
status: resolved
phase: 20-atelier-design-system-canvas-first-shell
source: [20-01-SUMMARY.md, 20-02-SUMMARY.md, 20-03-SUMMARY.md, 20-04-SUMMARY.md, 20-05-SUMMARY.md]
started: 2026-07-14T04:46:51Z
updated: 2026-07-14T06:04:01Z
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
result: pass
source: automated-browser
resolved_by: 20-06-PLAN.md
resolution: "Both gaps closed by 20-06 gap-closure plan and re-verified in the live dev server (localhost:5174, 1280x800). GAP 1: legacy sidebar brand cluster removed → visible GemPixel wordmark count = 1 (top-bar header span.font-display), both in empty and match-loaded states. GAP 2: AtelierShell root swapped min-h-screen → h-dvh overflow-hidden → with a real match loaded (4,679 drills / 48 bags / ~200 DMC rows) the page does NOT scroll beyond the viewport (scrollHeight 800 = clientHeight 800, overflowPx 0), the canvas sits above the fold (top 131 / bottom 733), and the left control panel (1441px content) + supply aside scroll on their own inner scrollbars. Save pill and D-13 soft-invalidate/recompute confirmed unregressed (width edit → stale banner + 'Recompute match' CTA)."
prior_report: "Duplicate GemPixel wordmark (top-bar span 21/600 at y=21 + legacy Step1 <h1> 23/700 at y=79). Separately: excessive spacing from the top bar means you must scroll to see the photo/canvas (canvas top=855px, below the 800px fold; page 2249px tall)."
severity: major

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
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0
auto_covered: 13

## Gaps

<!-- YAML for plan-phase --gaps consumption. Two distinct shell-layout defects surfaced
     on checkpoint 4; both confirmed by the user, who asked to fix now. -->

- truth: "The Atelier top bar shows exactly one 'GemPixel' wordmark (Newsreader 21/600 beside the pixel tile); no duplicate wordmark elsewhere on the Upload screen."
  status: resolved
  resolved_by: 20-06-PLAN.md
  reason: "User-confirmed: a second visible 'GemPixel' heading (legacy Step1 <h1>, Newsreader 23/700 at y=79) renders directly below the top-bar wordmark. UI-SPEC copywriting contract specifies a single wordmark; 20-04 SUMMARY flagged this as a known transient duplicate. FIXED in 20-06: legacy sidebar brand cluster removed; browser re-verify shows exactly 1 visible GemPixel wordmark (header span.font-display)."
  severity: major
  test: 4
  root_cause: "The legacy left-sidebar control-panel header still renders its own brand cluster (gem-logo tile + <h1>GemPixel</h1> + 'Diamond Painting Planner' tagline). Phase 20 added the new AtelierShell top-bar wordmark but kept the always-mounted legacy body, so both wordmarks render simultaneously. The AtelierShell <span> is the intended one; the legacy sidebar <h1> is redundant."
  artifacts:
    - path: "src/App.tsx"
      issue: "Lines 1298-1308: legacy sidebar header brand cluster (h1 GemPixel at 1305-1306 + tagline at 1306) — the redundant duplicate to remove/hide. Keep the collapse button at 1309-1317."
    - path: "src/features/wizard/AtelierShell.tsx"
      issue: "Line 61: the intended top-bar wordmark <span> (Newsreader 21/600) — leave as-is."
    - path: "src/__tests__/App.test.tsx"
      issue: "Lines 99-101 and 109-111 assert container.querySelector('h1').textContent === 'GemPixel'; the first <h1> is currently the legacy sidebar h1. Removing it makes the first <h1> the print-only 'GemPixel Supply Plan Report' → both assertions fail unless retargeted to the AtelierShell wordmark."
  missing:
    - "Remove (or hide) the legacy sidebar header brand cluster in src/App.tsx (~1298-1308), preserving the collapse button and the sidebar itself — no full Step 1 deletion (that is Phase 23/25)."
    - "Retarget the two App.test.tsx wordmark assertions (99-101, 109-111) to the top-bar AtelierShell wordmark (query span.font-display within <header>), rather than the first <h1>."
  debug_session: .planning/debug/duplicate-gempixel-wordmark.md

- truth: "On a desktop viewport the photo/canvas is visible within the shell without scrolling (canvas-first shell — the canvas is the primary above-the-fold surface)."
  status: resolved
  resolved_by: 20-06-PLAN.md
  reason: "User-confirmed: 'so much spacing from the top bar you must scroll to see the photo.' Measured at 1280x800: header ends at 63px but canvas starts at y=855 (below the 800px fold); page scrollHeight 2249px. <main> is flex-column; the center canvas column stretches to the tall supply-list sidebar and vertically-centers the canvas, floating it below the fold. FIXED in 20-06: AtelierShell root min-h-screen -> h-dvh overflow-hidden; browser re-verify with a real match loaded shows canvas top=131/bottom=733 (above the 800 fold), page overflowPx=0 (no scroll beyond viewport), sidebars scroll internally."
  severity: major
  test: 4
  root_cause: "min-h-screen vs h-screen flexbox gotcha. The shell root (AtelierShell.tsx:52) and body (index.css:120) use min-h-screen (min-height only = indefinite height). The flex-1 row wrapper's 0% basis then resolves against content, so the shell grows to the tallest child — the always-mounted 183-207 row DMC Supply List <aside> (~2249px). The row's min-h-0 + overflow-hidden and the sidebars' inner overflow-y-auto (already authored for viewport-capped internal scroll) never engage because nothing forces a definite height. <main> inherits the ballooned height and the center column (items-center) vertically-centers the canvas at ~y=855, below the fold. items-center is a symptom amplifier, not the cause."
  artifacts:
    - path: "src/features/wizard/AtelierShell.tsx"
      issue: "Line 52: shell root 'flex flex-col min-h-screen' — indefinite outer height (primary offender). Header is already shrink-0."
    - path: "src/index.css"
      issue: "Line 120: body { ... min-h-screen } — also indefinite, reinforces the chain."
    - path: "src/App.tsx"
      issue: "Line 1290 row wrapper (flex flex-1 min-h-0 overflow-hidden) + 1594 <main> + 1624 center column (flex items-center justify-center) + 1867 always-mounted supply-list <aside> — correctly authored for internal scroll but cannot cap under an indefinite parent."
  missing:
    - "Give the shell a definite viewport height: on AtelierShell.tsx:52 swap min-h-screen -> h-screen (prefer h-dvh/h-[100dvh] for mobile URL-bar correctness) and add overflow-hidden, so the existing flex-1 min-h-0 + inner overflow-y-auto engage and the page caps to the viewport."
    - "Optional: top-align the canvas (items-start + top padding) instead of items-center if a fixed top anchor is preferred; not required to bring the canvas above the fold once height is definite."
    - "Chrome/layout-only change — no Step body edits. Optional lightweight regression asserting the shell root carries a definite-height class (h-screen/h-dvh)."
  debug_session: .planning/debug/canvas-below-fold.md
