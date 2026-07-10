# Rough Idea — GemPixel Architecture Deepening (v1 hardening)

**Date:** 2026-07-10
**Target repo:** `C:\Users\rickf\OneDrive\Documents\Gemini Workspaces\gempixel` (branch `master`)
**Goal:** As GemPixel nears v1 release, resolve five architectural "deepening" opportunities that
turn shallow, entangled code into deep modules with real seams — improving locality, testability,
and AI-navigability without changing user-facing behavior (except fixing the one latent bug in
Candidate 1).

> **Vocabulary** (used throughout these docs): *Module* = interface + implementation. *Interface* =
> everything a caller must know (types, invariants, ordering, error modes). *Depth* = a lot of
> behaviour behind a small interface. *Shallow* = interface nearly as complex as implementation.
> *Seam* = where an interface lives; a place behaviour can change without editing in place.
> *Locality* = change/bugs/knowledge concentrated in one place. *Leverage* = what callers gain.
> *Deletion test* = if you delete the module, does complexity vanish (pass-through) or reappear
> across N callers (earning its keep)?

## Architecture snapshot (as found)

- **Engine layer (`src/engine/`) is mostly deep and healthy.** `color.ts`, `worker-client.ts`,
  `ingest.ts`, `export.ts` each hide real work behind small interfaces. Leave their shape alone.
- **`palette.ts` (4058 lines) and `variants.ts` (5106 lines) are static catalogs** — deep data
  modules (tiny lookup interface over huge data). **Do not touch.**
- **All friction is in `src/App.tsx` — 3321 lines, 52 `useState`, 16 `useEffect`, ~25 handlers,
  all four wizard steps rendered inline.** It is a shallow God component: its interface (the mental
  model to hold) is nearly as large as its implementation. Every concern is entangled with no
  locality. Deleting `App.tsx` scatters everything — it is not a module, it is the *absence* of
  modules. The fix is a set of **carve-outs** so each concern gets a home.

## The five candidates

### Candidate 1 — Supply Bag Optimizer consolidation (HIGH PRIORITY: latent v1 correctness bug)
- **Files:** `src/App.tsx:136–214` (`calculateSafetyPurchase`, `getDefaultPacketCost`,
  `optimizeBags`), `src/engine/checkout.ts:35` (a **second** `optimizeBags`), `checkout.ts:245`
  (`calculateCanvasCost`), `checkout.ts:188–244` (`VENDOR_REGISTRY`, pricing).
- **Problem:** "How many drill bags to buy and what it costs" has **no single home** and exists as
  **two conflicting adapters at an accidental seam**:
  - `App.tsx:169` `optimizeBags(target, prices)` — brute-force **cost minimizer**, returns
    `{bags:{200,500,1000,2000}, cost, totalDrills}`.
  - `checkout.ts:35` `optimizeBags(count)` — greedy **dye-lot packer**, returns
    `{qty200, qty500, qty1000, qty2000}`.
  - Same name, same domain, different math, different files. The cost the user *sees* (App's
    optimizer) can disagree with the cart that gets *built* (checkout's packer). Pricing tables
    (`getDefaultPacketCost`) live in the UI file; `VENDOR_REGISTRY` pricing lives in the engine.
- **Solution:** One deep `supply`/`bagPlanner` engine module owning safety-margin math, bag packing,
  and cost — with dye-lot rule and cost-optimization as explicit, named strategies rather than two
  functions sharing a name. Estimate and cart must derive from the same source.
- **Benefits:** Locality (all drill-supply arithmetic in one file; dye-lot rule stated once);
  Leverage (callers ask "plan supplies for N drills" and get one consistent answer feeding both
  estimate and cart); Testability (half the math is trapped in `App.tsx`, reachable only by driving
  the component — a seam makes both strategies unit-testable and lets a test assert estimate == cart).
- **Deletion test:** Deleting either `optimizeBags` today concentrates a latent bug (they silently
  diverge). Consolidating concentrates complexity where it belongs.

### Candidate 2 — Matcher pipeline hook (the core-value engine)
- **Files:** `src/App.tsx` — `clientRef`/`MatcherClient` lifecycle (`:558`, `:618–625`, `:893`),
  `rawMatchResult` (`:310`), `matchResult`/`symbolMap`/legend memos (`:569–600`),
  `loading`/`progress` state, plus the effects that feed `viewerRef`.
- **Problem:** GemPixel's core value (image → matched grid) is a pipeline — worker match → low-count
  substitution → symbol allocation → legend split → viewer feed — **smeared across the God
  component**, interleaved with worker lifecycle and loading state. The pipeline has no interface of
  its own; you cannot reason about "the match" without reading the whole file.
- **Solution:** A `useDiamondArtMatch` hook (Coordinator-Engine style) owning worker lifecycle,
  `loading`/`progress`, and derived `matchResult`/`symbolMap`/legends behind a small signal surface.
- **Benefits:** Locality (worker teardown, abort, cache-hash logic next to the state they drive);
  Leverage (`App` reads `{matchResult, loading, progress}` instead of orchestrating a worker);
  Testability (pipeline testable without mounting the wizard).
- **Deletion test:** Deleting the scattered pieces reproduces the pipeline across every consumer —
  earning its keep, just no seam.

### Candidate 3 — Project & recent-image persistence store
- **Files:** `src/App.tsx:42–114` (`generateUUID`, `generateThumbnail`, `saveProjectToStorage`,
  `loadProjectFromStorage`, `deleteProjectFromStorage`), `ProjectSummary`/`ProjectData` interfaces
  (`:12–40`), plus `projectsRegistry`, `recentImages` state and the quota-pop `useEffect` (~`:601`).
- **Problem:** All `localStorage` persistence is exported from `App.tsx` with quota-handling logic
  scattered between free functions and effects. Serialization shape (`ProjectData`) is defined next
  to the component that happens to use it — a leak across the persistence seam.
- **Solution:** A `projectStore` module owning serialization, quota eviction, thumbnails, and the
  recents list behind a small CRUD interface.
- **Benefits:** Locality (one place for storage-shape and quota rules); Leverage (`store.save(project)`);
  Testability (quota eviction currently only reachable by driving the component; a seam makes it a
  unit test).
- **Deletion test:** Complexity reappears in every save/load site — real module, no home.

### Candidate 4 — Active-candidates (palette selection) resolver
- **Files:** `src/App.tsx:563–567` (`baseCandidates`/`activeCandidates`), `selectedBaseKit` (`:302`),
  `excludedColors` (`:304`).
- **Problem:** The palette selection (base kit filter + exclusions → the candidate set every
  downstream stage depends on) is **two inline `.filter()`s recomputed on every render** (no
  `useMemo`), a shallow expression with no name. Also a mild hot-path allocation.
- **Solution:** A small pure `resolveActiveCandidates(kit, exclusions)` in the engine, memoized at
  the call site.
- **Benefits:** Leverage (a named concept the matcher, legends, and supply counts all consume);
  Testability (kit/exclusion logic tested without a render); free perf win.
- **Deletion test:** Shallow today — but naming it concentrates a concept currently duplicated
  implicitly wherever "which colors are in play" matters.

### Candidate 5 — Wizard step machine + step view components
- **Files:** `src/App.tsx` — `wizardStep` (`:299`), `isStepValid` (`:417`), nav footer
  (`:2382–2480`), and the four inline render blocks (`:1370`, `:1693`, `:1908`, `:2238`).
- **Problem:** The 4-step flow is a bare `number` plus `isValid` checks duplicated across the footer
  and dots; each step is a ~300–500-line inline JSX block. The state machine (valid transitions,
  completion) has no interface.
- **Solution:** A `useWizard` hook for step/validity/transitions, plus extracting the four blocks
  into `Step1Ingest`…`Step4Export` view components (pure receivers).
- **Benefits:** Locality (transition rules in one place); Leverage (steps become nameable,
  reorderable units); Testability (validity logic without a full mount). Lowest-risk readability win.
- **Deletion test:** Partly shallow (a wizard is inherently a small machine), but the *duplication*
  of validity logic is real complexity that consolidates.

## Suggested sequencing (initial hypothesis, to confirm)
1. Candidate 1 first — latent correctness bug, not just tidiness.
2. Candidates 2 and 3 — the two genuinely deep modules trapped in `App.tsx`.
3. Candidates 4 and 5 — lower-risk readability follow-ups.

## Constraints / environment
- Stack: Preact + Vite + TypeScript + Tailwind v4; heavy matching in a Web Worker. Client-only, no
  server, no image ever leaves the browser.
- Tests: Vitest + jsdom. Current suite: **99 tests passing** (per `SUMMARY.md`). Tests in
  `src/engine/__tests__/` and `src/__tests__/`.
- Verify gates: `npx tsc --noEmit` (typecheck), `npm test` (vitest run), `npm run build` (tsc && vite build).
- gempixel is GSD-managed (`.planning/`), but this deepening work is being driven via the Fretted
  PDD → code-task-generator → code-assist pipeline. Docs live in `.agents/planning/`.

## Process note (why these docs are heavy on file/line anchors)
Context is cleared between three phases: **scoping (this PDD)** → **code-task generation** →
**coding**. Each phase runs in a fresh context with a different orchestrator agent. Therefore the
design doc and implementation plan must be **self-contained** and anchored to concrete file paths,
line numbers, and function names so a cold-start agent can act without re-deriving the analysis.
