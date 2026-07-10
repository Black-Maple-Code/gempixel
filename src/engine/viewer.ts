import { getContrastColor } from './symbols';

/**
 * CanvasViewer handles interactive rendering of the gem art grid.
 * It implements panning, cursor-centered zoom, and offscreen double-buffering.
 * Supports rendering drills in square and round styles, showing neutral slate backing.
 */
export class CanvasViewer {
  public onZoomChange?: (scale: number) => void;
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
  private highlightedColor: string | null = null;
  private drillType: 'standard' | 'ab' | 'glow' | 'crystal' = 'standard';
  private viewMode: 'grid' | 'symbols' | 'reference' = 'grid';
  private symbolMap: Record<string, string> = {};
  private roundBacking = '#2D3748';   // slate backing shown through round-drill gaps (themed)
  private gridGap = '#0d0d13';        // fill behind square drills / gap color (themed)

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

    if (this.onZoomChange) {
      this.onZoomChange(this.scale);
    }
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

  public setHighlightedColor(code: string | null) {
    this.highlightedColor = code;
    this.draw();
  }

  public setDrillType(type: 'standard' | 'ab' | 'glow' | 'crystal') {
    this.drillType = type;
    this.redrawOffscreen();
    this.draw();
  }

  public setViewMode(mode: 'grid' | 'symbols' | 'reference') {
    this.viewMode = mode;
    this.draw();
  }

  public setSymbolMap(map: Record<string, string>) {
    this.symbolMap = map;
    this.draw();
  }

  /** Theme the slate backing shown through the gaps of round drills. */
  public setRoundBacking(hex: string) {
    if (!hex) return;
    this.roundBacking = hex;
    this.redrawOffscreen();
    this.draw();
  }

  /** Theme the fill color behind drills / the inter-drill gap. */
  public setGridGap(hex: string) {
    if (!hex) return;
    this.gridGap = hex;
    this.redrawOffscreen();
    this.draw();
  }

  private drawCellFinish(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    style: 'square' | 'round',
    type: 'standard' | 'ab' | 'glow' | 'crystal'
  ) {
    if (type === 'ab') {
      const grad = ctx.createLinearGradient(x, y, x + size, y + size);
      grad.addColorStop(0, 'rgba(255, 180, 200, 0.25)'); // pink shimmer
      grad.addColorStop(0.5, 'rgba(180, 220, 255, 0.2)'); // blue shimmer
      grad.addColorStop(1, 'rgba(180, 255, 180, 0.25)'); // green shimmer
      ctx.fillStyle = grad;
      if (style === 'square') {
        ctx.fillRect(x, y, size, size);
      } else {
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, 0.45 * size, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === 'glow') {
      const grad = ctx.createRadialGradient(
        x + size / 2, y + size / 2, 1,
        x + size / 2, y + size / 2, 0.45 * size
      );
      grad.addColorStop(0, 'rgba(230, 255, 200, 0.45)'); // Bright luminous core
      grad.addColorStop(0.5, 'rgba(150, 255, 150, 0.2)'); // Greenish mid-glow
      grad.addColorStop(1, 'rgba(100, 255, 100, 0.05)'); // Soft outer edge
      ctx.fillStyle = grad;
      if (style === 'square') {
        ctx.fillRect(x, y, size, size);
      } else {
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, 0.45 * size, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === 'crystal') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.beginPath();
      ctx.arc(
        x + 0.35 * size,
        y + 0.35 * size,
        0.15 * size,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  public redrawOffscreen() {
    if (this.gridWidth <= 0 || this.gridHeight <= 0) {
      this.offscreenCanvas.width = 1;
      this.offscreenCanvas.height = 1;
      return;
    }

    let cellSize = 16;
    const maxDimension = 2048;
    if (this.gridWidth * cellSize > maxDimension || this.gridHeight * cellSize > maxDimension) {
      cellSize = Math.max(2, Math.floor(maxDimension / Math.max(this.gridWidth, this.gridHeight)));
    }

    this.offscreenCanvas.width = this.gridWidth * cellSize;
    this.offscreenCanvas.height = this.gridHeight * cellSize;

    const ctx = this.offscreenCtx;
    // Round drills reveal the slate backing through their gaps; square drills sit
    // on the gap color. Both are theme-driven.
    ctx.fillStyle = this.drillStyle === 'round' ? this.roundBacking : this.gridGap;
    ctx.fillRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);

    for (let row = 0; row < this.gridHeight; row++) {
      for (let col = 0; col < this.gridWidth; col++) {
        const idx = row * this.gridWidth + col;
        const code = this.cellMatches[idx];
        const color = this.colorMap.get(code) || this.roundBacking;

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
        this.drawCellFinish(ctx, col * cellSize, row * cellSize, cellSize, this.drillStyle, this.drillType);
      }
    }
  }

  public draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.gridWidth <= 0 || this.gridHeight <= 0) {
      return;
    }
    this.ctx.imageSmoothingEnabled = false;

    const virtualCellSize = 16;
    const scaledCellSize = virtualCellSize * this.scale;

    if (this.highlightedColor) {
      // 1. Draw entire offscreen canvas dimmed
      this.ctx.globalAlpha = 0.2;
      this.ctx.drawImage(
        this.offscreenCanvas,
        0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height,
        this.offsetX, this.offsetY, this.gridWidth * virtualCellSize * this.scale, this.gridHeight * virtualCellSize * this.scale
      );

      // 2. Draw highlighted cells fully opaque
      this.ctx.globalAlpha = 1.0;

      const startCol = Math.max(0, Math.floor(-this.offsetX / scaledCellSize));
      const endCol = Math.min(this.gridWidth, Math.ceil((this.canvas.width - this.offsetX) / scaledCellSize));
      const startRow = Math.max(0, Math.floor(-this.offsetY / scaledCellSize));
      const endRow = Math.min(this.gridHeight, Math.ceil((this.canvas.height - this.offsetY) / scaledCellSize));

      for (let row = startRow; row < endRow; row++) {
        for (let col = startCol; col < endCol; col++) {
          const code = this.cellMatches[row * this.gridWidth + col];
          if (code === this.highlightedColor) {
            const color = this.colorMap.get(code) || this.roundBacking;
            this.ctx.fillStyle = color;

            const destX = this.offsetX + col * virtualCellSize * this.scale;
            const destY = this.offsetY + row * virtualCellSize * this.scale;
            const destW = virtualCellSize * this.scale;
            const destH = virtualCellSize * this.scale;

            if (this.drillStyle === 'square') {
              this.ctx.fillRect(destX, destY, destW, destH);
            } else {
              this.ctx.beginPath();
              this.ctx.arc(destX + destW / 2, destY + destH / 2, 0.45 * destW, 0, Math.PI * 2);
              this.ctx.fill();
            }
            this.drawCellFinish(this.ctx, destX, destY, destW, this.drillStyle, this.drillType);
          }
        }
      }
    } else {
      // Draw everything normally
      this.ctx.globalAlpha = 1.0;
      this.ctx.drawImage(
        this.offscreenCanvas,
        0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height,
        this.offsetX, this.offsetY, this.gridWidth * virtualCellSize * this.scale, this.gridHeight * virtualCellSize * this.scale
      );
    }
    this.ctx.globalAlpha = 1.0; // Reset

    // Render symbol overlay if zoom is sufficient and viewMode is symbols
    if (this.viewMode === 'symbols' && scaledCellSize >= 10) {
      this.ctx.save();
      this.ctx.font = `bold ${Math.floor(scaledCellSize * 0.65)}px 'Outfit', sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      const startCol = Math.max(0, Math.floor(-this.offsetX / scaledCellSize));
      const endCol = Math.min(this.gridWidth, Math.ceil((this.canvas.width - this.offsetX) / scaledCellSize));
      const startRow = Math.max(0, Math.floor(-this.offsetY / scaledCellSize));
      const endRow = Math.min(this.gridHeight, Math.ceil((this.canvas.height - this.offsetY) / scaledCellSize));

      for (let row = startRow; row < endRow; row++) {
        for (let col = startCol; col < endCol; col++) {
          const index = row * this.gridWidth + col;
          const code = this.cellMatches[index];
          const color = this.colorMap.get(code) || this.roundBacking;
          const symbol = this.symbolMap[code];

          if (symbol) {
            const isHighlighted = !this.highlightedColor || code === this.highlightedColor;
            this.ctx.globalAlpha = isHighlighted ? 1.0 : 0.2;
            this.ctx.fillStyle = getContrastColor(color);
            const centerX = this.offsetX + (col + 0.5) * scaledCellSize;
            const centerY = this.offsetY + (row + 0.5) * scaledCellSize;
            this.ctx.fillText(symbol, centerX, centerY);
          }
        }
      }
      this.ctx.restore();
    }
  }

  public zoomIn() {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    this.handleZoom(centerX, centerY, 1.25);
  }

  public zoomOut() {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    this.handleZoom(centerX, centerY, 0.8);
  }

  public resetZoom() {
    this.fitToContainer();
  }

  public fitToContainer() {
    if (this.gridWidth <= 0 || this.gridHeight <= 0) return;
    const cellSize = 16;
    const offscreenWidth = this.gridWidth * cellSize;
    const offscreenHeight = this.gridHeight * cellSize;

    const scaleX = this.canvas.width / offscreenWidth;
    const scaleY = this.canvas.height / offscreenHeight;
    const newScale = Math.min(scaleX, scaleY) * 0.95; // 5% padding

    this.scale = Math.min(Math.max(newScale, 0.1), 50.0);
    this.offsetX = (this.canvas.width - offscreenWidth * this.scale) / 2;
    this.offsetY = (this.canvas.height - offscreenHeight * this.scale) / 2;
    this.draw();

    if (this.onZoomChange) {
      this.onZoomChange(this.scale);
    }
  }
}
