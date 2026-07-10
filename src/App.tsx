import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { CanvasViewer } from './engine/viewer';
import { DMC_PALETTE } from './engine/palette';
import { compileShopifyCartLink, calculateCanvasCost, VENDOR_REGISTRY } from './engine/checkout';
import { drawCanvasOnly, drawCombinedCanvasSheet, triggerCanvasDownload, FRAMER_MARGIN_CELLS } from './engine/export';
import { planColorSupply, defaultPacketCost } from './engine/bagPlanner';
import { resolveActiveCandidates } from './engine/candidates';
import { projectStore, generateUUID, generateThumbnail, type ProjectSummary, type ProjectData, type RecentImage } from './engine/projectStore';
import { useDiamondArtMatch } from './features/match/useDiamondArtMatch';


export const STANDARD_SIZES = [
  { name: 'Custom size', value: 'custom' },
  // Standard Sizes (12x16, 16x20, 20x28, 40x60 in)
  { name: 'Canvas 12 x 16 in (30 x 40 cm)', value: '30x40-cm', width: 30, height: 40, unit: 'cm' },
  { name: 'Canvas 16 x 12 in (40 x 30 cm)', value: '40x30-cm', width: 40, height: 30, unit: 'cm' },
  { name: 'Canvas 16 x 20 in (40 x 50 cm)', value: '40x50-cm', width: 40, height: 50, unit: 'cm' },
  { name: 'Canvas 20 x 16 in (50 x 40 cm)', value: '50x40-cm', width: 50, height: 40, unit: 'cm' },
  { name: 'Canvas 20 x 28 in (50 x 70 cm)', value: '50x70-cm', width: 50, height: 70, unit: 'cm' },
  { name: 'Canvas 28 x 20 in (70 x 50 cm)', value: '70x50-cm', width: 70, height: 50, unit: 'cm' },
  { name: 'Canvas 40 x 60 in (100 x 150 cm)', value: '100x150-cm', width: 100, height: 150, unit: 'cm' },
  { name: 'Canvas 60 x 40 in (150 x 100 cm)', value: '150x100-cm', width: 150, height: 100, unit: 'cm' },
  
  // Custom grids
  { name: '40 x 30 grid', value: '40x30-grid', width: 40, height: 30, unit: 'grid' },
  { name: '80 x 53 grid', value: '80x53-grid', width: 80, height: 53, unit: 'grid' },
  { name: '100 x 75 grid', value: '100x75-grid', width: 100, height: 75, unit: 'grid' },
  { name: '120 x 80 grid', value: '120x80-grid', width: 120, height: 80, unit: 'grid' }
];


export function calculateSafetyPurchase(exactCount: number, bagSize: number = 200): { safety: number; packets: number; purchase: number } {
  const safety = Math.ceil(Math.round(exactCount * 110) / 100);
  const packets = Math.ceil(safety / bagSize);
  const purchase = packets * bagSize;
  return { safety, packets, purchase };
}

export function hexToHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  if (max !== min) {
    const d = max - min;
    if (max === r) {
      h = (g - b) / d + (g < b ? 6 : 0);
    } else if (max === g) {
      h = (b - r) / d + 2;
    } else if (max === b) {
      h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return h * 360;
}

export function App() {
  const isTestEnv = typeof window !== 'undefined' && navigator.userAgent.includes('jsdom');
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [cols, setCols] = useState(80);
  const [rows, setRows] = useState(53);

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>('');
  const [projectsRegistry, setProjectsRegistry] = useState<ProjectSummary[]>(() => projectStore.list());
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveProjectName, setSaveProjectName] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [imagesDrawerOpen, setImagesDrawerOpen] = useState(false);

  const [unit, setUnit] = useState<'cm' | 'inch' | 'grid'>('grid');
  const [widthInput, setWidthInput] = useState<string>('80');
  const [heightInput, setHeightInput] = useState<string>('53');
  const [selectedPreset, setSelectedPreset] = useState<string>('custom');
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [excludeListOpen, setExcludeListOpen] = useState(false);
  const [recsOpen, setRecsOpen] = useState(true);
  const [supplyListOpen, setSupplyListOpen] = useState(true);
  const [viewportMode, setViewportMode] = useState<'grid' | 'symbols' | 'reference'>('grid');
  const [zoomScale, setZoomScale] = useState(1.0);

  // Theme skin: "dark" (Pixel Lab) / "light" (Atelier). Persisted + applied to <html>.
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return (localStorage.getItem('gempixel_theme') as 'dark' | 'light') || 'light';
    } catch {
      return 'light';
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('gempixel_theme', theme);
    } catch {
      /* ignore persistence failures */
    }
  }, [theme]);
  const [sortBy, setSortBy] = useState<'color' | 'code' | 'name' | 'quantity'>('quantity');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [recentImages, setRecentImages] = useState<RecentImage[]>(() => projectStore.recents.list());

  const [recentUploadsOpen, setRecentUploadsOpen] = useState(true);

  const [wizardStep, setWizardStep] = useState<number>(1);
  const [imageFitMode, setImageFitMode] = useState<'cover' | 'contain'>('cover');
  const [drillStyle, setDrillStyle] = useState<'square' | 'round'>('square');
  const [selectedBaseKit, setSelectedBaseKit] = useState<'all' | '100' | '200'>('all');
  const [drillType, setDrillType] = useState<'standard' | 'ab' | 'glow' | 'crystal'>('standard');
  const [excludedColors, setExcludedColors] = useState<Set<string>>(new Set());
  const [highlightedColor, setHighlightedColor] = useState<string | null>(null);
  const [resourcesModalOpen, setResourcesModalOpen] = useState(false);
  
  // Match pipeline (worker lifecycle + derivations) lives in useDiamondArtMatch;
  // its { matchResult, symbolMap, loading, progress, restore } are wired in below.
  const [enableSubstitution, setEnableSubstitution] = useState<boolean>(() => {
    return localStorage.getItem('gempixel_enable_substitution') === 'true';
  });
  const [substitutionThreshold, setSubstitutionThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('gempixel_substitution_threshold');
    return saved ? parseInt(saved, 10) : 20;
  });
  const [unmappedLog, setUnmappedLog] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('gempixel_unmapped_colors_log') || '[]');
    } catch {
      return [];
    }
  });


  useEffect(() => {
    localStorage.setItem('gempixel_enable_substitution', enableSubstitution.toString());
  }, [enableSubstitution]);

  useEffect(() => {
    localStorage.setItem('gempixel_substitution_threshold', substitutionThreshold.toString());
  }, [substitutionThreshold]);
  const [selectedVendor, setSelectedVendor] = useState<'lumaprints' | 'prodigi' | 'finerworks'>('lumaprints');
  const [canvasBaseCost, setCanvasBaseCost] = useState(15.0);
  const [canvasShippingEstimate, setCanvasShippingEstimate] = useState(8.0);
  const [drillPacketCost, setDrillPacketCost] = useState(0.25);
  const [drillBagSize, setDrillBagSize] = useState<number>(200);
  const [optimizeBagsCost, setOptimizeBagsCost] = useState(true);
  const [priceDb, setPriceDb] = useState<Record<200 | 500 | 1000 | 2000, number>>({
    200: 0.60,
    500: 1.10,
    1000: 1.80,
    2000: 3.20
  });

  const updatePriceDb = (qty: 200 | 500 | 1000 | 2000, val: number) => {
    setPriceDb(prev => ({ ...prev, [qty]: val }));
  };

  const [affiliateTag, setAffiliateTag] = useState<string>(() => {
    return localStorage.getItem('gempixel_affiliate_tag') || '';
  });
  const [affiliateApp, setAffiliateApp] = useState<'ref' | 'rfsn' | 'none'>(() => {
    return (localStorage.getItem('gempixel_affiliate_app') as any) || 'ref';
  });
  const [canvasTemplate, setCanvasTemplate] = useState<string>(() => {
    const saved = localStorage.getItem('gempixel_canvas_template');
    if (saved && saved.includes('heartfuldiamonds')) {
      return 'https://adiamondpainting.com/products/personalised-photo-custom-diamond-painting?size={size}&shape={shape}';
    }
    return saved || 'https://adiamondpainting.com/products/personalised-photo-custom-diamond-painting?size={size}&shape={shape}';
  });

  useEffect(() => {
    localStorage.setItem('gempixel_affiliate_tag', affiliateTag);
  }, [affiliateTag]);

  useEffect(() => {
    localStorage.setItem('gempixel_affiliate_app', affiliateApp);
  }, [affiliateApp]);

  useEffect(() => {
    localStorage.setItem('gempixel_canvas_template', canvasTemplate);
  }, [canvasTemplate]);

  useEffect(() => {
    if (!image && !activeProjectId) return;

    const w = parseFloat(widthInput);
    const h = parseFloat(heightInput);
    if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
      const cost = calculateCanvasCost(w, h, unit, selectedVendor);
      setCanvasBaseCost(cost);
      const config = VENDOR_REGISTRY[selectedVendor];
      if (config) {
        setCanvasShippingEstimate(config.baseShipping);
      }
    }
  }, [widthInput, heightInput, unit, selectedVendor, image, activeProjectId]);

  const sizingAdviceData = useMemo(() => {
    // Physical size is derived from the grid itself (10 dots per inch => 2.54 cm),
    // so the advice is always in inches + cm regardless of the sizing mode.
    const wIn = cols / 10;
    const hIn = rows / 10;
    const toCm = (inches: number) => inches * 2.54;
    const fmt = (n: number) => (Math.round(n * 10) / 10).toString();
    const wrapIn = 1; // legend/wrap buffer for the combined sheet, each side
    const framerIn = FRAMER_MARGIN_CELLS / 10; // framer wrap baked into the Canvas Grid PNG, each side

    return {
      gridIn: `${fmt(wIn)}″ × ${fmt(hIn)}″`,
      gridCm: `${fmt(toCm(wIn))} × ${fmt(toCm(hIn))} cm`,
      combinedIn: `${fmt(wIn + wrapIn * 2)}″ × ${fmt(hIn + wrapIn * 2)}″`,
      combinedCm: `${fmt(toCm(wIn + wrapIn * 2))} × ${fmt(toCm(hIn + wrapIn * 2))} cm`,
      canvasOnlyIn: `${fmt(wIn + framerIn * 2)}″ × ${fmt(hIn + framerIn * 2)}″`,
      canvasOnlyCm: `${fmt(toCm(wIn + framerIn * 2))} × ${fmt(toCm(hIn + framerIn * 2))} cm`,
      framer: `${fmt(framerIn)}″ (${fmt(toCm(framerIn))} cm)`,
      wrap: `${wrapIn}″ (${fmt(toCm(wrapIn))} cm)`,
    };
  }, [cols, rows]);

  const isStepValid = (step: number) => {
    if (step === 1) return true;
    if (step === 2) return !!(image || activeProjectId);
    if (step === 3 || step === 4) return !!matchResult;
    return false;
  };

  const loadProject = (id: string) => {
    const project = projectStore.load(id);
    if (!project) return;

    setActiveProjectId(project.id);
    setImage(null);
    setImageName(project.imageName || '');
    setSaveProjectName(project.name || '');
    setCols(project.dimensions.cols);
    setRows(project.dimensions.rows);
    setDrillStyle(project.drillStyle);
    setSelectedBaseKit(project.selectedBaseKit || 'all');
    setDrillType(project.drillType || 'standard');
    setExcludedColors(new Set(project.excludedDmcCodes || []));
    setHighlightedColor(null);
    setCanvasBaseCost(project.kitBaseCost ?? 15.0);
    setDrillPacketCost(project.drillPacketCost ?? 0.25);
    setCanvasTemplate(project.canvasTemplate || '');
    setAffiliateTag(project.affiliateTag || '');
    setAffiliateApp(project.affiliateApp || 'ref');
    setUnit('grid');
    setWidthInput(project.dimensions.cols.toString());
    setHeightInput(project.dimensions.rows.toString());
    setSelectedPreset('custom');
    
    if (project.pricesPerBagSize) {
      setPriceDb(project.pricesPerBagSize);
    }

    if (project.gridData) {
      const restoredMatches = project.gridData.map(idx => DMC_PALETTE[idx]?.dmc || '310');
      const counts: Record<string, number> = {};
      restoredMatches.forEach(code => {
        counts[code] = (counts[code] || 0) + 1;
      });
      restore({
        matches: restoredMatches,
        counts
      });
    } else {
      restore(null);
    }
  };

  const resetWorkspace = () => {
    setActiveProjectId(null);
    setImage(null);
    setImageName('');
    setCols(80);
    setRows(53);
    setUnit('grid');
    setWidthInput('80');
    setHeightInput('53');
    setSelectedPreset('custom');
    setDrillStyle('square');
    setSelectedBaseKit('all');
    setDrillType('standard');
    setExcludedColors(new Set());
    setHighlightedColor(null);
    setCanvasBaseCost(15.0);
    setCanvasShippingEstimate(8.0);
    setDrillPacketCost(0.25);
    setDrillBagSize(200);
    setOptimizeBagsCost(true);
    setPriceDb({
      200: 0.60,
      500: 1.10,
      1000: 1.80,
      2000: 3.20
    });
    restore(null);
    setWizardStep(1);
  };

  const handleSaveProject = (name: string, forceNewId = false) => {
    if (!name.trim()) return;

    const projectId = (forceNewId ? '' : activeProjectId) || generateUUID();
    const nowStr = new Date().toISOString();
    
    let thumbnailDataUrl = '';
    if (canvasRef.current) {
      thumbnailDataUrl = generateThumbnail(canvasRef.current);
    }

    const gridData = matchResult
      ? matchResult.matches.map(code => DMC_PALETTE.findIndex(c => c.dmc === code))
      : null;

    const projectSummary: ProjectSummary = {
      id: projectId,
      name,
      thumbnail: thumbnailDataUrl,
      dateModified: nowStr,
      dateCreated: activeProjectId ? (projectsRegistry.find(p => p.id === activeProjectId)?.dateCreated || nowStr) : nowStr
    };

    const projectData: ProjectData = {
      id: projectId,
      name,
      dateCreated: projectSummary.dateCreated,
      dateModified: nowStr,
      imageName: imageName || (image ? 'Uploaded Image' : 'Imported Project'),
      dimensions: { cols, rows },
      drillStyle,
      selectedBaseKit,
      safetyMargin: 10,
      laborMarkup: 0,
      kitBaseCost: canvasBaseCost,
      drillPacketCost,
      excludedDmcCodes: Array.from(excludedColors),
      pricesPerBagSize: priceDb,
      drillType,
      canvasTemplate,
      affiliateTag,
      affiliateApp,
      gridData
    };

    projectStore.save(projectSummary, projectData);
    setProjectsRegistry(projectStore.list());

    setActiveProjectId(projectId);
    setSaveModalOpen(false);
  };

  const showSaveSuccess = () => {
    setSaveSuccessMsg('Saved successfully!');
    setTimeout(() => {
      setSaveSuccessMsg('');
    }, 3000);
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<CanvasViewer | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const lastFitImageRef = useRef<HTMLImageElement | null>(null);

  // Determine base catalog candidate list
  const baseCandidates = selectedBaseKit === 'all'
    ? DMC_PALETTE
    : DMC_PALETTE.filter(c => c.kits.includes(selectedBaseKit));

  // NOTE: resolveActiveCandidates is a pure resolver (see engine/candidates.ts). It is
  // intentionally called inline rather than wrapped in useMemo: memoizing it stabilizes
  // the reference and shifts Preact's render/effect scheduling, which exposes a latent
  // cross-test race in the [cols,rows,unit] dimension-sync effect below (that effect reads
  // document.activeElement and clobbers width/height inputs). The extraction delivers the
  // naming/depth/testability goal; the per-render-allocation memo is deferred until that
  // dimension-sync effect's double-source-of-truth fragility is addressed separately.
  const activeCandidates = resolveActiveCandidates(selectedBaseKit, excludedColors);

  const { matchResult, symbolMap, loading, progress, restore } = useDiamondArtMatch({
    image,
    cols,
    rows,
    activeCandidates,
    enableSubstitution,
    substitutionThreshold,
  });

  const { leftLegendColors, rightLegendColors } = useMemo(() => {
    const mid = Math.ceil(activeCandidates.length / 2);
    return {
      leftLegendColors: activeCandidates.slice(0, mid),
      rightLegendColors: activeCandidates.slice(mid)
    };
  }, [activeCandidates]);

  // Persist recent image list to localStorage (quota eviction handled in projectStore).
  useEffect(() => {
    projectStore.recents.save(recentImages);
  }, [recentImages]);

  // Tear down the canvas viewer on unmount (worker teardown lives in useDiamondArtMatch).
  useEffect(() => {
    return () => {
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, []);

  const lastFitProjectRef = useRef<string | null>(null);

  // Initialize CanvasViewer when canvas is rendered (depends on image OR matchResult)
  useEffect(() => {
    if (canvasRef.current && (image || matchResult)) {
      if (!viewerRef.current) {
        viewerRef.current = new CanvasViewer(canvasRef.current);
        viewerRef.current.onZoomChange = (scale) => {
          setZoomScale(scale);
        };
      }
    } else {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
        setZoomScale(1.0);
      }
    }
  }, [image, matchResult]);

  // Synchronize viewer data when canvas, matches, or styles change
  useEffect(() => {
    if (viewerRef.current && matchResult && activeCandidates.length > 0) {
      const colorMap = new Map<string, string>();
      activeCandidates.forEach(c => colorMap.set(c.dmc, c.hex));
      viewerRef.current.setData(cols, rows, matchResult.matches, colorMap);
      viewerRef.current.setDrillStyle(drillStyle);
      viewerRef.current.setHighlightedColor(highlightedColor);
      viewerRef.current.setDrillType(drillType);
      viewerRef.current.setViewMode(viewportMode);
      viewerRef.current.setSymbolMap(symbolMap);

      // Automatically fit to container by default on first load of a new image or when switching projects
      if (lastFitImageRef.current !== image || (activeProjectId && lastFitProjectRef.current !== activeProjectId)) {
        viewerRef.current.fitToContainer();
        lastFitImageRef.current = image;
        lastFitProjectRef.current = activeProjectId;
      }
    }
  }, [image, matchResult, activeCandidates, drillStyle, highlightedColor, cols, rows, drillType, activeProjectId, viewportMode, symbolMap]);

  // Push theme colors into the canvas viewer (canvas can't read CSS vars itself).
  useEffect(() => {
    if (!viewerRef.current) return;
    const styles = getComputedStyle(document.documentElement);
    viewerRef.current.setRoundBacking(styles.getPropertyValue('--drill-round-backing').trim());
    viewerRef.current.setGridGap(styles.getPropertyValue('--canvas-gap').trim());
  }, [theme, image, matchResult, drillStyle]);

  const savedViewportModeRef = useRef<'grid' | 'symbols' | 'reference'>('grid');

  // Print hooks to force symbol rendering and fit to container
  useEffect(() => {
    const handleBeforePrint = () => {
      savedViewportModeRef.current = viewportMode;
      setViewportMode('symbols');
      if (viewerRef.current) {
        viewerRef.current.setViewMode('symbols');
        viewerRef.current.fitToContainer();
      }
    };

    const handleAfterPrint = () => {
      setViewportMode(savedViewportModeRef.current);
      if (viewerRef.current) {
        viewerRef.current.setViewMode(savedViewportModeRef.current);
        viewerRef.current.draw();
      }
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [viewportMode]);

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

  // Synchronize drillPacketCost defaults and priceDb presets when drillType changes
  useEffect(() => {
    setDrillPacketCost(defaultPacketCost(drillType, drillBagSize));
    if (drillType === 'standard') {
      setPriceDb({ 200: 0.60, 500: 1.10, 1000: 1.80, 2000: 3.20 });
    } else if (drillType === 'ab') {
      setPriceDb({ 200: 0.70, 500: 1.30, 1000: 2.20, 2000: 3.90 });
    } else if (drillType === 'glow') {
      setPriceDb({ 200: 0.80, 500: 1.50, 1000: 2.60, 2000: 4.70 });
    } else if (drillType === 'crystal') {
      setPriceDb({ 200: 0.90, 500: 1.70, 1000: 3.00, 2000: 5.40 });
    }
  }, [drillType, drillBagSize]);

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
      } else if (preset.unit === 'grid') {
        setCols(preset.width);
        setRows(preset.height);
      }
    }
  };


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
        setActiveProjectId(null);
        setImageName(file.name || 'Uploaded Image');

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
      setActiveProjectId(null);
      setImageName(entry.name || 'Recent Image');

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

  const handleHeaderClick = (type: 'color' | 'code' | 'name' | 'quantity') => {
    if (sortBy === type) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(type);
      setSortAsc(type === 'name' || type === 'code' || type === 'color');
    }
  };

  const printReport = () => {
    window.print();
  };

  const handleDownloadCanvasOnly = async () => {
    if (!matchResult) return;
    try {
      const colorMap = new Map<string, string>();
      activeCandidates.forEach(c => colorMap.set(c.dmc, c.hex));
      
      const canvas = drawCanvasOnly({
        cols,
        rows,
        gridData: matchResult.matches,
        colorMap,
        symbolMap,
        cellScale: 20
      });
      
      const baseName = saveProjectName.trim() || 'gempixel-layout';
      await triggerCanvasDownload(canvas, `${baseName}-canvas.png`);
    } catch (err) {
      console.error('Failed to download canvas grid:', err);
    }
  };

  const handleDownloadCombinedCanvasSheet = async () => {
    if (!matchResult) return;
    try {
      const colorMap = new Map<string, string>();
      activeCandidates.forEach(c => colorMap.set(c.dmc, c.hex));
      
      const canvas = drawCombinedCanvasSheet({
        cols,
        rows,
        gridData: matchResult.matches,
        colorMap,
        symbolMap,
        leftLegendColors,
        rightLegendColors,
        cellScale: 20,
        marginWidth: 200
      });
      
      const baseName = saveProjectName.trim() || 'gempixel-layout';
      await triggerCanvasDownload(canvas, `${baseName}-grid-legend.png`);
    } catch (err) {
      console.error('Failed to download canvas grid + legend:', err);
    }
  };

  const printLegendSheetOnly = () => {
    document.body.classList.add('print-only-legend-mode');
    window.print();
    const cleanup = () => {
      document.body.classList.remove('print-only-legend-mode');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
  };

  // Calculate sorted legend table rows
  const sortedMatches = Object.entries(matchResult?.counts || {})
    .map(([code, count]) => {
      const colorInfo = DMC_PALETTE.find(c => c.dmc === code);
      const name = colorInfo?.name || 'Unknown DMC Color';
      const hex = colorInfo?.hex || '#2D3748';

      if (optimizeBagsCost) {
        // +10% safety drill count (unchanged column semantics).
        const safety = Math.ceil(Math.round(count * 110) / 100);

        // Pack exact + safety through the SAME per-color primitive the cart uses
        // (bagPlanner.packColor), so the legend estimate always matches the cart.
        const row = planColorSupply(code, drillStyle, count, priceDb);

        return {
          code,
          count,
          name,
          hex,
          safety, // +10% drill count (Safety Marg. column)
          packets: row.safety.packets, // total bag/packet count
          purchase: row.safety.totalDrills, // total drills purchased
          costExact: row.costExact,
          costSafety: row.costSafety,
          bagsText: row.bagsText,
          optimizedBags: row.safety.bySize
        };
      } else {
        const metrics = calculateSafetyPurchase(count, drillBagSize);
        const costExact = (count / drillBagSize) * drillPacketCost;
        const costSafety = metrics.packets * drillPacketCost;
        return {
          code,
          count,
          name,
          hex,
          ...metrics,
          costExact,
          costSafety,
          bagsText: `${metrics.packets} bag(s)`,
          optimizedBags: null
        };
      }
    })
    .sort((a, b) => {
      let diff = 0;
      if (sortBy === 'quantity') {
        diff = a.count - b.count;
      } else if (sortBy === 'name') {
        diff = a.name.localeCompare(b.name);
      } else if (sortBy === 'code') {
        const numA = parseInt(a.code, 10);
        const numB = parseInt(b.code, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          diff = numA - numB;
        } else {
          diff = a.code.localeCompare(b.code);
        }
      } else if (sortBy === 'color') {
        diff = hexToHue(a.hex) - hexToHue(b.hex);
      }
      return sortAsc ? diff : -diff;
    });

  // Calculator derivations
  const totalSafetyDrills = sortedMatches.reduce((acc, row) => acc + row.safety, 0);
  const totalPackets = sortedMatches.reduce((acc, row) => acc + row.packets, 0);

  const safetyDrillCost = sortedMatches.reduce((acc, row) => acc + row.costSafety, 0);

  const totalCostSafety = canvasBaseCost + canvasShippingEstimate + safetyDrillCost;

  const [checkoutWarning, setCheckoutWarning] = useState<{
    url: string;
    isUrlTooLong: boolean;
    unmappedItems: Array<{ dmcCode: string; handle: string }>;
  } | null>(null);

  const handleShopifyCheckout = () => {
    if (!matchResult) return;
    const items = Object.entries(matchResult.counts).map(([code, count]) => {
      const safety = Math.ceil(Math.round(count * 110) / 100);
      return {
        dmcCode: code,
        shape: drillStyle,
        requiredCount: safety
      };
    });

    const result = compileShopifyCartLink(items, affiliateTag, affiliateApp);
    
    if (result.unmappedItems.length > 0) {
      const savedLog = JSON.parse(localStorage.getItem('gempixel_unmapped_colors_log') || '[]');
      const newCodes = result.unmappedItems.map(item => item.dmcCode);
      const updatedLog = Array.from(new Set([...savedLog, ...newCodes]));
      localStorage.setItem('gempixel_unmapped_colors_log', JSON.stringify(updatedLog));
      setUnmappedLog(updatedLog);
    }
    
    if (result.isUrlTooLong || result.unmappedItems.length > 0) {
      setCheckoutWarning(result);
    } else {
      window.open(result.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden print:h-auto print:overflow-visible">
      {/* Left Sidebar Control Panel */}
      <aside
        className={`bg-slate-900/60 backdrop-blur-md border-r border-slate-800/80 flex flex-col gap-4 no-print transition-all duration-300 relative shrink-0 ${
          leftPanelCollapsed ? 'w-0 border-r-0 p-0 overflow-hidden' : 'w-80 p-4'
        }`}
      >
        <div className="flex justify-between items-center border-b border-slate-800/60 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="gem-logo w-[38px] h-[38px] shrink-0" aria-hidden="true">
              {['--gem-pink','--gem-cyan','--gem-violet','--gem-amber','--gem-pink','--gem-cyan','--gem-violet','--gem-amber','--gem-pink'].map((c, i) => (
                <span key={i} style={{ backgroundColor: `var(${c})` }} />
              ))}
            </div>
            <div>
              <h1 className="font-display text-[23px] font-bold text-ink leading-none">GemPixel</h1>
              <p className="text-[10px] text-muted mt-1 font-medium tracking-wide">Diamond Painting Planner</p>
            </div>
          </div>
          <button
            onClick={() => setLeftPanelCollapsed(true)}
            className="p-1.5 rounded-full hover:bg-slate-800/80 text-slate-400 hover:text-white transition-all cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center border border-transparent hover:border-slate-700/30"
            title="Collapse Sidebar"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-4 pr-1">
          {/* My Images saved-projects drawer */}
          <div className="border-b border-slate-800/40 pb-2 flex flex-col gap-2 shrink-0">
          <div className="flex justify-between items-center">
            <button
              onClick={() => setImagesDrawerOpen(!imagesDrawerOpen)}
              className="flex items-center gap-1.5 text-left font-bold text-slate-200 transition-colors select-none cursor-pointer focus:outline-none"
            >
              <span className={`text-[8px] text-slate-500 transition-transform duration-200 ${imagesDrawerOpen ? 'rotate-90' : ''}`}>▶</span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">My Images</span>
              <span className="text-[9px] text-slate-500 font-medium">({projectsRegistry.length})</span>
            </button>
            <button
              id="new-project-btn"
              onClick={resetWorkspace}
              className="text-[9px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer border border-indigo-500/20 px-1.5 py-0.5 rounded bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors"
              title="Reset workspace to start a new image"
            >
              New
            </button>
          </div>
          
          {imagesDrawerOpen && (
            <div className="flex flex-col gap-2 mt-1">
              <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto scrollbar-thin">
                {projectsRegistry.map(project => {
                  const isActive = activeProjectId === project.id;
                  return (
                    <div
                      key={project.id}
                      onClick={() => loadProject(project.id)}
                      className={`group relative flex items-center gap-2 p-1.5 rounded cursor-pointer transition-all border ${
                        isActive
                          ? 'bg-indigo-600/10 border-indigo-500/30'
                          : 'bg-slate-950/40 border-slate-850 hover:bg-slate-950/60 hover:border-slate-800'
                      }`}
                    >
                      {project.thumbnail ? (
                        <img
                          src={project.thumbnail}
                          alt={project.name}
                          className="w-8 h-8 rounded object-cover border border-slate-800/80 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-slate-800 border border-slate-700/80 shrink-0 flex items-center justify-center text-[9px] text-slate-500 font-bold">
                          GEM
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-slate-200 block truncate group-hover:text-white transition-colors">{project.name}</span>
                        <span className="text-[9px] text-slate-500 block truncate font-mono">{new Date(project.dateModified).toLocaleDateString()}</span>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete "${project.name}"?`)) {
                            projectStore.remove(project.id);
                            setProjectsRegistry(projectStore.list());
                            if (activeProjectId === project.id) {
                              setActiveProjectId(null);
                              restore(null);
                            }
                          }
                        }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-950/80 text-[11px] text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-slate-900 border border-slate-800 cursor-pointer"
                        title="Delete Image"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                {projectsRegistry.length === 0 && (
                  <span className="text-[10px] text-slate-500 text-center block py-2 italic">No images saved yet.</span>
                )}
              </div>
              <button
                id="save-project-btn"
                onClick={() => {
                  setSaveProjectName(activeProjectId ? (projectsRegistry.find(p => p.id === activeProjectId)?.name || '') : `Diamond Art ${projectsRegistry.length + 1}`);
                  setSaveModalOpen(true);
                }}
                disabled={!matchResult}
                className="w-full bg-slate-950/80 hover:bg-slate-850 disabled:bg-slate-950/20 disabled:text-slate-600 text-indigo-400 hover:text-indigo-300 disabled:border-slate-900 border border-slate-800 rounded py-1.5 text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                <span>Save to My Images</span>
              </button>
            </div>
          )}
        </div>

        {/* Wizard Step Contents */}
        {wizardStep === 1 && (
          <div className="flex flex-col gap-4">
            {/* File Ingestion */}
            <div className="flex flex-col gap-1.5 shrink-0">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Load Image</label>
              {image ? (
                <div className="flex items-center justify-between bg-slate-950/40 border border-slate-850 rounded-lg p-2 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded bg-slate-800 overflow-hidden shrink-0 border border-slate-800 flex items-center justify-center">
                      <img src={image.src} alt="Uploaded thumbnail" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-350 font-bold truncate leading-none">{imageName || 'Loaded Photo'}</div>
                      <div className="text-[8px] text-slate-500 mt-1 font-semibold">{image.naturalWidth} x {image.naturalHeight} px</div>
                    </div>
                  </div>
                  <button
                    onClick={() => document.getElementById('file-upload')?.click()}
                    className="text-[9px] text-indigo-400 hover:text-indigo-300 font-bold border border-indigo-500/20 px-2 py-0.5 rounded bg-indigo-500/5 hover:bg-indigo-500/10 transition-all cursor-pointer"
                  >
                    Replace
                  </button>
                  <input
                    id="file-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              ) : (
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
              )}
            </div>

            {/* Recent Uploads */}
            {recentImages.length > 0 && (
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
                    {STANDARD_SIZES.map(sz => (
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
                                <span className={`text-[10px] font-mono font-semibold ${sz.matchPct >= 95 ? 'text-emerald-400' : 'text-amber-400'}`}>
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
        )}

        {wizardStep === 2 && (
          <div className="flex flex-col gap-3.5">
            <details open className="text-[10px] text-slate-400 bg-slate-950/20 p-2 rounded border border-slate-850/40 cursor-pointer">
              <summary className="font-bold text-xs uppercase text-indigo-400 select-none flex items-center gap-2 cursor-pointer pb-2 border-b border-slate-850/30">
                <span className="caret-icon text-slate-500">▶</span>
                <span>Palette Optimization Settings</span>
              </summary>
              <div className="flex flex-col gap-3.5 mt-3 cursor-default" onClick={(e) => e.stopPropagation()}>
                {/* Base Kit Selector */}
                <div className="flex flex-col gap-1 shrink-0">
                  <div className="flex items-center gap-1.5 justify-between">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">DMC Kit Reference</label>
                    <div className="tooltip-group">
                      <span className="text-[10px] text-slate-500 hover:text-slate-350 cursor-help w-3.5 h-3.5 rounded-full border border-slate-800 flex items-center justify-center font-bold">?</span>
                      <div className="tooltip-box">Filter the standard DMC colors to match selected manufacturer gem kits.</div>
                    </div>
                  </div>
                  <select
                    value={selectedBaseKit}
                    onChange={(e) => {
                      setSelectedBaseKit((e.target as HTMLSelectElement).value as any);
                      setExcludedColors(new Set()); // Reset exclusions on kit change
                    }}
                    className="bg-slate-950/80 border border-slate-850 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-200 cursor-pointer text-ellipsis overflow-hidden"
                  >
                    <option value="all">All DMC Palette</option>
                    <option value="100">Art Dot 100 Kit</option>
                    <option value="200">Art Dot 200 Kit</option>
                  </select>
                </div>

                {/* Drill Type Selector */}
                <div className="flex flex-col gap-1 shrink-0">
                  <div className="flex items-center gap-1.5 justify-between">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Drill Type (Finish)</label>
                    <div className="tooltip-group">
                      <span className="text-[10px] text-slate-500 hover:text-slate-350 cursor-help w-3.5 h-3.5 rounded-full border border-slate-800 flex items-center justify-center font-bold">?</span>
                      <div className="tooltip-box">Select the finish/style of diamond drills (standard, AB, glow, crystal).</div>
                    </div>
                  </div>
                  <select
                    value={drillType}
                    onChange={(e) => {
                      setDrillType((e.target as HTMLSelectElement).value as any);
                    }}
                    className="bg-slate-950/80 border border-slate-850 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-200 cursor-pointer text-ellipsis overflow-hidden"
                  >
                    <option value="standard">Standard Resin</option>
                    <option value="ab">AB (Aurora Borealis)</option>
                    <option value="glow">Glow-in-the-Dark</option>
                    <option value="crystal">Crystal / Rhinestone</option>
                  </select>
                </div>

                {/* Color Substitution Option */}
                <div className="flex flex-col gap-1.5 bg-slate-950/60 p-2.5 rounded border border-slate-850/50 mt-1 shrink-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        id="substitute-colors-checkbox"
                        type="checkbox"
                        checked={enableSubstitution}
                        onChange={(e) => setEnableSubstitution((e.target as HTMLInputElement).checked)}
                        className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer shrink-0"
                      />
                      <label htmlFor="substitute-colors-checkbox" className="text-xs font-semibold text-slate-350 cursor-pointer select-none">
                        Auto-substitute low-count colors
                      </label>
                    </div>
                    <div className="tooltip-group">
                      <span className="text-[10px] text-slate-500 hover:text-slate-350 cursor-help w-3.5 h-3.5 rounded-full border border-slate-800 flex items-center justify-center font-bold">?</span>
                      <div className="tooltip-box">Automatically map colors with low pixel counts to their closest active neighbors.</div>
                    </div>
                  </div>
                  {enableSubstitution && (
                    <div className="flex flex-col gap-1 mt-1.5 pl-5 select-none">
                      <label className="text-[9px] uppercase tracking-wide text-slate-500 font-bold">Substitution Threshold (Max Drills)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="1"
                          max="500"
                          value={substitutionThreshold}
                          onInput={(e) => setSubstitutionThreshold(parseInt((e.target as HTMLInputElement).value, 10) || 1)}
                          className="flex-1 accent-indigo-500 cursor-pointer h-1 bg-slate-800 rounded appearance-none"
                        />
                        <input
                          type="number"
                          min="1"
                          value={substitutionThreshold}
                          onInput={(e) => setSubstitutionThreshold(parseInt((e.target as HTMLInputElement).value, 10) || 1)}
                          className="bg-slate-900 border border-slate-800/80 rounded px-1.5 py-0.5 text-[10px] font-bold font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 shrink-0 w-14 text-center shadow-inner"
                        />
                      </div>
                      <span className="text-[9px] text-slate-500 italic mt-0.5 leading-tight">
                        Fills colors with counts below threshold into their closest color.
                      </span>
                    </div>
                  )}
                </div>

                {/* Collapsible Sub-palette selection checklist */}
                <div className="border border-slate-850 p-2 rounded bg-slate-950/30 flex flex-col shrink-0 no-print">
                  <button
                    onClick={() => setExcludeListOpen(!excludeListOpen)}
                    className="w-full flex justify-between items-center text-left font-bold text-xs text-slate-250 select-none cursor-pointer focus:outline-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[8px] text-slate-500 transition-transform duration-200 ${excludeListOpen ? 'rotate-90' : ''}`}>▶</span>
                      <span className="font-semibold text-slate-400 uppercase tracking-wider">Exclude Colors</span>
                      {excludedColors.size > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-semibold">{excludedColors.size}</span>
                      )}
                    </div>
                    {excludeListOpen && (
                      <div className="flex gap-2 text-[10px]" onClick={(e) => e.stopPropagation()}>
                        <button onClick={handleSelectAll} className="text-indigo-400 hover:text-indigo-300 cursor-pointer">
                          All
                        </button>
                        <span className="text-slate-700 select-none">|</span>
                        <button onClick={handleDeselectAll} className="text-indigo-400 hover:text-indigo-300 cursor-pointer">
                          None
                        </button>
                      </div>
                    )}
                  </button>

                  {excludeListOpen && (
                    <div className="mt-2 flex flex-col gap-1.5">
                      <p className="text-[9px] text-slate-500 leading-normal">Uncheck colors to exclude them from matching.</p>
                      <div className="grid grid-cols-2 gap-1 max-h-28 overflow-y-auto border border-slate-850 p-1 rounded bg-slate-950/60 scrollbar-thin">
                        {baseCandidates.map(c => {
                          const isExcluded = excludedColors.has(c.dmc);
                          return (
                            <label
                              key={c.dmc}
                              className="flex items-center gap-1 cursor-pointer hover:bg-slate-850 p-0.5 rounded text-[10px] select-none"
                            >
                              <input
                                type="checkbox"
                                checked={!isExcluded}
                                onChange={() => toggleColorExclusion(c.dmc)}
                                className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 h-2.5 w-2.5 cursor-pointer"
                              />
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-slate-850 shrink-0"
                                style={{ backgroundColor: c.hex }}
                              />
                              <span className="font-mono text-slate-350 truncate" title={c.name}>{c.dmc}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </details>

            {/* DMC Legend List Table */}
            <div className="flex flex-col gap-1.5 no-print">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">DMC Supply List</label>
              <div className="border border-slate-850 rounded bg-slate-950/30 max-h-80 overflow-y-auto scrollbar-thin">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400 select-none text-[9px] uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-1 px-1 w-6 text-center">Col</th>
                      <th className="py-1 px-1 w-10 text-center">DMC</th>
                      <th className="py-1 px-1 text-right">Exact</th>
                      <th className="py-1 px-1 text-right">Safety</th>
                      <th className="py-1 px-1 text-right">Bags</th>
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
                          <td className="py-1 px-1 flex justify-center">
                            <span
                              className="block w-2 h-2 rounded-full border border-slate-850 shadow-sm"
                              style={{ backgroundColor: row.hex }}
                            />
                          </td>
                          <td className="py-1 px-1 font-mono font-bold text-center text-slate-200 text-[10px]">
                            {row.code}
                          </td>
                          <td className="py-1 px-1 text-right text-slate-400 font-mono">{row.count}</td>
                          <td className="py-1 px-1 text-right font-medium text-indigo-300 font-mono">{row.safety}</td>
                          <td className="py-1 px-1 text-right font-bold text-slate-350 font-mono text-[9px]">
                            {optimizeBagsCost ? row.bagsText : row.packets}
                          </td>
                        </tr>
                      );
                    })}
                    {sortedMatches.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-slate-500 text-xs">
                          No matching colors. Load an image to compute.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {wizardStep === 3 && (
          <div className="flex flex-col gap-4">
            {/* Canvas Print Partner Dropdown (V-05) */}
            <div className="flex flex-col gap-1">
              <label htmlFor="canvas-print-partner" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Canvas Print Partner</label>
              <select
                id="canvas-print-partner"
                value={selectedVendor}
                onChange={(e) => setSelectedVendor((e.target as HTMLSelectElement).value as any)}
                className="bg-slate-950/80 border border-slate-850 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-200 cursor-pointer h-[32px]"
              >
                <option value="lumaprints">Lumaprints (Default)</option>
                <option value="prodigi">Prodigi</option>
                <option value="finerworks">FinerWorks</option>
              </select>
            </div>

            {/* Canvas Base Price ($) and shipping estimate */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Canvas Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={canvasBaseCost}
                  onInput={(e) => setCanvasBaseCost(parseFloat((e.target as HTMLInputElement).value) || 0)}
                  className="bg-slate-950/80 border border-slate-850 rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-200"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Est. Shipping ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={canvasShippingEstimate}
                  onInput={(e) => setCanvasShippingEstimate(parseFloat((e.target as HTMLInputElement).value) || 0)}
                  className="bg-slate-950/80 border border-slate-850 rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-200"
                />
              </div>
            </div>

            {/* Optimize Bag Combinations Checkbox */}
            <div className="flex items-center gap-2 mt-1">
              <input
                id="optimize-bags-checkbox"
                type="checkbox"
                checked={optimizeBagsCost}
                onChange={(e) => setOptimizeBagsCost((e.target as HTMLInputElement).checked)}
                className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer shrink-0"
              />
              <label htmlFor="optimize-bags-checkbox" className="text-xs font-semibold text-slate-300 cursor-pointer">
                Optimize bag sizes (Adaptive)
              </label>
            </div>

            {optimizeBagsCost ? (
              <div className="flex flex-col gap-1.5 bg-slate-950/60 p-2.5 rounded border border-slate-850/50">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Prices per Bag Size ($)</span>
                <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 font-mono">200 qty</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={priceDb[200]}
                      onInput={(e) => updatePriceDb(200, parseFloat((e.target as HTMLInputElement).value) || 0)}
                      className="bg-slate-900 border border-slate-800 rounded px-1 py-0.5 font-mono text-center text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 font-mono">500 qty</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={priceDb[500]}
                      onInput={(e) => updatePriceDb(500, parseFloat((e.target as HTMLInputElement).value) || 0)}
                      className="bg-slate-900 border border-slate-800 rounded px-1 py-0.5 font-mono text-center text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 font-mono">1k qty</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={priceDb[1000]}
                      onInput={(e) => updatePriceDb(1000, parseFloat((e.target as HTMLInputElement).value) || 0)}
                      className="bg-slate-900 border border-slate-800 rounded px-1 py-0.5 font-mono text-center text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 font-mono">2k qty</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={priceDb[2000]}
                      onInput={(e) => updatePriceDb(2000, parseFloat((e.target as HTMLInputElement).value) || 0)}
                      className="bg-slate-900 border border-slate-800 rounded px-1 py-0.5 font-mono text-center text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Drill Bag Size</label>
                  <select
                    value={drillBagSize}
                    onChange={(e) => setDrillBagSize(parseInt((e.target as HTMLSelectElement).value, 10))}
                    className="bg-slate-950/80 border border-slate-850 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-200 cursor-pointer h-[26px]"
                  >
                    <option value={200}>200 Drills</option>
                    <option value={1000}>1,000 Drills</option>
                    <option value={2000}>2,000 Drills</option>
                    <option value={5000}>5,000 Drills</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bag Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={drillPacketCost}
                    onInput={(e) => setDrillPacketCost(parseFloat((e.target as HTMLInputElement).value) || 0)}
                    className="bg-slate-950/80 border border-slate-850 rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-200"
                  />
                </div>
              </div>
            )}

            {/* Quoting Cost Breakdown card */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cost Estimate</span>
              
              <div className="flex flex-col gap-3 bg-slate-950/40 p-2.5 rounded-lg border border-slate-850/60 text-[11px] text-slate-350">
                <div className="text-slate-400 font-bold border-b border-slate-850/50 pb-1.5 mb-1.5 flex justify-between">
                  <span>Price Breakdown</span>
                  <span className="text-[9px] text-indigo-400 font-medium normal-case font-mono">{totalSafetyDrills.toLocaleString()} pcs</span>
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[10px] pl-1.5 text-slate-400">
                    <span>Canvas (Product Cost):</span>
                    <span className="font-semibold text-slate-300 font-mono">${canvasBaseCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] pl-1.5 text-slate-400">
                    <span>Canvas (Est. Shipping):</span>
                    <span className="font-semibold text-slate-300 font-mono">${canvasShippingEstimate.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] pl-1.5 text-slate-400">
                    <span>Drills ({totalPackets} bag(s)):</span>
                    <span className="font-semibold text-slate-300 font-mono">${safetyDrillCost.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center bg-slate-900/40 p-2 rounded border border-slate-850/40 my-1">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Total Cost</span>
                      <span className="text-sm font-bold text-emerald-400 font-mono">
                        ${totalCostSafety.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Order & Print Actions */}
            <div className="flex flex-col gap-2 bg-slate-900/40 p-3 rounded-lg border border-slate-850/60">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Order & Actions</span>
              
              <button
                onClick={handleShopifyCheckout}
                disabled={!matchResult}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white py-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
              >
                <span>🛒 Order Drills from Diamond Drills USA</span>
              </button>

              <button
                onClick={handleDownloadCanvasOnly}
                disabled={!matchResult}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white py-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
              >
                <span>📥 Download Canvas Grid (PNG)</span>
              </button>

              <button
                onClick={handleDownloadCombinedCanvasSheet}
                disabled={!matchResult}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white py-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
              >
                <span>📥 Download Canvas Grid + Legend (PNG)</span>
              </button>

              <button
                onClick={printLegendSheetOnly}
                disabled={!matchResult}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white py-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>🖨️ Print Legend Sheet (Paper)</span>
              </button>

              <button
                onClick={printReport}
                disabled={!matchResult}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>🖨️ Print Supply Report</span>
              </button>
            </div>

            {/* Sizing Advice Helper Card (V-06) */}
            <div className="border border-indigo-500/30 p-3 rounded-lg bg-indigo-950/20 flex flex-col gap-2 no-print">
              <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                <span>ℹ️ Sizing Advice</span>
              </div>
              <div className="flex flex-col gap-2.5 text-xs text-slate-300 leading-relaxed">
                <div>
                  <span className="font-semibold text-indigo-300 block mb-0.5">Canvas Grid (PNG):</span>
                  <span>
                    Your finished grid is <strong>{sizingAdviceData.gridIn}</strong> ({sizingAdviceData.gridCm}). The downloaded Canvas Grid PNG adds a {sizingAdviceData.framer} white framer wrap on each side, so order a rolled canvas of <strong>{sizingAdviceData.canvasOnlyIn}</strong> ({sizingAdviceData.canvasOnlyCm}) and upload the PNG below.
                  </span>
                </div>
                <div className="border-t border-slate-800/80 my-1.5"></div>
                <div>
                  <span className="font-semibold text-indigo-300 block mb-0.5">Canvas + Legend (PNG):</span>
                  <span>
                    Prefer the all-in-one sheet? Order roughly <strong>{sizingAdviceData.combinedIn}</strong> ({sizingAdviceData.combinedCm}) to fit the grid plus the printed legend margins.
                  </span>
                </div>
              </div>
            </div>

            {/* Send to a canvas printer — direct provider "doors" */}
            <div className="flex flex-col gap-2 bg-slate-900/40 p-3 rounded-lg border border-slate-850/60">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Send to a Canvas Printer</span>
              <p className="text-[10px] text-slate-500 leading-normal">
                Download the <strong>Canvas Grid PNG</strong> above, then open a printer below and upload it as a rolled canvas at <strong>{sizingAdviceData.canvasOnlyIn}</strong> ({sizingAdviceData.canvasOnlyCm}).
              </p>
              <div className="flex flex-col gap-1.5">
                {(Object.keys(VENDOR_REGISTRY) as Array<keyof typeof VENDOR_REGISTRY>).map(key => {
                  const v = VENDOR_REGISTRY[key];
                  return (
                    <a
                      key={key}
                      href={v.uploadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex justify-between items-center bg-slate-950/40 hover:bg-slate-950/80 p-2.5 rounded-lg border border-slate-850 hover:border-accent transition-all text-xs text-slate-200 hover:text-ink group"
                    >
                      <span className="font-semibold">Upload to {v.name}</span>
                      <span className="text-slate-500 group-hover:text-accent font-bold ml-2">↗</span>
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Affiliate & settings configurations */}
            <details className="text-[11px] text-slate-400 cursor-pointer bg-slate-950/20 p-2 rounded border border-slate-850/40">
              <summary className="font-semibold text-[10px] uppercase text-indigo-400 select-none">Affiliate & Partner Settings</summary>
              <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-slate-850">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wide text-slate-500">Affiliate Tag</label>
                  <input
                    type="text"
                    value={affiliateTag}
                    onChange={(e) => setAffiliateTag((e.target as HTMLInputElement).value)}
                    placeholder="e.g. gempixel"
                    className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 cursor-text"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wide text-slate-500">Tracking Engine</label>
                  <select
                    value={affiliateApp}
                    onChange={(e) => setAffiliateApp((e.target as HTMLSelectElement).value as any)}
                    className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 cursor-pointer"
                  >
                    <option value="ref">Ref/Referral (ref=...)</option>
                    <option value="rfsn">Refersion (rfsn=...)</option>
                    <option value="none">None</option>
                  </select>
                </div>
                {/* Logged Unmapped Colors List */}
                <div className="flex flex-col gap-1 pt-2 border-t border-slate-850">
                  <div className="flex justify-between items-center">
                    <label className="text-[9px] uppercase tracking-wide text-slate-500 font-bold">Logged Unmapped Colors</label>
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.removeItem('gempixel_unmapped_colors_log');
                        setUnmappedLog([]);
                      }}
                      className="text-[9px] text-red-400 hover:text-red-300 font-semibold cursor-pointer"
                    >
                      Clear Log
                    </button>
                  </div>
                  <div className="bg-slate-950/60 p-2 rounded border border-slate-850/60 max-h-24 overflow-y-auto text-[10px] font-mono text-slate-350 cursor-default">
                    {unmappedLog.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {unmappedLog.map(code => (
                          <span key={code} className="bg-slate-800 px-1 rounded border border-slate-700 select-all">
                            {code}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500 italic select-none">No unmapped colors logged.</span>
                    )}
                  </div>
                </div>
              </div>
            </details>
          </div>
        )}

        {wizardStep === 4 && (
          <div className="flex flex-col gap-4">
            {/* Section A: Summary */}
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 flex flex-col gap-2.5">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Diamond Art Summary</span>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex flex-col gap-0.5 bg-slate-950/40 p-2 rounded border border-slate-850/50">
                  <span className="text-[9px] text-slate-500 uppercase font-semibold">Dimensions</span>
                  <span className="font-bold text-slate-200">{cols} x {rows} {unit}</span>
                </div>
                <div className="flex flex-col gap-0.5 bg-slate-950/40 p-2 rounded border border-slate-850/50">
                  <span className="text-[9px] text-slate-500 uppercase font-semibold">Palette Size</span>
                  <span className="font-bold text-slate-200">{matchResult ? Object.keys(matchResult.counts).length : 0} Colors</span>
                </div>
                <div className="flex flex-col gap-0.5 bg-slate-950/40 p-2 rounded border border-slate-850/50">
                  <span className="text-[9px] text-slate-500 uppercase font-semibold">Drill Style</span>
                  <span className="font-bold text-slate-200 capitalize">{drillStyle} / {drillType}</span>
                </div>
                <div className="flex flex-col gap-0.5 bg-slate-950/40 p-2 rounded border border-slate-850/50">
                  <span className="text-[9px] text-slate-500 uppercase font-semibold">Required Drills</span>
                  <span className="font-bold text-slate-200">{totalSafetyDrills.toLocaleString()} pcs</span>
                </div>
              </div>

              {/* Pricing summary */}
              <div className="flex justify-between items-center bg-slate-900/80 p-2 rounded border border-slate-800 mt-1">
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Total Cost</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">${totalCostSafety.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Portfolio Saving Form */}
            <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-850/60 flex flex-col gap-2.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Save to My Images</span>
              <div className="flex flex-col gap-1.5">
                <input
                  type="text"
                  id="step4-save-name-input"
                  value={saveProjectName}
                  onInput={(e) => setSaveProjectName((e.target as HTMLInputElement).value)}
                  placeholder="e.g. Sunset Beach"
                  className="bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                />
                
                <div className="flex gap-2">
                  {activeProjectId ? (
                    <>
                      <button
                        onClick={() => {
                          handleSaveProject(saveProjectName);
                          showSaveSuccess();
                        }}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2 rounded cursor-pointer transition-colors"
                      >
                        Update
                      </button>
                      <button
                        onClick={() => {
                          handleSaveProject(saveProjectName, true);
                          showSaveSuccess();
                        }}
                        className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold py-2 rounded cursor-pointer transition-colors"
                      >
                        Save as Copy
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        handleSaveProject(saveProjectName);
                        showSaveSuccess();
                      }}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2 rounded cursor-pointer transition-colors"
                    >
                      Save to My Images
                    </button>
                  )}
                </div>

                {saveSuccessMsg && (
                  <span className="text-[10px] text-emerald-400 font-semibold text-center block mt-0.5">
                    ✓ {saveSuccessMsg}
                  </span>
                )}
              </div>
            </div>

            {/* Start Over / Reset button */}
            <div className="mt-2 pt-2 border-t border-slate-800/60 no-print">
              <button
                onClick={resetWorkspace}
                className="w-full bg-slate-800 hover:bg-slate-750 hover:text-slate-100 text-slate-350 py-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
              >
                <span>Start New Image / Reset</span>
              </button>
            </div>
          </div>
        )}



        {/* Sidebar Footer Actions */}
        <div className="mt-auto flex flex-col gap-2 pt-2 border-t border-slate-800/60 shrink-0 no-print">
          {matchResult && (
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted">
              <span className="w-2 h-2 rounded-sm bg-accent-2 inline-block" />
              Matched · {sortedMatches.length} colors
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setResourcesModalOpen(true)}
              className="flex-1 bg-panel hover:bg-border text-muted hover:text-ink py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-border active:scale-[0.98]"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>Artist Resources</span>
            </button>

            {/* Simple light/dark pill toggle */}
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              aria-label="Toggle light or dark theme"
              className="relative w-[58px] h-8 rounded-full bg-panel border border-border cursor-pointer shrink-0 transition-colors"
            >
              <span
                className={`absolute top-[3px] h-6 w-6 rounded-full bg-accent text-on-accent flex items-center justify-center text-[12px] leading-none transition-all duration-200 ${
                  theme === 'light' ? 'left-[3px]' : 'left-[27px]'
                }`}
              >
                {theme === 'light' ? '☀' : '☾'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Sticky wizard navigation footer */}
      <div className="mt-auto pt-4 border-t border-slate-800/60 shrink-0 no-print flex flex-col gap-4 bg-slate-900/60 px-1 pb-1">
        <div className="flex items-center justify-between">
          {wizardStep > 1 ? (
            <button
              id="wizard-back-btn"
              onClick={() => setWizardStep(prev => Math.max(1, prev - 1))}
              className="text-xs font-bold text-slate-450 hover:text-slate-200 cursor-pointer transition-colors"
            >
              &lt; Back
            </button>
          ) : (
            <div className="text-xs font-bold text-slate-700/0 select-none cursor-default w-[42px]">&nbsp;</div>
          )}

          {/* Dots */}
          <div className="flex gap-2">
            {[1, 2, 3, 4].map(step => {
              const isActive = wizardStep === step;
              const isCompleted = wizardStep > step;
              const isValid = isStepValid(step) || isTestEnv;
              return (
                <button
                  key={step}
                  onClick={() => isValid && setWizardStep(step)}
                  disabled={!isValid}
                  className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow shadow-indigo-600/30 scale-105'
                      : isCompleted
                      ? 'bg-indigo-950 text-indigo-300 hover:bg-indigo-900 hover:text-white border border-indigo-500/30'
                      : isValid
                      ? 'bg-slate-850 text-slate-450 hover:bg-slate-800 hover:text-slate-250 border border-slate-800'
                      : 'bg-slate-950 text-slate-750 border border-slate-900 cursor-not-allowed'
                  }`}
                  title={['Upload', 'Palette & Optimize', 'Cost & Order', 'Save'][step - 1]}
                >
                  {step}
                </button>
              );
            })}
          </div>

          {wizardStep < 4 ? (
            <button
              id="wizard-next-btn"
              onClick={() => setWizardStep(prev => Math.min(4, prev + 1))}
              disabled={!isStepValid(wizardStep + 1)}
              className="bg-accent text-on-accent px-3 py-1.5 rounded-md text-xs font-bold hover:brightness-110 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-all"
            >
              Next Step &gt;
            </button>
          ) : (
            <div className="text-xs font-bold text-indigo-750/0 select-none cursor-default w-[72px]">&nbsp;</div>
          )}
        </div>
      </div>
    </aside>

    {/* Main Canvas Area */}
    <main className="flex-1 relative flex flex-col min-w-0 print:block">

        {/* Center top wizard progress bar + Save */}
        <div className="hidden md:flex items-center justify-between gap-4 px-6 py-3 border-b border-border bg-panel no-print shrink-0">
          <div className="flex items-center gap-1.5">
            {['Upload', 'Size', 'Colors', 'Supplies'].map((label, i) => {
              const step = i + 1;
              const isActive = wizardStep === step;
              const isCompleted = wizardStep > step;
              const isValid = isStepValid(step) || isTestEnv;
              return (
                <div key={label} className="flex items-center gap-1.5">
                  {i > 0 && <span className="w-6 h-px bg-border" />}
                  <button
                    onClick={() => isValid && setWizardStep(step)}
                    disabled={!isValid}
                    title={['Upload', 'Palette & Optimize', 'Cost & Order', 'Save'][i]}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono uppercase tracking-wider transition-all cursor-pointer disabled:cursor-not-allowed ${
                      isCompleted
                        ? 'bg-accent-2 text-on-accent font-bold'
                        : isActive
                        ? 'bg-accent text-on-accent font-bold'
                        : isValid
                        ? 'text-muted hover:text-ink'
                        : 'text-muted opacity-50'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] border border-current">
                      {isCompleted ? '✓' : step}
                    </span>
                    {label}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            {wizardStep < 4 && (
              <button
                onClick={() => setWizardStep(prev => Math.min(4, prev + 1))}
                disabled={!(isStepValid(wizardStep + 1) || isTestEnv)}
                className="btn-chunk rounded-md px-5 py-2 text-xs font-bold uppercase tracking-wide disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Next Step →
              </button>
            )}
            <button
              onClick={() => {
                setSaveProjectName(activeProjectId ? (projectsRegistry.find(p => p.id === activeProjectId)?.name || '') : `Diamond Art ${projectsRegistry.length + 1}`);
                setSaveModalOpen(true);
              }}
              disabled={!matchResult}
              className="btn-chunk-2 rounded-md px-5 py-2 text-xs font-bold uppercase tracking-wide disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Save
            </button>
          </div>
        </div>

        {leftPanelCollapsed && (
          <button
            onClick={() => setLeftPanelCollapsed(false)}
            className="absolute top-16 left-4 z-50 p-2 bg-slate-900/90 hover:bg-slate-800 text-indigo-400 hover:text-white rounded-lg shadow-xl border border-slate-700/50 transition-all duration-200 cursor-pointer hidden md:flex items-center justify-center hover:scale-105 active:scale-95"
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
            className="absolute top-16 right-4 z-50 p-2 bg-slate-900/90 hover:bg-slate-800 text-indigo-400 hover:text-white rounded-lg shadow-xl border border-slate-700/50 transition-all duration-200 cursor-pointer hidden md:flex items-center justify-center hover:scale-105 active:scale-95"
            title="Expand Workspace"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M11 19l-7-7 7-7M17 19l-7-7 7-7" />
            </svg>
          </button>
        )}

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
                      onClick={() => viewerRef.current?.zoomIn()}
                      aria-label="Zoom In"
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-355 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
                    >
                      ➕
                    </button>
                    <div className="tooltip-box">Zoom In</div>
                  </div>

                  <div className="tooltip-group">
                    <button
                      onClick={() => viewerRef.current?.zoomOut()}
                      aria-label="Zoom Out"
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-355 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
                    >
                      ➖
                    </button>
                    <div className="tooltip-box">Zoom Out</div>
                  </div>

                  <div className="tooltip-group">
                    <button
                      onClick={() => viewerRef.current?.fitToContainer()}
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
                  <div className="px-2 py-1 rounded bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-bold select-none cursor-default flex items-center gap-1 animate-pulse">
                    ⚠️ Low Zoom
                  </div>
                  <div className="tooltip-box">Zoom in to view symbol overlays (disabled at &lt;10px cell size)</div>
                </div>
              )}
            </div>
          )}
          {(image || matchResult) ? (
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
                  className={`shadow-2xl border border-slate-800 bg-slate-900 print:border-none print:shadow-none ${
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
          ) : (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="text-center p-6 max-w-md flex flex-col items-center gap-6"
            >
              <div className="flex flex-col items-center gap-2">
                <h2 className="font-display text-4xl font-bold text-ink leading-tight">Photo → Diamond Chart</h2>
                <p className="text-sm text-muted max-w-sm">Drop a photo to map it to DMC / Art Dot colors with exact drill counts. Everything runs in your browser.</p>
              </div>
              <div
                onClick={() => document.getElementById('hero-file-upload')?.click()}
                className={`w-full max-w-sm border-2 border-dashed rounded-xl px-6 py-10 cursor-pointer transition-all flex flex-col items-center gap-5 ${
                  isDragOver ? 'border-accent bg-accent/10' : 'border-border hover:border-accent/60 bg-panel/40'
                }`}
              >
                <div className="gem-logo w-12 h-12" aria-hidden="true">
                  {['--gem-pink','--gem-cyan','--gem-violet','--gem-amber','--gem-pink','--gem-cyan','--gem-violet','--gem-amber','--gem-pink'].map((c, i) => (
                    <span key={i} style={{ backgroundColor: `var(${c})` }} />
                  ))}
                </div>
                <span className="btn-chunk rounded-md px-5 py-2.5 text-xs font-bold uppercase tracking-wide">Browse Files</span>
                <input
                  id="hero-file-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          )}

          {/* Bottom hint pill */}
          {(image || matchResult) && (viewportMode === 'grid' || viewportMode === 'symbols') && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 no-print px-3 py-1.5 rounded-full bg-panel/80 border border-border text-[10px] font-mono text-muted whitespace-nowrap backdrop-blur">
              drag to pan · scroll to zoom · {(cols * rows).toLocaleString()} drills
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
        {/* Color Legend Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-2.5 px-4 pt-3.5 no-print shrink-0">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-lg font-bold text-ink leading-none">Color Legend</span>
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider">{sortedMatches.length} colors</span>
          </div>
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
        <div className="px-2 py-4 flex-1 flex flex-col overflow-hidden print:p-0 print:overflow-visible">
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
                    <th 
                      onClick={() => handleHeaderClick('color')}
                      className="py-1.5 px-1 w-6 text-center cursor-pointer hover:text-slate-200 transition-colors"
                      title="Sort by Color Hue"
                    >
                      Color{sortBy === 'color' && (sortAsc ? ' ▲' : ' ▼')}
                    </th>
                    <th 
                      onClick={() => handleHeaderClick('code')}
                      className="py-1.5 px-1 w-10 text-center cursor-pointer hover:text-slate-200 transition-colors"
                      title="Sort by DMC Code"
                    >
                      DMC{sortBy === 'code' && (sortAsc ? ' ▲' : ' ▼')}
                    </th>
                    <th 
                      onClick={() => handleHeaderClick('name')}
                      className="py-1.5 px-1 truncate max-w-[75px] cursor-pointer hover:text-slate-200 transition-colors"
                      title="Sort by Color Name"
                    >
                      Name{sortBy === 'name' && (sortAsc ? ' ▲' : ' ▼')}
                    </th>
                    <th 
                      onClick={() => handleHeaderClick('quantity')}
                      className="py-1.5 px-1 text-right cursor-pointer hover:text-slate-200 transition-colors"
                      title="Sort by Quantity Needed"
                    >
                      Exact{sortBy === 'quantity' && (sortAsc ? ' ▲' : ' ▼')}
                    </th>
                    <th className="py-1.5 px-1 text-right">Safety</th>
                    <th className="py-1.5 px-1 text-right text-ellipsis overflow-hidden truncate" title={optimizeBagsCost ? 'Optimized combinations of 200, 500, 1000, 2000 bags' : `Bags of size ${drillBagSize}`}>{optimizeBagsCost ? 'Bags (Opt)' : `Bags (${drillBagSize})`}</th>
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
                        <td className="py-1 px-1 flex justify-center">
                          <span
                            className="block w-2.5 h-2.5 rounded-full border border-slate-850 shadow-sm"
                            style={{ backgroundColor: row.hex }}
                          />
                        </td>
                        <td className="py-1 px-1 font-mono font-bold text-center text-slate-200 text-[10px]">
                          {row.code}
                          {drillType !== 'standard' && (
                            <span className={`ml-0.5 text-[7px] font-sans px-0.5 rounded-sm ${
                              drillType === 'ab'
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                : drillType === 'glow'
                                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                : 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                            }`}>
                              {drillType === 'ab' ? 'AB' : drillType === 'glow' ? 'GLOW' : 'XTAL'}
                            </span>
                          )}
                        </td>
                        <td className="py-1 px-1 text-slate-450 truncate max-w-[75px] text-[10px]" title={row.name}>
                          {row.name}
                        </td>
                        <td className="py-1 px-1 text-right text-slate-400 font-mono text-[10px]">{row.count}</td>
                        <td className="py-1 px-1 text-right font-medium text-indigo-300 font-mono text-[10px]">{row.safety}</td>
                        <td className="py-1 px-1 text-right font-bold text-slate-300 font-mono text-[9.5px]">
                          {optimizeBagsCost ? (
                            <div className="flex flex-col items-end leading-none">
                              <span className="text-[9.5px] text-slate-200">{row.bagsText}</span>
                              <span className="text-[8px] text-slate-500 font-normal font-sans">({row.purchase} pcs)</span>
                            </div>
                          ) : (
                            <>
                              {row.packets} <span className="text-[8px] text-slate-500 font-normal font-sans">({row.packets * drillBagSize})</span>
                            </>
                          )}
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
                  <th className="p-2 text-right border border-gray-300">{optimizeBagsCost ? 'Recommended Purchase Packs' : `Recommended ${drillBagSize}-Drill Packets`}</th>
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
                    <td className="p-2 font-mono font-bold border border-gray-300">
                      {row.code}
                      {drillType !== 'standard' ? ' ' + (drillType === 'ab' ? 'AB' : drillType === 'glow' ? 'Glow' : 'Crystal') : ''}
                    </td>
                    <td className="p-2 border border-gray-300">{row.name}</td>
                    <td className="p-2 text-right border border-gray-300">{row.count}</td>
                    <td className="p-2 text-right border border-gray-300">{row.safety}</td>
                    <td className="p-2 text-right font-bold border border-gray-300">
                      {optimizeBagsCost ? (
                        <span>{row.bagsText} ({row.purchase} drills)</span>
                      ) : (
                        <span>{row.packets} pack(s) ({row.packets * drillBagSize} drills)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>

        {/* Legend footer summary + primary CTA */}
        {matchResult && (
          <div className="shrink-0 border-t border-border px-4 py-3 flex flex-col gap-3 no-print">
            <div className="flex flex-col gap-1 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-muted uppercase tracking-wider">Drills (+10% safety)</span>
                <span className="font-bold text-ink">{totalSafetyDrills.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted uppercase tracking-wider">Packets ({drillBagSize}-ct)</span>
                <span className="font-bold text-ink">{totalPackets}</span>
              </div>
              <div className="flex justify-between items-center border-t border-border pt-1.5 mt-1">
                <span className="text-muted uppercase tracking-wider">Est. total</span>
                <span className="text-lg font-bold text-accent-2 font-mono">${totalCostSafety.toFixed(2)}</span>
              </div>
            </div>
            <button
              onClick={handleShopifyCheckout}
              className="btn-chunk rounded-md py-3 text-xs font-bold uppercase tracking-wide cursor-pointer"
            >
              Buy Supplies →
            </button>
          </div>
        )}
      </aside>

      {/* Artist Resources Modal */}
      {resourcesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm no-print font-sans">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full shadow-2xl p-5 relative overflow-hidden flex flex-col gap-4">
            {/* Top Close Button */}
            <button
              onClick={() => setResourcesModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer transition-colors p-1 rounded-full hover:bg-slate-800/60"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div>
              <h3 className="text-base font-bold text-white bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">Artist Resource Directory</h3>
              <p className="text-[11px] text-slate-400 mt-1">Curated links to print custom canvas layouts and purchase bulk DMC replacement drills.</p>
            </div>

            <div className="flex flex-col gap-3">
              {/* Category 1: Printing Custom Canvas */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Custom Canvas Printing</span>
                <div className="flex flex-col gap-2">
                  <a
                    href="https://adiamondpainting.com/products/personalised-photo-custom-diamond-painting"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex justify-between items-center bg-slate-950/40 hover:bg-slate-950/80 p-2.5 rounded-lg border border-slate-850 hover:border-indigo-500/50 transition-all text-xs text-slate-200 hover:text-white group"
                  >
                    <div>
                      <span className="font-semibold block">ADiamondPainting Custom Prints</span>
                      <span className="text-[10px] text-slate-500">Factory-direct printing with poured glue and drop-shipping support.</span>
                    </div>
                    <span className="text-slate-500 group-hover:text-indigo-400 font-bold ml-2">↗</span>
                  </a>
                  
                  <a
                    href="https://pandacraftysteam.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex justify-between items-center bg-slate-950/40 hover:bg-slate-950/80 p-2.5 rounded-lg border border-slate-850 hover:border-indigo-500/50 transition-all text-xs text-slate-200 hover:text-white group"
                  >
                    <div>
                      <span className="font-semibold block">Panda Crafty Sourcing</span>
                      <span className="text-[10px] text-slate-500">High-quality OEM factory manufacturing for custom canvases and kits.</span>
                    </div>
                    <span className="text-slate-500 group-hover:text-indigo-400 font-bold ml-2">↗</span>
                  </a>
                </div>
              </div>

              {/* Category 2: Bulk replacement drills */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bulk replacement drills</span>
                <div className="flex flex-col gap-2">
                  <a
                    href="https://diamonddrillsusa.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex justify-between items-center bg-slate-950/40 hover:bg-slate-950/80 p-2.5 rounded-lg border border-slate-850 hover:border-indigo-500/50 transition-all text-xs text-slate-200 hover:text-white group"
                  >
                    <div>
                      <span className="font-semibold block">Diamond Drills USA</span>
                      <span className="text-[10px] text-slate-500">Fast US shipping for round and square DMC replacement drill bags.</span>
                    </div>
                    <span className="text-slate-500 group-hover:text-indigo-400 font-bold ml-2">↗</span>
                  </a>
                  
                  <a
                    href="https://www.aliexpress.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex justify-between items-center bg-slate-950/40 hover:bg-slate-950/80 p-2.5 rounded-lg border border-slate-850 hover:border-indigo-500/50 transition-all text-xs text-slate-200 hover:text-white group"
                  >
                    <div>
                      <span className="font-semibold block">AliExpress Replacement Outlets</span>
                      <span className="text-[10px] text-slate-500">Inexpensive wholesale source for large quantity orders.</span>
                    </div>
                    <span className="text-slate-500 group-hover:text-indigo-400 font-bold ml-2">↗</span>
                  </a>
                </div>
              </div>
            </div>

            <button
              onClick={() => setResourcesModalOpen(false)}
              className="mt-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold py-2 rounded-lg cursor-pointer transition-colors"
            >
              Close Directory
            </button>
          </div>
        </div>
      )}

      {/* Mobile drawer backdrop — tap to return to Canvas */}
      {(!leftPanelCollapsed || !rightPanelCollapsed) && (
        <div
          className="drawer-backdrop md:hidden no-print"
          onClick={() => {
            setLeftPanelCollapsed(true);
            setRightPanelCollapsed(true);
          }}
        />
      )}

      {/* Mobile Bottom Tab Bar Navigation: Setup · Canvas · Colors */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 flex border-t border-border bg-panel pt-2.5 pb-[max(1.4rem,env(safe-area-inset-bottom))] no-print font-mono select-none">
        {/* Setup */}
        <button
          onClick={() => {
            setLeftPanelCollapsed(false);
            setRightPanelCollapsed(true);
          }}
          className={`flex-1 flex flex-col items-center gap-1.5 text-[10px] uppercase tracking-wide cursor-pointer transition-colors ${
            !leftPanelCollapsed ? 'text-accent font-bold' : 'text-muted'
          }`}
        >
          <span className="w-5 h-5 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </span>
          Setup
        </button>

        {/* Canvas */}
        <button
          onClick={() => {
            setLeftPanelCollapsed(true);
            setRightPanelCollapsed(true);
          }}
          className={`flex-1 flex flex-col items-center gap-1.5 text-[10px] uppercase tracking-wide cursor-pointer transition-colors ${
            leftPanelCollapsed && rightPanelCollapsed ? 'text-accent font-bold' : 'text-muted'
          }`}
        >
          <span className="w-5 h-5 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </span>
          Canvas
        </button>

        {/* Colors */}
        <button
          onClick={() => {
            setLeftPanelCollapsed(true);
            setRightPanelCollapsed(false);
          }}
          className={`flex-1 flex flex-col items-center gap-1.5 text-[10px] uppercase tracking-wide cursor-pointer transition-colors ${
            !rightPanelCollapsed ? 'text-accent font-bold' : 'text-muted'
          }`}
        >
          <span className="w-5 h-5 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </span>
          Colors
        </button>
      </nav>

      {/* Checkout Warning Modal */}
      {checkoutWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm no-print font-sans">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full shadow-2xl p-5 relative overflow-hidden flex flex-col gap-4">
            {/* Top Close Button */}
            <button
              onClick={() => setCheckoutWarning(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer transition-colors p-1 rounded-full hover:bg-slate-800/60"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div>
              <h3 className="text-base font-bold text-white bg-gradient-to-r from-red-400 to-amber-400 bg-clip-text text-transparent">
                Checkout Warnings & Fallbacks
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Review issues before proceeding to checkout at Diamond Drills USA.
              </p>
            </div>

            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {checkoutWarning.isUrlTooLong && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-200">
                  <span className="font-bold block mb-1">⚠️ Cart Link Too Long</span>
                  The compiled cart permalink exceeds 2,000 characters. Shopify's server may reject it with a "414 URI Too Long" error. You can still try the link, or order colors individually using the links below.
                </div>
              )}

              {checkoutWarning.unmappedItems.length > 0 && (
                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-850 flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Unmapped Colors ({checkoutWarning.unmappedItems.length})
                  </span>
                  <p className="text-[11px] text-slate-400">
                    These colors are not mapped in the database. Please search or add them manually:
                  </p>
                  <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                    {checkoutWarning.unmappedItems.map((item) => (
                      <div key={item.dmcCode} className="flex items-center justify-between bg-slate-900/60 p-2 rounded border border-slate-800 text-xs">
                        <span className="font-mono font-bold text-slate-200">DMC {item.dmcCode}</span>
                        <div className="flex gap-2 items-center flex-wrap">
                          <a
                            href={`https://diamonddrillsusa.com/products/${item.handle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                          >
                            DiamondDrillsUSA ↗
                          </a>
                          <span className="text-slate-700">|</span>
                          <a
                            href={`https://www.aliexpress.com/wholesale?SearchText=dmc+${item.dmcCode}+diamond+painting+drills`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                          >
                            AliExpress ↗
                          </a>
                          <span className="text-slate-700">|</span>
                          <a
                            href={`https://www.temu.com/search_result.html?search_key=dmc+${item.dmcCode}+diamond+painting+drills`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                          >
                            Temu ↗
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2.5 mt-2 border-t border-slate-850 pt-3">
              <button
                onClick={() => {
                  window.open(checkoutWarning.url, '_blank', 'noopener,noreferrer');
                  setCheckoutWarning(null);
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2 rounded-lg cursor-pointer transition-colors text-center"
              >
                Proceed to Shopify Cart anyway
              </button>
              <button
                onClick={() => setCheckoutWarning(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold py-2 rounded-lg cursor-pointer transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Save Project Modal */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm no-print font-sans">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full shadow-2xl p-5 relative overflow-hidden flex flex-col gap-4">
            <h3 className="text-base font-bold text-white bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              Save to My Images
            </h3>
            <p className="text-[11px] text-slate-400">
              Enter a name to save this project layout configuration locally.
            </p>
            <input
              type="text"
              id="save-project-name-input"
              value={saveProjectName}
              onInput={(e) => setSaveProjectName((e.target as HTMLInputElement).value)}
              placeholder="e.g. Sunset Beach"
              className="bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
            <div className="flex gap-2.5 mt-2">
              <button
                id="save-project-submit"
                onClick={() => handleSaveProject(saveProjectName)}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2 rounded-lg cursor-pointer transition-colors"
              >
                Save
              </button>
              <button
                id="save-project-cancel"
                onClick={() => setSaveModalOpen(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold py-2 rounded-lg cursor-pointer transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Printable checklist container (only visible on print via media query) */}
      {wizardStep === 3 && matchResult && (
        <div className="legend-checklist-print-container hidden">
          <h2 className="text-sm font-bold mb-2 uppercase tracking-wider text-black border-b pb-1">Color Checklist Legend</h2>
          <div className="print-checklist-grid">
            {activeCandidates.map(c => {
              const symbol = symbolMap[c.dmc] || '';
              return (
                <div key={c.dmc} className="print-checklist-item">
                  <input type="checkbox" className="mr-2 h-4 w-4 border-gray-300 rounded cursor-pointer" readOnly />
                  <span className="font-mono text-xs w-6 text-center border border-slate-350 mr-2 rounded bg-slate-100 py-0.5 text-black font-bold">
                    {symbol}
                  </span>
                  <div className="w-4 h-4 border border-black mr-2 shrink-0" style={{ backgroundColor: c.hex }} />
                  <span className="font-mono text-xs font-semibold text-black">{c.dmc}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
