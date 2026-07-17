---
id: 260717-fxo
title: "Remove BEST tag, fix save/reload re-upload, custom-size units, shift preset sizes"
status: complete
mode: quick
branch: claude/gsd-ui-phase-20-70b245
commits:
  - 95b2694  # projectStore: persist image
  - cbeca73  # app: presets/seeds, save-reload rehydrate, unit selector
  - 4ac20cf  # tests
---

# Quick Task 260717-fxo — SUMMARY

All four items done; 393 tests pass, tsc clean; verified live.

## 1. Removed "Best" from sizing
Dropped `tag: 'BEST'` from the Medium preset; `DEFAULT_REFINE_PRESET` is now
`REFINE_SIZE_PRESETS[1]` directly (no tag lookup). No card shows a BEST badge.

## 2. Save/reload no longer needs a re-upload  ← the important fix
Projects previously persisted only `gridData` + a thumbnail, so `loadProject` set
`image = null`; the restored grid displayed but any recompute (resize/reduce) hit
the ME-01 imageless guard → "Re-upload the source image."
- `projectStore.ts`: added optional `imageDataUrl` + `imageToStorableDataUrl()`
  (downscaled JPEG, longest edge ≤1600px, ~37KB for the test image).
- `handleSaveProject` persists it; `loadProject` rehydrates an `Image` and
  `setImage()` on decode. The restored grid stays (no re-match fires), the image
  becomes available for recompute, and the new image identity auto-advances to
  Refine. Legacy blobs without `imageDataUrl` behave exactly as before.
- **Verified live:** saved a project → reloaded the page → reselected it → landed on
  Refine with the canvas restored, NO re-upload prompt, and clicking the Large card
  recomputed cleanly (no prompt).

## 3. Swappable custom-size units (grid / inch / cm)
The unit conversion + display-sync effect already existed; only the UI was missing.
Added a units `<select>` (`#refine-unit`) to the RefineScreen custom-size entry and
wired `unit` + `onUnitChange = setUnit`. **Verified:** grid 110×73 → inch 11×7.3 →
cm 27.5×18.25 → back to grid 110×73.

## 4. Preset sizes shifted up + higher-res XL
`REFINE_SIZE_PRESETS` now: Small 80×53 (4,240), Medium 110×73 (8,030), Large
140×93 (13,020), Extra large 190×127 (24,130 — higher res than the old 140×93 XL).
Pre-upload seed + default are Medium (110×73) for consistency.

## Tests
Retargeted preset/default dim assertions (App size-preset, integration
portrait/exact-3:2/size-card, custom-size seed); added a RefineScreen test for the
units selector; refreshed a stale "unit switcher removed" note.

## Notes
- Image is stored in **localStorage** as a downscaled JPEG — client-side only (never
  uploaded), consistent with the privacy model. Quota is still surfaced on save
  (existing B3 handling); a very large library of image-bearing projects could hit
  the localStorage ceiling — a future IndexedDB move would raise that ceiling.
