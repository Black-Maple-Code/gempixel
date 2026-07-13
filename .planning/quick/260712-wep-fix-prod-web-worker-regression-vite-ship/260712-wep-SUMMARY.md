---
phase: 260712-wep
plan: 01
subsystem: engine/worker
tags: [vite, web-worker, bundling, regression, production]
status: complete
requires:
  - Vite static worker detection (new Worker(new URL(...)) single-expression form)
provides:
  - Production-bundled matcher worker as a hashed .js chunk
affects:
  - src/engine/worker-client.ts
  - src/features/match/useDiamondArtMatch.ts
tech-stack:
  added: []
  patterns:
    - "Inline new Worker(new URL('./x.ts', import.meta.url)) literal is the sole Vite-detectable worker form; optional constructor arg preserves the test-injection seam"
key-files:
  created: []
  modified:
    - src/engine/worker-client.ts
    - src/features/match/useDiamondArtMatch.ts
decisions:
  - "MatcherClient constructor arg made optional; no-arg default branch holds the verbatim inline Worker+URL literal so Vite compiles+bundles the worker. The optional workerUrl exists solely to keep worker.test.ts's injected-URL seam working."
metrics:
  duration: ~4min
  completed: 2026-07-13
  tasks: 2
  files: 2
---

# Phase 260712-wep Plan 01: Fix Prod Web Worker Regression (Vite Ship) Summary

Fixed a production-only regression where Vite shipped `matcher.worker` as raw, un-transpiled TypeScript (`/assets/matcher.worker-<hash>.ts`, served `video/mp2t`) by re-coupling the `new Worker(...)` call with its `new URL('./matcher.worker.ts', import.meta.url)` argument into a single statically-detectable inline expression — so Vite now compiles and bundles the worker into a hashed `.js` chunk that instantiates in production.

## What Was Built

- **`src/engine/worker-client.ts`** — `MatcherClient` constructor parameter is now optional (`workerUrl?: URL | string`). When provided, the worker is instantiated from it exactly as before (test seam). When omitted, the constructor takes an `else` branch holding the verbatim inline literal `new Worker(new URL('./matcher.worker.ts', import.meta.url), { type: 'module' })` — the only form Vite statically detects to compile+bundle the worker and its transitive `./color`, `./ingest`, `./types` imports. A code comment above the constructor documents why the inline form is mandatory and why the optional parameter exists.
- **`src/features/match/useDiamondArtMatch.ts`** — the worker-lifecycle `useEffect` now constructs `new MatcherClient()` with no argument, routing production through the default bundled-worker branch. Terminate-on-cleanup and all other effect logic unchanged.

No runtime behavior changed: `match()`, message/error handlers, run-id supersede logic, and the test-injection paths are byte-for-byte the same aside from the constructor signature and the single call-site edit.

## Verification Results

- **`npm test`** — 244/244 tests green (plan estimated ~205; the suite has grown). `worker.test.ts` still instantiates via the injected-URL branch (`new MatcherClient(new URL('http://localhost/matcher.worker.ts'))`) and all 5 of its integration cases pass.
- **`npm run build`** — `tsc` typecheck + `vite build` both succeed (180 modules transformed).
- **Worker artifact shape** — `dist/assets/matcher.worker-5huLDEaW.js` (18.12 kB) emitted; NO `matcher.worker-<hash>.ts` asset exists; `grep` for a bare `from './color'` in the chunk finds none — dependencies are inlined. First bytes confirm a minified IIFE (`(function(){"use strict";...`), i.e. bundled JavaScript.

## Deviations from Plan

None - plan executed exactly as written. (Test count is 244, not the plan's estimated ~205; this is an estimate variance, not a deviation — all tests green.)

## Threat Model

T-wep-01 (availability: worker fails to instantiate on gem-pixel.com) is closed by this fix — the worker now ships as a bundled hashed `.js` module that instantiates instead of firing `onerror` and stranding the render. T-wep-02 (dependency tampering) N/A — no packages added, removed, or upgraded; source-only refactor.

## Self-Check: PASSED

- FOUND: src/engine/worker-client.ts (modified, committed)
- FOUND: src/features/match/useDiamondArtMatch.ts (modified, committed)
- FOUND commit: d7fe6fb (fix(260712-wep): bundle matcher worker by inlining the Worker+URL literal)
- FOUND build artifact: dist/assets/matcher.worker-5huLDEaW.js (dist/ gitignored — not committed, as expected)
