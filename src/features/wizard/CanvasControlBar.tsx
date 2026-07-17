/**
 * CanvasControlBar — the Refine canvas chrome relocated OFF the raster and into
 * the wizard's fixed bottom action zone (AtelierShell Zone 3, immediately above
 * the Back/Next bar). It renders the view-mode switcher (Grid Colors / Grid +
 * Symbols / Original Photo), the zoom in/out/fit controls, and the low-zoom
 * warning as NORMAL-FLOW chrome — never `absolute`/`fixed` over the canvas
 * (GAP-1 / SC8, completing D-05 full-height content + D-07 switcher bottom-snap).
 *
 * PURE / props-only (Phase 20 D-01): App.tsx stays the sole state owner. This
 * component owns NO state and imports NO engine *value* — `viewportMode`,
 * `zoomScale`, and the viewer-wrapped zoom callbacks are all threaded as props.
 * The switcher/zoom markup (button structure, tooltips, aria-labels,
 * active-segment styling, and the low-zoom threshold) is a byte-behavior
 * relocation of the blocks that previously floated inside CanvasWorkspace.
 *
 * Positioning is owned by the parent (AtelierShell Zone 3), so the root is a
 * plain in-flow row — it carries no `absolute`/`fixed`/`bottom-*` token.
 */
export interface CanvasControlBarProps {
  /** When null there is no canvas, so the whole strip renders nothing. */
  image: HTMLImageElement | null;
  viewportMode: 'grid' | 'symbols' | 'reference';
  setViewportMode: (mode: 'grid' | 'symbols' | 'reference') => void;
  /** Wraps `viewerRef.current?.zoomIn()` — the ref stays in App. */
  onZoomIn: () => void;
  /** Wraps `viewerRef.current?.zoomOut()`. */
  onZoomOut: () => void;
  /** Wraps `viewerRef.current?.fitToContainer()`. */
  onFit: () => void;
  zoomScale: number;
}

export function CanvasControlBar(props: CanvasControlBarProps) {
  const { image, viewportMode, setViewportMode, onZoomIn, onZoomOut, onFit, zoomScale } = props;

  // No image → no canvas → no chrome.
  if (!image) return null;

  const showZoom = viewportMode === 'grid' || viewportMode === 'symbols';

  return (
    <div className="mx-auto flex w-full max-w-[1180px] items-center justify-center gap-3 no-print">
      {/* View-mode switcher — the relocated D-07 dock, now in-flow chrome. */}
      <div className="flex rounded-lg border border-border p-0.5">
        {(['grid', 'symbols', 'reference'] as const).map(mode => {
          const isActive = viewportMode === mode;
          const label = mode === 'grid' ? 'Grid Colors' : mode === 'symbols' ? 'Grid + Symbols' : 'Original Photo';
          const tooltip = mode === 'grid' ? 'Canvas colors' : mode === 'symbols' ? 'Colors + Symbols' : 'Original photo';
          return (
            <div key={mode} className="tooltip-group">
              <button
                onClick={() => setViewportMode(mode)}
                aria-pressed={isActive}
                className={`text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-accent text-on-accent shadow shadow-accent/20'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
              <div className="tooltip-box">{tooltip}</div>
            </div>
          );
        })}
      </div>

      {/* Zoom controls — meaningful only on the rendered canvas (grid/symbols);
          hidden in reference mode where the full-res photo shows at native size. */}
      {showZoom && (
        <div className="flex items-center gap-1">
          <div className="tooltip-group">
            <button
              onClick={() => onZoomIn()}
              aria-label="Zoom in"
              className="min-h-[44px] min-w-[44px] p-1.5 rounded-lg hover:bg-border text-muted hover:text-ink transition-colors cursor-pointer flex items-center justify-center"
            >
              ➕
            </button>
            <div className="tooltip-box">Zoom In</div>
          </div>

          <div className="tooltip-group">
            <button
              onClick={() => onZoomOut()}
              aria-label="Zoom out"
              className="min-h-[44px] min-w-[44px] p-1.5 rounded-lg hover:bg-border text-muted hover:text-ink transition-colors cursor-pointer flex items-center justify-center"
            >
              ➖
            </button>
            <div className="tooltip-box">Zoom Out</div>
          </div>

          <div className="tooltip-group">
            <button
              onClick={() => onFit()}
              aria-label="Fit to screen"
              className="min-h-[44px] min-w-[44px] p-1.5 rounded-lg hover:bg-border text-muted hover:text-ink transition-colors cursor-pointer flex items-center justify-center"
            >
              ⛶
              <span className="hidden">Zoom</span>
            </button>
            <div className="tooltip-box">Fit to Screen</div>
          </div>
        </div>
      )}

      {/* Low-zoom warning — symbols mode only, below the ~10px cell threshold. */}
      {viewportMode === 'symbols' && zoomScale * 16 < 10 && (
        <div className="tooltip-group flex items-center border-l border-border pl-3">
          <div className="px-2 py-1 rounded bg-warn/15 border border-warn/40 text-warn text-[10px] font-bold select-none cursor-default flex items-center gap-1 whitespace-nowrap animate-pulse">
            ⚠️ Low Zoom
          </div>
          <div className="tooltip-box">Zoom in to view symbol overlays (disabled at &lt;10px cell size)</div>
        </div>
      )}
    </div>
  );
}
