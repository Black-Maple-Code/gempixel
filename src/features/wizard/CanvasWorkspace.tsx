import { RefObject } from 'preact';
import type { RawMatch } from '../match/useDiamondArtMatch';
import type { ColorSymbolMap } from '../../engine/symbols';

/**
 * CanvasWorkspace — the center-canvas preview region (the `viewport-dots`
 * surface hosting the SINGLE-MOUNT `<canvas>`, the reference-mode full-res
 * image, print legends, the drag/scroll hint pill, and the loading overlay).
 * The view-mode switcher + zoom controls were relocated to CanvasControlBar
 * (Plan 25-07, GAP-1/SC8) — an in-flow strip in AtelierShell Zone 3 above
 * Back/Next — so no chrome floats over the raster and the canvas fills the
 * full height. The match/action error banners were hoisted to frame scope in
 * App (Plan 08) so they surface on any step, not only while the canvas is
 * visible.
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
  /** Drives the canvas hidden/reference toggle + the hint pill. Owned by App. */
  viewportMode: 'grid' | 'symbols' | 'reference';
  cols: number;
  rows: number;
  symbolMap: ColorSymbolMap;
  leftLegendColors: LegendColor[];
  rightLegendColors: LegendColor[];
  loading: boolean;
  loadingPhase: 'preparing' | 'matching';
  progress: number;
}

export function CanvasWorkspace(props: CanvasWorkspaceProps) {
  const {
    canvasRef,
    image,
    matchResult,
    viewportMode,
    cols,
    rows,
    symbolMap,
    leftLegendColors,
    rightLegendColors,
    loading,
    loadingPhase,
    progress,
  } = props;

  return (
    <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-bg viewport-dots print:bg-white print:h-auto print:overflow-visible print:p-4">
      {/* The zoom HUD + view-mode switcher were relocated to CanvasControlBar
          (Plan 25-07, GAP-1/SC8) — an in-flow strip in AtelierShell Zone 3 — so
          nothing floats over the raster and the canvas fills the full height. */}
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
              className={`shadow-2xl border border-border bg-bg print:border-none print:shadow-none ${
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
                className="max-w-full max-h-[75vh] object-contain rounded-lg border border-border shadow-2xl"
              />
              <span className="text-[10px] text-faint font-medium tracking-wide">Viewing original image at full resolution ({image.naturalWidth} x {image.naturalHeight})</span>
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
        <div className="absolute inset-0 bg-bg/80 flex flex-col items-center justify-center gap-3">
          {loadingPhase === 'preparing' ? (
            <>
              <div className="w-48 bg-border h-2 rounded-full overflow-hidden">
                <div className="bg-accent h-full w-full animate-pulse" />
              </div>
              <span className="text-sm font-medium text-ink">Recomputing…</span>
            </>
          ) : (
            <>
              <div className="w-48 bg-border h-2 rounded-full overflow-hidden">
                <div className="bg-accent h-full transition-all duration-100" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-sm font-medium text-ink">Matching colors: {progress}%</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
