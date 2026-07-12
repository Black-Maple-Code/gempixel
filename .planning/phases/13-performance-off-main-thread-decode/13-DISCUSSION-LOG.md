# Phase 13: Performance — Off-Main-Thread Decode - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 13-performance-off-main-thread-decode
**Areas discussed:** Decode boundary & transfer, Worker topology, Browser fallback, Loading/progress UX, Parity verification
**Mode:** advisor (USER-PROFILE present) — each area researched by a parallel gsd-advisor-researcher subagent; comparison tables presented before selection.

---

## Decode boundary & transfer

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Everything in worker | Transfer raw Blob into worker; decode + resample + box-sample all off-main. Maximal de-jank; highest parity risk; Firefox blocks on `createImageBitmap(blob)` in-worker; untestable in jsdom. | |
| (b) Also evict decode readback | `createImageBitmap` on main (async) + transfer `ImageBitmap`; resample + `getImageData` + box-sample in worker. Fully removes resample/readback jank; parity now at risk; needs a real-browser way to prove parity. | ✓ |
| (c) Box-sample only — parity-safe | Keep `getImagePixels` on main; transfer `ImageData` ArrayBuffer; run only `boxSampleImage` in worker. Parity guaranteed by construction, jsdom-testable, zero browser-compat surface; residual ~15–40ms decode hitch stays on main. | |

**User's choice:** (b) Also evict decode readback.
**Notes:** Clarified during discussion that the `HTMLImageElement` is already decoded at `img.onload`, so (b) actually evicts the `drawImage` resample + `getImageData` readback (via a transferred `ImageBitmap`), not the initial browser decode. Consequences accepted: parity moves off the CI gate (→ parity-verification area) and browser fallback becomes a live dependency (→ fallback area).

---

## Worker topology

| Option | Description | Selected |
|--------|-------------|----------|
| A. Fold into matcher.worker | One message carries the `ImageBitmap` into the existing worker → resample → box-sample → match, single round-trip; existing runId cancels the whole pipeline atomically. | ✓ |
| B. Separate decode.worker | New dedicated decode worker + own client; matcher.worker frozen, but abort spans two runId schemes that must both cancel on new input. | |
| C. Hybrid client orchestrates both | MatcherClient drives two workers under one runSeq; frozen matcher.worker + single `match()` surface, but heavier client and two round-trips. | |

**User's choice:** A. Fold into matcher.worker.
**Notes:** Chosen because it *simplifies* the load-bearing B2 abort (one supersede cancels decode+match together) rather than splitting it, and collapses to a single round-trip.

---

## Browser fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-fail via Phase 11 banner | Single worker-only decode path; if the init-time probe finds no OffscreenCanvas support, surface an "update your browser" message via Phase 11's error banner. | ✓ |
| Dual-path fallback to main-thread | Keep today's `getImagePixels` as a graceful fallback; works on 100% of browsers but carries two decode paths that must stay pixel-identical forever. | |

**User's choice:** Hard-fail via Phase 11 banner.
**Notes:** Became live only because decode boundary (b) was chosen. Detection is an init-time capability probe exposed as an injectable flag (also the jsdom test seam) under either option. Safari <16.4 is low single-digit share in 2026; anti-legacy single-path preferred.

---

## Loading / progress UX

| Option | Description | Selected |
|--------|-------------|----------|
| Phase label + indeterminate bar | Indeterminate "Preparing image…" during decode, flip to determinate "Matching colors: {n}%" on first worker progress; reuses the single overlay, preserves the spinner-vs-error-banner invariant. | ✓ |
| Fold into existing spinner | No label change; bar sits at 0% until match progress — can read as "Matching colors: 0%" / stalled during decode. | |
| Combined 0–100, decode = first slice | Maps decode to the first slice of one bar; fabricates progress motion. | |

**User's choice:** Phase label + indeterminate bar.
**Notes:** Also decided: worker-side decode failures route through the reactive `error` signal (like match failures), not the imperative `actionError`; generalize banner copy to a stage-agnostic form.

---

## Parity verification

| Option | Description | Selected |
|--------|-------------|----------|
| Manual in-browser fixture check at verify | Run one fixture through old vs new pipeline in a real browser and diff the matched grid once; no permanent infra. | ✓ |
| Automated real-browser gate | Add vitest browser mode / Playwright fixture parity test in CI forever; strongest regression protection, adds a test-runner dep. | |
| Keep pure box-sample jsdom test only | Only the integer box-sample math stays CI-gated; rely on manual review for the decode path. | |

**User's choice:** Manual in-browser fixture check at verify.
**Notes:** jsdom cannot test the moved decode; the existing `boxSampleImage` unit test remains the CI gate for the math. One-time manual gate, not a regression guard — automated harness deferred unless a regression appears.

## Claude's Discretion

- Exact `{kind:'match'}` payload additions, OffscreenCanvas creation details, and how `createImageBitmap` is awaited/aborted within the hook effect — left to research/planning provided the locked decisions (D-01…D-11) hold.

## Deferred Ideas

- Automated real-browser parity gate (vitest browser mode / Playwright) — revisit only if a resample-parity regression surfaces.
- Phases 10, 12, 14 remain deferred (unchanged by this discussion).
