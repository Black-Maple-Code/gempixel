# Phase 16: Optimized Supply Plan & Savings - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 16-optimized-supply-plan-savings
**Mode:** advisor (research-backed comparison tables; calibration tier `standard`; NON_TECHNICAL_OWNER=false)
**Areas discussed:** Objective & overshoot, Savings baseline, Plan & savings display, Toggle fate

---

## Objective & overshoot (BAG-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Fewest-bags, cost-premium cap | Bag count primary but only accept a fewer-bags plan when its cost premium stays under a cap; bounded search preserved | ✓ |
| Pure fewest-bags, cost tiebreak | Literal BAG-01; unbounded overshoot — a big bag always wins even when wasteful | |
| Cost-min primary, fewest-bags tiebreak | Never overshoots into a pricier plan, but inverts BAG-01's stated priority | |

**User's choice:** Fewest-bags with a cost-premium cap.
**Follow-up (cap definition):** Cost premium ≤ one smallest available bag price (chosen over "overshoot < smallest bag size" and "both, stricter wins"). Ties to the money the user sees; easy to explain in the "why" tooltip.
**Notes:** Comparator/filter change inside the existing exact bounded search — no greedy/LP solver. Must be a total, deterministic order so legend and cart never diverge. Dye-lot ≤800 → 200s path untouched.

---

## Savings baseline (BAG-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Smallest covering bag/color, dye-lot rule | New pure fn; smallest single covering size per color, inheriting ≤800→200s; apples-to-apples, provably ≥0, anchored to nothing mutable | ✓ |
| Fixed single-size (drillBagSize×ceil) | Reuse existing path; savings shifts with the mutable drillBagSize toggle and ignores dye-lot → can inflate | |
| Uniform 200-count/color | Trivial, but violates dye-lot for >800 colors → compares against an invalid purchase, maximally inflated | |

**User's choice:** Smallest covering bag per color, same dye-lot rule.
**Notes:** Reuses DRILL_VARIANTS availability + DYE_LOT_CEILING + priceColorPack/money.ts. Small colors show $0 savings (truthful). Define a no-cover fallback (ceil-fill largest available size). This is a NEW fn — distinct from the retained fixed-size path.

---

## Plan & savings display (BAG-02 + BAG-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid: headline + "why" expander | Always-on savings line by Est. total; dye-lot "why" behind a discoverable a11y-safe expander | ✓ |
| Global summary block only | One static explainer line + headline savings in footer; leanest, aggregate-only | |
| "How this plan works" section | Second collapsible with rationale + side-by-side comparison; savings hidden by default | |
| Per-color tooltips / column | Precise but crowds the dense ~9px table, hover fails on touch, likely reworked in Phase 18 | |

**User's choice:** Hybrid — always-on savings headline + "Why these bags?" expander.
**Notes:** Static copy so the print report stays a trivial mirror. Augment the existing supply panel in place; do not anticipate the Phase 18 viewport rework.

---

## Toggle fate (optimizeBagsCost)

| Option | Description | Selected |
|--------|-------------|----------|
| Retire toggle, optimized always-on | Optimized fewest-bags is the sole displayed plan; keep the fixed-size pure fn; no migration (ephemeral state) | ✓ |
| Keep a "simple/single-size" mode | Max regression safety + a simple view for Phase 19, but two divergent pricing paths persist | |
| Delete toggle + fixed path | Cleanest code, but silently removes a live behavior and discards a reusable fn | |

**User's choice:** Retire the toggle; optimized always-on.
**Notes:** Code correction surfaced by research — `optimizeBagsCost` is ephemeral `useState(true)` at App.tsx:175, absent from the save payload, so there is NO persisted state to migrate. `calculateSafetyPurchase` is kept in the codebase; any user-facing simple view is a Phase 19 decision.

---

## Claude's Discretion

- Exact copy for the savings headline and the "Why these bags?" sentence (plain-language, static).
- Naming/signatures of the new pure aggregator (`planOrderSupply`) and the naive-baseline function (follow existing bagPlanner.ts conventions).
- Whether the savings headline shows `$` and `%` or just `$` (keep it one clean line).

## Deferred Ideas

- User-facing "simple/single-size" view → reconsidered in Phase 19 (Customer/Artist mode split).
- Per-color savings / per-row info icons → deferred; revisit after Phase 18 viewport rework if users ask "why is this color split."
- Side-by-side naive-vs-optimized comparison table → a Phase 18 candidate if the headline proves insufficient.
