---
phase: 09
slug: viewport-hud-intuitive-navigation
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-10
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts |
| **Quick run command** | `npx vitest run src/__tests__/App.test.tsx` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit` and target vitest command: `npx vitest run src/__tests__/App.test.tsx`
- **After every plan wave:** Run `npm test`
- **Before /gsd-verify-work:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | NAV-02 | — | N/A | unit | `npx tsc --noEmit` | ✅ W1 | ⬜ pending |
| 09-01-02 | 01 | 1 | NAV-02, NAV-03 | — | N/A | manual | `npm run build` | ✅ W1 | ⬜ pending |
| 09-02-01 | 02 | 2 | NAV-01, NAV-03 | — | N/A | unit | `npx tsc --noEmit` | ✅ W2 | ⬜ pending |
| 09-02-02 | 02 | 2 | NAV-02 | — | N/A | unit | `npx tsc --noEmit` | ✅ W2 | ⬜ pending |
| 09-02-03 | 02 | 2 | NAV-01 | — | N/A | unit | `npx vitest run src/__tests__/App.test.tsx` | ✅ W2 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Viewport HUD Overlay controls | NAV-02 | Requires manual click check of floating overlay buttons | Click Grid, Symbols, and Original view mode buttons in the HUD. Click Zoom In (+), Zoom Out (-), and Fit to Screen (⛶) buttons. Confirm canvas updates layout and zoom matches action. |
| Click propagation stop | NAV-02 | Drag panning interaction check | Click and drag starting from the floating HUD overlay container. Confirm that the canvas underneath does not pan or drag. |
| Low zoom warning overlay | NAV-02 | Visual check of zoom threshold rendering | Choose symbols mode. Scroll zoom out until the cell sizes are very small (<10px). Check that the "⚠️ Low Zoom" yellow badge appears on the HUD with its tooltip. Zoom in again and verify it disappears. |
| Sticky footer wizard navigation | NAV-01 | UI interaction and sticky styling validation | Navigate between steps 1 to 4 using Next/Back buttons and step dots. Verify dots reflect completed/active states and sticky footer stays anchored at the bottom when resizing or scrolling the settings sidebar. Confirm the Next button has `id="wizard-next-btn"` and the Back button has `id="wizard-back-btn"`. |
| Collapsible settings panels | NAV-03 | Accordion interaction validation | Expand and collapse "Ingestion Settings" and "Palette Optimization Settings" details tags. Confirm carets rotate and inputs slide/hide correctly. Check that the font size uses `text-[10px]` or `text-sm` (conforming to `09-UI-SPEC.md`). Check that long content is scrollable and doesn't push the footer out of view. |
| Pure CSS hover tooltips | NAV-03 | Layout and tooltips visual check | Hover over settings helper nodes and HUD buttons. Confirm sleek tooltips show up correctly without coordinate shifts or delays. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-10
