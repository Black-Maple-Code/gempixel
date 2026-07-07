# Phase 3: Canvas Viewer & Zoom/Pan Interaction - Pattern Map

**Mapped:** 2026-07-07
**Files analyzed:** 2
**Analogs found:** 0 / 2

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/engine/viewer.ts` | service | control | `src/engine/worker-client.ts` | Medium |
| `src/engine/__tests__/viewer.test.ts` | test | transform | `src/engine/__tests__/worker.test.ts` | High |

---

## Pattern Assignments

### `src/engine/viewer.ts` (service, control)

**CanvasViewport Initialization Pattern**:
Structure the class encapsulating viewport dimensions, matrices, mouse drag flags, and offscreen buffers.
```typescript
import { DmcColor } from './types';

export class CanvasViewer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D;
  
  private scale = 1.0;
  private offsetX = 0;
  private offsetY = 0;
  
  private isDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  
  private drillStyle: 'square' | 'round' = 'square';
  private gridWidth = 0;
  private gridHeight = 0;
  private cellMatches: string[] = [];
  private colorMap = new Map<string, string>(); // maps DMC code to hex string

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d')!;
    
    this.setupListeners();
  }
}
```

**Cursor-Centered Zoom Calculation Pattern**:
Apply scale updates centered at cursor offsets.
```typescript
private handleZoom(mouseX: number, mouseY: number, zoomFactor: number) {
  const mouseCanvasX = (mouseX - this.offsetX) / this.scale;
  const mouseCanvasY = (mouseY - this.offsetY) / this.scale;

  const minScale = 0.5;
  const maxScale = 50.0;
  const newScale = Math.min(Math.max(this.scale * zoomFactor, minScale), maxScale);

  this.offsetX = mouseX - mouseCanvasX * newScale;
  this.offsetY = mouseY - mouseCanvasY * newScale;
  this.scale = newScale;

  this.draw();
}
```

**Offscreen Redraw & Blit Blitting Pattern**:
Draw cells to offscreen buffer once, then copy it to the display canvas with smoothing disabled.
```typescript
public redrawOffscreen() {
  const cellSize = 16;
  this.offscreenCanvas.width = this.gridWidth * cellSize;
  this.offscreenCanvas.height = this.gridHeight * cellSize;
  
  const ctx = this.offscreenCtx;
  ctx.fillStyle = '#2D3748'; // Neutral slate backing
  ctx.fillRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);

  for (let row = 0; row < this.gridHeight; row++) {
    for (let col = 0; col < this.gridWidth; col++) {
      const idx = row * this.gridWidth + col;
      const code = this.cellMatches[idx];
      const color = this.colorMap.get(code) || '#2D3748';
      
      ctx.fillStyle = color;
      if (this.drillStyle === 'square') {
        ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
      } else {
        ctx.beginPath();
        ctx.arc(
          (col + 0.5) * cellSize,
          (row + 0.5) * cellSize,
          0.45 * cellSize,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
  }
}

public draw() {
  this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  this.ctx.imageSmoothingEnabled = false;
  this.ctx.drawImage(
    this.offscreenCanvas,
    0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height,
    this.offsetX, this.offsetY, this.offscreenCanvas.width * this.scale, this.offscreenCanvas.height * this.scale
  );
}
```

---

### `src/engine/__tests__/viewer.test.ts` (test, transform)

**Mocking Canvas and Event Dispatching Pattern**:
Test coordinate transforms in JSDOM using mock canvas context behaviors.
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CanvasViewer } from '../viewer';

describe('CanvasViewer Transformations', () => {
  let canvas: HTMLCanvasElement;
  let viewer: CanvasViewer;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    
    // Stub out Canvas 2D functions that JSDOM doesn't support
    canvas.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn()
    });
    
    viewer = new CanvasViewer(canvas);
  });

  it('calculates screen translations correctly on pan', () => {
    // Dispatch events, verify scale/offset states
  });
});
```
