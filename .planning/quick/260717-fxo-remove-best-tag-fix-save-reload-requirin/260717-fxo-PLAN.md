---
id: 260717-fxo
title: "Remove BEST tag, fix save/reload re-upload, custom-size units, shift preset sizes"
status: complete
mode: quick
branch: claude/gsd-ui-phase-20-70b245
---

# Quick Task 260717-fxo

Four user requests on the Refine sizing + project save/reload. Orchestrator executes
with live browser verification.

1. **Remove "Best" from sizing** — drop the `tag: 'BEST'` from the Medium size preset
   (`REFINE_SIZE_PRESETS`), and stop deriving `DEFAULT_REFINE_PRESET` from the tag.
2. **Save/reload requires re-upload** — a saved project reloaded + selected prompted
   "Re-upload the source image." Root cause: projects persisted `gridData` + a
   thumbnail but NOT the source image, so `loadProject` set `image=null` and any
   recompute hit the ME-01 imageless guard. Fix: persist the source image
   (downscaled JPEG data URL) with the project and rehydrate it on load.
3. **Custom-size unit of measure** — the custom W×H entry had no unit; add a
   swappable grid/inch/cm selector. (The conversion logic + display-sync effect
   already existed — only the UI was missing.)
4. **Shift preset sizes up a tier + higher-res XL** — Small←old Medium, Medium←old
   Large, Large←old XL, XL←new higher resolution.

## Verification
- `npx tsc --noEmit`; full `npx vitest run`.
- Live: Refine shows new sizes + no BEST + Drills labels; units selector converts
  (grid 110×73 → inch 11×7.3 → cm 27.5×18.25); save a project, reload, reselect →
  image restored, lands on Refine, no re-upload prompt, size change recomputes.
