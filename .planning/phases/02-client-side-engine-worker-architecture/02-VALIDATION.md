---
phase: 02
slug: client-side-engine-worker-architecture
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-07
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts |
| **Quick run command** | `npx vitest run src/engine/__tests__/ingest.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/engine/__tests__/ingest.test.ts` or `npx vitest run src/engine/__tests__/worker.test.ts` (depending on the task scope)
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | INGEST-01, INGEST-02, INGEST-03, INGEST-04 | — | N/A | unit | `npx vitest run src/engine/__tests__/ingest.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | ENGINE-03, ENGINE-04 | — | N/A | unit | `npx vitest run src/engine/__tests__/worker.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/engine/__tests__/ingest.test.ts` — stubs for loading and downscaling assertions
- [ ] `src/engine/__tests__/worker.test.ts` — stubs for worker messaging assertions

---

## Manual-Only Verifications

- File Loader drag-and-drop / file input testing (browser-dependent). Verified programmatically using mock File lists in JSDOM, and manually during UAT.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
