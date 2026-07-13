---
phase: 16-optimized-supply-plan-savings
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/engine/bagPlanner.ts
  - src/engine/__tests__/bagPlanner.test.ts
  - src/engine/__tests__/checkout.test.ts
autonomous: true
requirements: [BAG-01]
must_haves:
  truths:
    - "packColor packs a >800 bulk color into the FEWEST bags within the LOCKED overshoot cap (wasted drills <= one smallest available bulk bag; D-01), while the <=800 dye-lot path returns 200-count bags unchanged (D-04)."
    - "packColor and compileShopifyCartLink return identical bags for every fixture — the shared primitive yields a total, deterministic order so legend and cart can never diverge on a tie (D-03)."
    - "packColor is a pure deterministic function: identical inputs yield an identical ColorPack across repeated calls (no Math.random, no key-order reliance)."
  artifacts:
    - "src/engine/bagPlanner.ts — minCostBulk selection criterion changed from cost-min to fewest-bags-within-cap"
    - "src/engine/__tests__/bagPlanner.test.ts — fewest-bags worked-example + deterministic-tie + dye-lot-untouched tests"
    - "src/engine/__tests__/checkout.test.ts — packColor == cart no-divergence assertion"
  key_links:
    - "packColor -> minCostBulk (comparator) is the single primitive consumed by compileShopifyCartLink (cart) AND planColorSupply (legend)."
  prohibitions:
    - "No ILP/LP solver, no greedy downgrade, no new dependency (D-02): the exact bounded enumeration in minCostBulk is preserved; ONLY the selection criterion changes."
    - "The dye-lot <=800 -> 200-count path (DYE_LOT_CEILING, pack200) is NOT modified (D-04)."
    - "No non-deterministic tiebreak: the comparator produces a total order (D-03)."
---

<objective>
Change the bulk (>800) bag optimizer's objective from cost-minimization to
**fewest bags, bounded by a cap** (BAG-01, D-01), as a comparator/selection edit
INSIDE the existing exact bounded search in `bagPlanner.ts::minCostBulk` (D-02).
The dye-lot <=800 -> 200-count path is untouched (D-04). The comparator must
yield a total, deterministic order so the legend estimate and the Shopify cart —
which call the same `packColor` primitive — can never diverge (D-03).

Purpose: BAG-01 — the supply plan uses the fewest bags that still respect
dye-lot consistency, with cost as the bounded tiebreak.
Output: an updated `minCostBulk`, extended engine + checkout tests. The cap
semantics are already LOCKED (see below) — this plan is autonomous.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/16-optimized-supply-plan-savings/16-CONTEXT.md
@src/engine/bagPlanner.ts
@src/engine/money.ts
@src/engine/checkout.ts
</context>

<locked_decision>
## Cap semantics — LOCKED: overshoot cap (developer sign-off 2026-07-12)

During planning the planner surfaced a contradiction between D-01's literal COST
cap and the CONTEXT worked example (1050 drills @ standard prices `{200:0.25,
500:0.55, 1000:0.8, 2000:1.4}`: `1x2000` = $1.40 (1 bag, wastes 950) vs `1x1000 +
1x500` = $1.35 (2 bags, wastes 450); a $0.05 premium under any cost cap would
ACCEPT `1x2000`, but the example says REJECT it). The developer **resolved this to
`option-b-overshoot-cap`**: the cap is an **overshoot bound** (wasted drills <= one
smallest available BULK bag's capacity), NOT D-01's literal cost cap. Rationale:
matches the CONTEXT worked example and the cap's stated purpose (prevent wasteful
overshoot); D-01's literal cost-cap wording is reinterpreted accordingly.

**This is decided — execution MUST NOT stop to re-ask.** Tasks below bake it in.
The concrete rule the comparator implements: among covering plans prefer the
FEWEST bags, but REJECT a fewer-bags plan whose wasted drills (coveredDrills -
requiredCount) exceed one smallest available bulk bag's capacity; if every
fewer-bags option is rejected, fall back toward the cost-minimizing plan (a
covering plan ALWAYS exists — the cost-min plan is always acceptable). Final
tiebreaks: fewer total drills, then largest-size-first — a total deterministic
order (D-03). Worked-example outcome to reproduce: 1050 @ standard -> `1x1000 +
1x500` (NOT `1x2000`).
</locked_decision>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Change minCostBulk selection to fewest-bags-within-the-overshoot-cap</name>
  <files>src/engine/bagPlanner.ts</files>
  <read_first>
    - src/engine/bagPlanner.ts (whole file — current minCostBulk lines ~120-183 is the exact bounded search; packColor ~63-112 shows the <=800 dye-lot branch and how bulkSizes feed minCostBulk; note ColorPack shape and the isUnpriced Infinity handling)
    - src/engine/money.ts (integer-cents helpers — any cost comparison the cap needs must reconcile through toCents/sumCents, never raw float thresholds)
    - src/engine/checkout.ts (~33-64 — compileShopifyCartLink calls packColor with the same priceDb: the "cannot diverge" contract)
  </read_first>
  <behavior>
    - >800 color, count 2100 @ PRICE_DB {200:2,500:4,1000:7,2000:12}: still {2000:1, 500:1} (2 bags is already the minimum for 2100; unchanged from today).
    - >800 color, count 13533 @ same PRICE_DB: still {2000:7} (7 bags is the minimum; unchanged).
    - 1050 @ standard prices {200:0.25,500:0.55,1000:0.8,2000:1.4}: {1000:1, 500:1} — the 1-bag 1x2000 plan wastes 950 drills, MORE than one smallest bulk bag (500), so the overshoot cap REJECTS it and falls back to the cost-min 2-bag plan (LOCKED overshoot cap).
    - <=800 color, count 800: {200:4} unchanged (dye-lot rule overrides fewest-bags, D-04).
    - Deterministic tie: when two minimal plans have equal bag count AND equal total cost, the largest-size-first plan is returned, every call.
  </behavior>
  <action>
    Preserve the exact bounded enumeration in `minCostBulk` (the recursive `search`
    over counts of every size but the smallest, smallest ceil-fills the remainder)
    — do NOT replace it with a greedy or solver approach (D-02). Change ONLY the
    selection step: instead of tracking the single cheapest `total`, enumerate the
    same candidate plans and select by the LOCKED overshoot cap:
      1. Compute `costMin` (the minimum cost over all covering candidates) exactly
         as today, in integer cents via money.ts (never a raw float threshold), and
         keep the cost-min plan as the guaranteed fallback (it is ALWAYS acceptable,
         so a covering plan always exists).
      2. Mark a candidate ACCEPTABLE when its overshoot (coveredDrills -
         requiredCount) <= the smallest available bulk size (the smallest size in
         `bulkSizes`, e.g. 500 when 500/1000/2000 exist). This is the overshoot cap:
         a fewer-bags plan that wastes more than one smallest-bulk-bag's capacity is
         rejected.
      3. Among ACCEPTABLE candidates, pick the one with the FEWEST packets; break
         ties by lowest cost cents; then by fewer total drills; then largest-size-first
         (descending size composition). If NO fewer-bags candidate is acceptable, use
         the cost-min plan from step 1. These final tiebreaks make the order TOTAL and
         deterministic (D-03) so packColor never depends on Object key order or float
         wobble.
    Keep the unpriced-size handling intact: unpriced bulk sizes stay excluded from
    the candidate set (priced-only), and a color coverable ONLY by unpriced sizes
    still returns the flagged empty pack (hasUnpricedSize=true) — unchanged from
    today. Do NOT touch packColor's <=800 pack200 branch or DYE_LOT_CEILING (D-04).
    Update the minCostBulk docstring to state the fewest-bags-within-overshoot-cap
    objective and the deterministic tiebreak order.
  </action>
  <acceptance_criteria>
    - `npx tsc --noEmit` exits 0.
    - `packColor('150','square',1050,{200:0.25,500:0.55,1000:0.8,2000:1.4}).bySize` === {1000:1, 500:1} — the wasteful 1x2000 plan is NOT selected (overshoot cap, worked example).
    - `packColor('150','square',2100,{200:2,500:4,1000:7,2000:12}).bySize` === {2000:1, 500:1} (unchanged).
    - `packColor('150','square',13533,...).bySize` === {2000:7} (unchanged).
    - `packColor('150','square',800,...).bySize` === {200:4} (dye-lot path untouched, D-04).
    - `rg -n 'const search' src/engine/bagPlanner.ts` still matches (recursive bounded search preserved — no greedy/solver, D-02).
    - Any cost comparison in the comparator routes through money.ts integer cents (no raw float threshold); no Math.random / Object.keys-order dependence.
  </acceptance_criteria>
  <verify>
    <automated>npx tsc --noEmit && npx vitest run src/engine/__tests__/bagPlanner.test.ts</automated>
  </verify>
  <done>
    tsc exits 0; the pre-existing bagPlanner packColor tests (2100 -> {2000:1,500:1};
    13533 -> {2000:7}; 800 -> {200:4}; unknown-code empty pack; PRICE-02 unpriced
    cases) all still pass; minCostBulk still contains the recursive bounded search
    (no solver/greedy replacement).
  </done>
</task>

<task type="auto">
  <name>Task 2: Add fewest-bags, deterministic-tie, dye-lot-untouched, and no-divergence tests</name>
  <files>src/engine/__tests__/bagPlanner.test.ts, src/engine/__tests__/checkout.test.ts</files>
  <read_first>
    - src/engine/__tests__/bagPlanner.test.ts (whole file — extend it; note existing PRICE_DB fixtures and the "estimate == cart (Candidate 1 regression)" block that already asserts packColor == compileShopifyCartLink)
    - src/engine/__tests__/checkout.test.ts (add the cart-side no-divergence assertion here if it fits the existing structure; otherwise co-locate in bagPlanner.test.ts)
    - src/engine/bagPlanner.ts (the minCostBulk you just changed — to author the standard-prices fixture)
  </read_first>
  <action>
    Add a describe block for the BAG-01 fewest-bags-within-overshoot-cap objective
    using the standard price table {200:0.25, 500:0.55, 1000:0.8, 2000:1.4}:
      1. The WORKED-EXAMPLE test for 1050 drills on a color with all four sizes
         (e.g. DMC '150' square): assert packColor('150','square',1050,STD).bySize
         === {1000:1, 500:1}, and explicitly assert the wasteful single-2000 plan is
         NOT selected (e.g. bySize[2000] is undefined). Add a comment: the 1x2000
         plan wastes 950 drills > one smallest bulk bag (500), so the LOCKED overshoot
         cap rejects it.
      2. A DETERMINISTIC-TIE test: craft a priceDb in which two DISTINCT acceptable
         plans have identical bag count AND identical total cost for one count, then
         assert packColor returns the largest-size-first composition, and that a
         second identical call returns a deeply-equal ColorPack (purity/stability).
      3. A DYE-LOT-UNTOUCHED guard (D-04): packColor('150','square',800) === {200:4}
         and a count of 700 still returns only 200-count bags (fewest-bags must NOT
         leak into the <=800 path).
      4. A NO-DIVERGENCE assertion (D-03): for a bulk fixture including the 1050
         count, the bags packColor produces equal the bags compileShopifyCartLink
         emits (reuse the existing estimate==cart parsing pattern), proving the
         legend and cart cannot diverge under the new comparator.
  </action>
  <acceptance_criteria>
    - `npx vitest run src/engine/__tests__/bagPlanner.test.ts src/engine/__tests__/checkout.test.ts` passes.
    - The 1050 worked-example test asserts bySize === {1000:1, 500:1} AND that 1x2000 is NOT selected (overshoot cap, LOCKED).
    - A determinism test asserts two identical packColor calls return a deeply-equal ColorPack, and the tie fixture returns the largest-size-first composition.
    - A D-04 guard asserts packColor('150','square',800) === {200:4} and 700 stays on 200-count bags.
    - A no-divergence test asserts packColor bags === cart bags for a bulk fixture including 1050.
  </acceptance_criteria>
  <verify>
    <automated>npx vitest run src/engine/__tests__/bagPlanner.test.ts src/engine/__tests__/checkout.test.ts</automated>
  </verify>
  <done>
    All four new assertions pass; the full engine + checkout suites are green; the
    1050 worked-example test asserts {1000:1, 500:1} (1x2000 rejected); a repeated
    packColor call is asserted deeply equal (determinism).
  </done>
</task>

</tasks>

<artifacts_produced>
## Artifacts this phase produces (Plan 16-01)

**Modified symbols:**
- `bagPlanner.ts::minCostBulk` — selection criterion changed from cost-min to fewest-bags-within-cap (same bounded search; new deterministic total-order tiebreaks: fewest packets -> lowest cost cents -> fewer total drills -> largest-size-first).

**New tests (no new production symbols):**
- `bagPlanner.test.ts` — describe block for the BAG-01 fewest-bags objective: 1050 worked-example, deterministic-tie/purity, dye-lot-untouched, no-divergence.
- `checkout.test.ts` — packColor == cart no-divergence assertion (if co-located here).

**Removed symbols:** none.

**Unchanged-by-contract:** `packColor` <=800 dye-lot `pack200` branch, `DYE_LOT_CEILING`, `isUnpriced`/unpriced-flagging, `priceColorPack`, `withSafetyMargin`.
</artifacts_produced>

<threat_model>
## Trust Boundaries

GemPixel is a fully client-side, in-browser app: no backend, no server, no auth,
no database, no network upload (images never leave the client). The only outbound
surface is the Shopify cart deep-link built by `checkout.ts::compileShopifyCartLink`
(unchanged this plan).

| Boundary | Description |
|----------|-------------|
| user image data -> optimizer | Untrusted image can yield very large grids -> extreme per-color drill counts fed into `minCostBulk`. Same trust domain (in-process), no network. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-16-01 | Denial of Service | bagPlanner.ts::minCostBulk bounded search | low | mitigate | Preserve the bounded enumeration (`maxN = ceil(requiredCount/size)` per larger size, smallest ceil-fills). The changed selection does not add an unbounded loop; extreme counts stay a few hundred evaluations. |
| T-16-02 | Tampering | cost/overshoot cap comparison | low | mitigate | All cost comparisons reconcile through money.ts integer cents (toCents throws on non-finite), so a tampered priceDb cannot make the cap silently pick a $0/NaN plan; unpriced sizes stay excluded. |

No package installs in this plan (no npm/pip/cargo), so no supply-chain (T-*-SC)
threat applies. No server/auth/injection surface exists in this client-only app.
**No threat at or above LOW/HIGH severity was found — there are no HIGH-severity
threats in this plan.**
</threat_model>

<verification>
- `npx tsc --noEmit` exits 0.
- `npm test` (vitest run) is fully green, including the pre-existing packColor,
  planColorSupply, estimate==cart, and PRICE-01/02 suites.
- `minCostBulk` still contains the recursive bounded `search` (grep confirms no
  greedy/solver replacement).
- The comparator implements the LOCKED overshoot cap (wasted drills <= one smallest
  available bulk bag); 1050 @ standard -> {1000:1, 500:1} (1x2000 rejected).
</verification>

<success_criteria>
- BAG-01: the bulk optimizer selects the fewest bags within the locked cap, with
  cost as the bounded tiebreak, and the <=800 dye-lot path is unchanged (D-04).
- D-03: packColor yields a total deterministic order; packColor == cart proven.
- D-02: the exact bounded search is preserved; no new dependency.
</success_criteria>

<output>
Create `.planning/phases/16-optimized-supply-plan-savings/16-01-SUMMARY.md` when done.
Note that the cap is the LOCKED overshoot cap (option-b), so downstream plans and
the savings clamp (16-02) account for it.
</output>
