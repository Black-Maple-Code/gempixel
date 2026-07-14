import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { CanvasViewer } from './engine/viewer';
import { DMC_PALETTE } from './engine/palette';
import { compileShopifyCartLink, calculateCanvasCost, normalizeVendor, VENDOR_REGISTRY, type CanvasVendor } from './engine/checkout';
import { drawCanvasOnly, drawCombinedCanvasSheet, triggerCanvasDownload, FRAMER_MARGIN_CELLS } from './engine/export';
import { planOrderSupply, defaultPacketCost } from './engine/bagPlanner';
import { hasVariantMapping } from './engine/variants';
import { toCents, fromCents, formatUSD, sanitizeMoney } from './engine/money';
import { resolveActiveCandidates } from './engine/candidates';
import { projectStore, generateUUID, generateThumbnail, type ProjectSummary, type ProjectData, type RecentImage } from './engine/projectStore';
import { safeStorage } from './engine/safeStorage';
import { useDiamondArtMatch } from './features/match/useDiamondArtMatch';
import { useWizard } from './features/wizard/useWizard';
import { AtelierShell } from './features/wizard/AtelierShell';
import { Step1Ingest } from './features/wizard/steps/Step1Ingest';
import { Step2Palette } from './features/wizard/steps/Step2Palette';
import { Step3Canvas } from './features/wizard/steps/Step3Canvas';
import { Step4Export } from './features/wizard/steps/Step4Export';
import { usePersistentState, codecs } from './hooks/usePersistentState';
import type { Codec } from './hooks/usePersistentState';


// BAG-02/D-09/D-10: the single plain-language dye-lot "why" sentence. A STATIC
// string constant (no per-row/per-color computation) so the on-screen expander
// and the printable report can mirror the exact same copy trivially.
export const DYE_LOT_WHY_SENTENCE =
  'Colors needing 800 drills or fewer stay in single-lot 200-count bags so every dot in that color comes from one dye lot and matches, while only larger colors are consolidated into bigger bulk bags.';

// Default custom-canvas checkout URL template. Kept at module scope so the
// custom codec below can reference it as its parse fallback.
export const DEFAULT_CANVAS_TEMPLATE =
  'https://adiamondpainting.com/products/personalised-photo-custom-diamond-painting?size={size}&shape={shape}';

// canvasTemplate persists as a raw string but normalizes on read: an empty/
// whitespace stored value resolves to the default (WR-03 — restores the pre-
// migration `saved || DEFAULT` fallback, so a template-less/imported project
// that persisted '' recovers the default instead of a broken checkout URL),
// and the legacy heartfuldiamonds host maps to the current adiamondpainting
// default (RESEARCH Pitfall 4). serialize is identity so the on-disk format
// is unchanged.
export const customTemplateCodec: Codec<string> = {
  parse: (raw: string) =>
    !raw.trim() || raw.includes('heartfuldiamonds') ? DEFAULT_CANVAS_TEMPLATE : raw,
  serialize: (value: string) => value,
};


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

// Mapping-aware fixed-bag cost for a single grid color (WR-02). Mirrors the
// optimized branch and the Shopify cart: a color with NO drill variant mapped
// for the selected shape (hasVariantMapping === false) emits a $0 line —
// checkout.ts drops it and bagPlanner.packColor returns an empty pack, so the
// displayed total must reconcile to $0 for that color too. The +10% drill
// COUNT (safety) is preserved even when unmapped to match the optimized
// branch's Safety Margin column; only the purchasable bags and cost are zeroed.
// Mapped colors return exactly today's fixed-bag math (byte-for-byte unchanged).
export function calculateFixedBagCost(
  code: string,
  shape: 'square' | 'round',
  count: number,
  bagSize: number,
  packetCost: number
): { safety: number; packets: number; purchase: number; costExact: number; costSafety: number } {
  const metrics = calculateSafetyPurchase(count, bagSize);
  if (!hasVariantMapping(code, shape)) {
    // $0 line: no drill in the selected shape, matching the cart and the
    // optimized branch. Keep safety (drill count) non-zero; zero the rest.
    return { safety: metrics.safety, packets: 0, purchase: 0, costExact: 0, costSafety: 0 };
  }
  return {
    safety: metrics.safety,
    packets: metrics.packets,
    purchase: metrics.purchase,
    costExact: (count / bagSize) * packetCost,
    costSafety: metrics.packets * packetCost,
  };
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
  // Unified one-shot action-error banner (ERR-01). Surfaces imperative failures —
  // save quota-full (CR-02/B3, folded in from the former saveErrorMsg), download
  // generation failures, and a corrupt checkout unmapped-colors log. Each action
  // handler clears it at its start (clear-then-act) and it is dismissible.
  const [actionError, setActionError] = useState<string | null>(null);
  const [imagesDrawerOpen, setImagesDrawerOpen] = useState(false);
  // Step 1 "Source Image" disclosure — auto-collapses once an image is loaded so the
  // ingestion settings sit near the top without scrolling; user can reopen it.
  const [imageSourceOpen, setImageSourceOpen] = useState(true);

  const [unit, setUnit] = useState<'cm' | 'inch' | 'grid'>('grid');
  const [widthInput, setWidthInput] = useState<string>('80');
  const [heightInput, setHeightInput] = useState<string>('53');
  const [selectedPreset, setSelectedPreset] = useState<string>('custom');
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [excludeListOpen, setExcludeListOpen] = useState(false);
  const [recsOpen, setRecsOpen] = useState(true);
  const [supplyListOpen, setSupplyListOpen] = useState(true);
  // BAG-02/D-09: open/closed state for the a11y-safe "Why these bags?" dye-lot
  // explainer; follows the supplyListOpen progressive-disclosure idiom.
  const [viewportMode, setViewportMode] = useState<'grid' | 'symbols' | 'reference'>('grid');
  const [zoomScale, setZoomScale] = useState(1.0);

  // Dark mode is fully retired (Atelier light only). Clear the abandoned persisted
  // key once on boot so a returning dark-mode user carries no residue; routed
  // through the guarded storage boundary so a blocked store never throws.
  useEffect(() => {
    safeStorage.removeItem('gempixel_theme');
  }, []);
  const [sortBy, setSortBy] = useState<'color' | 'code' | 'name' | 'quantity'>('quantity');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [recentImages, setRecentImages] = useState<RecentImage[]>(() => projectStore.recents.list());

  const [recentUploadsOpen, setRecentUploadsOpen] = useState(true);

  // wizardStep state now lives in useWizard (wired below, after the match hook).
  const [imageFitMode, setImageFitMode] = useState<'cover' | 'contain'>('cover');
  const [drillStyle, setDrillStyle] = useState<'square' | 'round'>('square');
  const [selectedBaseKit, setSelectedBaseKit] = useState<'all' | '100' | '200'>('all');
  const [drillType, setDrillType] = useState<'standard' | 'ab' | 'glow' | 'crystal'>('standard');
  const [excludedColors, setExcludedColors] = useState<Set<string>>(new Set());
  const [highlightedColor, setHighlightedColor] = useState<string | null>(null);
  const [resourcesModalOpen, setResourcesModalOpen] = useState(false);
  
  // Match pipeline (worker lifecycle + derivations) lives in useDiamondArtMatch;
  // its { matchResult, symbolMap, loading, progress, restore } are wired in below.
  // Default ON — auto-substitute low-count colors unless the user opted out.
  const [enableSubstitution, setEnableSubstitution] = usePersistentState(
    'gempixel_enable_substitution', true, codecs.bool
  );
  // Default threshold 15 — colors with a count of 15 and below are substituted.
  const [substitutionThreshold, setSubstitutionThreshold] = usePersistentState(
    'gempixel_substitution_threshold', 15, codecs.int(15)
  );
  // Default ON (Light) — clean orphan drills / blotchy edges unless opted out.
  const [enableSmoothing, setEnableSmoothing] = usePersistentState(
    'gempixel_enable_smoothing', true, codecs.bool
  );
  // Default 1 (Light) — minimal shape change; user can push to Medium/Strong.
  const [smoothingStrength, setSmoothingStrength] = usePersistentState(
    'gempixel_smoothing_strength', 1, codecs.int(1)
  );
  // Lazy-init read migrated onto the guarded hook; the imperative checkout writes
  // (handleShopifyCheckout) are guarded in Plan 11-03 — untouched here.
  const [unmappedLog, setUnmappedLog] = usePersistentState<string[]>(
    'gempixel_unmapped_colors_log', [], codecs.stringArray()
  );

  const [selectedVendor, setSelectedVendor] = useState<CanvasVendor>('lumaprints');
  const [canvasBaseCost, setCanvasBaseCost] = useState(15.0);
  const [canvasShippingEstimate, setCanvasShippingEstimate] = useState(8.0);
  const [drillPacketCost, setDrillPacketCost] = useState(0.25);
  const [drillBagSize, setDrillBagSize] = useState<number>(200);
  const [priceDb, setPriceDb] = useState<Record<200 | 500 | 1000 | 2000, number>>({
    200: 0.60,
    500: 1.10,
    1000: 1.80,
    2000: 3.20
  });

  const updatePriceDb = (qty: 200 | 500 | 1000 | 2000, val: number) => {
    setPriceDb(prev => ({ ...prev, [qty]: val }));
  };

  // WR-01: when loadProject restores a project whose drillType differs from the
  // active one, it also restores that project's saved per-bag prices. The
  // drillType-keyed preset effect below would otherwise fire right after commit
  // and overwrite those restored prices with the type defaults — silently
  // discarding the persisted pricesPerBagSize. loadProject sets this ref so the
  // NEXT preset-effect run (the load-driven drillType change) is suppressed,
  // while interactive drill-type switches still apply their presets.
  const skipDrillPresetRef = useRef(false);

  const [affiliateTag, setAffiliateTag] = usePersistentState(
    'gempixel_affiliate_tag', '', codecs.string
  );
  const [affiliateApp, setAffiliateApp] = usePersistentState<'ref' | 'rfsn' | 'none'>(
    'gempixel_affiliate_app', 'ref', codecs.string as unknown as Codec<'ref' | 'rfsn' | 'none'>
  );
  const [canvasTemplate, setCanvasTemplate] = usePersistentState(
    'gempixel_canvas_template', DEFAULT_CANVAS_TEMPLATE, customTemplateCodec
  );

  useEffect(() => {
    if (!image && !activeProjectId) return;

    const w = parseFloat(widthInput);
    const h = parseFloat(heightInput);
    if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
      const cost = calculateCanvasCost(w, h, unit, selectedVendor);
      // Never set a $0 base cost on the null guard (T-15-01): an unknown vendor
      // must not silently zero out the canvas price.
      if (cost !== null) {
        setCanvasBaseCost(cost);
      }
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
    // WR-01: only arm the preset-skip when the load actually CHANGES drillType,
    // because the preset effect only fires on a real change. Arming it
    // unconditionally would leave the ref stuck true after a same-type load and
    // wrongly suppress the user's next interactive drill-type switch.
    const loadedDrillType = project.drillType || 'standard';
    if (loadedDrillType !== drillType) {
      skipDrillPresetRef.current = true;
    }
    setDrillType(loadedDrillType);
    setExcludedColors(new Set(project.excludedDmcCodes || []));
    setHighlightedColor(null);
    setCanvasBaseCost(project.kitBaseCost ?? 15.0);
    setDrillPacketCost(project.drillPacketCost ?? 0.25);
    setCanvasTemplate(project.canvasTemplate || '');
    setAffiliateTag(project.affiliateTag || '');
    setAffiliateApp(project.affiliateApp || 'ref');
    // Migrate any legacy/unknown persisted vendor (e.g. a removed vendor or a
    // tampered blob) to a valid CanvasVendor before it reaches the pricing engine
    // (VENDOR-02, T-15-02).
    setSelectedVendor(normalizeVendor((project as any).selectedVendor));
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
    setImageSourceOpen(true);
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
    setPriceDb({
      200: 0.60,
      500: 1.10,
      1000: 1.80,
      2000: 3.20
    });
    restore(null);
    wizard.reset();
  };

  const handleSaveProject = (name: string, forceNewId = false): boolean => {
    if (!name.trim()) return false;
    setActionError(null);

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
      gridData,
      selectedVendor
    };

    // CR-02/B3: on a quota failure, surface a warning and abort the "saved" side
    // effects — do NOT mark the project active or close the modal, since nothing
    // durable was persisted and other stored projects are left untouched.
    const result = projectStore.save(projectSummary, projectData);
    if (!result.ok) {
      setActionError('Storage is full. Delete a saved project to free space, then try again — your current work was not saved.');
      return false;
    }

    setProjectsRegistry(projectStore.list());

    setActiveProjectId(projectId);
    setSaveModalOpen(false);
    return true;
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

  const { matchResult, symbolMap, loading, progress, loadingPhase, restore, error: matchError } = useDiamondArtMatch({
    image,
    cols,
    rows,
    activeCandidates,
    enableSubstitution,
    substitutionThreshold,
    enableSmoothing,
    smoothingStrength,
  });

  const wizard = useWizard({
    hasImage: !!(image || activeProjectId),
    hasMatch: !!matchResult,
    isTestEnv,
  });

  const { leftLegendColors, rightLegendColors } = useMemo(() => {
    // The printable/exported legend is a KEY for the grid, so it must list only
    // the colors actually used in the (smoothed) grid and in the SAME order the
    // grid symbols are assigned — most-used first. That makes it read A, B, C…
    // top-to-bottom with every swatch's symbol matching the grid exactly.
    // (Previously this listed the entire kit in DMC order, so unused colors —
    // which fall through to the glyph tier — dominated and hid the letters.)
    const counts = matchResult?.counts || {};
    const used = Object.keys(counts)
      .sort((a, b) => {
        // Mirror generateSymbolAllocation: frequency desc, alphabetical tie-break.
        if (counts[b] !== counts[a]) return counts[b] - counts[a];
        return a.localeCompare(b);
      })
      .map(dmc => {
        const info =
          activeCandidates.find(c => c.dmc === dmc) || DMC_PALETTE.find(c => c.dmc === dmc);
        return { dmc, hex: info?.hex || '#2D3748' };
      });
    const mid = Math.ceil(used.length / 2);
    return {
      leftLegendColors: used.slice(0, mid),
      rightLegendColors: used.slice(mid)
    };
  }, [matchResult, activeCandidates]);

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

  // Push CSS-var canvas tokens into the viewer (canvas can't read CSS vars itself).
  // The real theme->canvas mechanism: :root now always resolves to Atelier light.
  // PHASE 22: remove theme param — the `theme` dep was dropped when dark mode retired.
  useEffect(() => {
    if (!viewerRef.current) return;
    const styles = getComputedStyle(document.documentElement);
    viewerRef.current.setRoundBacking(styles.getPropertyValue('--drill-round-backing').trim());
    viewerRef.current.setGridGap(styles.getPropertyValue('--canvas-gap').trim());
  }, [image, matchResult, drillStyle]);

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
    // WR-01: a load-driven drillType change must NOT overwrite the project's
    // just-restored per-bag prices / packet cost with the type defaults. Consume
    // the one-shot skip flag and preserve the restored values.
    if (skipDrillPresetRef.current) {
      skipDrillPresetRef.current = false;
      return;
    }
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
        setImageSourceOpen(false);

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
      setImageSourceOpen(false);
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

  // BAG-03/D-10: "Print Supply Report" isolates a self-contained supply report
  // (header + static savings/why banner + per-color supply table + reconciled
  // proposed total) via its own print-only mode, mirroring the proven
  // print-only-legend-mode pattern. The plain @media print path hid the report
  // (it lived inside <aside>, which @media print sets display:none), so the
  // button previously printed the canvas grid instead of a report — this mode
  // reveals ONLY the .supply-report-print-container. Cleanup on afterprint.
  const printReport = () => {
    document.body.classList.add('print-only-report-mode');
    window.print();
    const cleanup = () => {
      document.body.classList.remove('print-only-report-mode');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
  };

  const handleDownloadCanvasOnly = async () => {
    if (!matchResult) return;
    setActionError(null);
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
      setActionError('Could not generate the download. Please try again.');
    }
  };

  const handleDownloadCombinedCanvasSheet = async () => {
    if (!matchResult) return;
    setActionError(null);
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
      setActionError('Could not generate the download. Please try again.');
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

  // BAG-02/D-13: the legend, per-color bags, total bag count and total cost are all
  // computed by the SHARED order aggregator (planOrderSupply), not an inline App.tsx
  // reduction — so the legend estimate, the Shopify cart, and the Phase 17 order
  // packet can never diverge. Called ONCE; the aggregator is pure (no palette
  // name/hex lookup and no sort), so the DMC_PALETTE join and the existing sort stay
  // here in the component.
  const orderPlan = planOrderSupply(matchResult?.counts || {}, drillStyle, priceDb);

  // Calculate sorted legend table rows
  const sortedMatches = orderPlan.rows
    .map(row => {
      const { code } = row;
      const count = matchResult?.counts[code] ?? 0;
      const colorInfo = DMC_PALETTE.find(c => c.dmc === code);
      const name = colorInfo?.name || 'Unknown DMC Color';
      const hex = colorInfo?.hex || '#2D3748';

      // +10% safety drill count (unchanged Safety Marg. column semantics).
      const safety = Math.ceil(Math.round(count * 110) / 100);

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
        optimizedBags: row.safety.bySize,
        hasUnpricedSize: row.hasUnpricedSize // PRICE-02: color coverable only by an unpriced size
      };
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
  // SC2/BAG-02: the total bag count is sourced from the shared aggregator's
  // totalPackets (sum of the per-color SAFETY packets), NOT a stale inline sum, and
  // is rendered user-visibly as the "Drills ({totalPackets} bag(s))" line.
  const totalPackets = orderPlan.totalPackets;

  // PRICE-03: the itemized drill cost comes from the aggregator's integer-cents
  // optimizedCostCents; the displayed total then reconciles the canvas base +
  // shipping into it in integer cents (via money.ts) so there is no IEEE-754 float
  // drift between the drill lines and the total.
  const safetyDrillCostCents = orderPlan.optimizedCostCents;
  // CR-01: belt-and-suspenders finite guard. The onInput handlers already
  // sanitize live edits, but a tampered/imported project whose kitBaseCost is
  // non-finite (or a string) reaches this line via loadProject — `??` only
  // guards null/undefined — and toCents throws on non-finite input, which would
  // white-screen the render body. sanitizeMoney clamps to a finite, non-negative
  // dollar amount before toCents ever sees it.
  const totalCostSafetyCents =
    toCents(sanitizeMoney(canvasBaseCost)) +
    toCents(sanitizeMoney(canvasShippingEstimate)) +
    safetyDrillCostCents;
  const safetyDrillCost = fromCents(safetyDrillCostCents);
  const totalCostSafety = fromCents(totalCostSafetyCents);

  // BAG-03/D-08: always-on savings headline sourced from the SHARED aggregator's
  // savingsCents/savingsPct (already integer-cents and clamped >= 0 in 16-02) —
  // formatted ONCE here via money.ts formatUSD and never recomputed. This single
  // string feeds both the on-screen Step3Canvas headline and the static print
  // mirror (D-10) so the two can never diverge. When there are no bulk savings
  // (small-color plans), a truthful zero-state line renders rather than hiding.
  const savingsHeadline =
    orderPlan.savingsCents > 0
      ? `Save ${formatUSD(orderPlan.savingsCents)} (${orderPlan.savingsPct}%) vs per-color`
      : 'No bulk savings at this size';

  // PRICE-02: a color coverable only by an unpriced bag size is surfaced through
  // the existing actionError banner (never rendered as a free $0 line). Derived
  // here; applied in an effect below so we never setState during render.
  const unpricedColorCodes = orderPlan.unpricedColorCodes;
  const unpricedColorsKey = unpricedColorCodes.join(',');

  // DATA-01: a grid color with NO drill variant mapped for the currently selected
  // shape (an allow-listed data hole, e.g. 471 while drillStyle='square') would
  // otherwise vanish from the supply plan. Surface it via the SAME banner so it is
  // never silently dropped (threat T-15-08). Derived here; applied in the effect
  // below so we never setState during render.
  const unmappedShapeCodes = Object.keys(matchResult?.counts || {})
    .filter(code => !hasVariantMapping(code, drillStyle));
  const unmappedShapeKey = unmappedShapeCodes.join(',');

  // Only THIS derived warning is managed on the shared actionError banner; track the
  // last value we set so the effect can clear its own stale warning (WR-01) without
  // clobbering an unrelated storage/download/checkout error that is currently showing.
  const derivedActionWarningRef = useRef<string | null>(null);
  useEffect(() => {
    const messages: string[] = [];
    if (unpricedColorsKey) {
      const codes = unpricedColorsKey.split(',').join(', ');
      messages.push(
        `Some colors have an unpriced bag size and were left out of the total: ${codes} — price them to include an accurate cost.`
      );
    }
    if (unmappedShapeKey) {
      const codes = unmappedShapeKey.split(',').join(', ');
      // WR-02: state the fact (no drills available for this shape) without claiming the
      // color was excluded from the total — in fixed-bag mode it is still billed.
      messages.push(
        `These colors have no ${drillStyle} drills available: ${codes} — switch drill shape or exclude them.`
      );
    }
    const next = messages.length > 0 ? messages.join(' ') : null;
    const prevDerived = derivedActionWarningRef.current;
    derivedActionWarningRef.current = next;
    // Reactively clear/replace our own warning; leave any unrelated error untouched.
    setActionError(current => (current === prevDerived || current === null ? next : current));
  }, [unpricedColorsKey, unmappedShapeKey, drillStyle]);

  const [checkoutWarning, setCheckoutWarning] = useState<{
    url: string;
    isUrlTooLong: boolean;
    unmappedItems: Array<{ dmcCode: string; handle: string }>;
  } | null>(null);

  const handleShopifyCheckout = () => {
    if (!matchResult) return;
    setActionError(null);
    const items = Object.entries(matchResult.counts).map(([code, count]) => {
      const safety = Math.ceil(Math.round(count * 110) / 100);
      return {
        dmcCode: code,
        shape: drillStyle,
        requiredCount: safety
      };
    });

    const result = compileShopifyCartLink(items, affiliateTag, affiliateApp, priceDb);
    
    if (result.unmappedItems.length > 0) {
      // Guard the stored-log read (W4 / T-11-06): a corrupt value (another tab or a
      // manual edit) must not throw and silently kill checkout. On parse failure we
      // fall back to [] and surface the banner — checkout still proceeds. Read/write
      // route through safeStorage so a blocked/private-mode store never throws.
      const savedLog: string[] = (() => {
        const raw = safeStorage.getItem('gempixel_unmapped_colors_log');
        try {
          const parsed = JSON.parse(raw ?? '[]');
          // Shape-check inside the guard (WR-02): a valid-JSON non-array (stored '5'
          // -> 5, '{}' -> {}) parses without throwing, then the spread below would
          // do [...5] and throw OUTSIDE this try. Reject non-arrays so the fallback
          // actually applies and checkout proceeds with [].
          if (!Array.isArray(parsed)) throw new Error('not an array');
          return parsed as string[];
        } catch {
          setActionError('Could not read the saved unmapped-colors log; continuing without it.');
          return [];
        }
      })();
      const newCodes = result.unmappedItems.map(item => item.dmcCode);
      const updatedLog = Array.from(new Set([...savedLog, ...newCodes]));
      safeStorage.setItem('gempixel_unmapped_colors_log', JSON.stringify(updatedLog));
      setUnmappedLog(updatedLog);
    }
    
    if (result.isUrlTooLong || result.unmappedItems.length > 0) {
      setCheckoutWarning(result);
    } else {
      window.open(result.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <AtelierShell
      step={wizard.step}
      canEnter={wizard.canEnter}
      goTo={wizard.goTo}
      onSave={() => {
        setSaveProjectName(activeProjectId ? (projectsRegistry.find(p => p.id === activeProjectId)?.name || '') : `Diamond Art ${projectsRegistry.length + 1}`);
        setSaveModalOpen(true);
      }}
      canSave={!!matchResult}
    >
    <div className="flex flex-1 min-h-0 w-screen bg-slate-950 text-slate-100 overflow-hidden print:h-auto print:overflow-visible">
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
        {wizard.step === 1 && (
          <Step1Ingest
            image={image}
            imageName={imageName}
            dropZoneRef={dropZoneRef}
            isDragOver={isDragOver}
            imageSourceOpen={imageSourceOpen}
            setImageSourceOpen={setImageSourceOpen}
            recentImages={recentImages}
            recentUploadsOpen={recentUploadsOpen}
            setRecentUploadsOpen={setRecentUploadsOpen}
            imageFitMode={imageFitMode}
            setImageFitMode={setImageFitMode}
            standardSizes={STANDARD_SIZES}
            selectedPreset={selectedPreset}
            setSelectedPreset={setSelectedPreset}
            unit={unit}
            setUnit={setUnit}
            widthInput={widthInput}
            heightInput={heightInput}
            setWidthInput={setWidthInput}
            setHeightInput={setHeightInput}
            cols={cols}
            rows={rows}
            setCols={setCols}
            setRows={setRows}
            drillStyle={drillStyle}
            setDrillStyle={setDrillStyle}
            recsOpen={recsOpen}
            setRecsOpen={setRecsOpen}
            handleFileChange={handleFileChange}
            handleDragOver={handleDragOver}
            handleDragLeave={handleDragLeave}
            handleDrop={handleDrop}
            loadRecentImage={loadRecentImage}
            deleteRecentImage={deleteRecentImage}
            handlePresetChange={handlePresetChange}
            handleUnitChange={handleUnitChange}
            handleWidthChange={handleWidthChange}
            handleHeightChange={handleHeightChange}
          />
        )}

        {wizard.step === 2 && (
          <Step2Palette
            selectedBaseKit={selectedBaseKit}
            setSelectedBaseKit={setSelectedBaseKit}
            setExcludedColors={setExcludedColors}
            drillType={drillType}
            setDrillType={setDrillType}
            enableSubstitution={enableSubstitution}
            setEnableSubstitution={setEnableSubstitution}
            substitutionThreshold={substitutionThreshold}
            setSubstitutionThreshold={setSubstitutionThreshold}
            enableSmoothing={enableSmoothing}
            setEnableSmoothing={setEnableSmoothing}
            smoothingStrength={smoothingStrength}
            setSmoothingStrength={setSmoothingStrength}
            excludeListOpen={excludeListOpen}
            setExcludeListOpen={setExcludeListOpen}
            excludedColors={excludedColors}
            baseCandidates={baseCandidates}
            handleSelectAll={handleSelectAll}
            handleDeselectAll={handleDeselectAll}
            toggleColorExclusion={toggleColorExclusion}
            sortedMatches={sortedMatches}
            highlightedColor={highlightedColor}
            handleRowClick={handleRowClick}
          />
        )}

        {wizard.step === 3 && (
          <Step3Canvas
            selectedVendor={selectedVendor}
            setSelectedVendor={setSelectedVendor}
            canvasBaseCost={canvasBaseCost}
            setCanvasBaseCost={setCanvasBaseCost}
            canvasShippingEstimate={canvasShippingEstimate}
            setCanvasShippingEstimate={setCanvasShippingEstimate}
            priceDb={priceDb}
            updatePriceDb={updatePriceDb}
            totalSafetyDrills={totalSafetyDrills}
            totalPackets={totalPackets}
            safetyDrillCost={safetyDrillCost}
            totalCostSafety={totalCostSafety}
            savingsHeadline={savingsHeadline}
            matchResult={matchResult}
            sizingAdviceData={sizingAdviceData}
            affiliateTag={affiliateTag}
            setAffiliateTag={setAffiliateTag}
            affiliateApp={affiliateApp}
            setAffiliateApp={setAffiliateApp}
            unmappedLog={unmappedLog}
            setUnmappedLog={setUnmappedLog}
            handleShopifyCheckout={handleShopifyCheckout}
            handleDownloadCanvasOnly={handleDownloadCanvasOnly}
            handleDownloadCombinedCanvasSheet={handleDownloadCombinedCanvasSheet}
            printLegendSheetOnly={printLegendSheetOnly}
            printReport={printReport}
          />
        )}

        {wizard.step === 4 && (
          <Step4Export
            cols={cols}
            rows={rows}
            unit={unit}
            matchResult={matchResult}
            drillStyle={drillStyle}
            drillType={drillType}
            totalSafetyDrills={totalSafetyDrills}
            totalCostSafety={totalCostSafety}
            saveProjectName={saveProjectName}
            setSaveProjectName={setSaveProjectName}
            activeProjectId={activeProjectId}
            saveSuccessMsg={saveSuccessMsg}
            handleSaveProject={handleSaveProject}
            showSaveSuccess={showSaveSuccess}
            resetWorkspace={resetWorkspace}
          />
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
          </div>
        </div>
      </div>

      {/* Sticky wizard navigation footer */}
      <div className="mt-auto pt-4 border-t border-slate-800/60 shrink-0 no-print flex flex-col gap-4 bg-slate-900/60 px-1 pb-1">
        <div className="flex items-center justify-between">
          {wizard.step > 1 ? (
            <button
              id="wizard-back-btn"
              onClick={wizard.back}
              className="text-xs font-bold text-slate-450 hover:text-slate-200 cursor-pointer transition-colors"
            >
              &lt; Back
            </button>
          ) : (
            <div className="text-xs font-bold text-slate-700/0 select-none cursor-default w-[42px]">&nbsp;</div>
          )}

          {wizard.step < 4 ? (
            <button
              id="wizard-next-btn"
              onClick={wizard.next}
              disabled={!wizard.canEnter(wizard.step + 1)}
              className="bg-accent text-on-accent px-3 py-1.5 rounded-md text-xs font-bold hover:brightness-110 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-all"
            >
              Next Step →
            </button>
          ) : (
            <div className="text-xs font-bold text-indigo-750/0 select-none cursor-default w-[72px]">&nbsp;</div>
          )}
        </div>
      </div>
    </aside>

    {/* Main Canvas Area */}
    <main className="flex-1 relative flex flex-col min-w-0 print:block">

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
            className="absolute top-16 right-4 z-50 flex items-center gap-2 pl-2 pr-3 py-2 bg-panel hover:bg-border text-ink rounded-lg shadow-xl border border-border transition-all duration-200 cursor-pointer hidden md:flex hover:scale-105 active:scale-95"
            title="Expand color legend"
          >
            <svg className="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M11 19l-7-7 7-7M17 19l-7-7 7-7" />
            </svg>
            <div className="flex flex-col items-start leading-tight">
              <span className="text-xs font-bold text-ink">Color Legend</span>
              <span className="text-[9px] font-mono text-muted uppercase tracking-wider">{sortedMatches.length} colors</span>
            </div>
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
                  <div className="px-2 py-1 rounded bg-warn/15 border border-warn/40 text-warn text-[10px] font-bold select-none cursor-default flex items-center gap-1 whitespace-nowrap animate-pulse">
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
                onClick={() => setActionError(null)}
                className="shrink-0 -mr-1 -mt-0.5 px-1 text-rose-300 hover:text-rose-100 transition-colors text-sm leading-none"
              >
                ×
              </button>
            </div>
          )}
        </div>
      </main>
      {/* Right Sidebar Checklist & Legend */}
      <aside
        className={`bg-panel border-l border-slate-800/80 flex flex-col overflow-hidden print:w-full print:border-l-0 print:bg-white print:text-black print:overflow-visible print:h-auto shrink-0 transition-all duration-300 relative ${
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
                    <th className="py-1.5 px-1 text-right text-ellipsis overflow-hidden truncate" title="Optimized combinations of 200, 500, 1000, 2000 bags">Bags (Opt)</th>
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
                          <div className="flex flex-col items-end leading-none">
                            <span className="text-[9.5px] text-slate-200">{row.bagsText}</span>
                            <span className="text-[8px] text-slate-500 font-normal font-sans">({row.purchase} pcs)</span>
                          </div>
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
                {/* WR-02: totalPackets sums mixed-size bags (200/500/1000/2000)
                    from the optimizer, so a "200-ct" qualifier misrepresents it.
                    Use a size-neutral label; per-row bagsText carries the sizes. */}
                <span className="text-muted uppercase tracking-wider">Bags</span>
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
      {wizard.step === 3 && matchResult && (
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

      {/* BAG-03/BAG-02 · D-08/D-10: printable "GemPixel Supply Plan Report" — the
          "Print Supply Report" button's output, isolated via print-only-report-mode.
          Self-contained: header, a STATIC savings/why banner (independent of the
          on-screen expander state), a per-color supply table, and the reconciled
          proposed total (integer cents via money.ts). Always in the DOM (hidden by
          default; revealed only in report print mode) so the printed report never
          depends on the wizard step or the on-screen expander. */}
      <div className="supply-report-print-container hidden">
        <h1 className="supply-report-title">GemPixel Supply Plan Report</h1>
        <div className="supply-report-savings">
          <p className="supply-report-headline">{savingsHeadline}</p>
          <p className="supply-report-why">{DYE_LOT_WHY_SENTENCE}</p>
        </div>
        <table className="supply-report-table">
          <thead>
            <tr>
              <th>Color</th>
              <th>DMC</th>
              <th>Color Name</th>
              <th className="num">Exact Dots</th>
              <th className="num">Safety (+10%)</th>
              <th className="num">Recommended Bags</th>
            </tr>
          </thead>
          <tbody>
            {sortedMatches.map(row => (
              <tr key={row.code}>
                <td>
                  <span className="supply-report-swatch" style={{ backgroundColor: row.hex }} />
                </td>
                <td className="mono">
                  {row.code}
                  {drillType !== 'standard' ? ' ' + (drillType === 'ab' ? 'AB' : drillType === 'glow' ? 'Glow' : 'Crystal') : ''}
                </td>
                <td>{row.name}</td>
                <td className="num">{row.count}</td>
                <td className="num">{row.safety}</td>
                <td className="num">{row.bagsText} ({row.purchase} pcs)</td>
              </tr>
            ))}
            {sortedMatches.length === 0 && (
              <tr>
                <td colSpan={6} className="supply-report-empty">Load an image to compute your supply plan.</td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="supply-report-total">Proposed total: {formatUSD(totalCostSafetyCents)}</p>
      </div>
    </div>
    </AtelierShell>
  );
}
