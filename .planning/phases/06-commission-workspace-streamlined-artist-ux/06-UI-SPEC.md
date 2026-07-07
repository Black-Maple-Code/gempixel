---
phase: 6
slug: commission-workspace-streamlined-artist-ux
status: draft
shadcn_initialized: false
preset: none
created: 2026-07-07
---

# UI Design Contract: Phase 06 (Commission Workspace & Streamlined Artist UX)

## Design System

*   **Framework:** Preact (Vite)
*   **Styling:** Tailwind CSS (Vanilla utilities)
*   **Colors (Theme):**
    *   Dominant background: Dark Blue `#0B0F19`
    *   Sidebar background: Slate Card `#161E2F` / HSL
    *   Accent borders: `#1E293B` (slate-800)
    *   Button Primary: Violet `#8B5CF6` / Indigo `#6366F1`
    *   Success indicators: Emerald `#10B981`
*   **Typography:**
    *   Headings: Outfit (Sans-serif)
    *   Branding Header: Pixelify Sans
    *   Labels and Code elements: JetBrains Mono

## Spacing Scale
*   Layout padding: `p-4` (16px) or `p-3` (12px)
*   List item margins: `mb-2` (8px)
*   Button sizes: `py-2 px-3 text-xs` (compact primary CTAs)

## Copywriting Contract

### Wizard Navigation Buttons
*   Step 1 -> 2: `"Next: Size & Style →"`
*   Step 2 -> 3: `"Next: Legend & Palette →"`
*   Step 3 -> 4: `"Next: Quoting & Checkout →"`
*   Back action: `"← Back"`

### Portfolio Switched Controls
*   Action CTA: `"Save Current Commission"`
*   Portfolio Header: `"My Projects"`
*   Workspace Reset: `"Start New Design"`
*   Dialog Placeholder: `"Client/Project Name (e.g. Alice Cat)"`

## Component Layouts

### 1. Left Sidebar Header: "My Commissions" Portfolio Drawer
*   Positioned directly below the brand header and above the wizard steps.
*   Collapsible toggle layout (`<details>` structure) titled "My Commissions" with active projects count.
*   **List Item Specs:**
    *   A compact row flex layout (`flex items-center gap-2 bg-slate-900/40 border border-slate-800/80 p-2 rounded-lg mb-1.5 hover:border-indigo-500/50`)
    *   16x16px rounded thumbnail of the low-res project image.
    *   Project name (`font-semibold text-xs text-slate-200 truncate`) and mod date.
    *   Delete icon (`×`) to trigger deletion (hidden by default, visible on hover, red hover state).

### 2. Consolidated 4-Step Wizard Header
*   Replaces the tabs bar (`Files / Size / Quote`) with a progress track:
    *   Flex layout with four circular markers `1`, `2`, `3`, `4`.
    *   Active step marker highlighted in Indigo/Violet gradient with glowing text shadow.
    *   Connector lines between steps indicating linear path progress.
*   **Step Panels:**
    *   **Step 1 (Upload):** Render image upload drag-drop zone, ingestion behaviour selects, and recent uploads gallery.
    *   **Step 2 (Size):** Render grid dimensions presets, column/row inputs, physical conversions, and drill style toggles (round/square).
    *   **Step 3 (Palette):** Render base kit filter, DMC legend list checklist, color sorting headers, and exclusions counts.
    *   **Step 4 (Quote):** Render commission calculator inputs, pricing breakdown card, checkout actions, and partner templates.
