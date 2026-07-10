# Task: Extract the `projectStore` persistence module

## Description
Move all project + recent-image `localStorage` persistence (serialization, CRUD, quota eviction) out of `App.tsx` into a new `src/engine/projectStore.ts` behind a small CRUD interface. This is the single task for **Step 3 (Candidate 3)** of the GemPixel Architecture Deepening effort. It concentrates storage-shape and quota rules in one place so complexity stops reappearing at every save/load site.

## Background
`App.tsx` currently owns persistence directly (`research/current-state.md` §Candidate 3):
- `~:12` `interface ProjectSummary`, `~:20` `interface ProjectData` (the serialized shape).
- `~:42` `generateUUID()`, `~:49` `generateThumbnail(canvas)`.
- `~:65` `saveProjectToStorage(summary, data)`, `~:87` `loadProjectFromStorage(id): ProjectData | null`, `~:97` `deleteProjectFromStorage(id)` — all `localStorage`, all exported.
- State `projectsRegistry` / `recentImages` / `activeProjectId`, plus a quota-eviction `useEffect` (`~:601`).
- Consumers: `handleSaveProject` (`~:495`), the project load path (`~:421`, calls `loadProjectFromStorage` at `~:422`), and the recents effects. **Also bypass the exported functions entirely today** and must be repointed too: the `projectsRegistry` initial-state read (`~:245-252`, raw `localStorage.getItem('gempixel_workspace_registry')`), the `recentImages` initial-state read (`~:288-293`, raw `localStorage.getItem('gempixel_recent_images')`), the post-save registry reload inside `handleSaveProject` (`~:542-543`, raw `localStorage.getItem('gempixel_workspace_registry')` again instead of using the store), and the delete handler's registry filter (`~:1333-1335`, already calls `deleteProjectFromStorage` but should read the post-delete list from `projectStore.list()` rather than manually filtering local state).

Per design §4 Candidate 3 / R3: expose `projectStore.{list, load, save, remove, recents:{list, push}}` plus `generateUUID` / `generateThumbnail`, with quota eviction **internal** and unit-tested. **Storage keys and the serialized shape must not change** (design §5, §6 C3) — existing saved projects in users' browsers must keep loading. Pure logic lives in `src/engine/`; this module has no Preact/JSX.

## Reference Documentation
**Required:**
- Design: `.agents/planning/2026-07-10-architecture-deepening/design/detailed-design.md` (§4 Candidate 3, §5 Data Models, §6 Error Handling C3)
- Plan: `.agents/planning/2026-07-10-architecture-deepening/implementation/plan.md` (Step 3)
- Rules: `CLAUDE.md`, `.agents/GEMINI.md`

**Additional References (if relevant to this task):**
- `.agents/planning/2026-07-10-architecture-deepening/research/current-state.md` (§Candidate 3 anchors; §Test inventory — `App.test.tsx` project fixtures)

**Note:** You MUST read design §4 Candidate 3 before implementing. Anchors are pre-drift (Steps 1–2 already edited `App.tsx`) — re-grep `ProjectSummary`, `ProjectData`, `generateUUID`, `generateThumbnail`, `saveProjectToStorage`, `loadProjectFromStorage`, `deleteProjectFromStorage`, `projectsRegistry`, `recentImages`, and the `handleSaveProject` / load-path consumers before moving anything.

## Technical Requirements
1. Create `src/engine/projectStore.ts` exporting (design §4 Candidate 3):
   - `interface ProjectSummary` and `interface ProjectData` — moved **verbatim** from `App.tsx` (no shape change).
   - `const projectStore = { list(): ProjectSummary[]; load(id): ProjectData | null; save(summary, data): void; remove(id): void; recents: { list(): RecentImage[]; push(item: RecentImage): void } }`.
   - `generateUUID(): string`, `generateThumbnail(canvas: HTMLCanvasElement): string`.
   - **`RecentImage` does not exist as a named type anywhere in the codebase today** (confirmed via full-codebase grep) — it is only an inline anonymous object type duplicated at `App.tsx:288` (`useState<{ id, name, dataUrl, width, height }[]>`), the literal built at `~:1008-1014`, and the (slightly narrower, missing `id`) param type at `~:1024`. This module must **newly define** `export interface RecentImage { id: string; name: string; dataUrl: string; width: number; height: number }` from that shape — there is nothing pre-existing to "locate" or "re-export".
2. Move all `localStorage` keys, JSON serialization, and quota-eviction logic into the module. `save` and `recents.push` MUST catch `QuotaExceededError` and evict the oldest entry internally, then retry — never throw to the caller. **Note this is only a genuine relocation for `recents`** (the `~:601` effect already does this today); `saveProjectToStorage` (`~:65-85`) has **no existing eviction logic** — it only logs and swallows the error — so eviction for `save()`/the registry is new behavior. **The two eviction directions are NOT symmetric**: `recentImages` prepends newest (`[newEntry, ...filtered]`, `~:1016`), so the oldest is the LAST array element and `.pop()` (as in the `~:601` effect) correctly evicts it; the project registry APPENDS newest (`registry.push(summary)`, `~:73`), so the oldest is the FIRST array element (index 0) — `save()`'s eviction must `shift()`/remove index 0, not `.pop()`, or it will silently delete the user's newest project instead of the oldest.
3. Preserve exact storage keys and serialized JSON shape (design §5). Re-grep the current key strings and reuse them verbatim so already-saved projects and recents keep loading. Confirmed current keys: `'gempixel_workspace_registry'`, `` `gempixel_project_${id}` ``, `'gempixel_recent_images'`.
4. Repoint every `App.tsx` caller to `projectStore.*` / the exported helpers: `handleSaveProject` (`~:495`), the load path (`~:421`, `loadProjectFromStorage` call at `~:422`), the recents effects, **and the four raw-`localStorage` bypass sites listed in Background** (`projectsRegistry` init `~:245-252`, `recentImages` init `~:288-293`, post-save reload `~:542-543`, delete-handler registry filter `~:1333-1335`) — otherwise the extraction leaves storage-key/shape logic duplicated in `App.tsx`, defeating the task's own goal. `load` returns `null` on missing/corrupt JSON (preserve the existing `try/catch`).

## Dependencies
- Browser `localStorage` (native; no new deps — design §8A).
- `src/engine/types.ts` for any shared types referenced by `ProjectSummary`/`ProjectData` (neither currently references anything from `types.ts`, which only holds `LabCoordinates`/`DmcColor` — no change needed there). `RecentImage` is **not** an existing type to relocate — it must be newly authored in `projectStore.ts` from the inline shape used at `App.tsx:288`/`~:1008-1014`/`~:1024` (see Technical Requirements #1).
- `src/__tests__/App.test.tsx` (project fixtures) — must stay green after callers repoint.

## Implementation Approach
1. Re-grep all Candidate 3 anchors and the exact `localStorage` key strings; confirm `RecentImage` has no current named-type home (it's inline-only — see Technical Requirements #1) before authoring it fresh.
2. **Write the failing tests first (TDD, RED→GREEN per behavior):** create `src/engine/__tests__/projectStore.test.ts`. **The first line of the file MUST be `// @vitest-environment jsdom`** — `vite.config.ts` sets the default Vitest `environment` to `'node'` (confirmed: `typeof localStorage === 'undefined'` under plain Node), which has no global `localStorage`, so every test here would throw `ReferenceError: localStorage is not defined` without this pragma. This matches the existing convention in `src/__tests__/App.test.tsx:1` and `src/__tests__/integration.test.tsx:1`, which both open with the same pragma. Then, one behavior at a time:
   - save → list → load round-trip returns the same `ProjectData`.
   - `remove(id)` deletes it from `list()` and makes `load(id)` return `null`.
   - `recents.push` FIFO ordering / cap.
   - quota eviction: stub `localStorage.setItem` to throw `QuotaExceededError` once, assert the oldest entry is evicted and the save then succeeds.
3. Move the interfaces, `generateUUID`/`generateThumbnail`, the three storage functions, and the quota-eviction logic into `projectStore.ts`; wrap them in the `projectStore` object shape from the design.
4. Repoint `App.tsx` consumers; delete the now-dead locals and the `~:601` effect (its logic now lives in `save`/`recents.push`). Do **not** mirror store data into new local state beyond the existing `projectsRegistry`/`recentImages`/`activeProjectId` React state that drives rendering.
5. **Guardrail:** because quota eviction moved from an effect into the store methods, verify the eviction still fires on the same triggers (a save that exceeds quota) — the store, not a React effect, now owns it. Keep `activeProjectId` and registry-in-state semantics identical so the drawer UI is unchanged. **Also verify `save()`'s eviction removes registry index 0 (oldest, since projects are appended), not the last element** — copying the `recents` `.pop()` pattern verbatim would evict the newest project instead (see Technical Requirements #2).
6. **Verify gate (Cardinal Rule 4):** `npx tsc --noEmit` && `npm test` (all green, ≥99 incl. new file) && `npm run build`. Commit only when green: `refactor(persistence): extract projectStore from App`.

## Acceptance Criteria

1. **Round-trip persistence**
   - Given a `ProjectSummary` + `ProjectData`
   - When `projectStore.save(...)` then `projectStore.list()` / `projectStore.load(id)` run
   - Then the project appears in `list()` and `load(id)` returns the same data (same keys, same shape).

2. **Delete**
   - Given a saved project
   - When `projectStore.remove(id)` runs
   - Then it is absent from `list()` and `load(id)` returns `null`.

3. **Recents FIFO + quota eviction**
   - Given a `localStorage` stubbed to throw `QuotaExceededError` on the next write
   - When `projectStore.save(...)` / `recents.push(...)` runs
   - Then the oldest entry is evicted internally, the write succeeds, and no error propagates to the caller.

4. **Storage compatibility preserved**
   - Given a project serialized under the pre-refactor keys/shape
   - When the app loads it via `projectStore.load(...)`
   - Then it deserializes correctly (keys and JSON shape unchanged).

5. **App repointed, suite green**
   - Given `App.tsx` after repointing
   - When `npx tsc --noEmit`, `npm test` (≥99, incl. `App.test.tsx` fixtures + new `projectStore.test.ts`), `npm run build` run
   - Then all pass; save a project, reload the page, reopen from the drawer — it restores; recents still cap and evict oldest.

## Metadata
- **Complexity**: Medium
- **Labels**: engine, persistence, localStorage, candidate-3
- **Required Skills**: TypeScript, Vitest (localStorage stubbing), browser storage / quota handling
