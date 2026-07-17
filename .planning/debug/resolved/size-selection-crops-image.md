---
slug: size-selection-crops-image
status: resolved
trigger: "After uploading a picture and selecting a canvas size on the REFINE step, the software crops the uploaded image to a different size/aspect ratio instead of preserving the full original picture."
created: 2026-07-17
updated: 2026-07-17T03:00:00Z
---

# Debug Session: size-selection-crops-image

## Symptoms

DATA_START
- **Expected behavior:** Selecting a canvas size should map the *whole* uploaded picture to the grid without cropping away parts of the image (or the intended behavior is one of: (a) derive grid dimensions from the image's own aspect ratio, (b) letterbox/fit the full image without cropping, or (c) surface an explicit crop control — to be decided as part of the fix). The user's complaint is that content is silently lost.
- **Actual behavior:** After upload + size selection, the preview grid shows a cropped/altered version of the source image rather than the full picture. The image is resized/cropped to a different aspect ratio than the original.
- **Error messages:** None reported (silent visual/data behavior, not a crash or console error).
- **Timeline:** Present on the current REFINE-step size-selection flow (post Phase 23–26 wizard). Reported as a still-open issue.
- **Reproduction:** Upload any photo whose aspect ratio does not exactly match a size preset, then pick a size (Small 60×40, Medium 80×53, Large 110×73, Extra large 140×93, or a Custom size). The preview shows the image cropped to fit the grid's aspect ratio.
DATA_END

## Investigation Scope (hypothesis to test, not confirmed)

DATA_START
The size presets impose a fixed grid aspect ratio (~3:2) that does not match the uploaded image's aspect ratio, so the ingest/downscale path crops or letterboxes the source to fit the grid. Trace the full path:

  size selection (onSelectSize / handleRecomputeMatch / scheduleCustomRecompute in src/App.tsx)
    → matchInputs (cols/rows chosen)
    → ingest downscale (src/engine/ingest.ts — image load + Box-Sampling downscale)
    → matchResult grid (src/engine/color.ts)
    → RefineScreen preview render (src/features/screens/)

Find exactly where aspect ratio is lost / the image is cropped, and why. Candidate root causes to confirm or eliminate:
- Preset cols×rows have a fixed ratio; downscale draws the source into that ratio with a cover/crop (drawImage source-rect crop) instead of contain/fit.
- cols/rows derived independent of the image's native aspect ratio.
- Box-Sampling step assumes matching aspect ratios.

Relevant files: src/engine/ingest.ts, src/App.tsx (size selection + matchInputs), src/features/screens/ (RefineScreen size cards), src/engine/color.ts.
DATA_END

## Current Focus

- hypothesis: CONFIRMED — Size presets hardcode a fixed ~3:2 grid aspect ratio; selecting one sets cols/rows directly (no image-AR adjustment), then the downscale (`calculateCropBounds`, Cover/Crop) center-crops the source image to that 3:2 ratio. Any non-3:2 photo silently loses content. The custom-size path already preserves the image AR, so the presets contradict the app's own intent.
- next_action: FIX APPLIED + SELF-VERIFIED. `aspectAwareGrid` added to src/App.tsx; `refineSizePresets` now derives AR-adjusted cols/rows/inches/drill count from the loaded image; onSelectSize commits AR-correct dims so the ingest Cover/Crop is a no-op. `npx tsc --noEmit` clean; full Vitest suite 390/390 pass incl. 5 new no-crop/byte-identical/bug-reproduction tests. Remaining gates owned by the session manager: typescript-expert specialist review + the user's real-browser confirmation. Do NOT re-open unless a NEW product decision or a failed human/specialist check comes back.

- reasoning_checkpoint:
    hypothesis: "Clicking a REFINE size preset forces fixed ~3:2 cols/rows (onSelectSize commits preset dims verbatim), then calculateCropBounds center-crops the source to that 3:2 grid — so any non-3:2 photo loses content. Deriving preset cols/rows from the loaded image's aspect ratio (budget on the LONG axis) makes the crop a no-op."
    confirming_evidence:
      - "onSelectSize (App.tsx ~1320) sets cols=c/rows=r directly from the preset; no reference to image.naturalWidth/naturalHeight (Evidence entry 3)."
      - "calculateCropBounds (ingest.ts 42-68) is an explicit Cover/Crop to arTarget = cols/rows; boxSampleImage only samples the cropped region (Evidence entries 1-2)."
      - "handleWidthChange/handleHeightChange (App.tsx 821-897) already derive the dependent axis from image AR and produce no crop — the presets are the lone violator (Evidence entry 4)."
      - "loadImageFile (App.tsx 953-970) already AR-adjusts rows on upload, so the INITIAL match is uncropped; only the preset click re-introduces the crop — confirms the defect is isolated to the preset path."
    falsification_test: "Compute aspectAwareGrid(80,53,imageW,imageH) for a 2:3 portrait (1000x1500) → if cols/rows AR (cols/rows) does not match the image AR (≈0.667) within integer rounding, the fix fails. For a 3:2 image it must return exactly {80,53} (byte-identical guarantee) or the fix regresses existing behavior."
    fix_rationale: "Choosing AR-correct cols/rows UPSTREAM makes calculateCropBounds' crop rect equal the full source (offsets ≈0), addressing the root cause (wrong grid AR) rather than the symptom (the crop math, which is correct and shared with the custom path). Reuses the exact Math.max(1, round(long/ar)) derivation the custom handlers already use."
    blind_spots: "Integer grid quantization still yields a sub-pixel (<1%) crop when image AR can't be expressed as an exact integer ratio — identical to the custom-size path, and far below the ~56% crop the bug caused. The default post-upload state (cols=80, rows=round(80/ar)) maps the budget to WIDTH, so a portrait's default highlight won't land on a preset card until clicked; this matches current behavior (no regression) and is out of scope for this fix."

## Evidence

- timestamp: 2026-07-17T02:00:00Z
  checked: src/engine/ingest.ts calculateCropBounds() + boxSampleImage()
  found: calculateCropBounds is an explicit "Cover/Crop" — given src W/H and target cols/rows it computes a centered crop rect matching the TARGET aspect ratio (arTarget = cols/rows), discarding the overflowing axis. boxSampleImage feeds this crop rect into area-averaging, so the sampled grid only covers the cropped region.
  implication: The engine deliberately crops the source to the grid AR. Whole-image preservation is impossible whenever image AR != grid AR.

- timestamp: 2026-07-17T02:00:00Z
  checked: src/engine/matcher.worker.ts (match handler)
  found: The worker decodes the bitmap, caps dims, then calls boxSampleImage(pixels, w, h, cols, rows) with the client-supplied cols/rows verbatim. No AR reconciliation — it trusts the caller's cols/rows.
  implication: cols/rows chosen on the main thread fully determine the crop. Root cause is upstream, in how cols/rows are chosen.

- timestamp: 2026-07-17T02:00:00Z
  checked: src/App.tsx REFINE_SIZE_PRESETS (lines 90-95) + onSelectSize (lines 1320-1331)
  found: Presets are fixed grid dims — Small 60×40, Medium 80×53, Large 110×73, Extra large 140×93 — all ratio ≈1.50 (3:2). onSelectSize sets cols=c, rows=r directly and fires handleRecomputeMatch(c, r). No reference to image.naturalWidth/naturalHeight; the image's own aspect ratio is never consulted.
  implication: Clicking any preset forces a 3:2 grid regardless of the photo, guaranteeing a crop for any non-3:2 image. This is the direct trigger of the reported symptom.

- timestamp: 2026-07-17T02:00:00Z
  checked: src/App.tsx handleWidthChange (821-858) + handleHeightChange (860-897)
  found: The custom-size handlers DO preserve AR — when a width is typed they compute the height from `ar = image.naturalWidth / image.naturalHeight` (and vice-versa), with explicit comments "Auto-adjust height if image is loaded to maintain aspect ratio."
  implication: The app's established intent is to preserve the image's aspect ratio. The presets violate this intent — confirming the presets (not the engine crop per se) are the defect surface. A consistent fix makes preset selection AR-aware like the custom path.

## Eliminated

(none yet — hypothesis confirmed on first pass; no competing hypotheses required investigation)

## Resolution

root_cause: |
  Size presets (REFINE_SIZE_PRESETS in src/App.tsx) hardcode a fixed ~3:2 grid aspect
  ratio. onSelectSize() (src/App.tsx ~1320) commits those cols/rows verbatim and fires the
  worker recompute WITHOUT consulting the uploaded image's aspect ratio. The downscale path
  (boxSampleImage → calculateCropBounds in src/engine/ingest.ts) is a "Cover/Crop": it
  center-crops the source image to the target grid's aspect ratio. So selecting any preset
  forces a 3:2 grid and silently crops away the parts of a non-3:2 photo. The custom-size
  handlers already preserve the image's aspect ratio (deriving the dependent axis from
  image.naturalWidth/naturalHeight), so the presets contradict the app's own intent — they
  are the defect surface.
fix: |
  Option A (AR-aware presets), applied in src/App.tsx.
  1. New pure, exported helper `aspectAwareGrid(presetCols, presetRows, imageWidth,
     imageHeight)` (added next to REFINE_SIZE_PRESETS). It treats each preset as a
     size/detail TIER: the drill budget is `max(cols, rows)` on the LONG axis. That budget
     is mapped onto the IMAGE's own long axis and the short axis is derived from the image
     aspect ratio via the exact `Math.max(1, Math.round(long / ar))` derivation the
     custom-size handlers (handleWidthChange/handleHeightChange) already use. Landscape/
     square → cols carries the budget; portrait → rows carries it (a tall canvas). A
     degenerate/zero-height image falls back to the raw preset (defensive).
  2. `refineSizePresets` (the props App feeds RefineScreen) now runs each preset through
     `aspectAwareGrid` when an image is loaded, and derives the card's grid dims, inch
     string (gridToInches/formatInches) and drill count from the AR-adjusted cols/rows — so
     the card labels no longer lie and the `selected` highlight (RefineScreen compares live
     cols/rows === preset cols/rows) tracks the adjusted size. onSelectSize commits those
     same adjusted dims, so handleRecomputeMatch fires the worker with AR-correct cols/rows.
  The ingest crop engine (calculateCropBounds / boxSampleImage) is UNCHANGED: choosing
  AR-correct cols/rows upstream makes its Cover/Crop a no-op (offsets ≈ 0). Custom-size path
  untouched. RefineScreen.tsx untouched (it was already pure/props-only). One-tap, no new
  crop UI.
verification: |
  - `npx tsc --noEmit` → clean (no errors).
  - Full Vitest suite → 36 files / 390 tests pass, zero regressions. Relevant suites
    confirmed green: ingest (8), worker (5), RefineScreen (10), useDiamondArtMatch (9),
    App (29, incl. 5 NEW aspectAwareGrid tests).
  - New focused tests in src/__tests__/App.test.tsx (describe "aspectAwareGrid — AR-aware
    presets eliminate the size-selection crop") prove the fix end-to-end by feeding
    aspectAwareGrid's output into calculateCropBounds:
      * 3:2 landscape (3000×2000) → every preset returns its ORIGINAL dims byte-for-byte
        (Small 60×40 … XL 140×93) — no regression to the existing match guarantee.
      * 2:3 portrait (1000×1500) + Medium → 53×80 (budget 80 on the vertical long axis);
        a genuinely TALL canvas; calculateCropBounds keeps > 98% of both axes (crop is a
        no-op up to sub-pixel integer quantization).
      * BUG REPRODUCTION test: the OLD fixed 80×53 preset on the same portrait crops
        cropHeight to < 50% of the source — the ~56% content loss the fix removes.
      * 1:1, 16:9, 3:4, 9:16 across all four budgets → long-axis budget preserved and
        > 98% of the image kept in every case.
      * Degenerate image (height 0) → falls back to the raw preset.
  - Trace: onSelectSize → cols/rows now follow image AR → boxSampleImage's
    calculateCropBounds offsets ≈ 0 → whole image sampled → no crop, for any AR.
  - LIVE BROWSER VERIFICATION (orchestrator, 2026-07-17): started dev server, injected a
    2:3 portrait (1000×1500) with a white marker band on the top edge and a black marker
    band on the bottom edge. After upload, the preset cards relabeled to portrait dims
    (Small 40×60, Medium 53×80, Large 73×110, XL 93×140 — drill budgets preserved on the
    long axis). Tapped Medium; read the rendered CanvasViewer pixels: the white top-band
    (Y≈22–50) AND the black bottom-band (Y≈549–577 of 600) are BOTH present ⇒ the full
    top-to-bottom image is mapped, no vertical crop. Under the old bug the 3:2 center-crop
    would have discarded both bands. Confirms the fix in the real app, not just unit math.
  Status: RESOLVED (both automated + live-browser gates green; user approved commit+archive).
files_changed:
  - src/App.tsx (add aspectAwareGrid helper; refineSizePresets derives AR-adjusted dims/inches/drill count)
  - src/__tests__/App.test.tsx (add 5 focused aspectAwareGrid no-crop / byte-identical / bug-reproduction tests; import aspectAwareGrid + calculateCropBounds)

## Specialist Review

- reviewer: typescript-expert equivalent (TypeScript/Preact focus; the named typescript-expert
  skill is not installed in this environment, so an equivalent focused code review was run
  against the actual diff).
- verdict: LOOKS_GOOD
- summary: AR math is correct and fully guarded (Number.isFinite catches NaN/Infinity/0/0
  before the ar<=0 clause; Math.max(1, …) clamps both derived axes so extreme ARs never
  collapse to a 0-dim grid). Byte-identical guarantee verified for ALL four presets at
  ar=1.5 (Small→60×40, Medium→80×53, Large→110×73, XL→140×93). Typing is explicit, the pure
  exported helper is testable, and the selected-highlight equality invariant is internally
  consistent (refineSizePresets exposes AR-adjusted cols/rows, RefineScreen compares against
  those same values, onSelectSize commits them).
- non-blocking notes (follow-ups, NOT part of this fix):
  1. "Crop no-op" is approximate, not exact — longBudget/round(longBudget/ar) equals ar only
     up to rounding, so a sub-pixel residual crop can remain for non-3:2 images. Tests
     correctly assert >98% rather than 100%, so this is acknowledged, not a gap.
  2. Semantic mismatch with the image-load auto-adjust (App ~990-1006): on load, that path
     anchors the WIDTH budget (cols fixed, rows grows → portrait 2:3 becomes 80×120),
     whereas the presets anchor the LONG-AXIS budget (Medium portrait → 53×80). Both are
     crop-free (the user's chosen behavior), but the initial post-load grid matches no
     preset card until the user taps one. Pre-existing UX tension, outside this fix's
     crop scope — logged for awareness, no action taken.
  3. Pure-function tests cover the math thoroughly but do not assert the App↔RefineScreen
     highlight/commit integration invariant; code path is simple, low risk.
