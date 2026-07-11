import { RefObject } from 'preact';
import type { RecentImage } from '../../../engine/projectStore';

/**
 * Step1Ingest — the wizard's "Upload" step: image ingestion, recent uploads,
 * fit mode, canvas presets / recommended sizes, sizing units + width/height,
 * and drill style. Pure presentational component: all state + handlers are
 * passed in as props (no local state mirroring engine state).
 */
export interface Step1IngestProps {
  image: HTMLImageElement | null;
  imageName: string;
  dropZoneRef: RefObject<HTMLDivElement>;
  isDragOver: boolean;
  imageSourceOpen: boolean;
  setImageSourceOpen: (v: boolean) => void;
  recentImages: RecentImage[];
  recentUploadsOpen: boolean;
  setRecentUploadsOpen: (v: boolean) => void;
  imageFitMode: 'cover' | 'contain';
  setImageFitMode: (v: 'cover' | 'contain') => void;
  standardSizes: { name: string; value: string }[];
  selectedPreset: string;
  setSelectedPreset: (v: string) => void;
  unit: 'cm' | 'inch' | 'grid';
  setUnit: (v: 'cm' | 'inch' | 'grid') => void;
  widthInput: string;
  heightInput: string;
  setWidthInput: (v: string) => void;
  setHeightInput: (v: string) => void;
  cols: number;
  rows: number;
  setCols: (v: number) => void;
  setRows: (v: number) => void;
  drillStyle: 'square' | 'round';
  setDrillStyle: (v: 'square' | 'round') => void;
  recsOpen: boolean;
  setRecsOpen: (v: boolean) => void;
  handleFileChange: (e: Event) => void;
  handleDragOver: (e: DragEvent) => void;
  handleDragLeave: (e: DragEvent) => void;
  handleDrop: (e: DragEvent) => void;
  loadRecentImage: (entry: RecentImage) => void;
  deleteRecentImage: (id: string, e: Event) => void;
  handlePresetChange: (e: Event) => void;
  handleUnitChange: (u: 'cm' | 'inch' | 'grid') => void;
  handleWidthChange: (v: string) => void;
  handleHeightChange: (v: string) => void;
}

export function Step1Ingest(props: Step1IngestProps) {
  const {
    image,
    imageName,
    dropZoneRef,
    isDragOver,
    imageSourceOpen,
    setImageSourceOpen,
    recentImages,
    recentUploadsOpen,
    setRecentUploadsOpen,
    imageFitMode,
    setImageFitMode,
    standardSizes,
    selectedPreset,
    setSelectedPreset,
    unit,
    setUnit,
    widthInput,
    heightInput,
    setWidthInput,
    setHeightInput,
    cols,
    rows,
    setCols,
    setRows,
    drillStyle,
    setDrillStyle,
    recsOpen,
    setRecsOpen,
    handleFileChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    loadRecentImage,
    deleteRecentImage,
    handlePresetChange,
    handleUnitChange,
    handleWidthChange,
    handleHeightChange,
  } = props;

  // Recent Uploads strip — shown before an image is chosen, and inside the
  // expanded Source Image menu afterwards (declared once, reused in both).
  const recentUploads =
    recentImages.length > 0 ? (
      <div className="flex flex-col gap-1.5 border border-slate-850 p-2 rounded bg-slate-950/30 shrink-0 no-print">
        <button
          onClick={() => setRecentUploadsOpen(!recentUploadsOpen)}
          className="w-full flex justify-between items-center text-left font-bold text-slate-200 transition-colors select-none cursor-pointer focus:outline-none"
        >
          <div className="flex items-center gap-1.5">
            <span className={`text-[8px] text-slate-500 transition-transform duration-200 ${recentUploadsOpen ? 'rotate-90' : ''}`}>▶</span>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Recent Uploads</span>
          </div>
          <span className="text-[9px] text-slate-500 font-medium">({recentImages.length})</span>
        </button>
        {recentUploadsOpen && (
          <div className="flex gap-2 overflow-x-auto py-1 scrollbar-thin">
            {recentImages.map(imgEntry => (
              <div
                key={imgEntry.id}
                onClick={() => loadRecentImage(imgEntry)}
                className="relative w-10 h-10 rounded border border-slate-800 bg-slate-950/60 cursor-pointer hover:border-indigo-500/75 group shrink-0 overflow-hidden transition-all"
                title={imgEntry.name}
              >
                <img
                  src={imgEntry.dataUrl}
                  alt={imgEntry.name}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={(e) => deleteRecentImage(imgEntry.id, e)}
                  className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-slate-950/80 text-[10px] text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-slate-900 border border-slate-800 cursor-pointer"
                  title="Delete Image"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    ) : null;

  return (
        <div className="flex flex-col gap-4">
          {/* Source Image — collapses to a compact summary once an image is loaded,
              freeing vertical space for the ingestion settings below. */}
          {image ? (
            <div className="border border-slate-850 rounded bg-slate-950/30 shrink-0 overflow-hidden">
              <div
                id="source-image-toggle"
                onClick={() => setImageSourceOpen(!imageSourceOpen)}
                className="w-full flex items-center justify-between gap-2 p-2 cursor-pointer select-none hover:bg-slate-900/40 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-[8px] text-slate-500 transition-transform duration-200 shrink-0 ${imageSourceOpen ? 'rotate-90' : ''}`}>▶</span>
                  <div className="w-8 h-8 rounded bg-slate-800 overflow-hidden shrink-0 border border-slate-800 flex items-center justify-center">
                    <img src={image.src} alt="Uploaded thumbnail" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-slate-350 font-bold truncate leading-none">{imageName || 'Loaded Photo'}</div>
                    <div className="text-[8px] text-slate-500 mt-1 font-semibold">{image.naturalWidth} x {image.naturalHeight} px</div>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); document.getElementById('file-upload')?.click(); }}
                  className="text-[9px] text-indigo-400 hover:text-indigo-300 font-bold border border-indigo-500/20 px-2 py-0.5 rounded bg-indigo-500/5 hover:bg-indigo-500/10 transition-all cursor-pointer shrink-0"
                >
                  Replace
                </button>
              </div>

              {imageSourceOpen && (
                <div className="flex flex-col gap-3 p-2 pt-0">
                  {recentUploads}
                  <div className="flex flex-col gap-1.5 border border-slate-850 p-2 rounded bg-slate-950/30 shrink-0">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Reference Image</span>
                    <img
                      src={image.src}
                      alt="Reference Preview"
                      className="w-full max-h-24 object-contain rounded border border-slate-800 bg-slate-950/50"
                    />
                  </div>
                </div>
              )}

              {/* Hidden input backing the Replace button */}
              <input id="file-upload" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>
          ) : (
            <>
              {/* No image yet: prominent drop zone */}
              <div className="flex flex-col gap-1.5 shrink-0">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Load Image</label>
                <div
                  ref={dropZoneRef}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border border-dashed rounded-lg p-3 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[90px] ${
                    isDragOver
                      ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/5'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/60'
                  }`}
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <span className="text-[11px] text-slate-400 leading-relaxed max-w-[200px]">Drag & Drop Image or Click to Browse</span>
                  <input id="file-upload" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </div>
              </div>
              {recentUploads}
            </>
          )}
          <details open className="text-[10px] text-slate-400 bg-slate-950/20 p-2 rounded border border-slate-850/40 cursor-pointer">
            <summary className="font-bold text-xs uppercase text-indigo-400 select-none flex items-center gap-2 cursor-pointer pb-2 border-b border-slate-850/30">
              <span className="caret-icon text-slate-500">▶</span>
              <span>Ingestion Settings</span>
            </summary>
            <div className="flex flex-col gap-4 mt-3 cursor-default" onClick={(e) => e.stopPropagation()}>
              {/* Image Fit Option */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 justify-between">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fit/Crop Mode</label>
                  <div className="tooltip-group">
                    <span className="text-[10px] text-slate-500 hover:text-slate-350 cursor-help w-3.5 h-3.5 rounded-full border border-slate-800 flex items-center justify-center font-bold">?</span>
                    <div className="tooltip-box">Choose center crop or fit to grid aspect ratio.</div>
                  </div>
                </div>
                <select
                  value={imageFitMode}
                  onChange={(e) => {
                    setImageFitMode((e.target as HTMLSelectElement).value as any);
                  }}
                  className="bg-slate-950/80 border border-slate-850 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-200 cursor-pointer"
                >
                  <option value="cover">Center Crop (Cover)</option>
                  <option value="contain">Fit to Grid (Contain)</option>
                </select>
              </div>

              {/* Separator */}
              <div className="h-px bg-slate-800/40 my-1 no-print" />
              {/* Canvas Preset Size */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 justify-between">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Canvas Preset Size</label>
                  <div className="tooltip-group">
                    <span className="text-[10px] text-slate-500 hover:text-slate-350 cursor-help w-3.5 h-3.5 rounded-full border border-slate-800 flex items-center justify-center font-bold">?</span>
                    <div className="tooltip-box">Select a standard canvas dimensions preset.</div>
                  </div>
                </div>
                <select
                  id="preset-size-select"
                  value={selectedPreset}
                  onChange={handlePresetChange}
                  className="bg-slate-950/80 border border-slate-850 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-200 cursor-pointer"
                >
                  {standardSizes.map(sz => (
                    <option key={sz.value} value={sz.value}>{sz.name}</option>
                  ))}
                </select>
              </div>

              {/* Recommended Canvas Sizes (PrintKK matching) */}
              {image && (
                <div className="border border-slate-850 p-2 rounded bg-slate-950/30 flex flex-col shrink-0 no-print">
                  <button
                    onClick={() => setRecsOpen(!recsOpen)}
                    className="w-full flex justify-between items-center text-left font-bold text-xs text-slate-250 select-none cursor-pointer focus:outline-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[8px] text-slate-500 transition-transform duration-200 ${recsOpen ? 'rotate-90' : ''}`}>▶</span>
                      <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Recommended Canvas Sizes</span>
                    </div>
                  </button>
                  {recsOpen && (
                    <div className="mt-2.5 flex flex-col gap-1.5">
                      {(() => {
                        const imgW = image.width;
                        const imgH = image.height;
                        const imgRatio = imgW / imgH;
                        const isLandscape = imgRatio >= 1;

                        const PRINTKK_BASE_SIZES = [
                          { w: 30, h: 40 }, // 12" x 16"
                          { w: 40, h: 50 }, // 16" x 20"
                          { w: 50, h: 70 }, // 20" x 28"
                          { w: 100, h: 150 } // 40" x 60"
                        ];

                        const list = PRINTKK_BASE_SIZES.map(sz => {
                          const width = isLandscape ? Math.max(sz.w, sz.h) : Math.min(sz.w, sz.h);
                          const height = isLandscape ? Math.min(sz.w, sz.h) : Math.max(sz.w, sz.h);
                          const ratio = width / height;
                          const diff = Math.abs(imgRatio - ratio) / imgRatio;
                          const matchPct = Math.max(0, Math.min(100, Math.round((1 - diff) * 100)));
                          return { width, height, matchPct, diff };
                        });

                        const top3 = list.sort((a, b) => a.diff - b.diff).slice(0, 3);

                        return top3.map((sz, idx) => {
                          const isSelected = selectedPreset === 'custom' && unit === 'cm' && parseInt(widthInput) === sz.width && parseInt(heightInput) === sz.height;
                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                setSelectedPreset('custom');
                                setUnit('cm');
                                setWidthInput(sz.width.toString());
                                setHeightInput(sz.height.toString());
                                setCols(Math.max(1, Math.round(sz.width * 4)));
                                setRows(Math.max(1, Math.round(sz.height * 4)));
                              }}
                              className={`w-full py-1.5 px-2 rounded text-left text-xs transition-all flex items-center justify-between border cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600/30 text-indigo-200 border-indigo-500/50'
                                  : 'bg-slate-950/60 text-slate-350 border-slate-850 hover:bg-slate-900/60 hover:text-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold">{sz.width} x {sz.height} cm</span>
                                <span className="text-[10px] text-slate-400">({(sz.width * 0.3937).toFixed(0)}" x {(sz.height * 0.3937).toFixed(0)}")</span>
                              </div>
                              <span className={`text-[10px] font-mono font-semibold ${sz.matchPct >= 95 ? 'text-emerald-400' : 'text-warn'}`}>
                                {sz.matchPct}% Match
                              </span>
                            </button>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Sizing Units & Inputs */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 justify-between">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sizing Mode</label>
                  <div className="tooltip-group">
                    <span className="text-[10px] text-slate-500 hover:text-slate-350 cursor-help w-3.5 h-3.5 rounded-full border border-slate-800 flex items-center justify-center font-bold">?</span>
                    <div className="tooltip-box">Choose sizing in dots, centimeters, or inches.</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1 bg-slate-950/60 p-0.5 rounded border border-slate-850/50">
                  {(['grid', 'cm', 'inch'] as const).map(u => (
                    <button
                      key={u}
                      onClick={() => handleUnitChange(u)}
                      className={`text-[10px] py-1 rounded capitalize font-medium transition-all cursor-pointer ${
                        unit === u
                          ? 'bg-indigo-600 text-white shadow shadow-indigo-600/20'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-500 uppercase font-semibold">Width ({unit === 'grid' ? 'dots' : unit})</label>
                  <input
                    type="number"
                    data-field="width"
                    step={unit === 'grid' ? '1' : '0.1'}
                    value={widthInput}
                    onInput={(e) => handleWidthChange((e.target as HTMLInputElement).value)}
                    className="bg-slate-950/80 border border-slate-850 rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-200"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-500 uppercase font-semibold">Height ({unit === 'grid' ? 'dots' : unit})</label>
                  <input
                    type="number"
                    data-field="height"
                    step={unit === 'grid' ? '1' : '0.1'}
                    value={heightInput}
                    onInput={(e) => handleHeightChange((e.target as HTMLInputElement).value)}
                    className="bg-slate-950/80 border border-slate-850 rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-200"
                  />
                </div>
              </div>

              {/* Calculated Info */}
              <div className="bg-slate-950/30 p-2 rounded border border-slate-850/60 text-[11px] flex flex-col gap-1 text-slate-350">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Grid Dimensions:</span>
                  <span className="font-semibold text-slate-300 font-mono">{cols} × {rows}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Total Drills Needed:</span>
                  <span className="font-bold text-indigo-400 font-mono">{(cols * rows).toLocaleString()}</span>
                </div>
              </div>

              {/* Drill Style */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 justify-between">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Drill Representation</label>
                  <div className="tooltip-group">
                    <span className="text-[10px] text-slate-500 hover:text-slate-350 cursor-help w-3.5 h-3.5 rounded-full border border-slate-800 flex items-center justify-center font-bold">?</span>
                    <div className="tooltip-box">Choose square or round drill representation on the grid.</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 bg-slate-950/60 p-0.5 rounded border border-slate-850/50">
                  {(['square', 'round'] as const).map(style => (
                    <button
                      key={style}
                      onClick={() => setDrillStyle(style)}
                      className={`text-[10px] py-1 rounded capitalize font-medium transition-all cursor-pointer ${
                        drillStyle === style
                          ? 'bg-indigo-600 text-white shadow shadow-indigo-600/20'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </details>
        </div>
  );
}
