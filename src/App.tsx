import { useState, useEffect, useRef } from 'preact/hooks';
import { MatcherClient } from './engine/worker-client';
import { CanvasViewer } from './engine/viewer';
import { DMC_PALETTE } from './engine/palette';
import { boxSampleImage } from './engine/ingest';
import logoUrl from './logo.png';

export const STANDARD_SIZES = [
  { name: 'Custom size', value: 'custom' },
  { name: '20 x 25 cm', value: '20x25-cm', width: 20, height: 25, unit: 'cm' },
  { name: '30 x 30 cm', value: '30x30-cm', width: 30, height: 30, unit: 'cm' },
  { name: '30 x 40 cm', value: '30x40-cm', width: 30, height: 40, unit: 'cm' },
  { name: '40 x 50 cm', value: '40x50-cm', width: 40, height: 50, unit: 'cm' },
  { name: '50 x 70 cm', value: '50x70-cm', width: 50, height: 70, unit: 'cm' },
  { name: '8 x 10 inch', value: '8x10-inch', width: 8, height: 10, unit: 'inch' },
  { name: '12 x 12 inch', value: '12x12-inch', width: 12, height: 12, unit: 'inch' },
  { name: '12 x 16 inch', value: '12x16-inch', width: 12, height: 16, unit: 'inch' },
  { name: '16 x 20 inch', value: '16x20-inch', width: 16, height: 20, unit: 'inch' },
  { name: '20 x 28 inch', value: '20x28-inch', width: 20, height: 28, unit: 'inch' }
];

export function calculateSafetyPurchase(exactCount: number): { safety: number; packets: number; purchase: number } {
  const safety = Math.ceil(Math.round(exactCount * 110) / 100);
  const packets = Math.ceil(safety / 200);
  const purchase = packets * 200;
  return { safety, packets, purchase };
}

export function App() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [cols, setCols] = useState(80);
  const [rows, setRows] = useState(53);

  const [unit, setUnit] = useState<'cm' | 'inch' | 'grid'>('grid');
  const [widthInput, setWidthInput] = useState<string>('80');
  const [heightInput, setHeightInput] = useState<string>('53');
  const [selectedPreset, setSelectedPreset] = useState<string>('custom');
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [excludeListOpen, setExcludeListOpen] = useState(false);
  const [supplyListOpen, setSupplyListOpen] = useState(true);
  const [viewportMode, setViewportMode] = useState<'grid' | 'reference'>('grid');
  const [recentImages, setRecentImages] = useState<{ id: string; name: string; dataUrl: string; width: number; height: number }[]>(() => {
    try {
      const saved = localStorage.getItem('gempixel_recent_images');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

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

  // Determine base catalog candidate list
  const baseCandidates = selectedBaseKit === 'all'
    ? DMC_PALETTE
    : DMC_PALETTE.filter(c => c.kits.includes(selectedBaseKit));

  // Determine active candidates based on sub-palette exclusion checklist
  const activeCandidates = baseCandidates.filter(c => !excludedColors.has(c.dmc));

  // Persist recent image list to localStorage, popping oldest if quota exceeded
  useEffect(() => {
    let list = [...recentImages];
    while (list.length > 0) {
      try {
        localStorage.setItem('gempixel_recent_images', JSON.stringify(list));
        break;
      } catch (err) {
        // QuotaExceededError - drop oldest entry and retry
        list.pop();
        if (list.length === 0) {
          localStorage.removeItem('gempixel_recent_images');
          break;
        }
      }
    }
  }, [recentImages]);

  // Initialize MatcherClient
  useEffect(() => {
    // Instantiate client with Vite worker URL syntax
    clientRef.current = new MatcherClient(new URL('./engine/matcher.worker.ts', import.meta.url));

    return () => {
      clientRef.current?.terminate();
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, []);

  // Initialize CanvasViewer when canvas is rendered (depends on image or view mode)
  useEffect(() => {
    if (canvasRef.current) {
      if (!viewerRef.current) {
        viewerRef.current = new CanvasViewer(canvasRef.current);
      }
    } else {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    }
  }, [image, viewportMode]);

  // Synchronize viewer data when canvas, matches, or styles change
  useEffect(() => {
    if (viewerRef.current && matchResult && activeCandidates.length > 0 && viewportMode === 'grid') {
      const colorMap = new Map<string, string>();
      activeCandidates.forEach(c => colorMap.set(c.dmc, c.hex));
      viewerRef.current.setData(cols, rows, matchResult.matches, colorMap);
      viewerRef.current.setDrillStyle(drillStyle);
      viewerRef.current.setHighlightedColor(highlightedColor);
    }
  }, [image, viewportMode, matchResult, activeCandidates, drillStyle, highlightedColor, cols, rows]);

  // Update physical dimensions inputs when grid size changes or unit changes
  useEffect(() => {
    const activeEl = document.activeElement;
    const widthFocused = activeEl && activeEl.getAttribute('data-field') === 'width';
    const heightFocused = activeEl && activeEl.getAttribute('data-field') === 'height';

    if (unit === 'grid') {
      if (!widthFocused) setWidthInput(cols.toString());
      if (!heightFocused) setHeightInput(rows.toString());
    } else if (unit === 'cm') {
      if (!widthFocused) setWidthInput((cols / 4).toString());
      if (!heightFocused) setHeightInput((rows / 4).toString());
    } else if (unit === 'inch') {
      if (!widthFocused) setWidthInput((cols / 10).toString());
      if (!heightFocused) setHeightInput((rows / 10).toString());
    }
  }, [cols, rows, unit]);

  // Handle changes to unit selector
  const handleUnitChange = (newUnit: 'cm' | 'inch' | 'grid') => {
    setUnit(newUnit);
    setSelectedPreset('custom');
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
    setSelectedPreset('custom');
    const val = parseFloat(valStr);
    if (isNaN(val) || val <= 0) return;

    let computedCols = cols;
    if (unit === 'grid') {
      computedCols = Math.max(1, Math.round(val));
    } else if (unit === 'cm') {
      computedCols = Math.max(1, Math.round(val * 4));
    } else if (unit === 'inch') {
      computedCols = Math.max(1, Math.round(val * 10));
    }
    setCols(computedCols);

    // Auto-adjust height if image is loaded to maintain aspect ratio
    if (image) {
      const ar = image.naturalWidth / image.naturalHeight;
      const computedHeight = val / ar;
      let computedRows = rows;
      if (unit === 'grid') {
        computedRows = Math.max(1, Math.round(computedHeight));
        setHeightInput(Math.max(1, Math.round(computedHeight)).toString());
      } else {
        setHeightInput(computedHeight.toFixed(1));
        if (unit === 'cm') {
          computedRows = Math.max(1, Math.round(computedHeight * 4));
        } else if (unit === 'inch') {
          computedRows = Math.max(1, Math.round(computedHeight * 10));
        }
      }
      setRows(computedRows);
    }
  };

  const handleHeightChange = (valStr: string) => {
    setHeightInput(valStr);
    setSelectedPreset('custom');
    const val = parseFloat(valStr);
    if (isNaN(val) || val <= 0) return;

    let computedRows = rows;
    if (unit === 'grid') {
      computedRows = Math.max(1, Math.round(val));
    } else if (unit === 'cm') {
      computedRows = Math.max(1, Math.round(val * 4));
    } else if (unit === 'inch') {
      computedRows = Math.max(1, Math.round(val * 10));
    }
    setRows(computedRows);

    // Auto-adjust width if image is loaded to maintain aspect ratio
    if (image) {
      const ar = image.naturalWidth / image.naturalHeight;
      const computedWidth = val * ar;
      let computedCols = cols;
      if (unit === 'grid') {
        computedCols = Math.max(1, Math.round(computedWidth));
        setWidthInput(Math.max(1, Math.round(computedWidth)).toString());
      } else {
        setWidthInput(computedWidth.toFixed(1));
        if (unit === 'cm') {
          computedCols = Math.max(1, Math.round(computedWidth * 4));
        } else if (unit === 'inch') {
          computedCols = Math.max(1, Math.round(computedWidth * 10));
        }
      }
      setCols(computedCols);
    }
  };

  const handlePresetChange = (e: Event) => {
    const val = (e.target as HTMLSelectElement).value;
    setSelectedPreset(val);
    if (val === 'custom') return;

    const preset = STANDARD_SIZES.find(s => s.value === val);
    if (preset && preset.width && preset.height && preset.unit) {
      setUnit(preset.unit as any);
      setWidthInput(preset.width.toString());
      setHeightInput(preset.height.toString());
      if (preset.unit === 'cm') {
        setCols(Math.max(1, Math.round(preset.width * 4)));
        setRows(Math.max(1, Math.round(preset.height * 4)));
      } else if (preset.unit === 'inch') {
        setCols(Math.max(1, Math.round(preset.width * 10)));
        setRows(Math.max(1, Math.round(preset.height * 10)));
      }
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
        },
        cols
      );
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }, [image, cols, rows, selectedBaseKit, excludedColors]);

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
      const dataUrlStr = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // Reset exclusions when loading a new image
        setExcludedColors(new Set());
        setHighlightedColor(null);
        setSelectedPreset('custom');

        // Adjust dimensions to match aspect ratio
        const ar = img.naturalWidth / img.naturalHeight;
        let newRows = rows;
        if (unit === 'grid') {
          newRows = Math.max(1, Math.round(cols / ar));
          setHeightInput(newRows.toString());
        } else if (unit === 'cm') {
          const currentWidthCm = cols / 4;
          const newHeightCm = currentWidthCm / ar;
          newRows = Math.max(1, Math.round(newHeightCm * 4));
          setHeightInput(newHeightCm.toFixed(1));
        } else if (unit === 'inch') {
          const currentWidthInch = cols / 10;
          const newHeightInch = currentWidthInch / ar;
          newRows = Math.max(1, Math.round(newHeightInch * 10));
          setHeightInput(newHeightInch.toFixed(1));
        }
        setRows(newRows);
        setImage(img);

        // Add to recent images history (limit to 5)
        setRecentImages(prev => {
          const newEntry = {
            id: Math.random().toString(36).substring(2, 9),
            name: file.name || 'Uploaded Image',
            dataUrl: dataUrlStr,
            width: img.naturalWidth,
            height: img.naturalHeight
          };
          const filtered = prev.filter(x => x.dataUrl !== dataUrlStr);
          return [newEntry, ...filtered].slice(0, 5);
        });
      };
      img.src = dataUrlStr;
    };
    reader.readAsDataURL(file);
  };

  const loadRecentImage = (entry: { name: string; dataUrl: string; width: number; height: number }) => {
    const img = new Image();
    img.onload = () => {
      setExcludedColors(new Set());
      setHighlightedColor(null);
      setSelectedPreset('custom');

      const ar = img.naturalWidth / img.naturalHeight;
      let newRows = rows;
      if (unit === 'grid') {
        newRows = Math.max(1, Math.round(cols / ar));
        setHeightInput(newRows.toString());
      } else if (unit === 'cm') {
        const currentWidthCm = cols / 4;
        const newHeightCm = currentWidthCm / ar;
        newRows = Math.max(1, Math.round(newHeightCm * 4));
        setHeightInput(newHeightCm.toFixed(1));
      } else if (unit === 'inch') {
        const currentWidthInch = cols / 10;
        const newHeightInch = currentWidthInch / ar;
        newRows = Math.max(1, Math.round(newHeightInch * 10));
        setHeightInput(newHeightInch.toFixed(1));
      }
      setRows(newRows);
      setImage(img);
    };
    img.src = entry.dataUrl;
  };

  const deleteRecentImage = (id: string, e: Event) => {
    e.stopPropagation();
    setRecentImages(prev => prev.filter(x => x.id !== id));
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
      <aside
        className={`bg-slate-900/60 backdrop-blur-md border-r border-slate-800/80 flex flex-col gap-4 overflow-y-auto no-print transition-all duration-300 relative shrink-0 ${
          leftPanelCollapsed ? 'w-0 border-r-0 p-0 overflow-hidden' : 'w-80 p-4'
        }`}
      >
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <img src={logoUrl} alt="GemPixel Logo" className="w-8 h-8 rounded border border-slate-700 shadow shadow-indigo-500/20 object-cover" />
            <div>
              <h1 className="text-lg font-bold text-indigo-400 tracking-wide leading-none">GemPixel</h1>
              <p className="text-[9px] text-slate-400 mt-1">Diamond Painting Planner</p>
            </div>
          </div>
          <button
            onClick={() => setLeftPanelCollapsed(true)}
            className="p-1.5 rounded bg-slate-950/50 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer border border-slate-850/80 hover:scale-105 active:scale-95 flex items-center justify-center"
            title="Collapse Sidebar"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* File Upload / Dropzone */}
        <div className="flex flex-col gap-1.5">
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
            <input
              id="file-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* Recent Uploads */}
        {recentImages.length > 0 && (
          <div className="flex flex-col gap-1.5 border border-slate-850 p-2 rounded bg-slate-950/30 shrink-0 no-print">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Recent Uploads</span>
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
          </div>
        )}

        {/* Reference Image Thumbnail */}
        {image && (
          <div className="flex flex-col gap-1.5 border border-slate-850 p-2 rounded bg-slate-950/30 shrink-0">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Reference Image</span>
            <img
              src={image.src}
              alt="Reference Preview"
              className="w-full max-h-24 object-contain rounded border border-slate-800 bg-slate-950/50"
            />
          </div>
        )}

        {/* Base Kit Selector */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">DMC Kit Reference</label>
          <select
            value={selectedBaseKit}
            onChange={(e) => {
              setSelectedBaseKit((e.target as HTMLSelectElement).value as any);
              setExcludedColors(new Set()); // Reset exclusions on kit change
            }}
            className="bg-slate-950/80 border border-slate-850 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-200 cursor-pointer"
          >
            <option value="all">All DMC Palette</option>
            <option value="100">Art Dot 100 Kit</option>
            <option value="200">Art Dot 200 Kit</option>
          </select>
        </div>

        {/* Canvas Preset Size */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Canvas Preset Size</label>
          <select
            value={selectedPreset}
            onChange={handlePresetChange}
            className="bg-slate-950/80 border border-slate-850 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-200 cursor-pointer"
          >
            {STANDARD_SIZES.map(sz => (
              <option key={sz.value} value={sz.value}>{sz.name}</option>
            ))}
          </select>
        </div>

        {/* Sizing Units & Inputs */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sizing Mode</label>
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
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Drill Representation</label>
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

        {/* Action Button */}
        {matchResult && (
          <button
            onClick={printReport}
            className="mt-auto bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white py-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-950/20 active:scale-[0.98] transition-all cursor-pointer border border-indigo-500/20"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>Export / Print PDF</span>
          </button>
        )}
      </aside>

      {/* Main Canvas Area */}
      <main className="flex-1 relative flex flex-col min-w-0 print:block">
        {/* Floating Center Mode Selector */}
        {image && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 border border-slate-700/50 rounded-lg p-0.5 shadow-xl backdrop-blur-md flex gap-1 no-print">
            {(['grid', 'reference'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewportMode(mode)}
                className={`text-[10px] px-3 py-1 rounded font-semibold transition-all cursor-pointer capitalize ${
                  viewportMode === mode
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode === 'grid' ? 'Grid View' : 'Original Photo'}
              </button>
            ))}
          </div>
        )}

        {leftPanelCollapsed && (
          <button
            onClick={() => setLeftPanelCollapsed(false)}
            className="absolute top-4 left-4 z-50 p-2 bg-slate-900/90 hover:bg-slate-800 text-indigo-400 hover:text-white rounded-lg shadow-xl border border-slate-700/50 transition-all duration-200 cursor-pointer flex items-center justify-center hover:scale-105 active:scale-95"
            title="Expand Sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        {rightPanelCollapsed && (
          <button
            onClick={() => setRightPanelCollapsed(false)}
            className="absolute top-4 right-4 z-50 p-2 bg-slate-900/90 hover:bg-slate-800 text-indigo-400 hover:text-white rounded-lg shadow-xl border border-slate-700/50 transition-all duration-200 cursor-pointer flex items-center justify-center hover:scale-105 active:scale-95"
            title="Expand Workspace"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M11 19l-7-7 7-7M17 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-slate-950 print:bg-white print:h-auto print:overflow-visible print:p-4">
          {image ? (
            viewportMode === 'grid' ? (
              <canvas
                ref={canvasRef}
                width={800}
                height={600}
                className="shadow-2xl border border-slate-800 bg-slate-900 print:border-none print:shadow-none"
              />
            ) : (
              <div className="relative max-w-full max-h-[85vh] p-4 flex flex-col items-center gap-2 no-print">
                <img
                  src={image.src}
                  alt="Original reference full size"
                  className="max-w-full max-h-[75vh] object-contain rounded-lg border border-slate-800 shadow-2xl"
                />
                <span className="text-[10px] text-slate-500 font-medium tracking-wide">Viewing original image at full resolution ({image.naturalWidth} x {image.naturalHeight})</span>
              </div>
            )
          ) : (
            <div className="text-center p-6 max-w-sm flex flex-col items-center gap-2">
              <span className="text-lg font-bold text-slate-350">No Image Loaded</span>
              <p className="text-xs text-slate-400">Load a photo using the sidebar panel to see your diamond painting canvas layout preview.</p>
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
      <aside
        className={`bg-slate-900/60 backdrop-blur-md border-l border-slate-800/80 flex flex-col overflow-hidden print:w-full print:border-l-0 print:bg-white print:text-black print:overflow-visible print:h-auto shrink-0 transition-all duration-300 relative ${
          rightPanelCollapsed ? 'w-0 border-l-0 p-0' : 'w-96'
        }`}
      >
        {/* Workspace Panel Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-2.5 px-4 pt-3.5 no-print shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Workspace Panel</span>
          <button
            onClick={() => setRightPanelCollapsed(true)}
            className="p-1 rounded bg-slate-950/50 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer border border-slate-850/80 hover:scale-105 active:scale-95 flex items-center justify-center"
            title="Collapse Workspace"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        
        {/* Collapsible Sub-palette selection checklist */}
        <div className="border-b border-slate-800/80 no-print flex flex-col shrink-0 transition-all">
          <button
            onClick={() => setExcludeListOpen(!excludeListOpen)}
            className="w-full flex justify-between items-center py-3 px-4 hover:bg-slate-850/50 text-left font-bold text-sm text-slate-200 transition-colors select-none cursor-pointer focus:outline-none"
          >
            <div className="flex items-center gap-2">
              <span className={`text-[9px] text-slate-500 transition-transform duration-200 ${excludeListOpen ? 'rotate-90' : ''}`}>▶</span>
              <span>Exclude Colors</span>
              {excludedColors.size > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-semibold">{excludedColors.size}</span>
              )}
            </div>
            {excludeListOpen && (
              <div className="flex gap-2 no-print" onClick={(e) => e.stopPropagation()}>
                <button onClick={handleSelectAll} className="text-[10px] text-indigo-400 hover:text-indigo-300 cursor-pointer">
                  Select All
                </button>
                <span className="text-slate-700 text-[10px] select-none">|</span>
                <button onClick={handleDeselectAll} className="text-[10px] text-indigo-400 hover:text-indigo-300 cursor-pointer">
                  Deselect All
                </button>
              </div>
            )}
          </button>
          
          {excludeListOpen && (
            <div className="px-4 pb-4 flex flex-col gap-2 transition-all">
              <p className="text-[10px] text-slate-400">Uncheck colors to exclude them from calculations.</p>
              <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto border border-slate-850 p-1.5 rounded bg-slate-950/60 shadow-inner">
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
                        className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 h-3 w-3 cursor-pointer"
                      />
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-slate-850 shrink-0"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span className="font-mono text-slate-350 text-[11px] truncate" title={c.name}>{c.dmc}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Legend table */}
        <div className="p-4 flex-1 flex flex-col overflow-hidden print:p-0 print:overflow-visible">
          <button
            onClick={() => setSupplyListOpen(!supplyListOpen)}
            className="w-full flex justify-between items-center py-2.5 hover:bg-slate-850/30 text-left font-bold text-sm text-slate-200 transition-colors select-none cursor-pointer focus:outline-none no-print mb-2 border border-slate-850/50 p-2 rounded bg-slate-950/20 shrink-0"
          >
            <div className="flex items-center gap-2">
              <span className={`text-[9px] text-slate-500 transition-transform duration-200 ${supplyListOpen ? 'rotate-90' : ''}`}>▶</span>
              <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">DMC Supply List</span>
              {sortedMatches.length > 0 && !supplyListOpen && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-semibold">{sortedMatches.length} colors</span>
              )}
            </div>
            {highlightedColor && supplyListOpen && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRowClick(highlightedColor);
                }}
                className="text-[10px] text-red-400 hover:text-red-300 font-semibold cursor-pointer border border-red-500/20 px-2 py-0.5 rounded bg-red-500/5 hover:bg-red-500/10 transition-colors"
              >
                Clear Highlight
              </button>
            )}
          </button>

          <h2 className="hidden print:block text-2xl font-bold mb-4 font-sans">GemPixel Supply Plan Report</h2>

          {/* Table Container */}
          {supplyListOpen && (
            <div className="flex-1 overflow-y-auto border border-slate-850 rounded bg-slate-950/30 print:border-none print:bg-white print:overflow-visible no-print shadow-inner">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400 select-none text-[10px] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-1.5 px-2 w-8 text-center">Color</th>
                    <th className="py-1.5 px-2 w-12 text-center">DMC</th>
                    <th className="py-1.5 px-2 truncate max-w-[100px]">Name</th>
                    <th className="py-1.5 px-2 text-right">Exact</th>
                    <th className="py-1.5 px-2 text-right">Safety</th>
                    <th className="py-1.5 px-2 text-right">Bags</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMatches.map(row => {
                    const isHighlighted = highlightedColor === row.code;
                    return (
                      <tr
                        key={row.code}
                        onClick={() => handleRowClick(row.code)}
                        className={`border-b border-slate-800/40 hover:bg-slate-850/30 cursor-pointer select-none transition-all duration-150 ${
                          isHighlighted ? 'bg-indigo-950/40 hover:bg-indigo-950/50 border-l border-l-indigo-500 text-indigo-200' : 'text-slate-350'
                        }`}
                      >
                        <td className="py-1 px-2 flex justify-center">
                          <span
                            className="block w-3 h-3 rounded-full border border-slate-850 shadow-sm"
                            style={{ backgroundColor: row.hex }}
                          />
                        </td>
                        <td className="py-1 px-2 font-mono font-bold text-center text-slate-200">{row.code}</td>
                        <td className="py-1 px-2 text-slate-400 truncate max-w-[100px] text-[11px]" title={row.name}>
                          {row.name}
                        </td>
                        <td className="py-1 px-2 text-right text-slate-400 font-mono">{row.count}</td>
                        <td className="py-1 px-2 text-right font-medium text-indigo-300 font-mono">{row.safety}</td>
                        <td className="py-1 px-2 text-right font-bold text-slate-300 font-mono">
                          {row.packets} <span className="text-[9px] text-slate-500 font-normal font-sans">({row.packets * 200})</span>
                        </td>
                      </tr>
                    );
                  })}
                  {sortedMatches.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-slate-500 text-xs">
                        No matching colors. Load an image to compute.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Printable Layout Table (displayed only during printing) */}
          <div className="hidden print:block">
            {image && (
              <div className="mb-6 text-center page-break-inside-avoid">
                <h3 className="text-base font-bold mb-2">Original Reference Image</h3>
                <img
                  src={image.src}
                  alt="Original Reference"
                  className="max-h-48 object-contain mx-auto rounded border border-gray-300"
                />
              </div>
            )}
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
