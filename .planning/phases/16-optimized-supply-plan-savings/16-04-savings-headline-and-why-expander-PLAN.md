---
phase: 16-optimized-supply-plan-savings
plan: 04
type: execute
wave: 4
depends_on: ["16-03"]
files_modified:
  - src/App.tsx
  - src/features/wizard/steps/Step3Canvas.tsx
  - src/__tests__/print.test.tsx
autonomous: false
requirements: [BAG-02, BAG-03]
must_haves:
  truths:
    - "An always-on savings headline (e.g. 'Save $X (Y%) vs per-color') renders next to the displayed Est./Total cost, driven by planOrderSupply savings (D-08)."
    - "A persistent, keyboard-focusable 'Why these bags?' button toggles a single plain-language dye-lot sentence, with correct aria-expanded / aria-controls and an accessible name (D-09)."
    - "The print 'GemPixel Supply Plan Report' mirrors the savings headline and the dye-lot sentence as static text (D-10)."
  artifacts:
    - "src/App.tsx — 'Why these bags?' expander in the supply panel + static print mirror + savings compute/pass"
    - "src/features/wizard/steps/Step3Canvas.tsx — always-on savings headline near Total Cost"
    - "src/__tests__/print.test.tsx — savings + why-sentence mirror assertions"
  key_links:
    - "planOrderSupply savingsCents/savingsPct -> the Step3Canvas savings headline, the supply-panel expander, and the print report — one shared source, no recomputation."
  prohibitions:
    - "The 'why' is NOT a hover-only tooltip and NOT per-row computed tooltips/columns (D-09/D-10) — one static sentence behind a real <button>."
    - "No per-color savings columns or per-row info icons (deferred to Phase 18/19)."
    - "Savings + why copy is STATIC text (no per-row computed strings) so the print path stays a trivial mirror (D-10)."
---

<objective>
Surface the payoff and the reasoning on the existing supply panel in place
(BAG-02/BAG-03): an always-on savings headline next to the Est./Total cost (D-08),
a discoverable, a11y-safe "Why these bags?" expander revealing one plain-language
dye-lot sentence (D-09), and a static mirror of both in the printable "GemPixel
Supply Plan Report" (D-10). Do not anticipate the Phase 18 viewport rework —
augment the current panel minimally.

Purpose: BAG-03 savings explainer (the differentiator) + BAG-02 dye-lot "why".
Output: savings headline, "Why these bags?" expander, print mirror, tests.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/16-optimized-supply-plan-savings/16-CONTEXT.md
@src/engine/bagPlanner.ts
@src/engine/money.ts
</context>

<accessibility_contract>
No UI-SPEC exists for this phase (deliberately, --skip-ui). The "Why these bags?"
control's accessibility contract is therefore captured here as binding acceptance
criteria:
- It is a PERSISTENT, keyboard-focusable control — a real `<button type="button">`,
  NOT a hover-only tooltip.
- It has correct `aria-expanded` reflecting open/closed state, an `aria-controls`
  pointing at the revealed region's id, and an accessible name ("Why these bags?").
- The revealed content is a SINGLE plain-language static sentence (the dye-lot
  "why"), toggled on click / Enter / Space, and works on touch.
- The savings headline is always-on static text next to the Est./Total cost; the
  print path mirrors both statically.
</accessibility_contract>

<tasks>

<task type="auto">
  <name>Task 1: Always-on savings headline next to the Total cost</name>
  <files>src/App.tsx, src/features/wizard/steps/Step3Canvas.tsx</files>
  <read_first>
    - src/App.tsx (the planOrderSupply call wired in 16-03; surface savingsCents/savingsPct alongside the existing totalCostSafety derivation, and pass them to Step3Canvas)
    - src/features/wizard/steps/Step3Canvas.tsx lines 228-262 (the "Cost Estimate" card with the Total Cost figure at 252-259 where the headline mounts) and the Step3CanvasProps interface (add the new savings props)
    - src/engine/money.ts (formatUSD / fromCents for display formatting)
  </read_first>
  <action>
    Pass the aggregator's savings to Step3Canvas as new props (e.g. `savingsCents:
    number` and `savingsPct: number`, or a preformatted `savingsHeadline: string` —
    planner's discretion, keep it one clean line). In the Step3Canvas "Cost Estimate"
    card, render an always-on one-line headline immediately adjacent to the Total
    Cost figure, e.g. "Save $X (Y%) vs per-color" using fromCents/formatUSD for the
    dollar amount. When savingsCents is 0, render a truthful zero-state line (e.g.
    "No bulk savings at this size" or "Save $0.00 vs per-color") rather than hiding
    it — small-color $0 savings is a deliberate, honest signal (CONTEXT specifics).
    Keep it static text (no per-row computation). Choose $-and-% or $-only per
    discretion but keep it a single line. Do not restructure the card.
  </action>
  <acceptance_criteria>
    - `npx tsc --noEmit` exits 0 and `npm test` is green.
    - Step3Canvas receives savings from planOrderSupply via a new prop (no recomputation in the component).
    - An always-on one-line savings headline renders next to the Total Cost figure.
    - When savingsCents is 0, a truthful zero-state line renders (not hidden).
    - The dollar amount is formatted via money.ts (fromCents/formatUSD).
  </acceptance_criteria>
  <verify>
    <automated>npx tsc --noEmit && npm test</automated>
  </verify>
  <done>
    tsc exits 0; the Cost Estimate card shows an always-on savings line next to Total
    Cost driven by planOrderSupply savings; the zero-savings state renders a truthful
    line rather than disappearing; suite green.
  </done>
</task>

<task type="auto">
  <name>Task 2: "Why these bags?" a11y expander + static print mirror</name>
  <files>src/App.tsx, src/__tests__/print.test.tsx</files>
  <read_first>
    - src/App.tsx lines ~1895-1946 (the supply "DMC Supply List" panel header/table area where the expander mounts) and lines 2010-2060 (the print-only report block that must mirror the savings + why sentence statically)
    - src/App.tsx (existing collapsible idiom — e.g. supplyListOpen useState — to follow the same progressive-disclosure pattern for the expander's open/closed state)
    - src/__tests__/print.test.tsx (existing harness + patterns to extend with the mirror assertions)
  </read_first>
  <action>
    Add a `<button type="button">` labelled "Why these bags?" in the supply panel
    header (following the existing supplyListOpen collapsible idiom for state). Wire
    a boolean useState for its open/closed state; set `aria-expanded` to that state
    and `aria-controls` to the id of the revealed region. On click / Enter / Space
    (a native button already handles Enter/Space, so no custom key handler is
    needed) toggle the region, which contains ONE static plain-language sentence
    explaining the dye-lot grouping (e.g. that colors needing 800 drills or fewer are
    kept in single-lot 200-count bags so every dot in a color matches, and only
    larger colors are consolidated into bigger bulk bags). Keep the sentence a static
    string constant — no per-row/per-color computation (D-10). In the print-only
    report block, render the SAME savings headline and the SAME dye-lot sentence as
    static text (they must appear when printing regardless of the on-screen expander
    state, so the printed report is self-contained). Do not add per-color tooltips,
    columns, or info icons (D-09/D-10 rejected; deferred).
  </action>
  <acceptance_criteria>
    - `npx tsc --noEmit` exits 0.
    - The "Why these bags?" control is a real `<button type="button">` with the accessible name "Why these bags?", `aria-expanded` bound to its open state, and `aria-controls` pointing at the revealed region id.
    - Toggling reveals exactly ONE static plain-language dye-lot sentence (a string constant, no per-row computation).
    - The print-only report block renders both the savings headline text and the dye-lot sentence statically, regardless of on-screen expander state.
    - print.test.tsx asserts the mirrored savings + dye-lot strings are present in the report.
    - No per-color tooltips / columns / info icons are added.
  </acceptance_criteria>
  <verify>
    <automated>npx tsc --noEmit && npx vitest run src/__tests__/print.test.tsx</automated>
  </verify>
  <done>
    tsc exits 0; the expander is a real button with aria-expanded/aria-controls and
    the accessible name "Why these bags?"; toggling reveals exactly one static
    sentence; the print report block contains both the savings headline text and the
    dye-lot sentence statically; print.test.tsx asserts the mirrored strings are
    present.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verify the savings headline + "Why these bags?" a11y and print mirror</name>
  <files>src/App.tsx, src/features/wizard/steps/Step3Canvas.tsx</files>
  <action>Pause for the developer to run the app and confirm the savings headline, the keyboard/touch-accessible "Why these bags?" expander, and the static print mirror behave per the steps below. Do not proceed until they approve.</action>
  <what-built>
    An always-on savings headline next to the Total cost, a persistent
    keyboard-focusable "Why these bags?" expander revealing one plain-language
    dye-lot sentence (aria-expanded/aria-controls, click/Enter/Space, touch), and a
    static mirror of both in the printable supply report.
  </what-built>
  <how-to-verify>
    1. Run `npm run dev` and open http://localhost:5173; load any image so a plan
       computes.
    2. In the Cost & Order (Step 3) panel, confirm the savings line reads "Save $X
       (Y%) vs per-color" next to Total Cost, and that a small-color-only image shows
       a truthful $0 line rather than a blank.
    3. Tab to the "Why these bags?" control with the KEYBOARD (no mouse) — confirm it
       is focusable, press Enter then Space to toggle it, and confirm the single
       dye-lot sentence appears/disappears. Confirm it also toggles by tap/click.
    4. Use "Print Supply Report" (or the browser print preview) and confirm the
       printed "GemPixel Supply Plan Report" shows the same savings headline and the
       same dye-lot sentence as static text.
    5. Confirm no per-color tooltips/columns/info icons were added.
  </how-to-verify>
  <acceptance_criteria>
    - The developer confirms the savings headline, the keyboard- and touch-operable "Why these bags?" expander, and the static print mirror all behave as described, then types "approved" (or lists issues to fix before approval).
  </acceptance_criteria>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<artifacts_produced>
## Artifacts this phase produces (Plan 16-04)

**New UI (no new exported engine symbols):**
- Savings headline in Step3Canvas.tsx (new `savingsCents`/`savingsPct` or `savingsHeadline` Step3Canvas prop, sourced from planOrderSupply).
- "Why these bags?" `<button>` expander + its open/closed useState + the revealed static dye-lot sentence in App.tsx's supply panel.
- Static savings + dye-lot-sentence mirror in the print-only "GemPixel Supply Plan Report" block.

**New copy strings (static):** the savings headline template and the one-sentence dye-lot "why".

**New tests:** print.test.tsx assertions that the report mirrors the savings headline and the dye-lot sentence.

**Removed symbols:** none.
</artifacts_produced>

<threat_model>
## Trust Boundaries

Fully client-side app (no backend/server/auth/db/upload). This plan only renders
planOrderSupply output as static copy; no new outbound surface. The Shopify cart
deep-link (checkout.ts) is untouched.

| Boundary | Description |
|----------|-------------|
| planOrderSupply savings -> displayed/printed headline | A misleading savings figure would be a truthfulness issue, not a security breach; mitigated upstream. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-16-01 | Tampering | savings headline value | low | mitigate | The headline consumes planOrderSupply.savingsCents (already integer-cents, clamped >= 0 in 16-02); this plan formats via money.ts formatUSD and never recomputes savings, so it cannot introduce a misleading or NaN figure. |

No package installs (no npm/pip/cargo) -> no supply-chain threat. No new auth,
network, or injection surface. **No HIGH-severity threats exist in this plan.**
</threat_model>

<verification>
- `npx tsc --noEmit` exits 0; `npm test` fully green including the new print.test.tsx
  mirror assertions.
- The "Why these bags?" control is a real button with aria-expanded/aria-controls and
  the accessible name; one static sentence; works via keyboard and touch.
- The print report mirrors the savings headline + dye-lot sentence statically.
- Human-verify checkpoint approved.
</verification>

<success_criteria>
- BAG-02: a plain-language explanation tells the user why bags are grouped as they
  are (the dye-lot "why"), behind an a11y-safe expander (D-09).
- BAG-03: the user sees how much the optimized plan saves versus a naive per-color
  purchase, as an always-on headline (D-08), mirrored in print (D-10).
</success_criteria>

<output>
Create `.planning/phases/16-optimized-supply-plan-savings/16-04-SUMMARY.md` when done.
</output>
