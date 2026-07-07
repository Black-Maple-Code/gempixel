# Phase 4: Supply Planning, Customization & Exports - Pattern Map

**Mapped:** 2026-07-07
**Files analyzed:** 7
**Analogs found:** 0 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/App.tsx` | component | control | None (Greenfield App UI) | N/A |
| `src/main.tsx` | entry | control | None (Greenfield Entry) | N/A |
| `src/index.css` | stylesheet | transform | None (Greenfield Stylesheet) | N/A |
| `index.html` | entry | output | None (Greenfield HTML) | N/A |
| `src/__tests__/App.test.tsx` | test | transform | `src/engine/__tests__/viewer.test.ts` | Medium |
| `src/__tests__/integration.test.tsx` | test | transform | `src/engine/__tests__/viewer.test.ts` | Medium |
| `src/__tests__/print.test.tsx` | test | transform | `src/engine/__tests__/ingest.test.ts` | High |

---

## Pattern Assignments

### `src/App.tsx` (component, control)

**Preact App State & Layout Component Pattern**:
Manage state coordinates for file uploads, dimensions, loading progress, drill styles, exclusions, and active highlights.
```typescript
import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { MatcherClient } from './engine/worker-client';
import { CanvasViewer } from './engine/viewer';
import { DMC_PALETTE } from './engine/palette';

export function App() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [cols, setCols] = useState(40);
  const [rows, setRows] = useState(30);
  const [unit, setUnit] = useState<'cm' | 'inch' | 'grid'>('grid');
  const [drillStyle, setDrillStyle] = useState<'square' | 'round'>('square');
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [excludedColors, setExcludedColors] = useState<Set<string>>(new Set());
  const [highlightedColor, setHighlightedColor] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<CanvasViewer | null>(null);
  const clientRef = useRef<MatcherClient | null>(null);

  // setup client and viewer...
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-900 text-white">
      {/* Sidebar, Viewport, Legend */}
    </div>
  );
}
```

---

### `src/index.css` (stylesheet, transform)

**Tailwind v4 & Print Directives Pattern**:
Import tailwind utility classes, define page sizing, and hide navigation elements during printing.
```css
@import "tailwindcss";

@layer base {
  body {
    @apply bg-slate-950 text-slate-100 antialiased select-none;
  }
}

@media print {
  body {
    background: white !important;
    color: black !important;
  }
  
  .no-print {
    display: none !important;
  }
  
  .print-area {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    position: static !important;
    overflow: visible !important;
  }

  canvas {
    max-width: 100% !important;
    height: auto !important;
  }
}
```

---

### `src/__tests__/print.test.tsx` (test, transform)

**Safety Margin & Packets Assertions Pattern**:
Verify that the purchase count rounding matches the +10% and standard 200 multiple constraints.
```typescript
import { describe, it, expect } from 'vitest';

function calculateSafetyPurchase(exactCount: number): { safety: number; packets: number; purchase: number } {
  const safety = Math.ceil(exactCount * 1.1);
  const packets = Math.ceil(safety / 200);
  const purchase = packets * 200;
  return { safety, packets, purchase };
}

describe('Safety margin calculations', () => {
  it('correctly rounds up counts to recommended standard 200 bags', () => {
    const result = calculateSafetyPurchase(350);
    expect(result.safety).toBe(385);
    expect(result.packets).toBe(2);
    expect(result.purchase).toBe(400);
  });

  it('handles boundary multiples correctly', () => {
    const result = calculateSafetyPurchase(181); // 181 * 1.1 = 199.1 -> 200 safety -> 1 packet -> 200 purchase
    expect(result.safety).toBe(200);
    expect(result.packets).toBe(1);
    expect(result.purchase).toBe(200);
  });
});
```
