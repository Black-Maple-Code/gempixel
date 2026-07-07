---
phase: 04
slug: supply-planning-customization-exports
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-07
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts |
| **Quick run command** | `npx vitest run src/__tests__/print.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~4 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/__tests__/print.test.tsx` or other test files depending on the task scope.
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | REPORT-01, INGEST-01, INGEST-03, INGEST-04 | — | N/A | unit | `npx vitest run src/__tests__/App.test.tsx` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | PALETTE-03, VIEW-03 | — | N/A | unit | `npx vitest run src/__tests__/integration.test.tsx` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 3 | REPORT-02, REPORT-03 | — | N/A | unit | `npx vitest run src/__tests__/print.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/App.test.tsx` — mocks for client/viewer dashboard state
- [ ] `src/__tests__/integration.test.tsx` — mocks for sub-palette matches triggers
- [ ] `src/__tests__/print.test.tsx` — safety margin checks

---

## Manual-Only Verifications

- Native print layout inspection (visually check PDF output in print preview).
- Tailwind CSS dashboard layout review on mobile device screens.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
