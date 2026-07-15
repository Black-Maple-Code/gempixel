import { RefObject } from 'preact';
import type { RawMatch } from '../match/useDiamondArtMatch';
import type { ColorSymbolMap } from '../../engine/symbols';

/**
 * CanvasWorkspace — the center-canvas preview region (the `viewport-dots`
 * surface hosting the SINGLE-MOUNT `<canvas>`, the floating viewport HUD,
 * zoom controls, low-zoom warning, print legends, the loading overlay, and
 * the match/action error banners).
 *
 * PURE / props-only (Phase 20 D-01): App.tsx stays the sole state owner. This
 * component owns NO domain state and imports NO engine *value* (only the
 * `RawMatch` / `ColorSymbolMap` types). Every value it renders — including the
 * viewer zoom callbacks (wrapped so `viewerRef` stays in App) — is threaded as
 * a prop. This is a byte-behavior-equivalent extraction of the region that
 * previously lived inline in App's `<main>`; every className, `data-*`/`id`
 * attribute, `no-print`/`print:*` class, and the print-legend markup is
 * preserved exactly.
 *
 * D-14 single mount: `canvasRef` is passed through and attached to the SAME
 * `<canvas>` element App's CanvasViewer init effect binds — the canvas is never
 * gated behind a step conditional here, so the viewer never remounts on a step
 * change.
 *
 * D-10: UploadScreen owns image ingestion. When there is no image/match this
 * component renders nothing in the canvas slot (the legacy cream-on-dark hero
 * dropzone the UAT flagged as a duplicate upload prompt is gone).
 */
interface LegendColor {
  dmc: string;
  hex: string;
}

export interface CanvasWorkspaceProps {
  /** The single-mount canvas element (D-14) — bound to App's CanvasViewer. */
  canvasRef: RefObject<HTMLCanvasElement>;
  image: HTMLImageElement | null;
  matchResult: RawMatch | null;
  viewportMode: 'grid' | 'symbols' | 'reference';
  setViewportMode: (mode: 'grid' | 'symbols' | 'reference') => void;
  /** Wraps `viewerRef.current?.zoomIn()` — the ref stays in App. */
  onZoomIn: () => void;
  /** Wraps `viewerRef.current?.zoomOut()`. */
  onZoomOut: () => void;
  /** Wraps `viewerRef.current?.fitToContainer()`. */
  onFit: () => void;
  zoomScale: number;
  cols: number;
  rows: number;
  symbolMap: ColorSymbolMap;
  leftLegendColors: LegendColor[];
  rightLegendColors: LegendColor[];
  loading: boolean;
  loadingPhase: 'preparing' | 'matching';
  progress: number;
  matchError: string | null;
  actionError: string | null;
  onDismissActionError: () => void;
}

export function CanvasWorkspace(props: CanvasWorkspaceProps) {
  const {
    canvasRef,
    image,
    matchResult,
    viewportMode,
    setViewportMode,
    onZoomIn,
    onZoomOut,
    onFit,
    zoomScale,
    cols,
    rows,
    symbolMap,
    leftLegendColors,
    rightLegendColors,
    loading,
    loadingPhase,
    progress,
    matchError,
    actionError,
    onDismissActionError,
  } = props;

  return (
    <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-slate-950 viewport-dots print:bg-white print:h-auto print:overflow-visible print:p-4">
      {/* Floating Viewport HUD overlay */}
      {image && (
        <div
          className="viewport-hud no-print"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex bg-slate-950/40 rounded-lg p-0.5 border border-slate-800/40">
            {(['grid', 'symbols', 'reference'] as const).map(mode => {
              const isActive = viewportMode === mode;
              const label = mode === 'grid' ? 'Grid Colors' : mode === 'symbols' ? 'Grid + Symbols' : 'Original Photo';
              const tooltip = mode === 'grid' ? 'Canvas colors' : mode === 'symbols' ? 'Colors + Symbols' : 'Original photo';
              return (
                <div key={mode} className="tooltip-group">
                  <button
                    onClick={() => setViewportMode(mode)}
                    className={`text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-sky-500 text-white shadow shadow-sky-500/20'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                  <div className="tooltip-box">{tooltip}</div>
                </div>
              );
            })}
          </div>

          {/* Zoom controls */}
          {(viewportMode === 'grid' || viewportMode === 'symbols') && (
            <div className="flex items-center gap-1 border-l border-slate-800 pl-3">
              <div className="tooltip-group">
                <button
                  onClick={() => onZoomIn()}
                  aria-label="Zoom In"
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-355 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
                >
                  ➕
                </button>
                <div className="tooltip-box">Zoom In</div>
              </div>

              <div className="tooltip-group">
                <button
                  onClick={() => onZoomOut()}
                  aria-label="Zoom Out"
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-355 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
                >
                  ➖
                </button>
                <div className="tooltip-box">Zoom Out</div>
              </div>

              <div className="tooltip-group">
                <button
                  onClick={() => onFit()}
                  aria-label="Fit Viewport"
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-355 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
                >
                  ⛶
                  <span className="hidden">Zoom</span>
                </button>
                <div className="tooltip-box">Fit to Screen</div>
              </div>
            </div>
          )}

          {/* Low zoom warning */}
          {viewportMode === 'symbols' && zoomScale * 16 < 10 && (
            <div className="tooltip-group flex items-center border-l border-slate-800 pl-3">
              <div className="px-2 py-1 rounded bg-warn/15 border border-warn/40 text-warn text-[10px] font-bold select-none cursor-default flex items-center gap-1 whitespace-nowrap animate-pulse">
                ⚠️ Low Zoom
              </div>
              <div className="tooltip-box">Zoom in to view symbol overlays (disabled at &lt;10px cell size)</div>
            </div>
          )}
        </div>
      )}
      {(image || matchResult) && (
        <div className="print-canvas-sheet w-full h-full flex items-center justify-center print:grid print:grid-cols-[140px_1fr_140px] print:gap-2">
          {/* Left print legend */}
          <div className="print-legend print-legend-left hidden print:flex flex-col p-1 text-[8px] font-mono overflow-hidden border-r-2 border-dashed border-slate-500 pr-2">
            {leftLegendColors.map(c => {
              const symbol = symbolMap[c.dmc] || '';
              return (
                <div key={c.dmc} className="print-legend-item flex items-center mb-1 pb-1 border-b border-slate-200">
                  <span className="print-legend-symbol text-[10px] font-bold w-[18px] text-center mr-1">{symbol}</span>
                  <div className="print-legend-swatch w-3 h-3 border border-black mr-2 print-color-adjust-exact" style={{ backgroundColor: c.hex }} />
                  <span className="print-legend-label flex-1">{c.dmc}</span>
                </div>
              );
            })}
          </div>

          {/* Center canvas wrapper */}
          <div className="print-canvas-wrapper flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className={`shadow-2xl border border-slate-800 bg-slate-950 print:border-none print:shadow-none ${
                (viewportMode === 'grid' || viewportMode === 'symbols') ? '' : 'hidden'
              }`}
            />
          </div>

          {/* Right print legend */}
          <div className="print-legend print-legend-right hidden print:flex flex-col p-1 text-[8px] font-mono overflow-hidden border-l-2 border-dashed border-slate-500 pl-2">
            {rightLegendColors.map(c => {
              const symbol = symbolMap[c.dmc] || '';
              return (
                <div key={c.dmc} className="print-legend-item flex items-center mb-1 pb-1 border-b border-slate-200">
                  <span className="print-legend-symbol text-[10px] font-bold w-[18px] text-center mr-1">{symbol}</span>
                  <div className="print-legend-swatch w-3 h-3 border border-black mr-2 print-color-adjust-exact" style={{ backgroundColor: c.hex }} />
                  <span className="print-legend-label flex-1">{c.dmc}</span>
                </div>
              );
            })}
          </div>

          {image && (
            <div className={`relative max-w-full max-h-[85vh] p-4 flex flex-col items-center gap-2 no-print ${
              viewportMode === 'reference' ? '' : 'hidden'
            }`}>
              <img
                src={image.src}
                alt="Original reference full size"
                className="max-w-full max-h-[75vh] object-contain rounded-lg border border-slate-800 shadow-2xl"
              />
              <span className="text-[10px] text-slate-500 font-medium tracking-wide">Viewing original image at full resolution ({image.naturalWidth} x {image.naturalHeight})</span>
            </div>
          )}
        </div>
      )}

      {/* Bottom hint pill */}
      {(image || matchResult) && (viewportMode === 'grid' || viewportMode === 'symbols') && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 no-print px-3 py-1.5 rounded-full bg-panel/80 border border-border text-[10px] font-mono text-muted whitespace-nowrap backdrop-blur">
          drag to pan · scroll to zoom · {(cols * rows).toLocaleString()} drills
        </div>
      )}

      {/* Loading overlay — one surface, two phases (D-09). During the async
          off-thread decode/resample interval loadingPhase is 'preparing': an
          INDETERMINATE bar + "Preparing image…" (no percentage). It flips to
          'matching' on the worker's first onProgress tick: the DETERMINATE
          width:{progress}% bar + "Matching colors: {progress}%". Gated by
          {loading && …} so it clears on completion or error and never
          co-displays with the matchError banner below. */}
      {loading && (
        <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-3">
          {loadingPhase === 'preparing' ? (
            <>
              <div className="w-48 bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full w-full animate-pulse" />
              </div>
              <span className="text-sm font-medium text-slate-300">Preparing image…</span>
            </>
          ) : (
            <>
              <div className="w-48 bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full transition-all duration-100" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-sm font-medium text-slate-300">Matching colors: {progress}%</span>
            </>
          )}
        </div>
      )}

      {/* Match error banner — surfaces worker/synchronous failures across the whole
          pipeline: off-thread decode-stage failures (D-10) as well as match-stage
          failures (B1/W5). loading is cleared on error (see the hook), so this never
          co-displays with the spinner. Copy is stage-agnostic so a decode-stage
          message reads correctly. Text-only content (never dangerouslySetInnerHTML)
          so a crafted worker error string cannot inject markup. Clears automatically
          on the next match, which resets the hook's error to null. */}
      {matchError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 no-print max-w-md px-4 py-2.5 rounded-lg bg-rose-950/90 border border-rose-500/60 text-xs font-medium text-rose-100 shadow-lg backdrop-blur">
          Couldn't process the image: {matchError}
        </div>
      )}

      {/* Unified action-error banner (ERR-01) — one surface for imperative
          one-shot failures: save quota-full (CR-02/B3), download-generation
          failures, and a corrupt checkout unmapped-colors log (W4). Fixed +
          z-[60] so it sits above the Save Project Modal (z-50). Offset to top-16
          (distinct from the matchError banner at top-4) so the two never overlap
          (UX directive: no overlapping indicators). Text-only — {actionError} is
          rendered as a plain JSX text child, never dangerouslySetInnerHTML, so a
          crafted error/stored string cannot inject markup (ASVS output-encoding,
          T-11-07). Dismissible via the × so a stale one-shot error doesn't linger;
          each action handler also clears it at its start (clear-then-act). */}
      {actionError && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] no-print max-w-md flex items-start gap-3 px-4 py-2.5 rounded-lg bg-rose-950/95 border border-rose-500/60 text-xs font-medium text-rose-100 shadow-lg backdrop-blur">
          <span>{actionError}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={onDismissActionError}
            className="shrink-0 -mr-1 -mt-0.5 px-1 text-rose-300 hover:text-rose-100 transition-colors text-sm leading-none"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
