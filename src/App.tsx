import { useState, useEffect, useRef } from 'preact/hooks';
import { MatcherClient } from './engine/worker-client';
import { CanvasViewer } from './engine/viewer';
import { DMC_PALETTE } from './engine/palette';
import { boxSampleImage } from './engine/ingest';

export function calculateSafetyPurchase(exactCount: number): { safety: number; packets: number; purchase: number } {
  const safety = Math.ceil(Math.round(exactCount * 110) / 100);
  const packets = Math.ceil(safety / 200);
  const purchase = packets * 200;
  return { safety, packets, purchase };
}

export function App() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [cols, setCols] = useState(40);
  const [rows, setRows] = useState(30);

  const [unit, setUnit] = useState<'cm' | 'inch' | 'grid'>('grid');
  const [widthInput, setWidthInput] = useState<string>('40');
  const [heightInput, setHeightInput] = useState<string>('30');

  const [drillStyle, setDrillStyle] = useState<'square' | 'round'>('square');
  const [selectedBaseKit, setSelectedBaseKit] = useState<'all' | '100' | '200'>('all');
  const [excludedColors, setExcludedColors] = useState<Set<string>>(new Set());
  const [highlightedColor, setHighlightedColor] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [matchResult, setMatchResult] = useState<{ matches: string[]; counts: Record<string, number> } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<CanvasViewer | null>(null);
  const clientRef = useRef<MatcherClient | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Initialize MatcherClient and CanvasViewer
  useEffect(() => {
    // Instantiate client with Vite worker URL syntax
    clientRef.current = new MatcherClient(new URL('./engine/matcher.worker.ts', import.meta.url));

    if (canvasRef.current) {
      viewerRef.current = new CanvasViewer(canvasRef.current);
    }

    return () => {
      clientRef.current?.terminate();
      viewerRef.current?.destroy();
    };
  }, []);

  // Update physical dimensions inputs when grid size changes or unit changes
  useEffect(() => {
    if (unit === 'grid') {
      setWidthInput(cols.toString());
      setHeightInput(rows.toString());
    } else if (unit === 'cm') {
      setWidthInput((cols / 4).toString());
      setHeightInput((rows / 4).toString());
    } else if (unit === 'inch') {
      setWidthInput((cols / 10).toString());
      setHeightInput((rows / 10).toString());
    }
  }, [cols, rows, unit]);

  // Handle changes to unit selector
  const handleUnitChange = (newUnit: 'cm' | 'inch' | 'grid') => {
    setUnit(newUnit);
    if (newUnit === 'grid') {
      setWidthInput(cols.toString());
      setHeightInput(rows.toString());
    } else if (newUnit === 'cm') {
      setWidthInput((cols / 4).toString());
      setHeightInput((rows / 4).toString());
    } else if (newUnit === 'inch') {
      setWidthInput((cols / 10).toString());
      setHeightInput((rows / 10).toString());
    }
  };

  const handleWidthChange = (valStr: string) => {
    setWidthInput(valStr);
    const val = parseFloat(valStr);
    if (isNaN(val) || val <= 0) return;

    if (unit === 'grid') {
      setCols(Math.max(1, Math.round(val)));
    } else if (unit === 'cm') {
      setCols(Math.max(1, Math.round(val * 4)));
    } else if (unit === 'inch') {
      setCols(Math.max(1, Math.round(val * 10)));
    }
  };

  const handleHeightChange = (valStr: string) => {
    setHeightInput(valStr);
    const val = parseFloat(valStr);
    if (isNaN(val) || val <= 0) return;

    if (unit === 'grid') {
      setRows(Math.max(1, Math.round(val)));
    } else if (unit === 'cm') {
      setRows(Math.max(1, Math.round(val * 4)));
    } else if (unit === 'inch') {
      setRows(Math.max(1, Math.round(val * 10)));
    }
  };

  // Helper to extract pixels from image
  const getImagePixels = (img: HTMLImageElement): { pixels: Uint8ClampedArray; width: number; height: number } => {
    const canvas = document.createElement('canvas');
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2d context for image pixels');
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, w, h);
    return {
      pixels: imageData.data,
      width: w,
      height: h
    };
  };

  // Determine base catalog candidate list
  const baseCandidates = selectedBaseKit === 'all'
    ? DMC_PALETTE
    : DMC_PALETTE.filter(c => c.kits.includes(selectedBaseKit));

  // Determine active candidates based on sub-palette exclusion checklist
  const activeCandidates = baseCandidates.filter(c => !excludedColors.has(c.dmc));

  // Trigger match recalculation when image, dimensions, or candidates change
  useEffect(() => {
    if (!image) return;
    if (activeCandidates.length === 0) return;

    setLoading(true);
    setProgress(0);

    try {
      const { pixels, width: srcW, height: srcH } = getImagePixels(image);
      const downsampled = boxSampleImage(pixels, srcW, srcH, cols, rows);

      clientRef.current?.match(
        downsampled,
        activeCandidates,
        (pct) => setProgress(pct),
        (result) => {
          setLoading(false);
          setMatchResult(result);

          if (viewerRef.current) {
            const colorMap = new Map<string, string>();
            activeCandidates.forEach(c => colorMap.set(c.dmc, c.hex));
            viewerRef.current.setData(cols, rows, result.matches, colorMap);
            // Reapply current highlight
            viewerRef.current.setHighlightedColor(highlightedColor);
          }
        },
        cols
      );
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }, [image, cols, rows, selectedBaseKit, excludedColors]);

  // Handle drill style selector changes
  useEffect(() => {
    if (viewerRef.current) {
      viewerRef.current.setDrillStyle(drillStyle);
    }
  }, [drillStyle]);

  // Toggle exclusion for a color
  const toggleColorExclusion = (dmc: string) => {
    setExcludedColors(prev => {
      const next = new Set(prev);
      if (next.has(dmc)) {
        next.delete(dmc);
      } else {
        // Enforce that we don't exclude all colors
        if (next.size >= baseCandidates.length - 1) {
          alert("At least one candidate color must remain active.");
          return prev;
        }
        next.add(dmc);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setExcludedColors(new Set());
  };

  const handleDeselectAll = () => {
    if (baseCandidates.length > 0) {
      const allOthers = baseCandidates.slice(1).map(c => c.dmc);
      setExcludedColors(new Set(allOthers));
    }
  };

  // Handle color row clicks in supply table for highlighting
  const handleRowClick = (code: string) => {
    const nextHighlight = highlightedColor === code ? null : code;
    setHighlightedColor(nextHighlight);
    if (viewerRef.current) {
      viewerRef.current.setHighlightedColor(nextHighlight);
    }
  };

  // Image loading helpers
  const handleFileChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      loadImageFile(file);
    }
  };

  const [isDragOver, setIsDragOver] = useState(false);
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = () => {
    setIsDragOver(false);
  };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      loadImageFile(file);
    }
  };

  const loadImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Reset exclusions when loading a new image
        setExcludedColors(new Set());
        setHighlightedColor(null);
        setImage(img);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const printReport = () => {
    window.print();
  };

  // Calculate sorted legend table rows
  const sortedMatches = Object.entries(matchResult?.counts || {})
    .map(([code, count]) => {
      const colorInfo = DMC_PALETTE.find(c => c.dmc === code);
      const metrics = calculateSafetyPurchase(count);
      return {
        code,
        count,
        name: colorInfo?.name || 'Unknown DMC Color',
        hex: colorInfo?.hex || '#2D3748',
        ...metrics
      };
    })
    .sort((a, b) => b.count - a.count);

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden print:h-auto print:overflow-visible">
      {/* Left Sidebar Control Panel */}
      <aside className="w-80 bg-slate-900 border-r border-slate-800 p-4 flex flex-col gap-4 overflow-y-auto no-print">
        <div className="border-b border-slate-800 pb-3">
          <h1 className="text-xl font-bold text-indigo-400">GemPixel</h1>
          <p className="text-xs text-slate-400 mt-1">Diamond Painting Supply Planner</p>
        </div>

        {/* File Upload / Dropzone */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-300">Load Image</label>
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors flex flex-col items-center justify-center min-h-[100px] ${
              isDragOver ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-600 bg-slate-950/50'
            }`}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <span className="text-xs text-slate-400">Drag & Drop Image or Click to Browse</span>
            <input
              id="file-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* Base Kit Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-300">DMC Kit Reference</label>
          <select
            value={selectedBaseKit}
            onChange={(e) => {
              setSelectedBaseKit((e.target as HTMLSelectElement).value as any);
              setExcludedColors(new Set()); // Reset exclusions on kit change
            }}
            className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All DMC Palette</option>
            <option value="100">Art Dot 100 Kit</option>
            <option value="200">Art Dot 200 Kit</option>
          </select>
        </div>

        {/* Sizing Units & Inputs */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-300">Sizing Mode</label>
          <div className="grid grid-cols-3 gap-1">
            {(['grid', 'cm', 'inch'] as const).map(u => (
              <button
                key={u}
                onClick={() => handleUnitChange(u)}
                className={`text-xs py-1 rounded capitalize font-medium ${
                  unit === u ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Width ({unit === 'grid' ? 'dots' : unit})</label>
            <input
              type="number"
              step={unit === 'grid' ? '1' : '0.1'}
              value={widthInput}
              onInput={(e) => handleWidthChange((e.target as HTMLInputElement).value)}
              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Height ({unit === 'grid' ? 'dots' : unit})</label>
            <input
              type="number"
              step={unit === 'grid' ? '1' : '0.1'}
              value={heightInput}
              onInput={(e) => handleHeightChange((e.target as HTMLInputElement).value)}
              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Calculated Info */}
        <div className="bg-slate-950/40 p-2.5 rounded border border-slate-800/80 text-xs flex flex-col gap-1">
          <div className="flex justify-between">
            <span className="text-slate-400">Grid Dimensions:</span>
            <span className="font-semibold text-slate-200">{cols} x {rows}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Total Drills Needed:</span>
            <span className="font-semibold text-indigo-400">{(cols * rows).toLocaleString()}</span>
          </div>
        </div>

        {/* Drill Style */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-300">Drill Representation</label>
          <div className="grid grid-cols-2 gap-2">
            {(['square', 'round'] as const).map(style => (
              <label key={style} className="flex items-center gap-2 cursor-pointer bg-slate-950/30 border border-slate-800 hover:border-slate-750 px-3 py-1.5 rounded text-xs select-none">
                <input
                  type="radio"
                  name="drillStyle"
                  checked={drillStyle === style}
                  onChange={() => setDrillStyle(style)}
                  className="text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
                />
                <span className="capitalize">{style}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Action Button */}
        {matchResult && (
          <button
            onClick={printReport}
            className="mt-auto bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Print / Export PDF</span>
          </button>
        )}
      </aside>

      {/* Main Canvas Area */}
      <main className="flex-1 relative flex flex-col min-w-0 print:block">
        <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-slate-950 print:bg-white print:h-auto print:overflow-visible print:p-4">
          {image ? (
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="shadow-2xl border border-slate-800 bg-slate-900 print:border-none print:shadow-none"
            />
          ) : (
            <div className="text-center p-6 max-w-sm flex flex-col items-center gap-2">
              <span className="text-lg font-bold text-slate-300">No Image Loaded</span>
              <p className="text-sm text-slate-400">Load a photo using the sidebar panel to see your diamond painting canvas layout preview.</p>
            </div>
          )}

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-3">
              <div className="w-48 bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full transition-all duration-100" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-sm font-medium text-slate-300">Matching colors: {progress}%</span>
            </div>
          )}
        </div>
      </main>

      {/* Right Sidebar Checklist & Legend */}
      <aside className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden print:w-full print:border-l-0 print:bg-white print:text-black print:overflow-visible print:h-auto">
        
        {/* Sub-palette selection checklist */}
        <div className="p-4 border-b border-slate-800 no-print flex flex-col gap-2 shrink-0">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm text-slate-200">Exclude Colors</h3>
            <div className="flex gap-2">
              <button onClick={handleSelectAll} className="text-[10px] text-indigo-400 hover:text-indigo-300 cursor-pointer">
                Select All
              </button>
              <span className="text-slate-700 text-[10px] select-none">|</span>
              <button onClick={handleDeselectAll} className="text-[10px] text-indigo-400 hover:text-indigo-300 cursor-pointer">
                Deselect All
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mb-1">Uncheck colors to exclude them from the match algorithm.</p>
          
          <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto border border-slate-800 p-2 rounded bg-slate-950/60">
            {baseCandidates.map(c => {
              const isExcluded = excludedColors.has(c.dmc);
              return (
                <label
                  key={c.dmc}
                  className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-850 p-1 rounded text-xs select-none"
                >
                  <input
                    type="checkbox"
                    checked={!isExcluded}
                    onChange={() => toggleColorExclusion(c.dmc)}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 h-3 w-3"
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-slate-800 shrink-0"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className="font-mono text-slate-300 text-[11px] truncate" title={c.name}>{c.dmc}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Legend table */}
        <div className="p-4 flex-1 flex flex-col overflow-hidden print:p-0 print:overflow-visible">
          <div className="flex justify-between items-center mb-3 no-print">
            <h3 className="font-bold text-sm text-slate-200">DMC Supply List</h3>
            {highlightedColor && (
              <button
                onClick={() => handleRowClick(highlightedColor)}
                className="text-[11px] text-red-400 hover:text-red-300 cursor-pointer"
              >
                Clear Highlight
              </button>
            )}
          </div>
          
          <h2 className="hidden print:block text-2xl font-bold mb-4">GemPixel Supply Plan Report</h2>

          {/* Table Container */}
          <div className="flex-1 overflow-y-auto border border-slate-800 rounded bg-slate-950/30 print:border-none print:bg-white print:overflow-visible no-print">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400 select-none">
                <tr>
                  <th className="p-2 w-8">Color</th>
                  <th className="p-2 w-12">DMC</th>
                  <th className="p-2 truncate max-w-[100px]">Name</th>
                  <th className="p-2 text-right">Exact</th>
                  <th className="p-2 text-right">Safety</th>
                  <th className="p-2 text-right">Bags</th>
                </tr>
              </thead>
              <tbody>
                {sortedMatches.map(row => {
                  const isHighlighted = highlightedColor === row.code;
                  return (
                    <tr
                      key={row.code}
                      onClick={() => handleRowClick(row.code)}
                      className={`border-b border-slate-800/60 hover:bg-slate-850/50 cursor-pointer select-none transition-colors ${
                        isHighlighted ? 'bg-indigo-950/60 hover:bg-indigo-900/60 border-l-2 border-l-indigo-500' : ''
                      }`}
                    >
                      <td className="p-2">
                        <span
                          className="block w-4 h-4 rounded border border-slate-800"
                          style={{ backgroundColor: row.hex }}
                        />
                      </td>
                      <td className="p-2 font-mono font-bold text-slate-350">{row.code}</td>
                      <td className="p-2 text-slate-400 truncate max-w-[100px]" title={row.name}>
                        {row.name}
                      </td>
                      <td className="p-2 text-right text-slate-300">{row.count}</td>
                      <td className="p-2 text-right font-medium text-indigo-300">{row.safety}</td>
                      <td className="p-2 text-right font-bold text-slate-200">
                        {row.packets} ({row.packets * 200})
                      </td>
                    </tr>
                  );
                })}
                {sortedMatches.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center p-6 text-slate-500">
                      No matching colors. Load an image to compute.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Printable Layout Table (displayed only during printing) */}
          <div className="hidden print:block">
            <table className="w-full text-left text-sm border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-150 border-b border-gray-300">
                  <th className="p-2 border border-gray-300">Color Swatch</th>
                  <th className="p-2 border border-gray-300">DMC Code</th>
                  <th className="p-2 border border-gray-300">Color Name</th>
                  <th className="p-2 text-right border border-gray-300">Exact Dots</th>
                  <th className="p-2 text-right border border-gray-300">Safety Marg. (+10%)</th>
                  <th className="p-2 text-right border border-gray-300">Recommended 200-Drill Packets</th>
                </tr>
              </thead>
              <tbody>
                {sortedMatches.map(row => (
                  <tr key={row.code} className="border-b border-gray-300">
                    <td className="p-2 border border-gray-300 flex items-center justify-center">
                      <span
                        className="block w-6 h-6 rounded border border-gray-400"
                        style={{ backgroundColor: row.hex }}
                      />
                    </td>
                    <td className="p-2 font-mono font-bold border border-gray-300">{row.code}</td>
                    <td className="p-2 border border-gray-300">{row.name}</td>
                    <td className="p-2 text-right border border-gray-300">{row.count}</td>
                    <td className="p-2 text-right border border-gray-300">{row.safety}</td>
                    <td className="p-2 text-right font-bold border border-gray-300">
                      {row.packets} pack(s) ({row.packets * 200} drills)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
        </div>
      </aside>
    </div>
  );
}
