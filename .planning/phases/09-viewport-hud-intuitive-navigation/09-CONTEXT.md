# Phase 9: Viewport HUD Overlay & Intuitive Wizard Navigation UX

We will address the app's look-and-feel issues by redesigning the wizard next/back buttons into a prominent navigation bar, moving active view toggles and pan/zoom utilities into a floating Heads-Up Display (HUD) overlay inside the viewport, and reorganizing settings panels logically.

## Proposed UX/UI Enhancements

### 1. Viewport Heads-Up Display (HUD) (NAV-02)
To clear the left/right sidebar menus and make the viewport feel interactive, we propose adding a floating overlay panel inside the canvas container.
- **Location:** Centered at the top or bottom of the canvas viewport (floating glassmorphic panel).
- **Controls Included:**
  - **3-Way View Selector:** Toggles between **Grid Colors**, **Grid + Symbols**, and **Original Photo** (replaces sidebar tabs).
  - **Viewer Utilities:** Zoom In (`+`), Zoom Out (`-`), Fit to Viewport (`⛶`), and Reset Zoom.
  - **Symbol Overlay Size threshold toggle / Indicator.**

### 2. Intuitive Wizard Navigation Panel (NAV-01)
To make moving between steps clear and intuitive:
- **Redesign:** Introduce a styled navigation footer bar at the bottom of the sidebar (or bottom of the viewport) containing:
  - Distinctly styled `< Back` and `Next Step >` action buttons.
  - A step indicator (e.g., Progress dots/numbers: `1. Upload -> 2. Optimize -> 3. Order -> 4. Save`) that lets users click directly to jump to previously completed steps.
  - Primary CTAs (like "Generate Matches" or "Order Drills") dynamically highlighted at the active step.

### 3. Logically Grouped Settings & Tooltips (NAV-03)
- Reorganize sidebar controls into clearly labeled collapsible sub-groups (e.g., "Standard Presets" vs "Custom Dimensions").
- Add subtle hover help tooltip icons (`?` inside circles) describing settings (like *Max Color Threshold* or *Safety Drill Margin*).

---

## Design Choices & Options for User Review

### Option A: Viewport-centric Layout (Recommended)
- **Wizard Navigation:** Put a styled wizard footer bar *at the bottom of the left sidebar* that remains sticky.
- **HUD Panel:** A horizontal, floating glassmorphic bar positioned at the **top-center** of the canvas viewport (e.g. `z-index: 10`, backdrop-blur, dark borders).
- **Settings:** Keep settings in the sidebar but divide them into clear visual group cards.

### Option B: Sided-Floating Viewport Panel
- **Wizard Navigation:** Place next/back navigation buttons directly inside the main workspace view header.
- **HUD Panel:** Vertical floating toolbar on the **left side** of the canvas viewport.

### Option C: Compact Unified Layout
- Move both step navigation and viewport controls into a single top header workspace bar.
