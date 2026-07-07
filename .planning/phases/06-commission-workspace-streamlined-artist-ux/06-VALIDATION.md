---
phase: 06
slug: commission-workspace-streamlined-artist-ux
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-07
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts |
| **Quick run command** | `npx vitest run src/__tests__/App.test.tsx` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit` or `npx vitest run src/__tests__/App.test.tsx`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | ARTIST-01 | — | N/A | unit | `npx tsc --noEmit` | ✅ W1 | ⬜ pending |
| 06-01-02 | 01 | 1 | ARTIST-01 | — | N/A | manual | `npx tsc --noEmit` | ✅ W1 | ⬜ pending |
| 06-01-03 | 01 | 1 | ARTIST-01 | — | N/A | manual | `npx tsc --noEmit` | ✅ W1 | ⬜ pending |
| 06-01-04 | 01 | 1 | ARTIST-01 | — | N/A | unit | `npx vitest run src/__tests__/App.test.tsx` | ✅ W1 | ⬜ pending |
| 06-02-01 | 02 | 2 | ARTIST-02 | — | N/A | manual | `npx tsc --noEmit` | ✅ W2 | ⬜ pending |
| 06-02-02 | 02 | 2 | ARTIST-02 | — | N/A | manual | `npx tsc --noEmit` | ✅ W2 | ⬜ pending |
| 06-02-03 | 02 | 2 | ARTIST-02 | — | N/A | unit | `npx tsc --noEmit` | ✅ W2 | ⬜ pending |
| 06-02-04 | 02 | 2 | ARTIST-02 | — | N/A | unit | `npx vitest run src/__tests__/App.test.tsx` | ✅ W2 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Portfolio Loading / Project Switching | ARTIST-01 | Requires visual confirmation of layout redraw | Save a project under client "A", edit size, load "A", and confirm layout returns to saved size. |
| Modal Save Dialog Overlay | ARTIST-01 | Requires interaction with input text and backdrop | Click "Save Current Commission", assert dialog centers with glassmorphism backdrop, type name, and hit Save. |
| Progress Wizard Steps Track | ARTIST-02 | Requires CSS visual flow checking | Switch steps and confirm active step markers light up and show connector lines. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-07
