# Phase 2: Client-side Engine & Worker Architecture - Discussion Log

**Date:** 2026-07-07
**Phase:** 02 — Client-side Engine & Worker Architecture
**Areas discussed:** 4/4

## Discussion Summary

### 1. Aspect Ratio Fit/Crop Modes

**Options presented:**
1. Fit (contain) — Scale to fit, pad empty cells
2. Crop (cover) — Scale to fill, crop overflow
3. Stretch — Fill exactly, disregard aspect ratio

**User selected:** Option 2 — Crop (cover)

**Notes:** Single mode only. No fit/stretch alternatives. Avoids padding cell complexity entirely.

---

### 2. Downscaling Algorithms

**Options presented:**
1. Bilinear Scaling (Native Canvas drawImage) — Fast, GPU-backed, can blur
2. Nearest Neighbor — Sharp, can skip details
3. Box Sampling (Area Averaging) — Color-accurate, averages all pixels per cell

**User selected:** Option 3 — Box Sampling (recommended by agent)

**Notes:** Agent recommended box sampling for maximum color accuracy in CIEDE2000 matching. User agreed. Canvas drawImage used only for image decode, not downscaling.

---

### 3. Web Worker Communication & Cancellation Strategy

**Options presented:**
1. Single persistent Worker with abort signaling
2. Terminate & respawn on each new job

**User selected:** Option 1 — Single persistent Worker with abort signaling

**Notes:** Avoids worker script re-parse overhead on parameter changes. Abort logic is a simple flag check inside the pixel loop.

---

### 4. RGBA Match Cache Scope

**Options presented:**
1. Cleared per run
2. Persisted across runs, invalidated on palette change

**User selected:** Option 2 — Persisted, invalidated on palette change

**Notes:** Optimizes the common workflow of trying different canvas sizes on the same image. Only palette changes invalidate cached matches.

---

## Deferred Ideas

None.

## Agent Discretion Items

None — all gray areas were user-decided.

---

*Discussion log for Phase 02*
*Recorded: 2026-07-07*
