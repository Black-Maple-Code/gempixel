---
phase: quick-260716-tlu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/App.tsx
  - src/features/wizard/AtelierShell.tsx
autonomous: true
requirements: [QUICK-260716-tlu]
must_haves:
  truths:
    - "The wizard header (top-right) shows BOTH a New and a Save control; clicking New resets the workspace, clicking Save opens the save-project modal"
    - "No floating New / Save-project buttons remain over the top-right of the right-hand config panel"
    - "On REFINE, SUPPLIES and ORDER the right-hand config panel sits flush against the browser's right edge (no gutter) at desktop widths"
    - "Content begins tight under the step-wizard header — no large empty vertical band between the step bar and the viewport/panel"
    - "Narrow / mobile layout still reflows to a single column with no horizontal overflow"
    - "No functionality is lost: New = resetWorkspace, Save = save-project modal, both still gated exactly as before"
  artifacts:
    - src/App.tsx
    - src/features/wizard/AtelierShell.tsx
  key_links:
    - "AtelierShell header New button (id=new-project-btn) -> onNew prop -> App resetWorkspace (App.test.tsx querySelector('#new-project-btn') depends on this id)"
    - "AtelierShell header Save pill -> onSave prop -> App save-modal handler (already identical to the removed floating Save-project button)"
    - "App frame wrapper width/padding (drop max-w-[1180px]+mx-auto, pr-0) -> right-most screen panel lands flush against the viewport right edge"
---

<objective>
Three cohesive, browser-verifiable layout fixes to the GemPixel wizard UI (Preact + Tailwind v4). All three are visual/structural — no engine, worker, pricing, or persistence changes, and NO new dependencies.

1. **Tighten the vertical dead space** between the top step-wizard header (UPLOAD / REFINE / SUPPLIES / ORDER) and the content/viewport.
2. **Make the right-hand config panel flush to the browser's right edge** (no gap), staying responsive.
3. **Consolidate the workspace buttons into the header** — add a "New" button beside the existing header "Save" pill (wired to `resetWorkspace`), and remove the two floating "New" / "Save project" buttons that sit over the top-right of the right-hand panel.

Issues 1 and 3 share the same JSX band: the floating action-row (`App.tsx` ~1578-1602) is exactly the empty gap under the step bar, so removing it + tightening the frame's top padding resolves both. Issue 2 is the centered `max-w-[1180px] mx-auto px-4` frame wrapper (`App.tsx` ~1543).

Purpose: A cleaner, tighter, edge-to-edge canvas-first wizard where New/Save live only in the header.
Output: Modified `src/App.tsx` (frame wrapper + removed floating row + `onNew` wiring) and `src/features/wizard/AtelierShell.tsx` (new header New button).
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@src/App.tsx                              # header wiring (~1479-1535), floating action row (~1578-1602), frame wrapper (~1542-1543), resetWorkspace (~395)
@src/features/wizard/AtelierShell.tsx     # header chrome + Save pill (~59-91); add the New button here

# Reference only — the right-hand panels that must land flush-right. Do NOT edit; confirm their roots are the right-most flex child:
@src/features/screens/RefineScreen.tsx    # root section: max-w-[320px] border-l (right rail on step 2)
@src/features/screens/SuppliesScreen.tsx  # right summary: md:w-[320px] border-l md:sticky
@src/features/screens/OrderScreen.tsx     # right options panel: flex-1 bg-panel-2

# Tests that pin behavior (must stay green):
@src/__tests__/App.test.tsx               # querySelector('#new-project-btn').click() expects resetWorkspace (lines ~288, ~901)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Move New + Save into the header; delete the floating action row (fixes Issue 3 and the primary cause of Issue 1)</name>
  <files>src/features/wizard/AtelierShell.tsx, src/App.tsx</files>
  <action>
    In `src/features/wizard/AtelierShell.tsx`: add a required `onNew: () => void` prop to `AtelierShellProps` (with a short doc comment: "Reset-workspace handler for the header New button"), and destructure it in the `AtelierShell({ ... })` signature. In the header's right area (currently the lone Save `<button>` at ~83-90), wrap the controls in a right-aligned flex group: replace the single Save button with a `<div className="flex items-center gap-2">` containing, in order, a new "New" button THEN the existing Save pill (leave the Save pill markup exactly as-is).

    The new "New" button: `id="new-project-btn"` (REQUIRED — App.test.tsx querySelectors this id and expects it to trigger resetWorkspace; the id moves from the deleted floating button to here), `type="button"`, `onClick={onNew}`, `title="Reset the workspace to start a new image"`, and a secondary/ghost pill style that matches the Save pill's shape but reads as secondary: `className="rounded-[20px] border border-border px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted transition-all cursor-pointer hover:bg-border hover:text-ink"`. New is always enabled (no disabled state, matching the old floating New).

    In `src/App.tsx`: (a) pass `onNew={resetWorkspace}` to `<AtelierShell ...>` (add it alongside the existing `onSave`/`canSave` props, ~1484-1488). (b) DELETE the entire floating action-row block — the comment plus `<div className="no-print mb-3 flex items-center justify-end gap-2"> ... New ... Save project ... </div>` (~1578-1602, both buttons). Do NOT touch `resetWorkspace` or the save-modal handler: the header Save pill's `onSave` already runs the identical setSaveProjectName + setSaveModalOpen(true) logic that the removed floating "Save project" button ran, and is gated by the same `canSave={!!matchResult}`, so no behavior is lost.

    Removing the floating row also collapses the empty band under the step bar, addressing Issue 1's main cause (Task 2 finishes the top-spacing tighten).
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx vitest run src/__tests__/App.test.tsx</automated>
    Browser (dev server): New + Save both appear top-right in the header; no floating New/Save-project buttons remain over the panel. Clicking header New resets to Step 1 (canvas unmounts, Next disabled); clicking header Save opens the "Save to My Images" modal.
  </verify>
  <done>Header hosts New (id=new-project-btn, wired to resetWorkspace) + Save (unchanged); the floating New/Save-project row is deleted; App.test.tsx #new-project-btn reset tests pass; header Save still opens the save modal — no functionality dropped.</done>
</task>

<task type="auto">
  <name>Task 2: Full-bleed the frame so the right panel is flush-right, and tighten the top spacing (fixes Issue 2 and finishes Issue 1)</name>
  <files>src/App.tsx</files>
  <action>
    Edit the inner frame wrapper (~1543): `<div className="mx-auto flex min-h-full w-full max-w-[1180px] flex-col px-4 py-4 print:p-0">`.

    Make three class changes on this element:
    - Remove `mx-auto` and `max-w-[1180px]` so the workspace spans the full viewport width (full-bleed). This lets the right-most config panel reach the browser's right edge instead of being trapped inside a centered 1180px card.
    - Change `px-4` to `pl-4 pr-0` — keep the left gutter (so the canvas isn't jammed against the left edge) but drop the right gutter so the right rail is truly flush (no gap), per Issue 2.
    - Change `py-4` to `pt-2 pb-4` — tighten the top band so content sits close under the step bar (finishes Issue 1).

    Leave everything else on the wrapper (`flex min-h-full w-full flex-col print:p-0`) unchanged. Do NOT change the screens row's `justify-center` (~1614): on Refine the flex-1 canvas already consumes free space so the 320px rail is pushed to the (now gutter-less) right edge; on Upload it still centers the single column. Do NOT change the `@max-[640px]:flex-col` reflow — below 640px the rail becomes a full-width column, so `pr-0` introduces no horizontal overflow.

    No change needed inside the screen components: RefineScreen's root (`max-w-[320px] border-l`), SuppliesScreen's right summary (`md:w-[320px] border-l md:sticky`), and OrderScreen's right options panel (`flex-1`) are each already the right-most flex child and will land flush against the viewport right edge once the frame's right gutter and width cap are gone. Leave the AtelierShell Zone-3 Back/Next `bottomBar` inner row (`mx-auto max-w-[1180px]`) as-is (out of scope) — just eyeball that it still looks aligned.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx vitest run</automated>
    Browser (dev server) at a wide desktop width (~1280px+): upload an image, go to REFINE — the "How big should it be?" rail is flush against the browser's right edge with no gutter, and content sits tight under the step bar. Repeat on SUPPLIES and ORDER (their right panels flush-right too). Then narrow the window to ~360px: layout reflows to a single column with no horizontal scrollbar.
  </verify>
  <done>Right config panel is flush against the viewport right edge on REFINE/SUPPLIES/ORDER at desktop widths; the dead space under the header is reduced; mobile (@max-[640px]) still reflows to one column with no horizontal overflow; full Vitest suite and tsc stay green.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` → 0 type errors (new `onNew` prop is typed and passed).
- `npx vitest run` → suite green (>= prior 355-pass floor). The two `#new-project-btn` reset tests pass with the id now living in the header.
- `npm run dev` → manual browser walkthrough confirming all three fixes across UPLOAD/REFINE/SUPPLIES/ORDER at both desktop (~1280px) and narrow (~360px) widths.
</verification>

<success_criteria>
1. Header top-right shows both New and Save; New → resetWorkspace, Save → save-project modal; the two floating buttons are gone.
2. Right-hand config panel is flush to the browser's right edge (no gap) on steps 2-4 at desktop widths.
3. Content sits tight under the step-wizard header (dead space removed).
4. Layout stays responsive — single-column reflow below 640px, no horizontal overflow.
5. No lost functionality, no new dependencies, existing test suite and typecheck remain green.
</success_criteria>

<output>
Create `.planning/quick/260716-tlu-fix-three-gempixel-wizard-layout-issues-/260716-tlu-SUMMARY.md` when done.
</output>
