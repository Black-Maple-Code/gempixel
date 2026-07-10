# Pattern Map: Phase 07 (Symbol-Overlay Canvas & Margin Legends)

## Files to Modify/Create

We will modify and create the following files to implement the core symbol database, canvas overlay rendering, viewport mode switcher, and printable margin legends layout:

1. **`src/engine/symbols.ts` [CREATE]**:
   - **Role**: Domain Engine / Utility. Pure utility module managing symbols curation pool, color-to-symbol allocation based on occurrence frequency, and contrast luminance math.
   - **Data Flow**: Pure functions: `gridMatches` & `activePaletteCodes` -> `generateSymbolAllocation` -> `ColorSymbolMap` output. `hexColor` -> `getContrastColor` -> hex string color output.
   - **Closest Analog**: [src/engine/color.ts](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/engine/color.ts) (which houses color metrics and substitutions).

2. **`src/engine/viewer.ts` [MODIFY]**:
   - **Role**: UI Component / Canvas Rendering Engine.
   - **Data Flow**: Consumes symbol mapping data and rendering options (`viewMode`, `symbolMap`). Draw loop renders on-screen vector text symbols dynamically inside grid cells if scale bounds criteria are met and clipping filters check out.
   - **Closest Analog**: [src/engine/viewer.ts](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/engine/viewer.ts) (self-analog; specifically the high-performance double-buffered grid viewport rendering loops).

3. **`src/App.tsx` [MODIFY]**:
   - **Role**: Main UI Component / Controller.
   - **Data Flow**: Coordinates state initialization, wizard workflow, workspace setup, and window print listeners (`beforeprint`/`afterprint`). Intercepts print triggers to force symbols rendering and fit the canvas view, and structures the printable page grid.
   - **Closest Analog**: [src/App.tsx](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/App.tsx) (for state bindings, wizard tab switcher structure, and event/modal hooks).

4. **`src/index.css` [MODIFY]**:
   - **Role**: Style Presentation Layout.
   - **Data Flow**: Declares print styles (`@media print` and `@page` rules) to control canvas scale, hide screen UI elements, and split the legend margins using CSS grids.
   - **Closest Analog**: [src/index.css](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/index.css) (the existing print rules in index.css).

5. **`src/engine/__tests__/symbols.test.ts` [CREATE]**:
   - **Role**: Testing.
   - **Data Flow**: Validates symbol pools, allocation uniqueness, frequency ordering, and contrast color math.
   - **Closest Analog**: [src/engine/__tests__/color.test.ts](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/engine/__tests__/color.test.ts) or [src/engine/__tests__/viewer.test.ts](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/engine/__tests__/viewer.test.ts).

---

## Code Analogs & Excerpts

### Analog 1: Frequency Calculation and Mapping
We will follow the pattern of extracting unique active candidates and sorting/filtering arrays to implement symbol allocation.
* **Source File**: [src/engine/color.ts](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/engine/color.ts#L148-L170)
* **Pattern to copy**:
  ```typescript
  const lowCountCodes = Object.keys(counts).filter(code => counts[code] > 0 && counts[code] <= threshold);
  const highCountCodes = Object.keys(counts).filter(code => counts[code] > threshold);
  ```
* **Target Pattern**:
  ```typescript
  export function generateSymbolAllocation(
    gridMatches: string[],
    activePaletteCodes: string[]
  ): ColorSymbolMap {
    const freqMap: { [code: string]: number } = {};
    activePaletteCodes.forEach(code => { freqMap[code] = 0; });
    gridMatches.forEach(code => {
      if (freqMap[code] !== undefined) freqMap[code]++;
    });
    const sortedColors = activePaletteCodes
      .map(code => ({ code, count: freqMap[code] || 0 }))
      .sort((a, b) => b.count - a.count);
    // ... assign CURATED_SYMBOLS ...
  }
  ```

### Analog 2: Viewport Bound Clipping
We will reuse the bounding box logic inside the viewport render loop to draw overlay symbols only inside visible cells.
* **Source File**: [src/engine/viewer.ts](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/engine/viewer.ts#L291-L294)
* **Pattern to copy**:
  ```typescript
  const startCol = Math.max(0, Math.floor(-this.offsetX / scaledCellSize));
  const endCol = Math.min(this.gridWidth, Math.ceil((this.canvas.width - this.offsetX) / scaledCellSize));
  const startRow = Math.max(0, Math.floor(-this.offsetY / scaledCellSize));
  const endRow = Math.min(this.gridHeight, Math.ceil((this.canvas.height - this.offsetY) / scaledCellSize));
  ```
* **Target Pattern**:
  ```typescript
  if (scaledCellSize >= 10 && this.viewMode === 'symbols') {
    this.ctx.save();
    this.ctx.font = `bold ${Math.floor(scaledCellSize * 0.65)}px 'Outfit', sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    // Bounded viewport loop...
    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        // ... fillText centered in cell with contrast color ...
      }
    }
    this.ctx.restore();
  }
  ```

### Analog 3: HTML Print Interceptors
We will define print listeners using standard DOM hooks to programmatically manipulate viewport state.
* **Source File**: [src/App.tsx](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/App.tsx)
* **Pattern to copy**: Standard hook-based event listener registrations.
  ```typescript
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  ```
* **Target Pattern**:
  ```typescript
  useEffect(() => {
    const handleBeforePrint = () => {
      // D-07: force symbols view & scale fit
      setSavedMode(viewportMode);
      setViewportMode('symbols');
      if (viewerRef.current) {
        viewerRef.current.fitToContainer();
      }
    };
    const handleAfterPrint = () => {
      setViewportMode(savedMode);
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [viewportMode]);
  ```

### Analog 4: Print Media Selector Styles
We will expand the index.css print blocks to layout the canvas print sheet using CSS Grids.
* **Source File**: [src/index.css](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/index.css#L34-L43)
* **Pattern to copy**:
  ```css
  @media print {
    body {
      background: white !important;
      color: black !important;
    }
    .no-print {
      display: none !important;
    }
  }
  ```
* **Target Pattern**:
  ```css
  @media print {
    @page {
      size: A4 landscape;
      margin: 8mm;
    }
    .print-canvas-sheet {
      display: grid !important;
      grid-template-columns: 140px 1fr 140px;
      gap: 8px;
      width: 100vw;
      height: 90vh;
      box-sizing: border-box;
    }
    /* Dashed guidelines for wrap stretch fold */
    .print-legend-left {
      border-right: 2px dashed #4A5568;
    }
    .print-legend-right {
      border-left: 2px dashed #4A5568;
    }
  }
  ```
