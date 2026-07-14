---
phase: 23-the-four-screens-in-flow-order
reviewed: 2026-07-14T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/features/screens/flags.ts
  - src/features/screens/UploadScreen.tsx
  - src/features/screens/RefineScreen.tsx
  - src/features/screens/SuppliesScreen.tsx
  - src/features/screens/OrderScreen.tsx
  - src/features/screens/orderPacket.ts
  - src/App.tsx
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: resolved
resolved_at: 2026-07-14T00:00:00Z
resolution:
  CR-01: fixed — onDeleteProject prop wires Remove to projectStore.remove (commit 1682811)
  WR-01: fixed — loadProject + resetWorkspace reset finish/shipTo/packetDownloaded (commit b620354)
  WR-02: fixed — color slider gated below 9 detected colors; clamp hardened (commit f576b74)
  IN-01: fixed — dead UploadScreen props removed (commit ec99363)
---

# Phase 23: Code Review Report

**Reviewed:** 2026-07-14
**Depth:** standard
**Files Reviewed:** 7
**Status:** resolved (all 4 findings fixed 2026-07-14; `tsc --noEmit` clean, full Vitest suite green — 352 passed / 12 pre-existing skips)

## Summary

Reviewed the Phase 23 diff wiring four pure/props-only customer screens (Upload · Refine · Supplies · Order) into the state-owning App.tsx behind the four strangler flags (all now `true`).

The load-bearing seams are sound:
- **Two-tier Refine reactivity is correct.** Size selection (`onSelectSize`) sets live `cols`/`rows` only; the worker keys on committed `matchInputs`, so card clicks never re-fire the worker (verified `useDiamondArtMatch` inputs use `matchInputs.*`). Edge-cleanup and the color slider drive only the hook's post-process memo (`enableSmoothing`/`smoothingStrength`/`enableReduce`/`targetColorCount`) — no worker re-fire. The color slider correctly uses the live `onInput` path (`Slider` fires `onInput` per tick) and `max={detectedColorCount}` (raw-keyed, stable under drag), so the thumb does not jump.
- **Single-source quote holds.** Supplies and Order both render the one `buildOrderQuote(...)` result (`orderQuote`); neither screen does local cents summation. Totals cannot diverge by construction.
- **Order honesty + privacy hold.** `handleDownloadOrderPacket` performs a Blob download only — no `fetch`/XHR/`sendBeacon`. Ship-to is embedded in the packet and never transmitted. `buildOrderPacket` is pure/versioned/self-contained. No receipt/order-number/payment UI. No `dangerouslySetInnerHTML`; user strings (ship-to, filename via CSPRNG `packetId`) render/serialize inertly with Preact escaping.

One functional wiring defect (BLOCKER) and two robustness/state-leak gaps (WARNING) were found.

## Critical Issues

### CR-01: UploadScreen "Remove" deletes nothing — wired to the wrong list

**File:** `src/features/screens/UploadScreen.tsx:159-171` (call), `src/App.tsx:1657-1659` (wiring)
**Issue:** The new "Recent" section renders **saved projects** (`projectsRegistry`, each `project.id` from `generateUUID()`), but the Remove-confirm "Yes" button calls `props.deleteRecentImage(project.id, e)`. `deleteRecentImage` (App.tsx:1034-1037) filters the unrelated **recent-uploads** list: `setRecentImages(prev => prev.filter(x => x.id !== id))`. A project id never matches a `recentImages` id (different id namespaces), so the filter removes nothing, `projectStore.remove` is never called, and `projectsRegistry` is never refreshed. Result: the confirm flow runs, the chip stays, and the saved project is never deleted — a fully non-functional Remove button. The correct project-delete pattern already exists at App.tsx:1601-1607 (`projectStore.remove(id)` + `setProjectsRegistry(projectStore.list())` + active-project cleanup); UploadScreen was wired to the recent-image handler instead.
**Fix:** Add a dedicated project-delete prop and wire it to the real store call:
```tsx
// UploadScreenProps
onDeleteProject: (id: string) => void;
// ...Yes button:
onClick={(e) => { e.stopPropagation(); setConfirmingId(null); props.onDeleteProject(project.id); }}
```
```tsx
// App.tsx wiring
onDeleteProject={(id) => {
  projectStore.remove(id);
  setProjectsRegistry(projectStore.list());
  if (activeProjectId === id) { setActiveProjectId(null); restore(null); }
}}
```

## Warnings

### WR-01: Order-screen state leaks across project load / reset

**File:** `src/App.tsx:343-405` (`loadProject`), `src/App.tsx:407-437` (`resetWorkspace`)
**Issue:** `finish`, `shipTo`, and `packetDownloaded` are never reset by `loadProject` or `resetWorkspace`. After a user downloads a packet and then loads a different project (whose match is restored, so step 4 is reachable), the Order screen still shows the honest terminal state "Packet downloaded — take this file to your vendor" for a project they never downloaded, and the **previous project's ship-to address stays pre-filled**. This both misleads (false terminal state) and carries one project's client-entered PII into another project's Order form.
**Fix:** In both `loadProject` and `resetWorkspace`, reset the Order state:
```tsx
setFinish('trimmed');
setShipTo({ name: '', addressLine1: '', city: '', state: '', postalCode: '', country: '' });
setPacketDownloaded(false);
```

### WR-02: Refine color slider is degenerate when the image has fewer than 8 colors

**File:** `src/features/screens/RefineScreen.tsx:216-223`
**Issue:** The slider is `min={8}` with `max={detectedColorCount}`. For a low-color or near-monochrome image, `detectedColorCount` can be `< 8` (or `0` in the unmatched/hidden state), making `max < min`. HTML `<input type="range">` clamps `max` up to `min`, so the control collapses to `[8,8]` while the label reads e.g. "2 of 2 matched" with the thumb pinned at the far end — a broken/misleading control. `onColorTargetChange` also clamps to `Math.max(8, Math.min(n, detectedColorCount))`, forcing `targetColorCount = 8 > detectedColorCount` (a nonsensical reduce ceiling above the detected count).
**Fix:** Clamp the effective max (and gate the reduce floor) so `min <= max`, e.g. `max={Math.max(8, detectedColorCount)}`, and skip enabling reduce when `detectedColorCount <= 8` (there is nothing to reduce). Optionally hide the slider entirely below 8 detected colors.

## Info

### IN-01: UploadScreen carries unused props (dead plumbing)

**File:** `src/features/screens/UploadScreen.tsx:25-43` (interface), `src/App.tsx:1644-1660` (wiring)
**Issue:** `image`, `imageName`, `imageFitMode`, `setImageFitMode`, `recentImages`, and `loadRecentImage` are declared on `UploadScreenProps` and passed by App but never read in the component (only `dropZoneRef`, `isDragOver`, the drag/file handlers, `projectsRegistry`, `loadProject`, and `deleteRecentImage` are used). The recent-uploads (drag/drop history) surface was dropped in favor of the saved-projects list; if that is intentional (D-10), the `recentImages`/`loadRecentImage`/fit-mode props are dead and should be removed from the interface and the App wiring to keep the props-only contract honest and prevent confusion with CR-01's mis-wire.
**Fix:** Remove the unused fields from `UploadScreenProps` and drop them from the `<UploadScreen ... />` call site, or actually consume them if a recent-uploads row is still intended.

---

_Reviewed: 2026-07-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
