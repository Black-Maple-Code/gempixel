# Task: Extract `Step2Palette` as a pure step component

## Description
Extract the Step 2 (palette / kit + exclusions) inline render block from `App.tsx` into a pure `src/features/wizard/steps/Step2Palette.tsx`. Task 3 of 5 for **Step 5 (Candidate 5)**. Depends on task 01 (`useWizard`); best done after task 02. One step per increment, verified green.

## Background
The Step 2 block lives inline at `App.tsx:~1693` (`research/current-state.md` §Candidate 5), confirmed at the exact same line in the current file. It is larger than kit + exclusions alone: the single `{wizardStep === 2 && (...)}` block (`~1693`–`~1906`) also contains the Drill Type (Finish) selector (`drillType`), the Color Substitution controls (`enableSubstitution`, `substitutionThreshold`), and the DMC Supply List legend table (`sortedMatches`, `highlightedColor`, row-click handler, `optimizeBagsCost` for bag-vs-packet cost display) — all of it must move together per design §4 Candidate 5's "corresponding inline block extracted" (`App.tsx:1370/1693/1908/2238`). Kit selection (`selectedBaseKit`) and color exclusions (`excludedColors`) remain the headline inputs to the Candidate 4 resolver (Step 2 of the overall plan) and the matcher, but they are not the only state this component touches. Per design §4 Candidate 5, it becomes a pure props-in/JSX-out component rendered as `{wizard.step === 2 && <Step2Palette .../>}`. No behavior change (design N1).

## Reference Documentation
**Required:**
- Design: `.agents/planning/2026-07-10-architecture-deepening/design/detailed-design.md` (§4 Candidate 5)
- Plan: `.agents/planning/2026-07-10-architecture-deepening/implementation/plan.md` (Step 5)
- Rules: `CLAUDE.md`, `.agents/GEMINI.md`

**Additional References (if relevant to this task):**
- `.agents/planning/2026-07-10-architecture-deepening/research/current-state.md` (§Candidate 5 — Step 2 block anchor `~:1693`; §Candidate 4 — `selectedBaseKit`/`excludedColors`)

**Note:** You MUST read design §4 Candidate 5 first. Re-grep the Step 2 palette block and the `selectedBaseKit`/`excludedColors` handlers (anchors have drifted).

## Technical Requirements
1. Create `src/features/wizard/steps/Step2Palette.tsx` — pure component; all data/handlers closed over by the block must be lifted to typed props (verify via re-grep, not just this list — the block spans `~1693`–`~1906`):
   - Kit: `selectedBaseKit` (value) + `setSelectedBaseKit` (also resets `excludedColors` on change, `~1712-1715`).
   - Drill Type (Finish): `drillType` + `setDrillType` (`~1733-1737`).
   - Substitution: `enableSubstitution` + `setEnableSubstitution`, `substitutionThreshold` + `setSubstitutionThreshold` (`~1754-1783`).
   - Exclusion checklist: `excludedColors`, `excludeListOpen` + `setExcludeListOpen`, `handleSelectAll`, `handleDeselectAll`, `toggleColorExclusion`, and **`baseCandidates`** (NOT `activeCandidates`) as the palette rows iterated for the checklist (`~1824`) — `baseCandidates` is the unfiltered per-kit list, which is required so already-excluded colors still render (unchecked) and can be re-included; `activeCandidates` already excludes them and would make exclusion irreversible from this UI.
   - DMC Supply List legend table: `sortedMatches` (row data), `highlightedColor` + row-click handler (`handleRowClick`), `optimizeBagsCost` (toggles bag-cost vs. packet-cost column display, `~1889`).
   No `useState` mirroring app/engine state.
2. Move the JSX from `App.tsx:~1693` verbatim (locals → props). App renders `{wizard.step === 2 && <Step2Palette {...props} />}`.
3. Preserve every id/class/handler and control the tests/CSS depend on — the kit selector and drill type selector are both `<select>` dropdowns (NOT radios), in that DOM order; the substitution toggle is `#substitute-colors-checkbox`; the exclusion list uses per-row checkboxes plus the "Exclude Colors" / "Select All" / "None" buttons. Re-grep test-queried selectors before assuming any of these markup shapes.
4. Structural move only; no token/Tailwind changes.

## Dependencies
- Task 01 (`useWizard`).
- `selectedBaseKit` / `excludedColors` state + handlers, plus `drillType`, `enableSubstitution`, `substitutionThreshold`, `excludeListOpen`, `highlightedColor`, `optimizeBagsCost` and their setters/handlers, in `App.tsx`. `baseCandidates` (not the Candidate 4 `activeCandidates` memo) is the value this component's checklist needs; if the Candidate 4 resolver has landed by the time this task runs, confirm it still exposes `baseCandidates` (or an equivalent unfiltered-per-kit list) alongside `activeCandidates`.
- `src/__tests__/App.test.tsx` — stay green; specifically its "updates default drill packet cost when drill type changes" and "allows progression for loaded projects … display isolation" tests exercise this component's DOM directly. Note: `integration.test.tsx`'s "Exclude Colors" / "DMC Supply List" toggle tests target the always-visible right-sidebar `<aside>` (a separate render location sharing the same lifted state, not gated by wizard step) — they will stay green regardless of how this extraction goes and do NOT verify `Step2Palette` itself.

## Implementation Approach
1. Re-grep the Step 2 block; enumerate closed-over values/handlers → props interface.
2. Create `Step2Palette.tsx`; paste JSX; replace locals with `props.*`; type props.
3. Swap the inline block for `<Step2Palette .../>` in `App.tsx`.
4. **Guardrail:** keep it a pure receiver (no mirrored state); preserve ids/classes for selectors.
5. **Verify gate (Cardinal Rule 4) + UI pass:** `npx tsc --noEmit` && `npm test` (≥99) && `npm run build` && `npm run dev` (kit change, drill type change, substitution toggle/threshold, and color exclusion all update the grid/legend as before; DMC Supply List rows still highlight on click). Commit only when green: `refactor(wizard): extract Step2Palette component`.

## Acceptance Criteria

1. **Pure receiver** — Given `Step2Palette.tsx`, when inspected, then all inputs arrive via typed props with no state mirroring.
2. **Behavior unchanged** — Given step 2 (`npm run dev`), when changing kit / drill type / substitution settings / excluding colors, then the grid + candidates + DMC Supply List update exactly as before.
3. **Selectors preserved** — Given `App.test.tsx`'s "updates default drill packet cost when drill type changes" test (navigates to the "Palette & Optimize" tab and reads `document.querySelectorAll('select')[1]` as the drill type select — i.e. the kit select must remain the *first* `<select>` and drill type the *second*, in DOM order) and its "display isolation" test (`selectElementsStep2.find(s => s.value === '200')` for the kit select), when they query Step 2 controls, then all ids/classes/text/DOM order still resolve (green).
4. **Suite + build green** — When `npx tsc --noEmit`, `npm test` (≥99), `npm run build` run, then all pass.

## Metadata
- **Complexity**: Medium
- **Labels**: features, wizard, ui-extraction, candidate-5
- **Required Skills**: Preact/JSX, TypeScript, Vitest + jsdom
