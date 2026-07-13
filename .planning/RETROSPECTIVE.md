# GemPixel — Retrospective

A living retrospective across milestones.

## Milestone: v2.1 — Post-Review Remediation

**Shipped:** 2026-07-12
**Active scope:** Phases 11 + 13 (of 10–14; Phases 10/12/14 deferred)

### What Was Built
- **Phase 11 — Storage Robustness & Error Feedback:** `safeStorage` guard + `usePersistentState` hook (format-preserving codecs); migrated App.tsx's 7 persisted settings; unified `actionError` banner for save/download/checkout failures. (STORE-01/02, ERR-01)
- **Phase 13 — Off-Main-Thread Decode:** relocated the `drawImage` resample + `getImageData` readback + `boxSampleImage` averaging into `matcher.worker.ts` behind a zero-copy `ImageBitmap` transfer, reusing the B2 `currentRunId` abort; an injectable capability/decode seam keeps the node Vitest suite green. (PERF-01)
- Pre-milestone: the 4 review blockers (B1–B4) were fixed via quick tasks.

### What Worked
- **Code review caught what tests couldn't.** The Phase 13 execute-time review found a real HIGH bug (a stale `createImageBitmap` rejection clobbering a newer in-flight run) and a genuine EXIF parity bug (the 2000px cap computed on the oriented `bitmap.width` vs the old `naturalWidth`) — both invisible to the passing 178-test suite. Running review on a parity-critical change paid for itself.
- **Reusing established seams** (B2 `currentRunId` abort, B1 error path, Phase 11's banner) made Phase 13 a clean relocation, not a rewrite.
- **Manual UAT for the un-automatable:** responsiveness, bit-identical parity, and the unsupported-browser fallback were driven in a real browser (fallback demonstrated by forcing `OffscreenCanvas` off and confirming the reactive banner).

### What Was Inefficient
- **Milestones were never archived until now** — v2.0 (Phases 1–9) was closed in name only, so the roadmap accumulated all 14 phases and this v2.1 close had to snapshot the full history.
- **Verification debt carried:** Phases 07/08/09 shipped without formal UAT sign-off (`human_needed`), surfaced only at the milestone-close audit.
- **Scope churn:** Phases 10/12/14 were roadmapped then deferred without being planned — carried forward for a rewrite.

### Patterns Established
- **Injectable capability/test seams** for browser APIs absent in the node test env (OffscreenCanvas 2D probe → `__setOffscreenSupportForTest`).
- **Parity-by-construction:** match the removed code's exact inputs (source natural dims) rather than a "close enough" equivalent.

### Key Lessons
- Run `/gsd-code-review` on any change carrying a bit-identical / parity constraint — the test suite will pass regardless.
- Archive milestones as they complete, not in bulk later.

---

## Milestone: v3.0 — Two-Mode Viewport Experience (partial — FORCE-CLOSED at 40%)

**Shipped:** 2026-07-13
**Phases:** 2 of 5 (15–16 shipped; 17/18/19 never built) | **Plans:** 7 | **Requirements:** 8/21

### What Was Built
- **Phase 15 — Trustworthy Pricing & Data Foundation:** removed Prodigi, narrowed the vendor union, guarded `calculateCanvasCost` to `number | null` (no silent $0), added a load-time `normalizeVendor` migration; a canonical integer-cents `engine/money.ts` (epsilon-safe round-half-up, fail-loud) fixed the missing 500 tier and the `$0-as-free` optimizer bug and reconciled the displayed total; a DATA-01 integrity guard ratchets the 5,107-line `DRILL_VARIANTS` table and surfaces unmapped colors. (VENDOR-02, PRICE-01/02/03, DATA-01)
- **Phase 16 — Optimized Supply Plan & Savings:** `minCostBulk` fewest-bags-within-a-locked-overshoot-cap; the shared `planOrderSupply` aggregator (optimized rows + naive baseline + clamped savings, all integer-cents) is now the sole displayed plan; the `optimizeBagsCost` toggle retired; always-on savings headline + a11y "Why these bags?" explainer + isolated print-only Supply Plan Report. (BAG-01/02/03)
- Between-phase quick tasks fixed a prod Web Worker regression (matcher shipped as raw `.ts`) and redesigned the grid-symbol allocation (distinct glyphs first, no digit/combo ambiguity).

### What Worked
- **Correctness-first sequencing held up.** Landing all pricing/data/optimizer correctness (15–16) while the app was still the familiar wizard means the foundation is test-guarded and trustworthy even though the UI reworks never happened — the shipped slice is coherent on its own.
- **The shared `planOrderSupply` aggregator** as the single engine for legend + cart (+ the future order packet) prevents figure divergence by construction.
- **Human-verify checkpoints caught real UX bugs** (16-04 found the expander in the wrong panel and a `window.print()` that printed the canvas grid) before they shipped.

### What Was Inefficient
- **The milestone was closed at 40%.** Only the correctness foundation shipped; the two namesake capabilities (viewport-native wizard, Customer/Artist mode split) and the service-fee/order-packet flow were never built. A milestone named "Two-Mode Viewport Experience" that ships neither the viewport rework nor the modes is a scope/naming mismatch — the correctness work was arguably its own milestone.
- **Force-close semantics:** the honest record required a Known Gaps section and Backlog carry-forward rather than a clean archive.

### Patterns Established
- **Canonical integer-cents money authority** (`engine/money.ts`) — all pricing routes through one epsilon-safe, fail-loud helper; no floats in money math.
- **One shared plan aggregator** feeding every surface, so displayed numbers can't diverge.

### Key Lessons
- Size milestones so the namesake scope is achievable, or the correctness foundation and the UI rework it enables belong in separate milestones.
- When force-closing partial, record gaps explicitly (Known Gaps + Backlog + Deferred Items) so the next milestone can pick them up cleanly.

---

## Cross-Milestone Trends

| Milestone | Phases (active) | Shipped | Notable |
|-----------|-----------------|---------|---------|
| v2.0 | 1–9 | 2026-07-07 → 07-10 | Full product build; UAT sign-off deferred on Phases 7–9 |
| v2.1 | 11, 13 (10/12/14 deferred) | 2026-07-12 | Post-review hardening; review caught 2 real bugs the tests missed |
| v3.0 | 15, 16 (17/18/19 never built) | 2026-07-13 | Force-closed at 40%: correctness foundation only; headline viewport/mode scope carried to Backlog |
