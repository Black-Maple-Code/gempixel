---
phase: 08
slug: canvas-export-vendor-integration
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-10
---

# Phase 08 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts |
| **Quick run command** | `npx vitest run src/engine/__tests__/checkout.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit` or target vitest commands (e.g., `npx vitest run src/engine/__tests__/checkout.test.ts` or `npx vitest run src/engine/__tests__/export.test.ts`)
- **After every plan wave:** Run `npm test`
- **Before /gsd-verify-work:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | VENDOR-01 | — | N/A | unit | `npx tsc --noEmit` | ✅ W1 | ⬜ pending |
| 08-01-02 | 01 | 1 | VENDOR-01, EXPORT-02 | — | N/A | manual | `npx tsc --noEmit` | ✅ W1 | ⬜ pending |
| 08-01-03 | 01 | 1 | VENDOR-01 | — | N/A | unit | `npx vitest run src/engine/__tests__/checkout.test.ts` | ✅ W1 | ⬜ pending |
| 08-02-01 | 02 | 2 | EXPORT-01 | — | N/A | unit | `npx tsc --noEmit` | ✅ W2 | ⬜ pending |
| 08-02-02 | 02 | 2 | EXPORT-01 | — | N/A | manual | `npx tsc --noEmit` | ✅ W2 | ⬜ pending |
| 08-02-03 | 02 | 2 | EXPORT-01 | — | N/A | manual | `npx tsc --noEmit` | ✅ W2 | ⬜ pending |
| 08-02-04 | 02 | 2 | EXPORT-01 | — | N/A | unit | `npx vitest run src/engine/__tests__/export.test.ts` | ✅ W2 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Multi-Vendor Cost Selection | VENDOR-01 | Requires interaction with dropdown and verifying layout updates | Change "Canvas Print Partner" dropdown from Lumaprints to Prodigi and then FinerWorks. Confirm that base price matches standard pricing table, shipping changes to the respective rate, and total cost recalculates correctly. |
| Sizing Advice Render | EXPORT-02 | Visual validation of units and calculations based on UI panel selections | Toggle layout modes and check sizing advice text. For combined canvas sheet mode, ensure X matches 14 cells (grid unit), 1.4 inches (inch unit), or 3.56 cm (cm unit). For separate canvas mode, verify it advises ordering exact size. |
| PNG Canvas Exports | EXPORT-01 | Image compilation quality and download trigger check | Click "Download Canvas Grid (PNG)". Open download and check for borderless sharp cells and symbols. Click "Download Combined Canvas Sheet (PNG)". Open download and confirm left/right margins are present, guidelines are dashed, and height fits legend list completely. |
| Home Printer Legend print | EXPORT-01 | Requires visual check of browser print overlay layout | Click "Print Legend Sheet (Paper)". Confirm browser print preview displays portrait checklist sheet. Verify that the main app, sidebar, and canvas are hidden, colors appear on swatches, and spacing is optimized. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-10
