---
phase: 07
slug: symbol-overlay-canvas-margin-legends
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-09
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts |
| **Quick run command** | `npx vitest run src/engine/__tests__/symbols.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit` or `npx vitest run src/engine/__tests__/symbols.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | SYMBOL-01 | — | N/A | unit | `npx tsc --noEmit` | ✅ W1 | ⬜ pending |
| 07-01-02 | 01 | 1 | SYMBOL-02 | — | N/A | manual | `npx tsc --noEmit` | ✅ W1 | ⬜ pending |
| 07-01-03 | 01 | 1 | SYMBOL-01, SYMBOL-02 | — | N/A | unit | `npx vitest run src/engine/__tests__/symbols.test.ts` | ✅ W1 | ⬜ pending |
| 07-02-01 | 02 | 2 | SYMBOL-03 | — | N/A | manual | `npx tsc --noEmit` | ✅ W2 | ⬜ pending |
| 07-02-02 | 02 | 2 | SYMBOL-03 | — | N/A | manual | `npx tsc --noEmit` | ✅ W2 | ⬜ pending |
| 07-02-03 | 02 | 2 | SYMBOL-03 | — | N/A | manual | `npx tsc --noEmit` | ✅ W2 | ⬜ pending |
| 07-02-04 | 02 | 2 | SYMBOL-03 | — | N/A | unit | `npx vitest run src/engine/__tests__/viewer.test.ts` | ✅ W2 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Symbol Contrast Legibility | SYMBOL-02 | Requires visual check of text color against background | Load an image with dark colors (e.g. black, dark blue) and light colors (e.g. white, yellow), switch to Grid + Symbols mode, zoom in, and verify that dark cells render white text and light cells render black text. |
| Viewport Zoom Threshold | SYMBOL-02 | Verification of font readability limits | Zoom out to a low scale (cells < 10px wide) and confirm symbols disappear. Zoom in (cells >= 10px wide) and confirm symbols reappear and center precisely. |
| 3-way Viewport Switching | SYMBOL-03 | Visual confirmation of transition speed and style | Click the "Grid Colors", "Grid + Symbols", and "Original Photo" switcher buttons. Verify that the canvas draws instantly (<1ms) and changes views without re-mounting or lag. |
| Landscape Print Layout and Fold Guidelines | SYMBOL-03 | Print layout is only previewed in browser print dialog | Trigger print (Ctrl+P). In print preview, check that the canvas is automatically centered on an A4 Landscape page, with the DMC checklist divided into left and right columns, and dashed guidelines separating them. Confirm symbols are visible on print. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-09
