# Phase 20: Atelier Design System & Canvas-First Shell - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 20-atelier-design-system-canvas-first-shell
**Areas discussed:** Strangler seam & step mapping, Dark-mode rip-out depth, Font hosting & no-CLS, Step-nav gating & viewer mount
**Mode:** advisor (research-backed comparison tables; calibration tier = standard; NON_TECHNICAL_OWNER = false)

---

## Strangler seam & step mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Pure StepBar + shell | New pure `<StepBar>`/`<AtelierShell>` chrome fed by existing `useWizard` via props + a `STEP_META` label map; collapses today's two nav surfaces into one; App stays state owner; indices 1..4 unchanged. | ✓ |
| In-place relabel in App.tsx | Delete both existing nav surfaces, drop one 4-step bar bound to `wizard.step`, rename labels inline. Leanest but labels scattered across 2449 lines; revisit App.tsx in Phase 23. | |
| Outer shell mirrors wizard index | New top-level shell mirrors the index with body verbatim beneath. Forces lifting state (breaks state-owner rule) or duplicating it (dual source of truth). | |

**User's choice:** Pure StepBar + shell (Recommended)
**Notes:** Research surfaced that App.tsx today carries TWO nav surfaces (desktop dot-footer ~L1474, mobile bottom bar ~L1523); SHELL-01's "no second navigator" work is collapsing both into one bar.

---

## Dark-mode rip-out depth

| Option | Description | Selected |
|--------|-------------|----------|
| Staged: UI rip + engine quarantine | Delete both `[data-theme]` blocks, flatten to `:root` light, remove hook/toggle/effect, `removeItem('gempixel_theme')` on boot; pin viewer/symbols call sites to literal `'light'` with a `// PHASE 22` marker (signatures unchanged). | ✓ |
| Full rip now (incl. engine signatures) | Also strip the theme param from viewer.ts/symbols.ts now. Zero dead code but changes engine/* signatures inside a UI phase — violates the strangler rule. | |
| Neutralize only | Force light, keep `[data-theme=light]`, remove toggle, leave viewer/symbols params + dead localStorage key. Leaves a live dark branch + storage cruft. | |

**User's choice:** Staged: UI rip + engine quarantine (Recommended)
**Notes:** Deleting the dark CSS block (not an anti-FOUC head-script) is what guarantees SC1 — a stale `data-theme` attribute then selects nothing. The one-time `removeItem` clears returning-user residue; the Phase 22 marker ensures the quarantined engine branch is excised on schedule.

---

## Font hosting & no-CLS

| Option | Description | Selected |
|--------|-------------|----------|
| Variable @fontsource + Fontaine, drop Pixelify | Self-host Newsreader + Archivo (variable) + JetBrains Mono; delete both Google `@import` lines; Fontaine Vite plugin auto-injects fallback metrics so `font-display:swap` → ~0 CLS. Drop Pixelify Sans (ops console is v5.0); wordmark in Newsreader 21/600. | ✓ |
| Variable fonts + hand-authored metrics (no plugin) | Same self-hosting, hand-written `size-adjust`/`ascent-override` @font-face. Purest 'no build dep' but per-family metric numbers must be generated + maintained. | |
| Static weights + font-display: optional + preload | Guaranteed zero CLS via `optional`, but first-visit users can sit on the fallback all session — bad for a display-serif wordmark/titles. | |

**User's choice:** Variable @fontsource + Fontaine, drop Pixelify (Recommended)
**Notes:** Archivo replaces the current Outfit for body/UI. Pixelify Sans's only consumers are the wordmark (covered by Newsreader per the top-bar spec) and the deferred v5.0 ops console.

---

## Step-nav gating & viewer mount

*(Three sub-decisions.)*

### Gating UX

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled + unclickable + tooltip | `aria-disabled`, out of tab order, static "Upload an image to unlock" tooltip. All four steps visible as a stable map; a locked tap never dead-ends. | ✓ |
| Clickable + explanatory toast | Locked steps look reachable; tap fires a toast. Teaches the rule but invites-then-punishes; toast spam risk. | |
| Hidden until eligible | Steps appear as they unlock. Zero locked confusion but breaks the 4-step mental model + layout jank. | |

### Editing a completed step

| Option | Description | Selected |
|--------|-------------|----------|
| Soft-invalidate + re-run prompt | Mark downstream stale, keep last-good result, block advancing past stale, one "Recompute match" CTA. Recompute fires once on intentional click (shrinks B2 abort-race). | ✓ |
| Keep-and-recompute (auto re-run) | Any upstream edit auto re-runs the worker. Always-consistent but silently re-triggers the expensive match (abort-race, laggy). | |
| Hard reset downstream | Editing a completed step clears all later steps. Simple but nukes a valid match over a trivial edit. | |

### Single-mount viewer (SC4)

| Option | Description | Selected |
|--------|-------------|----------|
| Always-render at shell + CSS-toggle panels | Hoist `<CanvasViewer>` to shell scope (never inside `{step===n && …}`); step panels as `hidden`/`display:none` siblings. Never-remount from tree position; zero deps; preserves zoom/pan/LOD. | ✓ |
| Portal viewer into a stable shell node | `createPortal` while a step child logically owns it. Needs an always-mounted host anyway — extra indirection, no gain. | |
| Keep-alive / freeze library | react-activation / react-freeze. React-oriented — compat risk under `preact/compat`; over-engineered. | |

**User's choice:** Disabled + unclickable + tooltip; Soft-invalidate + re-run prompt; Always-render at shell + CSS-toggle panels (all Recommended)
**Notes:** All three defaults align with the anti-regression / design-conscious profile and the App-owns-state + never-remount constraints.

---

## Claude's Discretion

- Exact Atelier token names within the existing `@theme inline` block (values follow the design handoff verbatim).
- Component file placement for `<StepBar>`/`<AtelierShell>` (`src/ui/` primitives are formally Phase 21 — planner decides whether to seed `src/ui/` early or inline minimal chrome).
- Precise `stale` flag shape and where the "Recompute match" banner mounts.

## Deferred Ideas

- Actual Upload/Refine/Supplies/Order screen content → Phase 23.
- Additive engine (density / `detectedColorCount` / `reduceToColorCount` / `quote.ts`) + removing the quarantined viewer/symbols `theme` param → Phase 22.
- `src/ui/` shared primitives → Phase 21.
- Mobile responsive + touch → Phase 24.
- Deleting legacy Step1..4 + asides + dead sidebar/preset state → Phase 25.
- Pixelify Sans re-introduction (ops console) → v5.0.
