---
phase: 20-atelier-design-system-canvas-first-shell
plan: 05
subsystem: canvas-first-shell
tags: [d13, soft-invalidate, recompute, stepbar, wizard, shell-02]
requires:
  - "20-04: AtelierShell single navigator + always-mounted CSS-toggled step panels"
  - "20-03: pure StepBar with reserved stale? prop + STEP_META"
provides:
  - "D-13 soft-invalidate chrome: staleFromStep signal, Recompute match banner, advance-past-stale block"
  - "StepBar out-of-date marker rendered from the stale prop"
  - "committed match-input gate that prevents silent worker re-fire on upstream edits"
affects:
  - "src/App.tsx (state owner)"
  - "src/features/wizard/StepBar.tsx"
  - "src/features/wizard/AtelierShell.tsx"
tech-stack:
  added: []
  patterns:
    - "Committed-vs-live input gate: the worker consumes committed {image,cols,rows}; live values drive editing UI, divergence = stale"
    - "Recompute = commit live inputs → fires the existing match effect once (no new worker path), clears stale immediately"
    - "Forward-nav block via a guarded goTo wrapper + Next disable, leaving useWizard.canEnter frozen (D-04)"
key-files:
  created: []
  modified:
    - "src/App.tsx"
    - "src/features/wizard/StepBar.tsx"
    - "src/features/wizard/AtelierShell.tsx"
    - "src/__tests__/App.test.tsx"
key-decisions:
  - "stale shape = staleFromStep: number | null (earliest out-of-date step, =2 since image/size are Step 1 inputs feeding every downstream step)"
  - "Gate the worker via committed match inputs in App (hook untouched) so 'no silent re-fire' + 'keep last-good' hold in production, not just under the mocked-worker test"
  - "Recompute clears stale optimistically by committing live inputs (deterministic under the mocked worker) rather than waiting on a worker callback"
  - "Draw the canvas/exports at committed dims so a stale (edited-but-not-recomputed) size keeps rendering the last-good grid coherently"
requirements-completed: [SHELL-02]
coverage:
  - deliverable: "Soft-invalidate marks downstream stale, keeps last-good match, blocks advancing, and Recompute clears it (D-13/SC4)"
    verification:
      - kind: test
        ref: "src/__tests__/App.test.tsx#marks downstream stale, keeps last-good match, blocks advancing, and Recompute clears it"
        status: pass
    human_judgment: false
  - deliverable: "No false-positive stale on a fresh load; linear forward navigation unaffected (SC5)"
    verification:
      - kind: test
        ref: "src/__tests__/App.test.tsx#does not enter the stale state on a fresh linear load (no false positives)"
        status: pass
    human_judgment: false
  - deliverable: "StepBar renders a distinct token-based out-of-date marker via the stale prop (pure/props-only)"
    verification:
      - kind: test
        ref: "src/__tests__/App.test.tsx#marks downstream stale ... (asserts nav[aria-label=Progress] [data-stale=true])"
        status: pass
    human_judgment: false
  - deliverable: "Full Vitest suite stays green (>=240) and typecheck clean across the D-13 change"
    verification:
      - kind: command
        ref: "npx tsc --noEmit && npx vitest run (255 passed, 3x deterministic)"
        status: pass
    human_judgment: false
duration: 35 min
completed: 2026-07-13
status: complete
---

# Phase 20 Plan 05: Soft-Invalidate + Recompute Chrome (D-13) Summary

Editing a completed upstream step (re-upload / change size) after a match now soft-invalidates downstream steps via an App-level `staleFromStep` signal — keeping the last-good match/supplies on screen, blocking forward navigation past the stale step, and surfacing exactly one "This step is out of date" / "Recompute match" banner that re-runs the match once on click. Implemented by gating the worker behind committed match inputs so no expensive worker re-fire happens on edit (avoiding the B2 abort-race), threading the `stale` index through AtelierShell into a pure StepBar that renders a token-based amber marker.

## What shipped

- **App-level stale tracking (Task 1, `src/App.tsx`).** Introduced a committed `matchInputs {image, cols, rows}` state that the match hook consumes instead of the live values. Committed inputs advance only on intentional commits — fresh upload (first image only), project load, reset, and the Recompute CTA. `isStale = !!matchResult && (live diverges from committed)`, `staleFromStep = isStale ? 2 : null`. Added `handleRecomputeMatch` (commits live inputs → the existing match effect fires once, no new worker path), a `guardedGoTo` wrapper + `nextBlockedByStale` Next-disable that block advancing into stale steps without touching `useWizard.canEnter` (D-04), and the page-level warn banner. Canvas/exports now draw at the committed dims so the last-good grid stays coherent while stale.
- **StepBar marker (Task 2, `StepBar.tsx` + `AtelierShell.tsx`).** Reshaped the reserved `stale?` prop from `boolean` to `number | null` (the earliest out-of-date index) and render a small amber `bg-warn` dot on downstream steps at/after that index, plus an `sr-only "(out of date)"` note and a `data-stale` hook. StepBar stays pure/props-only (0 `useState`, 0 `dangerouslySetInnerHTML`). AtelierShell forwards the prop straight through.
- **Behavior test (Task 3, `App.test.tsx`).** A soft-invalidate test drives a restored match, edits the canvas size, and asserts the banner + CTA appear, the StepBar marker shows, the last-good canvas stays, advancing is blocked, and Recompute clears everything. A second test guards against false positives (fresh load is never stale; linear forward nav still works). Both use the poll-for-value idiom.

## How it satisfies D-13 / SHELL-02 (SC4)

| D-13 requirement | Implementation |
|---|---|
| Mark downstream steps stale | `staleFromStep` → StepBar amber marker on steps >= index |
| Keep last-good match/supplies on screen | Committed inputs freeze the worker; `matchResult` retained; canvas drawn at committed dims |
| Block advancing past a stale step | `guardedGoTo` + `nextBlockedByStale` (canEnter untouched) |
| One "Recompute match" CTA | Single page-level warn banner (heading "This step is out of date") |
| No silent worker re-fire | Worker keyed on committed inputs; edits don't advance them |
| Runs once on intentional click | Recompute commits live inputs → existing match effect fires once |

## Verification

- `npx tsc --noEmit` exits 0.
- `npx vitest run` — **255 passed** (253 baseline + 2 new), deterministically green across 3 consecutive runs. No prior navigation / locked-Next / single-mount / index test regressed.
- Acceptance greps: `Recompute match` ×5 and `This step is out of date` ×1 in App.tsx; StepBar `useState` = 0 and `dangerouslySetInnerHTML` = 0; `useWizard.ts` `canEnter` count unchanged (hook not modified).

## Deviations from Plan

### Auto-fixed / necessary adjustments

**1. [Rule 3 - Blocker] Threaded the `stale` prop through AtelierShell (not in `files_modified`)**
- **Found during:** Task 2.
- **Issue:** StepBar is only rendered by AtelierShell, so passing `stale` from App to StepBar requires AtelierShell to accept and forward it. The plan's Task 1 action explicitly says "Pass the stale signal down to `<AtelierShell>`/`<StepBar>`", but `AtelierShell.tsx` was omitted from the frontmatter `files_modified` list.
- **Fix:** Added an optional `stale?: number | null` prop to `AtelierShellProps` and forwarded it verbatim to `<StepBar>`. Trivial pure pass-through; no new state or behavior.
- **Files modified:** `src/features/wizard/AtelierShell.tsx`.
- **Verification:** tsc clean; the D-13 test asserts the StepBar marker renders (proving the prop reaches StepBar).
- **Commit:** d13ae9a

**2. [Rule 2 - Missing critical correctness] Gated the worker via committed match inputs so "no silent re-fire" holds in production**
- **Found during:** Task 1.
- **Issue:** `useDiamondArtMatch` auto-fires the worker on `[image, cols, rows, candidatesKey]`. A pure chrome-only stale marker would have let the worker silently re-fire on every size/image edit (the exact behavior D-13 forbids and the B2 abort-race risk). The plan scopes Task 1 to `App.tsx` and leaves the hook unmodified.
- **Fix:** App now passes *committed* `{image, cols, rows}` to the hook instead of the live values, advancing them only on intentional commits. This honors "no silent re-fire" + "keep last-good" in real usage, not just under the mocked-worker test, with zero changes to the hook's signature or its abort/run-id race protection.
- **Files modified:** `src/App.tsx`.
- **Verification:** D-13 test asserts the last-good canvas persists after an edit; full suite green.
- **Commit:** 0b08b44

**Total deviations:** 2 (1 blocker prop-threading, 1 missing-critical-correctness gate). **Impact:** Both are additive and inert outside the stale window (committed == live in every non-stale path, so all existing tests are unaffected). No engine/* signatures changed; legacy Step1..4 bodies untouched; no Phase 23 content built.

## Threat surface

Mitigations from the plan's `<threat_model>` are covered: T-20-11 (silent match re-fire → DoS/abort-race) is prevented by the committed-input gate + single-click Recompute; T-20-12 (discarding last-good on invalidation) is prevented by retaining `matchResult` and drawing at committed dims. Both asserted by the Task 3 test. No new security-relevant surface introduced.

## Next

Plan 5 of 5 — this is the final plan of Phase 20. Phase 20 (atelier-design-system-canvas-first-shell) is code-complete and green; ready for `/gsd-verify-work 20` then planning Phase 21.

## Self-Check: PASSED
- `src/App.tsx`, `src/features/wizard/StepBar.tsx`, `src/features/wizard/AtelierShell.tsx`, `src/__tests__/App.test.tsx` all modified and present on disk.
- Commits present: d13ae9a (Task 2), 0b08b44 (Task 1), a854355 (Task 3).
- `npx tsc --noEmit` exits 0; `npx vitest run` = 255 passed (3× deterministic).
