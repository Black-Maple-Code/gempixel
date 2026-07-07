
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
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = context;

    this.offscreenCanvas = document.createElement('canvas');
    const offCtx = this.offscreenCanvas.getContext('2d');
    if (!offCtx) {
      throw new Error('Could not get 2D context for offscreen canvas');
    }
    this.offscreenCtx = offCtx;

    this.setupListeners();
  }

  private setupListeners() {
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerCancel);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
  }

  public destroy() {
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerCancel);
    this.canvas.removeEventListener('wheel', this.handleWheel);
  }

  private handlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    this.isDragging = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      // Ignore failure in environments that do not support pointer capture fully (e.g. test environment stubs)
    }
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.isDragging) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.offsetX += dx;
    this.offsetY += dy;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.draw();
  };

  private handlePointerUp = (e: PointerEvent) => {
    if (!this.isDragging) return;
    this.isDragging = false;
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch (err) {
      // Ignore
    }
  };

  private handlePointerCancel = (e: PointerEvent) => {
    if (!this.isDragging) return;
    this.isDragging = false;
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch (err) {
      // Ignore
    }
  };

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Zoom factor: zoom in for scroll up (deltaY < 0), zoom out for scroll down (deltaY > 0)
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    this.handleZoom(mouseX, mouseY, zoomFactor);
  };

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

  public getViewportState() {
    return {
      scale: this.scale,
      offsetX: this.offsetX,
      offsetY: this.offsetY
    };
  }

  public setViewportState(scale: number, offsetX: number, offsetY: number) {
    this.scale = scale;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.draw();
  }

  public setData(width: number, height: number, matches: string[], colorMap: Map<string, string>) {
    this.gridWidth = width;
    this.gridHeight = height;
    this.cellMatches = matches;
    this.colorMap = colorMap;
    this.redrawOffscreen();
    this.draw();
  }

  public setDrillStyle(style: 'square' | 'round') {
    this.drillStyle = style;
    this.redrawOffscreen();
    this.draw();
  }

  public redrawOffscreen() {
    if (this.gridWidth <= 0 || this.gridHeight <= 0) {
      this.offscreenCanvas.width = 1;
      this.offscreenCanvas.height = 1;
      return;
    }

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
    if (this.gridWidth <= 0 || this.gridHeight <= 0) {
      return;
    }
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(
      this.offscreenCanvas,
      0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height,
      this.offsetX, this.offsetY, this.offscreenCanvas.width * this.scale, this.offscreenCanvas.height * this.scale
    );
  }
}
