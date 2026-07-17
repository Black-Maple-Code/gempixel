# Phase 26: Interim Customer Fulfillment — Canvas PNG Packet + Diamond Drills USA Order - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-16
**Phase:** 26-interim-customer-fulfillment-canvas-png-packet-diamond-drill
**Mode:** advisor (research-backed comparison tables; calibration tier = standard; NON_TECHNICAL_OWNER = false)
**Areas discussed:** Drill-cart placement, PNG delivery format, Standalone legend PNG, Order-step handoff UX

---

## Drill-cart handoff placement (ORDER-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Order only | One call site to `compileShopifyCartLink` on the honest terminal step; can't diverge from legend/quote | ✓ |
| Supplies only | Next to the supply table, but orphans the buy action and splits fulfillment across two steps | |
| Both steps | Max discoverability but two render sites of the same permalink → single-source divergence risk | |

**User's choice:** Order only
**Notes:** SC3's "(or Supplies)" treated as permissive fallback, not a mandate to duplicate. If UAT later shows customers stop at Supplies, add a lightweight "Continue to Order to buy drills →" pointer — not a second live cart button. (→ D-01)

---

## Canvas PNG delivery format (ORDER-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Separate labeled downloads | Reuse `triggerCanvasDownload` per artifact, zero new code/dep; caveat: browser "download multiple?" prompt | ✓ |
| Hand-rolled store-only ZIP | One clean file (PNGs + JSON), zero dep, but ~70 lines + CRC32 + round-trip test | |
| fflate zip library | Correct ZIP in ~8KB, but breaks the zero-new-dependency rule | |

**User's choice:** Separate labeled downloads
**Notes:** Thinnest, zero-dep, ships the interim fast; accept the multi-file browser prompt. Store-only ZIP noted as a deferred "one canvas package" upgrade if the prompt proves annoying. (→ D-03)

---

## Standalone legend PNG (SC1 vs "no engine signature changes")

| Option | Description | Selected |
|--------|-------------|----------|
| Additive `drawLegendOnly` renderer | New additive export (doesn't mutate the two frozen renderers); clean, artifact-free | ✓ |
| Two PNGs + keep legend print-only | Zero new code, honest SC1 third-PNG trim; needs a scope note | |
| Crop the combined sheet | No engine change but brittle — re-derives private constants, captures folding-guide artifacts | |

**User's choice:** Additive `drawLegendOnly` renderer
**Notes:** SC1's "no signature changes" read as "don't mutate the frozen renderers" — additive export permitted. Flagged as the one sanctioned engine addition in an otherwise UI phase; fall back to two-PNGs-+-print (never the crop) if the shared-loop extraction would force a signature change. (→ D-05)

---

## Order-step handoff UX (SC4)

| Option | Description | Selected |
|--------|-------------|----------|
| Two grouped task sections | "Get your canvas made" + "Order your drills", each with its own honest sub-terminal; retires `packetDownloaded` boolean | ✓ |
| Single "Download everything" + drill link | Fewest clicks, but bundling implies one vendor destination — fights SC4 honesty | |
| Flat button list | The retired `Step3Canvas` "Order & Actions" stack | |

**User's choice:** Two grouped task sections
**Notes:** Encodes the real two-vendor, two-errand model. Canvas → "downloaded ✓"; drills → "cart opened ↗ — finish on Diamond Drills USA" (never "ordered"). Replace `packetDownloaded: boolean` with a per-task state. (→ D-06, D-07)

---

## Folded Todos (cross-reference)

| Todo | Decision |
|------|----------|
| Retire remaining dark-slate modal + error-banner remnants (WR-04, `resolves_phase:26`) | **Folded** → D-08 (coupled to the Step3Canvas/checkout deletion + the error banner moving to Order) |
| Cancel debounced custom-size recompute timer (WR-02) | Reviewed, not folded (Refine bug, outside fulfillment scope) |
| Consume/remove unused viewer `isFitMode` API (WR-05) | Reviewed, not folded (viewer cleanup, outside scope) |
| Tighten Refine canvas fit at short viewports | Reviewed, not folded (Refine layout, outside scope) |

## Claude's Discretion

- `drawLegendOnly` internals (shared-loop extraction, canvas sizing, options shape) — no existing signature change.
- Per-task state shape replacing `packetDownloaded`.
- Download spacing between sequential `triggerCanvasDownload` calls.
- Section-② cart affordance copy + "cart opened ↗" sub-terminal wording.
- PNG filenames (reuse `saveProjectName.trim() || 'gempixel-layout'` baseName).

## Deferred Ideas

- Store-only ZIP "one canvas package" download — clean single-file upgrade over separate downloads.
- "Continue to Order to buy drills →" pointer on Supplies (UAT-gated).
- Richer finish/canvas visualization proof on Order (ORDER-03, v4.x).
- v5.0 fulfillment backend (real payment, lab submission, server render, tracking, sourcing).
