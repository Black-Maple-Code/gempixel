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

## Cross-Milestone Trends

| Milestone | Phases (active) | Shipped | Notable |
|-----------|-----------------|---------|---------|
| v2.0 | 1–9 | 2026-07-07 → 07-10 | Full product build; UAT sign-off deferred on Phases 7–9 |
| v2.1 | 11, 13 (10/12/14 deferred) | 2026-07-12 | Post-review hardening; review caught 2 real bugs the tests missed |
