# Phase 23: The Four Screens in Flow Order - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-14
**Phase:** 23-the-four-screens-in-flow-order
**Mode:** `--auto` (autonomous — all gray areas auto-selected, recommended option locked for each; single pass)
**Areas discussed:** Screen module structure & strangler swap, Refine live-render/re-match boundary, Custom size + Advanced disclosure, Supplies/Order single-source consumption, Order honest handoff & packet, Upload recent-projects & size move

---

## Screen module structure & the strangler swap mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Per-screen flags in `src/features/screens/flags.ts` | Four booleans; App renders new screen or legacy Step body in the same `data-step-panel` slot; one flag flips per plan | ✓ |
| One global "use new UI" flag | All four screens land together | |
| Delete legacy now, no flag | Replace Step1..4 directly | |

**Auto-selected:** Per-screen flags (recommended). Preserves the strangler discipline — one screen swaps per commit with the 240+ suite green; legacy bodies stay live behind their flags until Phase 25.
**Notes:** New `src/features/screens/` dir holds `UploadScreen`/`RefineScreen`/`SuppliesScreen`/`OrderScreen`, mirroring the pure `StepBar.tsx` pattern; single-mount viewer (Phase 20 D-14) untouched.

---

## Refine — live re-render & the re-match boundary (the keystone)

| Option | Description | Selected |
|--------|-------------|----------|
| Two-tier: size → worker re-match; edge-cleanup + color slider → main-thread post-process | Honors Phase 22 D-04/D-05; slider max pinned to `detectedColorCount` | ✓ |
| Everything re-runs the worker | Simpler wiring, but slider max jumps + abort-race churn | |
| Everything post-process | Wrong — size change is a genuine re-match | |

**Auto-selected:** Two-tier reactivity (recommended). Soft-invalidate (Phase 20 D-13) fires only on size changes; edge-cleanup/color ticks never trigger staleness or a worker re-fire.
**Notes:** Canvas-size ownership moves out of Upload into Refine (SC1). Color slider stays live and never jumps.

---

## Refine — custom size & the "Advanced" disclosure

| Option | Description | Selected |
|--------|-------------|----------|
| Preset SizeCards first + one custom-size entry; kit/exclude/shape under a collapsed "Advanced" disclosure | Defaults kit=all, shape=square; inches derived via `gridToInches` | ✓ |
| Advanced controls as their own step | Rejected — REFINE-05 explicitly says not a step | |
| No custom size | Rejected — REFINE-02 requires it | |

**Auto-selected:** Preset-first + custom entry + collapsed Advanced (recommended).
**Notes:** Custom clamps follow existing App canvas-clamp precedent; disclosure closed by default to keep the keystone uncluttered.

---

## Supplies & Order — single-source quote consumption

| Option | Description | Selected |
|--------|-------------|----------|
| Both screens read `buildOrderQuote` + `planOrderSupply` only; zero local total math | One selector, two views — can't diverge (SC4) | ✓ |
| Each screen computes its own totals | Rejected — the exact divergence Phase 22 D-06 prevents | |

**Auto-selected:** Single-source consumption (recommended). Supplies adds the legend/supply table + "why these bags?" disclosure; Order renders the same itemized quote.

---

## Order — honest client-side handoff & the order packet

| Option | Description | Selected |
|--------|-------------|----------|
| Locked spec + finish + ship-to + quote → download a versioned self-contained JSON packet; "packet downloaded" confirmation | No implied payment, no fake receipt (ORDER-02) | ✓ |
| Fake receipt / order number | Rejected — dishonest; violates ORDER-02 | |
| Real payment / checkout | Rejected — v5.0 | |

**Auto-selected:** Versioned JSON packet + honest confirmation (recommended). Reuses `export.ts`/`projectStore` serialization; ship-to stays client-side, embedded in the download only; schema forward-compatible with v5.0 backend.

---

## Upload — recent projects & size-selection move

| Option | Description | Selected |
|--------|-------------|----------|
| Drag/drop + browse + inline recent-projects list from `projectStore`; size selection removed to Refine | Inline list, no modal (design handoff A1) | ✓ |
| Modal recent-projects picker | Rejected — "never open a menu" design principle | |
| Keep size selection on Upload | Rejected — SC1 moves it to Refine | |

**Auto-selected:** Inline recent list + size moved to Refine (recommended).

---

## Claude's Discretion

- Exact `<Screen>Props` interfaces and prop-drilling vs grouped props object (props-only, no new store/context).
- `flags.ts` shape (const booleans vs typed record).
- Advanced disclosure implementation (native `<details>` vs controlled Pill-toggle) and recent-projects thumbnail size/layout.
- Order-packet filename, `version` string, and packet field naming.
- Screen swap order across plans (Refine is the keystone/highest-risk; Upload the simplest first swap).

## Deferred Ideas

- Mobile responsive + touch → Phase 24.
- Delete legacy Step1..4 / side asides / theme toggle / dead sidebar+preset state → Phase 25.
- Tunable Delta-E merge guard → REFINE-06 (v4.x).
- Richer finish/canvas visualization on Order → ORDER-03 (v4.x).
- Service-fee line + order-ref/threshold flagging → deferred (per ROADMAP note).
- Real payment + lab submission → v5.0.
