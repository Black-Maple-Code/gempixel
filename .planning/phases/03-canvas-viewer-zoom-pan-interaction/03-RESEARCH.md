# Phase 03 Research: Canvas Viewer & Zoom/Pan Interaction

## User Constraints

### Locked Decisions (verbatim from 03-CONTEXT.md)
*   **Viewport Interaction**
    *   **D-01:** Implement standard **pointer events** (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) and the `wheel` event to support zoom and pan interactions. Pointer events provide native support for mouse, touch, and stylus input.
    *   **D-02:** Implement **Zoom centered at the mouse cursor**. The transformation matrix offsets are adjusted during scrolling so the coordinates under the user's cursor remain anchored at the same screen position.
*   **Drill Rendering Styles**
    *   **D-03:** Support two drill styles: **Square** (covering the full grid cell) and **Round** (circular drills).
    *   **D-04:** Render a solid **neutral slate backing color** (specifically `#2D3748`) in the canvas background. When Round drills are selected, the slate backing shows through the corner gaps, providing realistic feedback and contrast.
*   **Performance Optimization**
    *   **D-05:** Implement **Offscreen Canvas double-buffering**. Draw the entire grid of drills (either squares or circles) onto a separate offscreen canvas. During pan and drag operations, draw that offscreen canvas to the screen as a single image (blitting).
    *   **D-06:** Redraw the offscreen canvas only when parameters change: on zoom level change, canvas resize, drill style toggle, or palette matching completion.
*   **Carrying Forward from Phase 2**
    *   **D-07 (from P2-D-10):** The viewport consumes the flat array of matched DMC codes and dimensions returned by the Web Worker.

---

## Technical Domain Research

### 1. 2D Transformation & Cursor-Centered Zoom Math

To implement smooth panning and cursor-centered zooming, the canvas viewport state is defined by three parameters:
- `scale` (zoom factor, e.g. `1.0`)
- `offsetX` (horizontal shift in pixels)
- `offsetY` (vertical shift in pixels)

#### A. Panning Math
When the user drags the mouse/pointer, we calculate the screen delta ($\Delta X, \Delta Y$) since the last frame and add it directly to the offsets:
$$X_{\text{offset}} \leftarrow X_{\text{offset}} + \Delta X$$
$$Y_{\text{offset}} \leftarrow Y_{\text{offset}} + \Delta Y$$

#### B. Zoom Centering Math
When the user zooms at mouse coordinate $(X_{\text{mouse}}, Y_{\text{mouse}})$:
1. Map the screen mouse coordinates to the pre-zoom canvas coordinate space:
   $$X_{\text{canvas}} = \frac{X_{\text{mouse}} - X_{\text{offset}}}{S_{\text{old}}}$$
   $$Y_{\text{canvas}} = \frac{Y_{\text{mouse}} - Y_{\text{offset}}}{S_{\text{old}}}$$
2. Calculate the new scale $S_{\text{new}}$ based on the zoom factor (bounded by minimum and maximum scale limits):
   $$S_{\text{new}} = \text{clamp}(S_{\text{old}} \times \text{factor}, S_{\text{min}}, S_{\text{max}})$$
3. Compute the new offsets so that the same canvas coordinate remains mapped to the mouse coordinates on screen:
   $$X_{\text{offset}} = X_{\text{mouse}} - X_{\text{canvas}} \times S_{\text{new}}$$
   $$Y_{\text{offset}} = Y_{\text{mouse}} - Y_{\text{canvas}} \times S_{\text{new}}$$

---

### 2. Offscreen Double-Buffering & Blitting

To guarantee 60 FPS rendering on grids of up to $100 \times 100$ cells, we avoid executing a nested drawing loop on every pointer move event.

#### A. Buffer Setup
An offscreen canvas is maintained in memory. If the grid is $Cols \times Rows$ cells, and each cell is allocated a base resolution of $CellSize$ pixels (e.g. 16 pixels), the buffer dimensions are:
$$W_{\text{offscreen}} = Cols \times CellSize$$
$$H_{\text{offscreen}} = Rows \times CellSize$$

#### B. Buffer Rendering
We clear the offscreen context to the background color. If the selected style is `round`, we draw `#2D3748` slate backing. Then we draw each cell:
- **Square drills**: Draw a filled rectangle of size $CellSize \times CellSize$ at coordinate $(col \times CellSize, row \times CellSize)$ using the color swatch.
- **Round drills**: Draw a filled circle centered at $((col + 0.5) \times CellSize, (row + 0.5) \times CellSize)$ with a radius of $0.45 \times CellSize$ (leaving a $10\%$ gap showing the slate backing color).

#### C. Viewport Blitting
On every pan or zoom animation frame, we simply blit the offscreen buffer to the main screen canvas:
```typescript
ctx.clearRect(0, 0, viewWidth, viewHeight);
ctx.imageSmoothingEnabled = false; // preserve crisp cell boundaries
ctx.drawImage(
  offscreenCanvas,
  0, 0, offscreenCanvas.width, offscreenCanvas.height,
  offsetX, offsetY, offscreenCanvas.width * scale, offscreenCanvas.height * scale
);
```

---

### 3. Pointer Events & Touch Interactions

We use standard Pointer Events to support mouse, stylus, and touch inputs unified under a single API:
- `pointerdown`: Register click/touch start, set drag state, record initial coordinates.
- `pointermove`: If dragging, update offsets, calculate deltas, and trigger blitting.
- `pointerup` / `pointercancel`: Release drag state.

To prevent browser scroll/zoom defaults from interrupting pointer panning on mobile devices, the canvas style must configure touch behavior:
```css
canvas {
  touch-action: none;
  user-select: none;
}
```
Wheel listener options must configure `passive: false` to allow calling `e.preventDefault()` during scrolling:
```typescript
canvas.addEventListener('wheel', handleWheel, { passive: false });
```
