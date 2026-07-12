---
status: testing
phase: 13-performance-off-main-thread-decode
source: [13-VERIFICATION.md]
started: 2026-07-12T18:50:09Z
updated: 2026-07-12T18:50:09Z
---

## Current Test

number: 1
name: Large-image UI responsiveness (PERF-01 / D-09)
expected: |
  Loading and re-matching a large source image (e.g. 4000×3000) keeps the UI
  responsive — the "Preparing image…" indeterminate overlay shows during the
  off-thread decode/resample, the page stays interactive (no frozen paint),
  then flips to the determinate "Matching colors: {n}%". Before this phase the
  same action janked the main thread on every match trigger.
awaiting: user response

## Tests

### 1. Large-image UI responsiveness (PERF-01 / D-09)
expected: |
  Load a large image (~4000×3000 or larger). During decode/resample the overlay
  reads "Preparing image…" (indeterminate) and the UI stays responsive (scroll,
  hover, palette toggles do not freeze); it then flips to "Matching colors: {n}%"
  (determinate) once worker progress starts. No main-thread jank on match triggers.
result: [pending]

### 2. Bit-identical parity vs the pre-phase pipeline (D-11 / ME-01)
expected: |
  A fixture image produces a matched grid IDENTICAL to the pre-phase main-thread
  pipeline (baseline commit 2249a34) — same color indices, same per-color counts,
  same rendered grid. Test at least: (a) a normal opaque JPG/PNG, and (b) an
  EXIF-rotated photo (the ME-01 fix target — the cap now uses source natural dims).
  How to diff: check out the baseline (e.g. a second clone/worktree at 2249a34),
  run the same fixture + same rows/cols/palette, and compare the supply counts /
  exported grid against the current build. Zero differences = pass.
result: [pending]

### 3. Unsupported-browser hard-fail (D-07)
expected: |
  On a browser/environment without OffscreenCanvas 2D support — or with the
  capability flag forced off (the __setOffscreenSupportForTest seam / a Safari
  <16.4 check) — the app surfaces the actionable stage-agnostic error banner
  ("Couldn't process the image…" / update-your-browser) via the reactive error
  path. No crash, no infinite spinner, and the banner does not co-display with
  the loading overlay.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
