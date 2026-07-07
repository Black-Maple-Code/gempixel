---
phase: 05
slug: supply-partnerships-checkout-integration
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-07
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts |
| **Quick run command** | `npm test src/engine/__tests__/checkout.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test src/engine/__tests__/checkout.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | PARTNER-01 | — | N/A | unit | `npm test src/engine/__tests__/checkout.test.ts` | ✅ W1 | ⬜ pending |
| 05-01-02 | 01 | 1 | PARTNER-01 | — | N/A | manual | — | ✅ W1 | ⬜ pending |
| 05-01-03 | 01 | 1 | PARTNER-01 | — | N/A | unit | `npm test src/engine/__tests__/checkout.test.ts` | ✅ W1 | ⬜ pending |
| 05-02-01 | 02 | 2 | PARTNER-02 | — | N/A | unit | `npm test src/engine/__tests__/checkout.test.ts` | ✅ W2 | ⬜ pending |
| 05-02-02 | 02 | 2 | PARTNER-02 | — | N/A | unit | `npm test src/engine/__tests__/checkout.test.ts` | ✅ W2 | ⬜ pending |
| 05-02-03 | 02 | 2 | PARTNER-02 | — | N/A | manual | — | ✅ W2 | ⬜ pending |
| 05-02-04 | 02 | 2 | PARTNER-02 | — | N/A | unit | `npm test src/engine/__tests__/checkout.test.ts` | ✅ W2 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Canvas Redirect URL Prefills | PARTNER-01 | Requires browser redirect checking | Run `npm run dev`, upload image, click 'Order Custom Sized Canvas' button, and verify query parameters. |
| Diamond Drills USA Checkout Cart URL | PARTNER-02 | Requires cart page display verification | Run `npm run dev`, upload image, click 'Order Drills from Diamond Drills USA' button, and verify variant ids. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-07
