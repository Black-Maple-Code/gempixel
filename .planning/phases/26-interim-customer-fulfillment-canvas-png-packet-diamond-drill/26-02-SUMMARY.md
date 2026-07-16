---
phase: 26-interim-customer-fulfillment-canvas-png-packet-diamond-drill
plan: 02
subsystem: ui
tags: [preact, order-screen, fulfillment, canvas-png, shopify-cart, per-task-state]

# Dependency graph
requires:
  - phase: 26-01
    provides: additive drawLegendOnly export (legend-only PNG renderer)
provides:
  - OrderScreen two honest task sections (Get your canvas made / Order your drills)
  - Four reachable canvas downloads on the Order step (grid PNG, grid+legend PNG, legend PNG, JSON packet)
  - Single Diamond Drills USA cart handoff on the Order step (onCartCheckout → handleShopifyCheckout)
  - Independent per-task done-states (canvasDownloaded / cartOpened) replacing the single packetDownloaded
  - App handleDownloadLegend handler (drawLegendOnly → ${baseName}-legend.png)
affects: [26-03 delete step, verify-work, ui-review]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Props-only screen composes App-owned handlers via new call site (D-02 strangler re-home)"
    - "Independent per-task boolean done-states (canvasDownloaded/cartOpened) with honest 'files really on disk' trigger"
    - "Additive done-panel: CTAs stay available while the done-state renders alongside"

key-files:
  created: []
  modified:
    - src/features/screens/OrderScreen.tsx
    - src/features/screens/__tests__/OrderScreen.test.tsx
    - src/App.tsx
    - src/__tests__/App.test.tsx

key-decisions:
  - "canvasDownloaded flips on ANY section-① download (3 PNGs OR JSON packet), not packet-only — honest per D-07 (explicit, recorded UI-SPEC deviation from the literal 'all files fire' wording)"
  - "handleFinishChange / handleShipToChange clear BOTH per-task flags (canvas + cart) per the plan's explicit four-reset-site instruction"
  - "App-test overrides the file-level throwing/unmapped module mocks (vi.mocked(...).mock…Once) to exercise the real PNG-download and cart-open success paths in jsdom"

patterns-established:
  - "Per-task independent done-states: two booleans, two sub-terminals, one may be done while the other is not"
  - "Reuse-only Atelier composition: two task groups led by 10px mono eyebrows, no new primitive/token/dep"

requirements-completed: [ORDER-04, ORDER-05]

coverage:
  - id: D1
    description: "Order step section ① renders four labeled downloads (grid PNG, grid+legend PNG, legend PNG, JSON packet), each invoking its App handler"
    requirement: ORDER-04
    verification:
      - kind: unit
        ref: "src/features/screens/__tests__/OrderScreen.test.tsx#section ① renders four labeled download CTAs, each invoking its own handler"
        status: pass
      - kind: unit
        ref: "src/__tests__/App.test.tsx#sets canvasDownloaded from a PNG download (not just the packet) — cart stays independent"
        status: pass
  - id: D2
    description: "App handleDownloadLegend builds the legend-only PNG via drawLegendOnly and downloads ${baseName}-legend.png"
    requirement: ORDER-04
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (handleDownloadLegend wired into orderProps.onDownloadLegend; grep-confirmed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Single Diamond Drills USA cart CTA on the Order step opens the compileShopifyCartLink permalink in a new tab (noopener,noreferrer), fed by the same bag plan as the legend/quote"
    requirement: ORDER-05
    verification:
      - kind: unit
        ref: "src/features/screens/__tests__/OrderScreen.test.tsx#section ② renders one Diamond Drills USA cart CTA calling onCartCheckout"
        status: pass
      - kind: unit
        ref: "src/__tests__/App.test.tsx#opening the drill cart surfaces order-cart-terminal independently (canvas terminal absent)"
        status: pass
  - id: D4
    description: "Two independent per-task done-states; drills sub-terminal reads 'Cart opened' never Ordered/Purchased/Complete; no place-order/receipt/order-number/payment UI (D-06/D-09)"
    requirement: ORDER-05
    verification:
      - kind: unit
        ref: "src/features/screens/__tests__/OrderScreen.test.tsx#surfaces the two sub-terminals INDEPENDENTLY (canvas done ≠ cart done)"
        status: pass
      - kind: unit
        ref: "src/features/screens/__tests__/OrderScreen.test.tsx#the cart sub-terminal reads \"Cart opened\" — never Ordered/Purchased/Complete (D-06)"
        status: pass
  - id: D5
    description: "Both per-task flags reset at every project load/reset/edit site so downloaded/cart-opened state cannot leak across projects (WR-01)"
    requirement: ORDER-04
    verification:
      - kind: unit
        ref: "src/__tests__/App.test.tsx#re-loading a project clears the previous ship-to PII and the downloaded terminal state"
        status: pass
      - kind: unit
        ref: "src/__tests__/App.test.tsx#resetWorkspace (New) clears ship-to PII and the downloaded terminal state"
        status: pass

# Metrics
duration: 15min
completed: 2026-07-16
status: complete
---

# Phase 26 Plan 02: Interim fulfillment re-home into the Order step Summary

**OrderScreen now presents two honest task sections — four reachable canvas downloads (grid PNG, grid+legend PNG, legend PNG, JSON packet) and the single Diamond Drills USA drill cart — with independent per-task done-states (canvasDownloaded/cartOpened) replacing the old single packetDownloaded boolean.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-16T16:49:00Z
- **Completed:** 2026-07-16T17:04:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Restructured OrderScreen's right column into two stacked, reuse-only task groups ("Get your canvas made" / "Order your drills"), each led by a 10px mono eyebrow — the fulfillment actions are now reachable on the shipped Order step instead of the dormant Step3Canvas.
- Added App `handleDownloadLegend` (via 26-01's `drawLegendOnly`) downloading `${baseName}-legend.png`, joining the existing `-canvas.png` and `-grid-legend.png`.
- Replaced the single `packetDownloaded` state with two independent booleans: `canvasDownloaded` flips on ANY section-① download (3 PNGs OR the JSON packet — honest "files really on disk" trigger, D-07); `cartOpened` flips when the drill cart opens. The cart stays a single Order call site (D-01); SuppliesScreen untouched.
- Retargeted the WR-01 leak suite and added tests proving the any-download trigger and the canvas/cart done-state independence.

## Task Commits

Each task was committed atomically:

1. **Task 1: OrderScreen two honest task sections + per-task state (TDD)** - `f3ca08c` (feat)
2. **Task 2: App wiring — handleDownloadLegend + all fulfillment handlers + per-task state** - `36e7ff7` (feat)

_Task 1 was executed TDD-style (test rewritten to the new contract → RED → component implemented → GREEN) in a single squashed commit; Task 2 verification was tsc + the App suite._

## Files Created/Modified
- `src/features/screens/OrderScreen.tsx` - Two task sections; props swapped `packetDownloaded` → `canvasDownloaded`/`cartOpened` + four handler props (`onDownloadCanvasGrid`, `onDownloadGridLegend`, `onDownloadLegend`, `onCartCheckout`); additive done-panels with stable testids.
- `src/features/screens/__tests__/OrderScreen.test.tsx` - Retargeted to the two-section, independent-terminal, honesty-guardrail contract.
- `src/App.tsx` - `drawLegendOnly` import; new `handleDownloadLegend`; `canvasDownloaded`/`cartOpened` state replacing `packetDownloaded`; success sets in all four section-① handlers + the cart handler; both flags reset at all four WR-01 sites; `orderProps` rewired.
- `src/__tests__/App.test.tsx` - WR-01 suite retargeted to `order-canvas-terminal`; added any-download-trigger and cart-independence tests (overriding the file-level throwing/unmapped module mocks).

## Decisions Made
- **Done-state trigger = ANY section-① download, not packet-only** (as directed by the plan's recorded UI-SPEC deviation): the most faithful reading of D-07's "files really on disk" intent. Neither over-claims (packet marks done though PNGs weren't taken) nor under-claims (PNGs taken but no packet showed nothing).
- **Finish/ship-to edits clear BOTH per-task flags:** followed the plan's explicit instruction to treat all four `setPacketDownloaded(false)` sites (project load, reset, finish edit, ship-to edit) as two-flag resets. Editing the spec invalidates the just-downloaded artifacts and the prior bag plan.
- **jsdom mock overrides in App.test:** the file mocks `triggerCanvasDownload` to throw and `compileShopifyCartLink` to return an unmapped item, so the PNG-download and cart-open success paths are unreachable by default. Overrode both per-test with `vi.mocked(...).mockResolvedValueOnce` / `.mockReturnValueOnce` (plus a no-op 2D-context stub for `drawCanvasOnly`) to exercise the real success paths.

## Deviations from Plan

None - plan executed exactly as written. (The "any section-① download" done-state trigger is a planned, plan-recorded deviation from the UI-SPEC's literal "all files fire" wording, not an execution deviation.)

## Issues Encountered
- **Cart test initially reported 0 window.open calls:** the file-level `compileShopifyCartLink` mock always returns an unmapped item (routes to the warning branch). Resolved by overriding it once per-test to a clean cart link.
- **`openSpy.mockRestore()` wiped the recorded calls before the assertion:** moved the `toHaveBeenCalledWith` assertion inside the guarded block, before restoring the spy.
- **PNG-download path unreachable in jsdom:** `triggerCanvasDownload` is globally mocked to throw and there is no `canvas` backend. Overrode the mock to resolve once and stubbed `getContext` so `drawCanvasOnly` runs, exercising the real handler success set.

## Known Stubs
None - no placeholder/empty-data stubs introduced. All CTAs are wired to live App handlers.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Strangler re-home complete and shipping green: OrderScreen carries the fulfillment actions while the dormant Step3Canvas branch still compiles behind the untouched `USE_NEW_SUPPLIES` flag.
- 26-03 can now delete Step3Canvas, `flags.ts`, and the coupled `checkoutWarning` modal, and refactor the too-long/unmapped cart branch to the actionError banner (explicitly deferred by this plan).
- Full suite green: 383 passed / 7 skipped; `npx tsc --noEmit` clean; `git diff` on `package.json`/`package-lock.json` and `src/engine/` empty.

---
*Phase: 26-interim-customer-fulfillment-canvas-png-packet-diamond-drill*
*Completed: 2026-07-16*
