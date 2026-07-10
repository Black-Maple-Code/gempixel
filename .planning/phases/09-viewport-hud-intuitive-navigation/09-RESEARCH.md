# Phase 09 Research: Viewport HUD Overlay & Intuitive Wizard Navigation UX

This research document analyzes the requirements and outlines the implementation architecture for Viewport HUD overlays and wizard footer navigation in the GemPixel project.

---

## User Constraints

Based on the architectural decisions recorded in [09-CONTEXT.md](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/.planning/phases/09-viewport-hud-intuitive-navigation/09-CONTEXT.md), this phase implements **Option A: Viewport-centric Layout**:
1. **Sticky Wizard Navigation Footer:** Restructure the left sidebar wrapper to anchor the navigation panel as a sticky footer block (`mt-auto border-t border-slate-800/50 pt-3`). It remains visible at all times.
2. **Floating Viewport HUD:** Position a horizontal, glassmorphic floating HUD overlay panel at the top-center of the canvas workspace (`absolute top-4 left-1/2 transform -translate-x-1/2 z-10`, `backdrop-blur-md`, `border-slate-800/60`, `shadow-lg`).
3. **Structured Group Cards:** Settings in the sidebar will be visual group cards, utilizing collapsible structures to prevent vertical overflow.

---

## Standard Stack

The implementation utilizes the project's native stack:
1. **Preact (Hooks):**
   - `useState` for tracking view modes, wizard steps, and component expand/collapse states.
   - `useRef` for binding to the canvas and maintaining a single reference to the `CanvasViewer` controller [VERIFIED: `src/App.tsx#L2327`].
   - `useMemo` for calculations (e.g. tracking layout aspect matches and pricing optimizations).
2. **Tailwind CSS (v4):**
   - Tailwind v4 is imported directly in index.css [VERIFIED: `src/index.css#L2`]. We will use Tailwind's native backdrop filters (`backdrop-blur-md`), grid/flex layouts, transition utilities, and responsive display styles.

---

## Architecture Patterns

### 1. Viewport HUD Controls Communication
- The floating HUD overlay will direct operations using two mechanisms:
  - **Programmatic Canvas Viewer Updates (Imperative):** Actions such as Zoom In, Zoom Out, Reset, and Fit to Viewport are sent directly to the `CanvasViewer` class instance stored in `viewerRef` [VERIFIED: `src/App.tsx#L2327`]. This bypasses Preact DOM diffing and directly repaints the HTML5 canvas, maintaining high frame rates.
  - **Reactive View Mode Synchronization (Declarative):** Changing the view mode (e.g., toggling between "Grid Colors", "Grid + Symbols", and "Original Photo") updates the Preact state `viewportMode` [VERIFIED: `src/App.tsx#L267`]. The viewer synchronizes this change reactively via an existing `useEffect` observer [VERIFIED: `src/App.tsx#L653`].
- **Viewer Enhancements Required:** Currently, the `CanvasViewer` class exposes the `fitToContainer()` method [VERIFIED: `src/engine/viewer.ts#L377`], but it lacks programmatic public zoom triggers. We must extend `CanvasViewer` to include:
  - `zoomIn()`: Triggers `handleZoom` centered on the canvas viewport center with a `1.25x` factor.
  - `zoomOut()`: Triggers `handleZoom` centered on the canvas viewport center with a `0.8x` factor.
  - `resetZoom()`: Acts as a alias for `fitToContainer()`.

### 2. Sticky Sidebar Wizard Footer Navigation
- Currently, next/back step transitions sit in the main canvas top header [VERIFIED: `src/App.tsx#L2258-2324`]. We will move these controls to a sticky block at the bottom of the left sidebar.
- Layout structure relies on CSS Flexbox:
  - Main Sidebar Container: Styled with `flex flex-col h-full` [ASSUMED].
  - Settings Steps Section: Styled with `flex-1 overflow-y-auto` [ASSUMED], ensuring main settings scroll while keeping the header and footer anchored.
  - Navigation Panel Footer: Styled with `mt-auto border-t border-slate-800/50 pt-3 shrink-0` [ASSUMED], remaining sticky and un-scrollable.
- Linear rules check step validations (e.g., preventing next-navigation from Step 1 if an image or active project is not loaded [VERIFIED: `src/App.tsx#L2317`]). Users can click step dots to jump back to previously completed steps.

### 3. Logically Grouped Settings & Tooltips
- Secondary settings (like price metrics per bag size, affiliate tracking parameters, and custom dimension limits) will be housed within collapsible components (such as native `<details>` elements or state-driven toggle panels).
- Hover tooltips will map absolute placements relative to input containers to explain technical terms (e.g. *Color Substitution Threshold* or *Safety Margins*).

---

## Don't Hand-Roll

1. **No JavaScript Tooltip Engines:** Avoid adding heavy JS libraries (like Popper or Tippy) or hand-rolling complex coordinate positioning scripts. Instead, use HTML5 `title` attributes, or simple Tailwind CSS hover tooltips (`group` parent container and a hidden `group-hover:block absolute` overlay).
2. **No Custom Pan/Zoom Physics:** Do not re-implement pan/zoom input listening. The existing `CanvasViewer` already handles drag-panning and mouse-wheel scrolling natively [VERIFIED: `src/engine/viewer.ts#L51`].
3. **No Heavy Animation Accordions:** Do not import custom layout animation packages. Collapsible settings groups can be handled using either native HTML `<details>` / `<summary>` tags [VERIFIED: `src/App.tsx#L2068`] or simple Preact boolean states.

---

## Common Pitfalls

1. **Event Bubbling & Canvas Dragging:** Clicking buttons in the floating HUD overlay will propagate pointer events to the canvas parent wrapper, triggering unintentional canvas panning. 
   - *Fix:* HUD elements must invoke `e.stopPropagation()` on all click and pointer-down events.
2. **Flex Height Overflows:** If `overflow-y-auto` is omitted on the main settings contents section, the sidebar height can expand beyond the viewport window, pushing the sticky navigation footer off the bottom of the screen.
3. **Mobile Layout Overlaps:** On mobile screens, the floating top-center HUD can cover the main grid view area.
   - *Fix:* Ensure responsive styling (e.g., hiding/shrinking the HUD or placing it inside a drawer on screens $< 768px$ [VERIFIED: `src/index.css#L215`]).
4. **Symbol Overlay Zoom Threshold Cutoff:** Symbols only render when cell sizes are $\ge 10$ pixels [VERIFIED: `src/engine/viewer.ts#L345`]. If zoomed out, cells remain blank in symbol mode. 
   - *Fix:* The HUD should display a "Low Zoom" warning indicator when the active mode is `symbols` but the zoom scale is below the rendering cutoff threshold.

---

## Code Examples

### 1. Viewport HUD Component
```tsx
import { useState, useEffect } from 'preact/hooks';

interface ViewportHUDProps {
  viewportMode: 'grid' | 'symbols' | 'reference';
  setViewportMode: (mode: 'grid' | 'symbols' | 'reference') => void;
  viewerRef: { current: any };
  zoomScale: number; // Current scale passed from parent
}

export function ViewportHUD({ viewportMode, setViewportMode, viewerRef, zoomScale }: ViewportHUDProps) {
  // Prevent click events from propagating to the canvas viewer underneath
  const handleHUDInteraction = (e: MouseEvent | PointerEvent) => {
    e.stopPropagation();
  };

  // Symbols rendering threshold check (16px base cell * scale < 10px cutoff)
  const symbolsHidden = viewportMode === 'symbols' && (zoomScale * 16 < 10);

  return (
    <div 
      onClick={handleHUDInteraction}
      onPointerDown={handleHUDInteraction}
      className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 border border-slate-800/60 rounded-xl p-1.5 shadow-xl backdrop-blur-md flex items-center gap-3.5 no-print font-sans select-none"
    >
      {/* 3-Way Mode Toggles */}
      <div className="flex bg-slate-950/60 p-0.5 rounded-lg border border-slate-850/40">
        {(['grid', 'symbols', 'reference'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewportMode(mode)}
            className={`text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
              viewportMode === mode
                ? 'bg-indigo-600 text-white shadow shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {mode === 'grid' ? 'Grid' : mode === 'symbols' ? 'Symbols' : 'Original'}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-slate-800/80" />

      {/* Programmatic Zoom Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); viewerRef.current?.zoomIn(); }}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Zoom In"
        >
          ➕
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); viewerRef.current?.zoomOut(); }}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Zoom Out"
        >
          ➖
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); viewerRef.current?.fitToContainer(); }}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Fit Grid to Viewport"
        >
          ⛶
        </button>
      </div>

      {/* Symbol cutoff threshold indicator */}
      {symbolsHidden && (
        <>
          <div className="h-4 w-px bg-slate-800/80" />
          <span 
            className="text-[9px] text-amber-400 font-bold bg-amber-500/10 px-2 py-1 rounded border border-amber-500/25 animate-pulse cursor-help"
            title="Symbols are hidden due to low zoom. Zoom in to view symbols."
          >
            ⚠️ Low Zoom
          </span>
        </>
      )}
    </div>
  );
}
```

### 2. Sticky Sidebar Layout with Wizard Footer
```tsx
interface LeftSidebarProps {
  wizardStep: number;
  setWizardStep: (step: number) => void;
  isStepValid: (step: number) => boolean;
  children: any;
}

export function LeftSidebar({ wizardStep, setWizardStep, isStepValid, children }: LeftSidebarProps) {
  const steps = [
    { num: 1, label: 'Upload' },
    { num: 2, label: 'Optimize' },
    { num: 3, label: 'Order' },
    { num: 4, label: 'Save' }
  ];

  return (
    <aside className="bg-slate-900/60 backdrop-blur-md border-r border-slate-800/80 w-80 p-4 h-full flex flex-col no-print select-none">
      {/* Header Block */}
      <div className="border-b border-slate-800/60 pb-3 shrink-0">
        <h2 className="text-sm font-bold tracking-wider text-slate-400 uppercase">Settings Wizard</h2>
      </div>

      {/* Scrollable Form Content */}
      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-4">
        {children}
      </div>

      {/* Sticky Wizard Footer */}
      <div className="mt-auto border-t border-slate-800/50 pt-3.5 shrink-0 flex flex-col gap-3">
        {/* Progress Stepper Line */}
        <div className="flex justify-between items-center px-1">
          {steps.map((s) => {
            const isActive = wizardStep === s.num;
            const isCompleted = wizardStep > s.num;
            const canJump = isStepValid(s.num);

            return (
              <button
                key={s.num}
                disabled={!canJump && s.num > wizardStep}
                onClick={() => setWizardStep(s.num)}
                className={`relative z-10 w-6.5 h-6.5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all cursor-pointer disabled:cursor-not-allowed ${
                  isActive
                    ? 'bg-slate-950 border-indigo-500 text-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.4)]'
                    : isCompleted
                    ? 'bg-indigo-600 border-indigo-650 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                }`}
                title={s.label}
              >
                {s.num}
              </button>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setWizardStep(Math.max(1, wizardStep - 1))}
            disabled={wizardStep === 1}
            className="flex-1 bg-slate-850 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-800 text-slate-300 py-2 rounded text-xs font-semibold transition-all cursor-pointer"
          >
            &lt; Back
          </button>
          <button
            onClick={() => setWizardStep(Math.min(4, wizardStep + 1))}
            disabled={wizardStep === 4 || !isStepValid(wizardStep)}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2 rounded text-xs font-semibold transition-all cursor-pointer"
          >
            Next &gt;
          </button>
        </div>
      </div>
    </aside>
  );
}
```

### 3. Collapsible Card Settings Panel with CSS Tooltip
```tsx
import { useState } from 'preact/hooks';

interface CollapsibleCardProps {
  title: string;
  tooltipText?: string;
  defaultOpen?: boolean;
  children: any;
}

export function CollapsibleCard({ title, tooltipText, defaultOpen = false, children }: CollapsibleCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-slate-950/40 border border-slate-850 rounded-lg overflow-hidden transition-all duration-150">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 select-none cursor-pointer hover:bg-slate-900/40 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-200">{title}</span>
          
          {/* Pure CSS/Tailwind Hover Tooltip */}
          {tooltipText && (
            <div className="group relative z-30 flex items-center">
              <span className="text-[10px] text-slate-500 hover:text-slate-355 cursor-help bg-slate-855 border border-slate-800 w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
                ?
              </span>
              <div className="hidden group-hover:block absolute bottom-5 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 p-2 rounded shadow-xl text-[10px] text-slate-300 font-medium w-48 leading-relaxed">
                {tooltipText}
              </div>
            </div>
          )}
        </div>
        
        <span className={`text-[8px] text-slate-500 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}>
          ▶
        </span>
      </div>

      {isOpen && (
        <div className="p-3 border-t border-slate-850/50 flex flex-col gap-3">
          {children}
        </div>
      )}
    </div>
  );
}
```
