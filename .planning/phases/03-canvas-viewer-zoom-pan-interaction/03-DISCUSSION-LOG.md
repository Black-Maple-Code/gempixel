# Phase 3: Canvas Viewer & Zoom/Pan Interaction - Discussion Log

**Date:** 2026-07-07
**Phase:** 03 — Canvas Viewer & Zoom/Pan Interaction
**Areas discussed:** 3/3

## Discussion Summary

### 1. Zoom Centering Behavior

**Options presented:**
1. Zoom centered at Mouse Cursor (recommended)
2. Zoom centered at Canvas Center

**User selected:** Option 1 — Zoom centered at Mouse Cursor

**Notes:** Provides a highly intuitive, CAD/Figma-like navigation experience. Zoom coordinates under the cursor remain anchored during wheel events.

---

### 2. Round Drill Gap Rendering

**Options presented:**
1. Neutral backing color (recommended slate gray `#2D3748`)
2. Transparent background

**User selected:** Option 1 — Neutral backing color

**Notes:** Mimics physical diamond painting canvas backings and guarantees high contrast across all matched colors.

---

### 3. Double-Buffering / Redraw Optimization Strategy

**Options presented:**
1. Offscreen Canvas double-buffering (recommended)
2. Dynamic Redrawing with Viewport Culling

**User selected:** Option 1 — Offscreen Canvas double-buffering

**Notes:** Draws the grid once at high resolution to a background canvas, blitting it during pans for a guaranteed 60 FPS. Wiped and redrawn only on changes to zoom level, resize, toggles, or new match jobs.

---

## Deferred Ideas

None.

## Agent Discretion Items

None — all gray areas user-decided.

---

*Discussion log for Phase 03*
*Recorded: 2026-07-07*
