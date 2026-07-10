# Task: Extract `Step1Ingest` as a pure step component

## Description
Extract the Step 1 (image ingest) inline render block from `App.tsx` into a pure `src/features/wizard/steps/Step1Ingest.tsx` component — props in, JSX out, no local `useState` mirroring engine state. Task 2 of 5 for **Step 5 (Candidate 5)**. Depends on task 01 (`useWizard`). Move exactly one step per increment so each diff stays reviewable and verifiable-green (design §C Risks; plan Step 5 guidance).

## Background
The Step 1 block currently lives inline at `App.tsx:~1370` (`research/current-state.md` §Candidate 5). Per design §4 Candidate 5: step views are **pure receivers** — each inline block becomes a component receiving its needed values/handlers as props, and App renders `{wizard.step === 1 && <Step1Ingest .../>}`. No behavior change (design N1); existing integration tests cover the rendered behavior.

## Reference Documentation
**Required:**
- Design: `.agents/planning/2026-07-10-architecture-deepening/design/detailed-design.md` (§4 Candidate 5)
- Plan: `.agents/planning/2026-07-10-architecture-deepening/implementation/plan.md` (Step 5)
- Rules: `CLAUDE.md`, `.agents/GEMINI.md`

**Additional References (if relevant to this task):**
- `.agents/planning/2026-07-10-architecture-deepening/research/current-state.md` (§Candidate 5 — Step 1 block anchor `~:1370`)

**Note:** You MUST read design §4 Candidate 5 first. Anchors are pre-drift (tasks 01 and Steps 1–4 moved lines) — re-grep the Step 1 ingest block before cutting it.

## Technical Requirements
1. Create `src/features/wizard/steps/Step1Ingest.tsx` as a pure Preact component: it receives every value and handler it needs via a typed `props` interface (image state, upload/browse handlers, size inputs, etc. — enumerate from the inline block). It holds **no** `useState` that mirrors engine/app state.
2. Move the JSX from the `App.tsx:~1370` block verbatim (only converting closed-over locals into props). App renders `{wizard.step === 1 && <Step1Ingest {...props} />}`.
3. Preserve all element ids/classes/handlers the tests and CSS rely on. Confirmed test-critical selectors inside this block (verified by grep, re-grep before cutting in case of drift): `#file-upload` (`App.test.tsx:451,461,800,838`; `integration.test.tsx:391,423`), `input[data-field="width"]` / `input[data-field="height"]` (`App.test.tsx:462`; `integration.test.tsx:402-403,443-444`), `#preset-size-select` (`integration.test.tsx:436`).
4. No Tailwind/token changes; this is a structural move only.

## Dependencies
- Task 01 (`useWizard`) — App gates the component with `wizard.step === 1`.
- `src/__tests__/App.test.tsx` + `integration.test.tsx` — must stay green (they exercise this step's behavior).

## Implementation Approach
1. Re-grep the Step 1 block; list every closed-over variable/handler it uses — those become the props interface.
2. Create `Step1Ingest.tsx`; paste the JSX; replace locals with `props.*`. Type the props explicitly.
3. Swap the inline block in `App.tsx` for `<Step1Ingest .../>`, passing the collected props.
4. **Guardrail — no state mirroring:** the component must not introduce `useState` for anything App owns; keep it a pure receiver (design §4 Candidate 5). Preserve ids/classes so existing selectors resolve.
5. **Verify gate (Cardinal Rule 4) + UI pass:** `npx tsc --noEmit` && `npm test` (≥99) && `npm run build` && `npm run dev` (Step 1 renders and behaves identically). Commit only when green: `refactor(wizard): extract Step1Ingest component`.

## Acceptance Criteria

1. **Pure receiver**
   - Given `Step1Ingest.tsx`
   - When inspecting it
   - Then it takes all data/handlers via typed props and declares no `useState` mirroring app/engine state.

2. **Behavior unchanged**
   - Given the app at wizard step 1 (`npm run dev`)
   - When uploading/browsing an image and setting size
   - Then it behaves exactly as before the extraction.

3. **Selectors preserved**
   - Given the existing integration tests
   - When they query Step 1 elements
   - Then all ids/classes/text they rely on still resolve (tests green).

4. **Suite + build green**
   - When `npx tsc --noEmit`, `npm test` (≥99), `npm run build` run
   - Then all pass and the build compiles.

## Metadata
- **Complexity**: Medium
- **Labels**: features, wizard, ui-extraction, candidate-5
- **Required Skills**: Preact/JSX, TypeScript, Vitest + jsdom
