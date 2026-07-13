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
autonomous: false
requirements: [BAG-01]
must_haves:
  truths:
    - "packColor packs a >800 bulk color into the FEWEST bags that respect the cap (D-01), while the <=800 dye-lot path returns 200-count bags unchanged (D-04)."
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
Output: an updated `minCostBulk`, extended engine + checkout tests, and a locked
cap-semantics decision.
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

<cap_ambiguity_notice>
The planner found a material contradiction the executor MUST resolve at Task 1
before writing any comparator code:

- **D-01 (locked) wording** defines a COST-premium cap: accept a fewer-bags plan
  only when `cost <= costMin + price of one smallest available bag`.
- **The CONTEXT worked example** (1050 drills @ standard prices `{200:0.25,
  500:0.55, 1000:0.8, 2000:1.4}`): `1x2000` = $1.40 (1 bag, wastes 950 drills)
  vs `1x1000 + 1x500` = $1.35 (2 bags, wastes 450). The premium is only **$0.05**
  — far below any bag price — so the LITERAL cost cap would ACCEPT `1x2000`.
  Yet the worked example says the cap must REJECT `1x2000` here.

Rejecting `1x2000` for 1050 is only reproducible with an **overshoot/waste** cap
(950 wasted drills > one bulk bag), not the cost cap D-01 literally describes.
These cannot both hold. Task 1 (checkpoint:decision) locks which cap governs; the
implementation and worked-example test in Tasks 2-3 branch on that decision.
</cap_ambiguity_notice>

<tasks>

<task type="checkpoint:decision" gate="blocking">
  <name>Task 1: Lock the cost-premium cap semantics (D-01 vs worked example)</name>
  <files>src/engine/bagPlanner.ts</files>
  <action>Present the two cap options below to the developer and record their choice (option-a-cost-cap or option-b-overshoot-cap) in the SUMMARY. Do NOT write any comparator code until the option is locked — Tasks 2 and 3 branch on it.</action>
  <decision>Which cap bounds the fewest-bags selection in minCostBulk, given the D-01-wording vs worked-example contradiction above?</decision>
  <context>
    D-01 (locked) is the primary contract but its literal COST cap and its own
    worked example disagree on the 1050-drill case. BAG-01/ROADMAP SC1 make
    "fewest bags primary" the priority; D-03 makes the resulting order a
    non-negotiable, deterministic invariant shared by the legend and the cart.
    Both options below produce a total deterministic order with identical final
    tiebreaks (fewer total drills, then largest-size-first); they differ ONLY in
    the accept/reject threshold for a fewer-bags plan.
  </context>
  <options>
    <option id="option-a-cost-cap">
      <name>Cost-premium cap — D-01 literal wording</name>
      <pros>Implements D-01's locked text verbatim; keeps "fewest bags primary" with a cost band; simplest to reason about.</pros>
      <cons>For 1050 @ standard it SELECTS 1x2000 ($1.40, wastes 950 drills), which the CONTEXT worked example and the downstream test say is the wasteful plan to avoid. Savings for such a color is $0.</cons>
    </option>
    <option id="option-b-overshoot-cap">
      <name>Overshoot/waste cap — matches the worked example</name>
      <pros>Reproduces the worked example (1050 -> 1x1000+1x500) and the downstream test; realizes the cap's stated PURPOSE (prevent wasteful overshoot); yields honest non-zero savings.</pros>
      <cons>Reinterprets D-01's "cost <= costMin + smallest bag" as an overshoot bound (wasted drills <= one smallest available bulk bag). D-01 is locked, so this needs the developer's sign-off.</cons>
    </option>
  </options>
  <recommendation>
    Option B. The worked example AND the downstream test both require 1050 -> {1000:1, 500:1}, and "prevent wasteful overshoot" is the cap's stated intent. Option A honors D-01's literal wording but produces exactly the wasteful single-2000 the example warns against. Selecting B reinterprets the cap metric from cost to overshoot; confirm because D-01 is a locked decision.
  </recommendation>
  <acceptance_criteria>
    - The developer explicitly selects option-a-cost-cap OR option-b-overshoot-cap.
    - The chosen option is recorded in 16-01-SUMMARY.md so Tasks 2-3 and downstream plans can reference it.
    - No comparator code is written before the option is locked.
  </acceptance_criteria>
  <resume-signal>Select: option-a-cost-cap or option-b-overshoot-cap</resume-signal>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Change minCostBulk selection to fewest-bags-within-the-locked-cap</name>
  <files>src/engine/bagPlanner.ts</files>
  <read_first>
    - src/engine/bagPlanner.ts (whole file — current minCostBulk lines ~120-183 is the exact bounded search; packColor ~63-112 shows the <=800 dye-lot branch and how bulkSizes feed minCostBulk; note ColorPack shape and the isUnpriced Infinity handling)
    - src/engine/money.ts (integer-cents helpers — any cost comparison the cap needs must reconcile through toCents/sumCents, never raw float thresholds)
    - src/engine/checkout.ts (~33-64 — compileShopifyCartLink calls packColor with the same priceDb: the "cannot diverge" contract)
  </read_first>
  <behavior>
    - >800 color, count 2100 @ PRICE_DB {200:2,500:4,1000:7,2000:12}: still {2000:1, 500:1} (2 bags is already the minimum for 2100; unchanged from today).
    - >800 color, count 13533 @ same PRICE_DB: still {2000:7} (7 bags is the minimum; unchanged).
    - 1050 @ standard prices {200:0.25,500:0.55,1000:0.8,2000:1.4}: result is DECIDED by Task 1 — Option A -> {2000:1}; Option B -> {1000:1, 500:1}.
    - <=800 color, count 800: {200:4} unchanged (dye-lot rule overrides fewest-bags, D-04).
    - Deterministic tie: when two minimal plans have equal bag count AND equal total cost, the largest-size-first plan is returned, every call.
  </behavior>
  <action>
    Preserve the exact bounded enumeration in `minCostBulk` (the recursive `search`
    over counts of every size but the smallest, smallest ceil-fills the remainder)
    — do NOT replace it with a greedy or solver approach (D-02). Change ONLY the
    selection step: instead of tracking the single cheapest `total`, enumerate the
    same candidate plans and select by the locked cap from Task 1:
      1. Compute `costMin` (the minimum cost over all covering candidates) exactly
         as today, in integer cents via money.ts (never a raw float threshold).
      2. Determine the acceptance band per the Task-1 decision — Option A: a
         candidate is acceptable when its cost cents <= costMin cents + toCents(price
         of the smallest available bulk size). Option B: a candidate is acceptable
         when its overshoot (coveredDrills - requiredCount) <= the smallest available
         bulk size.
      3. Among ACCEPTED candidates, pick the one with the FEWEST packets; break ties
         by lowest cost cents; then by fewer total drills; then largest-size-first
         (descending size composition). These final tiebreaks make the order TOTAL
         and deterministic (D-03) so packColor never depends on Object key order or
         float wobble.
    Keep the unpriced-size handling intact: unpriced bulk sizes stay excluded from
    the candidate set (priced-only), and a color coverable ONLY by unpriced sizes
    still returns the flagged empty pack (hasUnpricedSize=true) — unchanged from
    today. Do NOT touch packColor's <=800 pack200 branch or DYE_LOT_CEILING (D-04).
    Update the minCostBulk docstring to state the new fewest-bags-within-cap
    objective and the deterministic tiebreak order.
  </action>
  <acceptance_criteria>
    - `npx tsc --noEmit` exits 0.
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
  <name>Task 3: Add fewest-bags, deterministic-tie, dye-lot-untouched, and no-divergence tests</name>
  <files>src/engine/__tests__/bagPlanner.test.ts, src/engine/__tests__/checkout.test.ts</files>
  <read_first>
    - src/engine/__tests__/bagPlanner.test.ts (whole file — extend it; note existing PRICE_DB fixtures and the "estimate == cart (Candidate 1 regression)" block that already asserts packColor == compileShopifyCartLink)
    - src/engine/__tests__/checkout.test.ts (add the cart-side no-divergence assertion here if it fits the existing structure; otherwise co-locate in bagPlanner.test.ts)
    - src/engine/bagPlanner.ts (the minCostBulk you just changed — to author the standard-prices fixture)
  </read_first>
  <action>
    Add a describe block for the BAG-01 fewest-bags objective using the standard
    price table {200:0.25, 500:0.55, 1000:0.8, 2000:1.4}:
      1. The WORKED-EXAMPLE test for 1050 drills on a color with all four sizes
         (e.g. DMC '150' square). Assert the result the Task-1 decision dictates:
         Option A -> packColor('150','square',1050,STD).bySize === {2000:1};
         Option B -> === {1000:1, 500:1}. Include a comment naming which option was
         locked so the assertion's intent is unambiguous.
      2. A DETERMINISTIC-TIE test: craft a priceDb in which two DISTINCT minimal
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
    - The 1050 worked-example test asserts the Task-1-locked outcome ({2000:1} for A, {1000:1,500:1} for B) with a comment naming the locked option.
    - A determinism test asserts two identical packColor calls return a deeply-equal ColorPack, and the tie fixture returns the largest-size-first composition.
    - A D-04 guard asserts packColor('150','square',800) === {200:4} and 700 stays on 200-count bags.
    - A no-divergence test asserts packColor bags === cart bags for a bulk fixture including 1050.
  </acceptance_criteria>
  <verify>
    <automated>npx vitest run src/engine/__tests__/bagPlanner.test.ts src/engine/__tests__/checkout.test.ts</automated>
  </verify>
  <done>
    All four new assertions pass; the full engine + checkout suites are green; the
    1050 worked-example test encodes the Task-1-locked outcome; a repeated packColor
    call is asserted deeply equal (determinism).
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
- The Task-1 decision is recorded in the SUMMARY so downstream plans know which
  cap governs.
</verification>

<success_criteria>
- BAG-01: the bulk optimizer selects the fewest bags within the locked cap, with
  cost as the bounded tiebreak, and the <=800 dye-lot path is unchanged (D-04).
- D-03: packColor yields a total deterministic order; packColor == cart proven.
- D-02: the exact bounded search is preserved; no new dependency.
</success_criteria>

<output>
Create `.planning/phases/16-optimized-supply-plan-savings/16-01-SUMMARY.md` when done.
Record the locked cap option (A or B) prominently for downstream plans.
</output>
