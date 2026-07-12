---
plan: 13-03
phase: 13-performance-off-main-thread-decode
status: complete
completed: 2026-07-12
type: checkpoint:human-verify
requirements: [PERF-01]
---

# Plan 13-03 Summary — Manual Verification (D-11 gate)

One-time, in-browser verification that the off-main-thread decode relocation is
responsive, bit-identical, and fails safe on unsupported browsers. This plan makes
no code changes — its artifact is the recorded verification (see `13-UAT.md`).
All three checks passed via `/gsd-verify-work 13`.

## Verification Results

1. **Large-image UI responsiveness (PERF-01 / D-09)** — PASS (user-confirmed in browser).
   Loading/re-matching a large image keeps the UI responsive; the "Preparing image…"
   indeterminate overlay shows during the off-thread decode/resample, then flips to
   the determinate "Matching colors: {n}%". No main-thread jank on match triggers.

2. **Bit-identical parity vs the pre-phase pipeline (D-11 / ME-01)** — PASS (user-confirmed).
   Matched grid identical to baseline commit `2249a34` for both a normal opaque image and
   an EXIF-rotated photo (the ME-01 fix caps the resample on source natural dimensions).

3. **Unsupported-browser hard-fail (D-07)** — PASS (driven in the in-app browser).
   Forced `OffscreenCanvas` to `undefined` before the first match (so the memoized
   capability probe resolved unsupported), then injected a test image to trigger a match.
   The app rendered the reactive error banner: "Couldn't process the image: Please update
   your browser — off-thread image decoding (OffscreenCanvas) is unavailable." Verified no
   loading overlay co-displayed (`anyOverlayActuallyVisible: false`), no console errors,
   and no crash. Capability + injected state were then restored (page reloaded).

## Self-Check: PASSED

Verification-only plan (no source changes). The automated CI gate — the pure-integer
`boxSampleImage` unit test within the full suite (178/178, `tsc` clean) — remains green;
per D-11 this manual pass is the one-time gate for the moved decode/resample path, not a
permanent regression harness.
