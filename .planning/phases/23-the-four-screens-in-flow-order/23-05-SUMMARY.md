---
phase: 23-the-four-screens-in-flow-order
plan: 05
subsystem: ui
tags: [preact, strangler-fig, feature-flags, order, order-packet, honesty, client-side, single-source-quote, canvas-first]

# Dependency graph
requires:
  - phase: 23-the-four-screens-in-flow-order
    plan: 01
    provides: "flags.ts (USE_NEW_* booleans) + pure OrderScreen shell + App data-step-panel-4 ternary"
  - phase: 23-the-four-screens-in-flow-order
    plan: 04
    provides: "USE_NEW_SUPPLIES=true; the SINGLE-SOURCE orderQuote App derivation (buildOrderQuote) that Order REUSES; the re-home/skip strangler-bridge pattern; the TODO(23-05) displaced-coverage markers"
  - phase: 22-additive-engine-density-color-reducer-single-source-quote
    provides: "buildOrderQuote / OrderQuote (quote.ts) + planOrderSupply / OrderSupplyPlan (bagPlanner.ts) + money.ts integer-cents helpers + gridToInches/formatInches (density.ts)"
provides:
  - "orderPacket.ts — pure, deterministic, versioned OrderPacket serializer (buildOrderPacket): schemaVersion + injected packetId/createdAt, self-contained (JSON-round-trippable) design/canvasSpec/gemBags/quote/shipTo, product LOCKED to Rolled Canvas, size via gridToInches; no generateUUID/Date/DOM inside"
  - "OrderScreen.tsx — full pure/props-only Order screen (UI-SPEC A4): auto-filled LOCKED spec strip (Rolled Canvas + LOCKED Pill, size, finish) + two finish cards + client-only ship-to form + verbatim single-source quote + 'Download order packet' CTA + honest terminal state (no order#/receipt/payment, D-09)"
  - "App handleDownloadOrderPacket — builds the packet (generateUUID id injected) + downloads an application/json Blob via the export.ts anchor+deferred-revoke idiom; ship-to embedded client-side ONLY, NO fetch/network egress (D-08); actionError banner on failure; packetDownloaded terminal flag"
  - "USE_NEW_ORDER=true — ALL FOUR screens now live behind their flags; the four-screen journey (Upload → Refine → Supplies → Order) is complete; legacy Step bodies dormant until Phase 25"
  - "orderPacket.test.ts (9 cases) + OrderScreen.test.tsx (7 cases) + a re-homed App-level order-packet download-error test"
affects: [25-strangler-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure/deterministic serializer with injected non-determinism: buildOrderPacket takes packetId + createdAt as INPUTS (generateUUID + new Date live in the App handler), so the module is side-effect free and unit-testable (round-trip + fixed-input equality) — the CSPRNG id / timestamp never leak into the pure layer"
    - "Honest client-side handoff (D-09): completion = a versioned self-contained JSON Blob download (export.ts anchor+createObjectURL+deferred-revoke idiom over application/json); ship-to embedded in the file ONLY, zero fetch/XHR/sendBeacon; terminal state truthfully reads 'Packet downloaded' with NO order number / receipt / payment UI"
    - "Single-source quote consumed a SECOND time (D-07 proven end-to-end): OrderScreen renders the SAME App orderQuote object Supplies renders — Supplies total === Order total by construction (one shared buildOrderQuote result, no local cents math in either screen)"
    - "Strangler flip bridging (inherited from 23-03/23-04): wire+implement with the flag OFF (runtime unchanged) in one commit; isolate the flag flip in the next; re-home salvageable coverage to the new owner, skip legacy-only cases with explicit TODO(25) markers"

key-files:
  created:
    - src/features/screens/orderPacket.ts
    - src/features/screens/__tests__/orderPacket.test.ts
    - src/features/screens/__tests__/OrderScreen.test.tsx
  modified:
    - src/features/screens/OrderScreen.tsx
    - src/features/screens/flags.ts
    - src/features/screens/__tests__/flags.test.ts
    - src/App.tsx
    - src/__tests__/App.test.tsx

key-decisions:
  - "buildOrderPacket is PURE/deterministic — packetId + createdAt are INJECTED (generateUUID/new Date live in the App handler), so the serializer stays side-effect free and unit-testable (round-trip + fixed-input equality assertions)"
  - "The honest handoff REPLACES the legacy Shopify checkout: the Order screen ships a client-side JSON packet download + an honest terminal state (no order#/receipt/payment, D-09); the legacy handleShopifyCheckout + its guards stay dormant for the Phase 25 retire"
  - "The packet's canvasSpec.product is pinned to 'Rolled Canvas' UNCONDITIONALLY (LOCKED, D-08) and the size is derived from the grid via gridToInches — the single density source — so the spec label, the packet, and the canvas cost can never desync"
  - "Editing finish or ship-to resets packetDownloaded → the CTA re-surfaces (never a silent no-op after an edit), so the user can download an updated packet"

patterns-established:
  - "A pure serializer injects its non-determinism (ids, timestamps) rather than calling generateUUID/Date internally — the module stays deterministic and fully unit-testable; the impure id/timestamp generation lives at the App call site"

requirements-completed: [ORDER-01, ORDER-02]

coverage:
  - id: D1
    description: "buildOrderPacket returns a versioned (schemaVersion), self-contained packet: injected packetId/createdAt, design chart ref (cols/rows + full grid + drill spec), LOCKED canvasSpec (product 'Rolled Canvas', gridToInches size, finish, vendor), gemBags from OrderSupplyPlan safety rows, integer-cents quote snapshot, client-only shipTo — JSON-round-trippable, exact top-level key set (no stray PII/secret), deterministic"
    requirement: "ORDER-02"
    verification:
      - kind: unit
        ref: "src/features/screens/__tests__/orderPacket.test.ts#carries the schemaVersion for forward-compat with a future backend"
        status: pass
      - kind: unit
        ref: "src/features/screens/__tests__/orderPacket.test.ts#is JSON-round-trippable (self-contained: no functions/DOM/handles)"
        status: pass
      - kind: unit
        ref: "src/features/screens/__tests__/orderPacket.test.ts#exposes ONLY the expected top-level keys (no stray PII/secret)"
        status: pass
      - kind: unit
        ref: "src/features/screens/__tests__/orderPacket.test.ts#locks canvasSpec.product to \"Rolled Canvas\" regardless of input"
        status: pass
      - kind: unit
        ref: "src/features/screens/__tests__/orderPacket.test.ts#is deterministic — identical injected inputs yield an identical packet"
        status: pass
    human_judgment: false
  - id: D2
    description: "OrderScreen renders the auto-filled LOCKED spec (Rolled Canvas + LOCKED Pill, gridToInches size, finish) + finish cards + client-only ship-to + the SAME single-source orderQuote as Supplies (verbatim, no local cents math) (ORDER-01, D-07/D-08)"
    requirement: "ORDER-01"
    verification:
      - kind: unit
        ref: "src/features/screens/__tests__/OrderScreen.test.tsx#renders the LOCKED spec: Rolled Canvas + LOCKED pill, size, and finish"
        status: pass
      - kind: unit
        ref: "src/features/screens/__tests__/OrderScreen.test.tsx#renders two finish cards; selecting one calls onFinishChange"
        status: pass
      - kind: unit
        ref: "src/features/screens/__tests__/OrderScreen.test.tsx#renders the price total from quote.totalCents VERBATIM (single source, no local math)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Completion = downloading the packet (anchor+Blob idiom); terminal state is an honest 'Packet downloaded — take this to the vendor' with NO order number/receipt/payment; ship-to stays client-side (no fetch/network) (ORDER-02, D-08/D-09)"
    requirement: "ORDER-02"
    verification:
      - kind: unit
        ref: "src/features/screens/__tests__/OrderScreen.test.tsx#has a \"Download order packet\" CTA (no price, never \"Place order\") that calls onDownloadPacket"
        status: pass
      - kind: unit
        ref: "src/features/screens/__tests__/OrderScreen.test.tsx#shows the honest terminal state ONLY on packetDownloaded — no order number/receipt/payment"
        status: pass
      - kind: integration
        ref: "src/__tests__/App.test.tsx#surfaces the banner when the order-packet download fails (re-homed W5)"
        status: pass
      - kind: other
        ref: "grep -nE 'fetch|XMLHttpRequest|sendBeacon' src/features/screens/OrderScreen.tsx src/features/screens/orderPacket.ts + handleDownloadOrderPacket → NONE (no network egress; ship-to embedded in the Blob only)"
        status: pass
    human_judgment: false
  - id: D4
    description: "USE_NEW_ORDER=true — all four flags true; panel-4 renders OrderScreen; full suite + tsc green"
    verification:
      - kind: unit
        ref: "src/features/screens/__tests__/flags.test.ts#has all four screens swapped in (Upload + Refine + Supplies + Order live)"
        status: pass
      - kind: integration
        ref: "npm test — 347 passed / 12 skipped / 0 failed (36 files, stable across 3 runs); npx tsc --noEmit exit 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "Supplies total === Order total end-to-end: both render the SAME App orderQuote (buildOrderQuote) object — the D-07 single-source seam proven observably now that Order renders it. Visual A4 fidelity (470px proof column, finish cards, terminal chrome) is a design-conscious judgment call."
    verification: []
    human_judgment: true
    rationale: "Cross-screen total agreement is guaranteed by construction (one shared orderQuote object passed to both SuppliesScreen and OrderScreen) and now observable, but a live side-by-side visual confirmation + A4 layout-fidelity check (spacing, badge/Pill treatment, finish-card selected state) is a human design judgment deferred to gsd-ui-review / UAT."

# Metrics
duration: ~30min
completed: 2026-07-14
status: complete
---

# Phase 23 Plan 05: Order Screen — Honest Client-Side Handoff (ORDER-01/02, D-08/D-09) Summary

**Swapped in the final Order screen and flipped `USE_NEW_ORDER` — the four-screen journey (Upload → Refine → Supplies → Order) is now complete behind its strangler flags. Added a PURE, deterministic `buildOrderPacket` serializer that shapes a versioned (`schemaVersion`), self-contained `OrderPacket` (design/chart ref + LOCKED `canvasSpec` (Rolled Canvas, `gridToInches` size) + `gemBags` from `OrderSupplyPlan` safety rows + an integer-cents `OrderQuote` snapshot + client-only `shipTo`) — with `packetId` + `createdAt` INJECTED so `generateUUID`/`Date`/DOM never enter the pure layer. The props-only `OrderScreen` renders the auto-filled LOCKED spec strip, two finish cards, a client-only ship-to form, and the SAME App `orderQuote` Supplies renders (verbatim, zero local cents math — so Supplies total === Order total by construction, D-07 proven end-to-end). Completion = `handleDownloadOrderPacket` building the packet (`generateUUID` id) + downloading an `application/json` Blob via the `export.ts` anchor+deferred-revoke idiom — ship-to embedded in the file ONLY, ZERO `fetch`/network egress (D-08) — landing on an honest "Packet downloaded — take this to the vendor" terminal state with NO order number, NO receipt, NO payment UI (D-09). The mock's "Place order · $57.00" is deliberately not shipped. Engine frozen; tsc + Vitest green (347 pass / 12 skip, stable across 3 runs).**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-07-14
- **Tasks:** 3 (4 atomic commits)
- **Files:** 8 (3 created, 5 modified)

## Accomplishments
- `orderPacket.ts` — `OrderPacket` interface (`schemaVersion` + `packetId` + `createdAt` + `design` + `canvasSpec` + `gemBags` + `quote` + `shipTo`) and a PURE `buildOrderPacket(input)`: pins `canvasSpec.product = "Rolled Canvas"` unconditionally (LOCKED, D-08), derives the size via `gridToInches` (single density source), maps `OrderSupplyPlan.rows` → `gemBags` (dmc/name/bySize/packets/drills, size keys normalized to strings), snapshots the `OrderQuote` to integer-cents line items + total + `ratesAsOf` verbatim, and embeds the passed `shipTo` as-is. No `generateUUID`/`new Date()`/DOM inside — id + timestamp are injected.
- `OrderScreen.tsx` — full pure/props-only Order screen (UI-SPEC A4): a left LOCKED spec column (YOUR CANVAS PROOF size badge; SENT TO THE LAB · AUTO-FILLED 4/4 four-row spec list — IMAGE · PRODUCT with a LOCKED `Pill` · SIZE `{size} · from {grid} grid` · FINISH; "Nothing to re-enter" caption), a right column with the CANVAS FINISH two-card selector (Trimmed default + "BEST FOR ART" tag / Image wrap, `aria-pressed`, bound to `onFinishChange`), a SHIP TO form (plain text inputs bound to `onShipToChange`, "never sent anywhere" caption), the PRICE block (maps `quote.lineItems`/`quote.totalCents` verbatim with the same unpriced-canvas "unavailable" honesty affordance as Supplies), and a green "Download order packet" CTA → honest terminal confirmation on `packetDownloaded`.
- `App.tsx` — new Order-only state (`finish: 'trimmed'|'wrap'`, `shipTo`, `packetDownloaded`); `orderSizeLabel`/`orderGridLabel` derived once via `gridToInches`/`formatInches`; `handleFinishChange`/`handleShipToChange` (reset `packetDownloaded` on edit); `handleDownloadOrderPacket` (buildOrderPacket with `generateUUID` id + `new Date().toISOString()`, `application/json` Blob download via the `export.ts` anchor+`createObjectURL`+deferred-revoke idiom, filename `gempixel-order-<packetId8>.json`, try/catch → `actionError`, NO network); `orderProps` wired to `<OrderScreen {...orderProps} />`.
- `flags.ts` `USE_NEW_ORDER=true` (last flag; all four now true); `flags.test.ts` asserts all four live.
- `orderPacket.test.ts` (9 node cases) + `OrderScreen.test.tsx` (7 jsdom cases) + a re-homed App-level order-packet download-error test.

## Task Commits

Each task committed atomically:

1. **Task 1: pure versioned orderPacket serializer + unit test** — `1190d1e` (feat)
2. **Task 3 + Task 2 (wire, flag off): implement OrderScreen + App order wiring** — `e543b1f` (feat)
3. **Task 2 (flip): flip USE_NEW_ORDER on; re-home/skip displaced Step4 tests** — `cf6610a` (feat)
4. **Task 3 (test): OrderScreen render test** — `719c21e` (test)

_Task 3's component and Task 2's App wiring are coupled at a single JSX call site (`<OrderScreen {...orderProps} />` needs the expanded props to typecheck), so they landed green-together in commit 2 with the flag OFF (runtime unchanged); the flag flip is isolated in commit 3 (the 23-03/23-04 "wire-then-flip" pattern). Task 1 (pure serializer + test) landed first as its own atomic feat commit._

## Files Created/Modified
- `src/features/screens/orderPacket.ts` - NEW pure versioned packet serializer
- `src/features/screens/__tests__/orderPacket.test.ts` - NEW serializer unit test (9 cases)
- `src/features/screens/__tests__/OrderScreen.test.tsx` - NEW jsdom render test (7 cases)
- `src/features/screens/OrderScreen.tsx` - Full Order screen (was a placeholder shell)
- `src/features/screens/flags.ts` - `USE_NEW_ORDER = true` (all four flags true)
- `src/features/screens/__tests__/flags.test.ts` - Strangler-state assertion (all four live)
- `src/App.tsx` - finish/shipTo/packetDownloaded state + handleDownloadOrderPacket + orderProps + `<OrderScreen {...orderProps} />`
- `src/__tests__/App.test.tsx` - Re-home (Step-4 marker → `[data-screen="order"]`; download-error affordance → order-packet test) + 3 TODO(25) skips + resolved 3 inherited TODO(23-05/25) skips → TODO(25)

## Decisions Made
- `buildOrderPacket` is pure/deterministic — `packetId` + `createdAt` are injected, keeping the module side-effect free and unit-testable.
- The honest handoff replaces the legacy Shopify checkout — the Order screen ships a JSON packet download + honest terminal state (no order#/receipt/payment, D-09); `handleShopifyCheckout` stays dormant for Phase 25.
- `canvasSpec.product` pinned to "Rolled Canvas" unconditionally; size from `gridToInches` (single density source) — spec, packet, and canvas cost can never desync.
- Editing finish or ship-to resets `packetDownloaded` so the CTA re-surfaces (never a silent no-op after an edit).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `vi.spyOn(URL, 'createObjectURL')` fails — jsdom does not implement it**
- **Found during:** Task 2 flip (the re-homed order-packet download-error test).
- **Issue:** jsdom has no `URL.createObjectURL`, so `vi.spyOn(URL, 'createObjectURL')` threw "createObjectURL does not exist" instead of exercising the handler's catch path.
- **Fix:** Assign a throwing implementation directly (`(URL as ...).createObjectURL = () => { throw }`) inside a `try/finally` that restores the original — nothing to spy on.
- **Files modified:** `src/__tests__/App.test.tsx`
- **Commit:** `cf6610a`

### Displaced-coverage handling (expected strangler cost, inherited 23-03/23-04 pattern)

**2. [Rule 3 - Blocking] Re-homed the navigation Step-4 marker + the download-error affordance**
- **Found during:** Task 2 flip (`npm test`).
- **Issue:** Flipping `USE_NEW_ORDER` replaced the legacy `Step4Export` panel-4 DOM. The broad navigation/display-isolation test keyed off `#step4-save-name-input` (the Step4 save form), and the wave-4 `TODO(23-05)` download-error skip represented a "download failed → banner" affordance that now lives on the Order packet download.
- **Fix:** Re-homed the Step-4 marker → `[data-screen="order"]` (mirrors the 23-04 Step-3 → `[data-screen="supplies"]` re-home); re-homed the download-error affordance to a NEW App-level test ("surfaces the banner when the order-packet download fails") that mocks `createObjectURL` to throw and asserts the `actionError` banner + absence of the terminal state. No coverage silently dropped.
- **Files modified:** `src/__tests__/App.test.tsx`
- **Commit:** `cf6610a`

**3. [Rule 3 - Blocking] Skipped 3 legacy-only Step4Export tests (TODO(25)) + resolved 3 inherited TODO(23-05/25) skips**
- **Found during:** Task 2 flip.
- **Issue:** Three green tests drove Step4Export-only controls with NO canvas-first home in the four-screen flow: inline project **save/Update/Save-as-Copy**, **Start New / Reset**, and the **save-quota banner** (triggered via the project Update button). Separately, the three inherited `TODO(23-05/25)` skips (canvas-PNG download-error W5; Shopify-checkout W4/WR-02) needed their "23-05" expectation resolved.
- **Fix:** Skipped the three Step4Export tests with `TODO(25)` markers (handlers — `handleSaveProject`, `resetWorkspace` — unchanged for the dormant Step body; project save/reset is not part of the four-screen customer flow this milestone). Resolved the inherited skips → `TODO(25)`: the PNG download-error affordance is re-homed (see #2); the **Shopify checkout is deliberately absent from the honest Order screen (D-09)**, so W4/WR-02 have no canvas-first home and stay legacy-only. No NEW silent skips introduced.
- **Files modified:** `src/__tests__/App.test.tsx`
- **Commit:** `cf6610a`

---

**Total deviations:** 1 auto-fixed bug (test infra) + the expected strangler re-home/skip bookkeeping. No architectural changes (Rule 4 not triggered); no package installs. Zero engine files touched; no scope creep.
**Impact on plan:** All fixes were necessary to keep the suite green through the flag flip and to honor "no NEW silent skips" (the one displaceable behavior — download error — is re-homed; the rest are legacy-only with rationale, allowed by the plan).

## Threat Model
- **T-23-05-01 (Information disclosure — ship-to PII):** mitigated. `handleDownloadOrderPacket` makes NO `fetch`/`XMLHttpRequest`/`sendBeacon` call (grep-clean across the handler, `OrderScreen.tsx`, `orderPacket.ts`); ship-to is embedded in the local Blob only and rendered as plain `<input value>` text (no `dangerouslySetInnerHTML`, no injection sink).
- **T-23-05-02 (Information disclosure — packet contents):** mitigated. The packet carries only design/spec/gem-bags/quote/ship-to — no secrets/tokens; `orderPacket.test.ts` asserts the EXACT top-level key set (no stray PII/secret).
- **T-23-05-03 (Spoofing/integrity — packet id):** mitigated. `packetId` via `generateUUID()` (CSPRNG, `projectStore.ts:75-84`) — never `Math.random()`.
- **T-23-05-04 (Repudiation/honesty — terminal confirmation):** mitigated. No order number, no receipt, no payment UI (D-09); the terminal state truthfully reads "Packet downloaded"; `OrderScreen.test.tsx` asserts the absence of "Place order"/receipt/order-number/payment text.
- **T-23-SC (npm installs):** accepted; zero packages installed this plan.

## Known Stubs
None. The `finish` enum is a real fixed choice (`'trimmed' | 'wrap'`, no price impact by design, RESEARCH Q3); `shipTo` defaults to empty strings that are user-editable form fields (not placeholder data rendered as content). No hardcoded empty arrays/objects flow to UI as fake data.

## Issues Encountered
- jsdom's missing `URL.createObjectURL` (see Deviation #1) — resolved with a direct throwing-assignment + restore.
- The pre-existing jsdom `getContext()` "Not implemented" / "worker exploded" lines in test output are environment noise from canvas/worker tests, not failures — 347/347 active tests pass.

## User Setup Required
None — no external service configuration required (the app stays 100% client-side; the order packet is a local download).

## Next Phase Readiness
- **Milestone-complete for the four-screen journey:** all four strangler flags (`USE_NEW_UPLOAD` + `USE_NEW_REFINE` + `USE_NEW_SUPPLIES` + `USE_NEW_ORDER`) are `true`. Upload → Refine → Supplies → Order are all canvas-first and live; the single-source quote seam (D-07) is proven end-to-end (Supplies total === Order total by construction).
- **Deferred to Phase 25 (strangler cleanup):** delete the dormant legacy `Step1..4` bodies + their now-orphaned handlers/state, and re-home or retire the `TODO(25)` skips — the pricing-config grid, affiliate/unmapped-log settings, the drill-type select + auto-substitution UI (inherited 23-03), the canvas-PNG download trigger, the Shopify checkout (W4/WR-02), and the project save/copy/reset + save-quota affordances. 12 skips total, all `TODO(25)`, all with unchanged underlying handlers.
- **Strangler invariant held:** exactly one flag flipped this plan; single `<CanvasViewer>` mount + the `contents`/`hidden` toggle untouched; engine (`src/engine/`) untouched; zero new dependencies.

## Self-Check: PASSED

- Files present: `orderPacket.ts`, `orderPacket.test.ts`, `OrderScreen.tsx`, `OrderScreen.test.tsx`, `flags.ts`, `flags.test.ts`, `App.tsx`, `App.test.tsx`.
- Commits present: `1190d1e`, `e543b1f`, `cf6610a`, `719c21e`.
- `npx tsc --noEmit` exit 0; `npm test` 347 passed / 12 skipped / 0 failed (36 files, stable across 3 runs); all four `USE_NEW_*` flags `true`; `src/engine/` untouched; no `fetch`/network egress in the Order path; no `.reduce`/cents math in `OrderScreen.tsx`.

---
*Phase: 23-the-four-screens-in-flow-order*
*Completed: 2026-07-14*
