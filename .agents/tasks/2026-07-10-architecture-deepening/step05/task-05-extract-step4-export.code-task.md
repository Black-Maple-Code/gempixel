# Task: Extract `Step4Export` as a pure step component

## Description
Extract the Step 4 (summary / save-project / reset) inline render block from `App.tsx` into a pure `src/features/wizard/steps/Step4Export.tsx`. Task 5 of 5 for **Step 5 (Candidate 5)** — the final step view. After this, `App.tsx` renders all four steps as `{wizard.step === n && <StepN .../>}` and is a thin coordinator composing the five extracted modules. Depends on task 01; do last.

## Background
The Step 4 block lives inline at `App.tsx:~2238` (`{wizardStep === 4 && (` … closes `:2337`; `research/current-state.md` §Candidate 5). **Corrected via re-grep:** this block does NOT contain export/print buttons or the Shopify cart link — it renders the Diamond Art Summary stats card, the "Save to My Images" form (name input + Update/Save-as-Copy/Save buttons, wired to `handleSaveProject`/`showSaveSuccess`), and the Start-Over/Reset button (`resetWorkspace`). The export/print buttons ("Order & Actions": Shopify checkout, PNG downloads, print-legend/print-report) live inside the **Step 3** block (`~:1908`, task-04's scope), and the "BUY SUPPLIES →" cart CTA lives in a separate, always-visible legend `<aside>` (`~:2989`) gated only by `matchResult`, not by any wizard step — neither belongs to this task. This block still gates on a match (`canEnter(4)`). Per design §4 Candidate 5 it becomes a pure props-in/JSX-out component rendered as `{wizard.step === 4 && <Step4Export .../>}`. No behavior change (design N1).

## Reference Documentation
**Required:**
- Design: `.agents/planning/2026-07-10-architecture-deepening/design/detailed-design.md` (§4 Candidate 5)
- Plan: `.agents/planning/2026-07-10-architecture-deepening/implementation/plan.md` (Step 5)
- Rules: `CLAUDE.md`, `.agents/GEMINI.md`

**Additional References (if relevant to this task):**
- `.agents/planning/2026-07-10-architecture-deepening/research/current-state.md` (§Candidate 5 — Step 4 block anchor `~:2238`)

**Note:** You MUST read design §4 Candidate 5 first. Re-grep the Step 4 block (`~:2238`) and its actual handlers before editing — do not assume export/print/cart controls are in scope (see Background correction above).

## Technical Requirements
1. Create `src/features/wizard/steps/Step4Export.tsx` — pure component; all data/handlers (summary stats, save-project form state/handlers, reset handler) passed as typed props. No `useState` mirroring app/engine state.
2. Move the JSX from `App.tsx:~2238` verbatim (locals → props). App renders `{wizard.step === 4 && <Step4Export {...props} />}`.
3. Preserve every id/class/handler this block actually renders (`#step4-save-name-input`, the Update / Save-as-Copy / Save-to-My-Images buttons, the `saveSuccessMsg` confirmation text, the `no-print` class on the Reset wrapper, the Start New Image/Reset button) — re-grep test-queried selectors. The export/print buttons and `BUY SUPPLIES →` cart link live outside this block (see Background) and are out of scope.
4. Structural move only; no token/Tailwind changes.

## Dependencies
- Task 01 (`useWizard`); App locals/handlers this block closes over: `handleSaveProject`, `showSaveSuccess`, `resetWorkspace`, `saveProjectName`/`setSaveProjectName`, `activeProjectId`, `saveSuccessMsg`, `matchResult`, `cols`, `rows`, `unit`, `drillStyle`, `drillType`, `totalSafetyDrills`, `totalCostSafety`.
- `src/__tests__/App.test.tsx`, `integration.test.tsx` — stay green (wizard nav / step-4 UI). Note: `print.test.tsx` only unit-tests the pure `calculateSafetyPurchase`/`optimizeBags` functions imported from `../App` (Candidate 1's concern, likely already repointed to `bagPlanner.ts` by an earlier step) — it exercises no JSX from this block; keep it green as part of the full suite, not as a signal for this component.

## Implementation Approach
1. Re-grep the Step 4 block; enumerate closed-over summary/save/reset handlers + supply-summary values → props interface.
2. Create `Step4Export.tsx`; paste JSX; replace locals with `props.*`; type props.
3. Swap the inline block for `<Step4Export .../>`. Confirm `App.tsx` now renders all four steps via `{wizard.step === n && <StepN .../>}` and holds no inline step JSX.
4. **Guardrail:** pure receiver only; preserve the `no-print` class and the save-form ids/handlers so tests and print layout still resolve.
5. **Verify gate (Cardinal Rule 4) + UI pass:** `npx tsc --noEmit` && `npm test` (≥99) && `npm run build` && `npm run dev` — the summary stats, save-project flow (new/update/copy), and reset button work as before at step 4. Commit only when green: `refactor(wizard): extract Step4Export component`.

## Acceptance Criteria

1. **Pure receiver** — Given `Step4Export.tsx`, when inspected, then summary/save-project data arrive via typed props with no mirrored state.
2. **Summary + save + reset unchanged** — Given step 4 (`npm run dev`) with a match, when reading the Diamond Art Summary stats, saving/updating/copying a project via the Save-to-My-Images form, and clicking Start New Image/Reset, then behavior is identical to before.
3. **App is a thin coordinator** — Given `App.tsx` after this task, when inspecting the wizard render, then it renders all four steps via `{wizard.step === n && <StepN .../>}` with no inline step JSX remaining.
4. **Suite + build green** — When `npx tsc --noEmit`, `npm test` (≥99, incl. `print.test.tsx`), `npm run build` run, then all pass.

## Metadata
- **Complexity**: Medium
- **Labels**: features, wizard, ui-extraction, summary, candidate-5
- **Required Skills**: Preact/JSX, project-save/reset flows, TypeScript, Vitest + jsdom
