import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { CanvasViewer } from './engine/viewer';
import { DMC_PALETTE } from './engine/palette';
import { compileShopifyCartLink, calculateCanvasCost, normalizeVendor, VENDOR_REGISTRY, type CanvasVendor } from './engine/checkout';
import { drawCanvasOnly, drawCombinedCanvasSheet, triggerCanvasDownload, FRAMER_MARGIN_CELLS } from './engine/export';
import { planOrderSupply, defaultPacketCost } from './engine/bagPlanner';
import { buildOrderQuote } from './engine/quote';
import { gridToInches, formatInches } from './engine/density';
import { hasVariantMapping } from './engine/variants';
import { toCents, fromCents, formatUSD, sanitizeMoney } from './engine/money';
import { resolveActiveCandidates } from './engine/candidates';
import { projectStore, generateUUID, generateThumbnail, type ProjectSummary, type ProjectData, type RecentImage } from './engine/projectStore';
import { safeStorage } from './engine/safeStorage';
import { useDiamondArtMatch } from './features/match/useDiamondArtMatch';
import { useWizard } from './features/wizard/useWizard';
import { AtelierShell } from './features/wizard/AtelierShell';
import { CanvasWorkspace } from './features/wizard/CanvasWorkspace';
import { Step3Canvas } from './features/wizard/steps/Step3Canvas';
import { USE_NEW_SUPPLIES } from './features/screens/flags';
import { UploadScreen } from './features/screens/UploadScreen';
import { RefineScreen, type RefineScreenProps } from './features/screens/RefineScreen';
import { SuppliesScreen, type SuppliesScreenProps } from './features/screens/SuppliesScreen';
import { OrderScreen, type OrderScreenProps } from './features/screens/OrderScreen';
import {
  buildOrderPacket,
  LOCKED_CANVAS_PRODUCT,
  type OrderFinish,
  type OrderPacketShipTo,
} from './features/screens/orderPacket';
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


// Minimum grid dimension for an auto-recompute. Mirrors the ingest/width-height
// clamp lower bound (`Math.max(1, …)`), so a half-typed / degenerate custom size
// never fires a garbage worker run (D-02 clamp-guard).
export const MIN_GRID = 1;

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

/**
 * Curated Refine SizeCard presets (REFINE-01, D-05). A small recommendation set in
 * GRID dims — deliberately NOT the mixed cm/inch/grid STANDARD_SIZES above (RESEARCH
 * Q2). App derives each card's true inches (via gridToInches/formatInches, 2.5mm/dot)
 * and live drill count and passes them as props; the card renders, never derives
 * (Pattern 2). Anything off this list is reachable through the custom-size entry
 * (REFINE-02). "Medium" (80×53) is the default recommendation and carries the BEST tag.
 */
export const REFINE_SIZE_PRESETS: Array<{ label: string; cols: number; rows: number; tag?: string }> = [
  { label: 'Small', cols: 60, rows: 40 },
  { label: 'Medium', cols: 80, rows: 53, tag: 'BEST' },
  { label: 'Large', cols: 110, rows: 73 },
  { label: 'Extra large', cols: 140, rows: 93 },
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

  // D-02: the COMMITTED match inputs the worker actually consumes. Live image/cols/rows
  // drive the editing UI; these advance only on an intentional commit (fresh upload,
  // project load, reset, or an auto-fired recompute — SizeCard-immediate / custom-size
  // debounced). Keeping a separate committed snapshot means the expensive/abort-race-prone
  // match runs once per commit, and the last-good grid renders until the fresh one lands.
  const [matchInputs, setMatchInputs] = useState<{ image: HTMLImageElement | null; cols: number; rows: number }>(
    { image: null, cols: 80, rows: 53 }
  );

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>('');
  const [projectsRegistry, setProjectsRegistry] = useState<ProjectSummary[]>(() => projectStore.list());
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveProjectName, setSaveProjectName] = useState('');
  // Unified one-shot action-error banner (ERR-01). Surfaces imperative failures —
  // save quota-full (CR-02/B3, folded in from the former saveErrorMsg), download
  // generation failures, and a corrupt checkout unmapped-colors log. Each action
  // handler clears it at its start (clear-then-act) and it is dismissible.
  const [actionError, setActionError] = useState<string | null>(null);

  const [unit, setUnit] = useState<'cm' | 'inch' | 'grid'>('grid');
  const [widthInput, setWidthInput] = useState<string>('80');
  const [heightInput, setHeightInput] = useState<string>('53');
  // selectedPreset is no longer read by any live screen (legacy Step1Ingest showed it);
  // the setter is retained because live size-change handlers still reset it to 'custom'.
  const [, setSelectedPreset] = useState<string>('custom');
  const [viewportMode, setViewportMode] = useState<'grid' | 'symbols' | 'reference'>('grid');
  const [zoomScale, setZoomScale] = useState(1.0);

  // Dark mode is fully retired (Atelier light only). Clear the abandoned persisted
  // key once on boot so a returning dark-mode user carries no residue; routed
  // through the guarded storage boundary so a blocked store never throws.
  useEffect(() => {
    safeStorage.removeItem('gempixel_theme');
  }, []);
  // Legend sort is retired with the right Color-Legend aside (Plan 08); the
  // supply order is the stable default (quantity desc). Kept as read-only values
  // so sortedMatches stays deterministic; the interactive sort setters are gone.
  const [sortBy] = useState<'color' | 'code' | 'name' | 'quantity'>('quantity');
  const [sortAsc] = useState<boolean>(false);
  const [recentImages, setRecentImages] = useState<RecentImage[]>(() => projectStore.recents.list());

  // wizardStep state now lives in useWizard (wired below, after the match hook).
  const [drillStyle, setDrillStyle] = useState<'square' | 'round'>('square');
  const [selectedBaseKit, setSelectedBaseKit] = useState<'all' | '100' | '200'>('all');
  const [drillType, setDrillType] = useState<'standard' | 'ab' | 'glow' | 'crystal'>('standard');
  const [excludedColors, setExcludedColors] = useState<Set<string>>(new Set());
  const [highlightedColor, setHighlightedColor] = useState<string | null>(null);
  const [resourcesModalOpen, setResourcesModalOpen] = useState(false);

  // ORDER-01/02 (D-08/D-09): Order-screen-only state. App stays sole state owner
  // (D-01); the pure OrderScreen reads these via props. `finish` is a fixed UI enum
  // with NO price impact (RESEARCH Q3); `shipTo` is CLIENT-SIDE only — embedded in
  // the downloaded packet and NEVER transmitted (D-08). `packetDownloaded` drives
  // the honest terminal confirmation (no order number / receipt / payment — D-09).
  const [finish, setFinish] = useState<OrderFinish>('trimmed');
  const [shipTo, setShipTo] = useState<OrderPacketShipTo>({
    name: '',
    addressLine1: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
  });
  const [packetDownloaded, setPacketDownloaded] = useState(false);

  // Match pipeline (worker lifecycle + derivations) lives in useDiamondArtMatch;
  // its { matchResult, symbolMap, loading, progress, restore } are wired in below.
  // Default ON — auto-substitute low-count colors unless the user opted out.
  const [enableSubstitution] = usePersistentState(
    'gempixel_enable_substitution', true, codecs.bool
  );
  // Default threshold 15 — colors with a count of 15 and below are substituted.
  const [substitutionThreshold] = usePersistentState(
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
  // REFINE-04 (D-03/D-04) target-N color reduction — the post-process tier the
  // Refine color slider drives. OFF by default so matchResult stays byte-identical
  // to the pre-reducer pipeline (SC5); flips on the moment the user lowers the
  // slider below detectedColorCount. targetColorCount is a large sentinel until
  // then so the slider thumb sits at the top (= a no-op reduce ceiling).
  const [enableReduce, setEnableReduce] = useState(false);
  const [targetColorCount, setTargetColorCount] = useState<number>(256);
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
    // D-13: a project load is a complete-state commit (its match is restored below),
    // so align the committed match inputs with the restored dims — never "stale" on load.
    setMatchInputs({ image: null, cols: project.dimensions.cols, rows: project.dimensions.rows });
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
    // Sanitize money-typed loads to a finite, non-negative NUMBER at the state
    // boundary. `??` only guards null/undefined, so a tampered/imported value
    // (e.g. the string '1e999') would otherwise reach the always-mounted
    // Step3Canvas panel (D-14) and throw on `.toFixed()` (CR-01). Clamping here
    // keeps the eagerly-rendered panel robust without touching the Step body.
    setCanvasBaseCost(sanitizeMoney(project.kitBaseCost ?? 15.0));
    setDrillPacketCost(sanitizeMoney(project.drillPacketCost ?? 0.25));
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

    // WR-01: Order state is per-workspace and must NOT leak across a project load.
    // Reset the finish, the client-entered ship-to (PII — never carry one project's
    // address into another's form), and the packet-downloaded terminal flag (a false
    // "already downloaded" state for a project the user never downloaded).
    setFinish('trimmed');
    setShipTo({ name: '', addressLine1: '', city: '', state: '', postalCode: '', country: '' });
    setPacketDownloaded(false);

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
    // D-13: reset clears the committed match inputs too (no residual stale state).
    setMatchInputs({ image: null, cols: 80, rows: 53 });
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
    // WR-01: clear per-workspace Order state on reset too (finish + client-entered
    // ship-to PII + the packet-downloaded terminal flag) — a fresh workspace must
    // never inherit the previous one's address or a stale "downloaded" state.
    setFinish('trimmed');
    setShipTo({ name: '', addressLine1: '', city: '', state: '', postalCode: '', country: '' });
    setPacketDownloaded(false);
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
      // HI-01: gridData below comes from the COMMITTED matchResult, so the saved
      // dimensions must be the committed dims (matchInputs), not the live cols/rows.
      // Otherwise a Save during the D-13 stale window (resized but not yet recomputed)
      // persists a grid whose size disagrees with its stored dimensions — it renders
      // wrong on reload. With no match there is no grid to disagree with, so use live.
      dimensions: matchResult ? { cols: matchInputs.cols, rows: matchInputs.rows } : { cols, rows },
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

  const { matchResult, detectedColorCount, symbolMap, loading, progress, loadingPhase, restore, error: matchError } = useDiamondArtMatch({
    // D-13: the worker consumes the COMMITTED inputs, not the live ones — so an
    // upstream edit (size/image) after a match does not silently re-fire the worker.
    image: matchInputs.image,
    cols: matchInputs.cols,
    rows: matchInputs.rows,
    activeCandidates,
    enableSubstitution,
    substitutionThreshold,
    enableSmoothing,
    smoothingStrength,
    // REFINE-04 post-process tier (D-03/D-04): these live ONLY in the hook's
    // matchResult memo deps, never the worker effect (image/cols/rows/candidatesKey),
    // so the color slider re-renders on the main thread with no worker re-fire.
    enableReduce,
    targetColorCount,
  });

  const wizard = useWizard({
    hasImage: !!(image || activeProjectId),
    hasMatch: !!matchResult,
    isTestEnv,
  });

  // The dimensions the on-screen match actually corresponds to (the COMMITTED match
  // inputs). The canvas/exports render at these dims, so a dimension change that is
  // still being recomputed keeps showing the last-good grid coherently until the fresh
  // one lands — the two-phase loading overlay covers that pending window.
  const matchCols = matchInputs.cols;
  const matchRows = matchInputs.rows;

  // D-02 auto-recompute: commit the given (or current live) inputs. Committing makes
  // the match hook — which keys on matchInputs — fire the EXISTING match effect exactly
  // once (no new worker path, no B2 abort-race re-entry). Callers pass the freshly
  // computed cols/rows explicitly so the commit never reads stale React state from the
  // same tick as the setCols/setRows that scheduled it. The last-good match stays on
  // screen until the fresh one lands.
  const handleRecomputeMatch = (nextCols: number = cols, nextRows: number = rows) => {
    setActionError(null);
    // ME-01: without a live source image there is nothing to recompute. Committing
    // would let the worker bail on the null image and silently strand a mismatched
    // grid, so keep the last-good match and prompt a re-upload instead.
    if (!image) {
      setActionError('Re-upload the source image to recompute the match.');
      return;
    }
    setMatchInputs({ image, cols: nextCols, rows: nextRows });
  };

  // D-02: a valid custom-size edit auto-recomputes on a ~500ms debounce so rapid
  // keystrokes ("1" → "15" → "150") collapse into a single worker run. The clamp-guard
  // (MIN_GRID + a live image) means a half-typed or imageless value never fires.
  const customRecomputeTimerRef = useRef<number | null>(null);
  const scheduleCustomRecompute = (nextCols: number, nextRows: number) => {
    if (customRecomputeTimerRef.current !== null) {
      clearTimeout(customRecomputeTimerRef.current);
    }
    customRecomputeTimerRef.current = window.setTimeout(() => {
      customRecomputeTimerRef.current = null;
      if (image && nextCols >= MIN_GRID && nextRows >= MIN_GRID) {
        handleRecomputeMatch(nextCols, nextRows);
      }
    }, 500);
  };

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
      if (customRecomputeTimerRef.current !== null) {
        clearTimeout(customRecomputeTimerRef.current);
        customRecomputeTimerRef.current = null;
      }
    };
  }, []);

  const lastFitProjectRef = useRef<string | null>(null);
  // Tracks the committed dims the canvas last fitted to, so a dimension change
  // (SizeCard / custom size) re-fits the viewport cleanly once — riding the Plan 03
  // isFitMode resting state — without a post-process slider tick ever re-fitting (D-04).
  const lastFitDimsRef = useRef<string | null>(null);

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
      // Draw the grid at the COMMITTED match dimensions so an in-flight recompute keeps
      // rendering the last-good grid coherently until the fresh one lands.
      viewerRef.current.setData(matchCols, matchRows, matchResult.matches, colorMap);
      viewerRef.current.setDrillStyle(drillStyle);
      viewerRef.current.setHighlightedColor(highlightedColor);
      viewerRef.current.setDrillType(drillType);
      viewerRef.current.setViewMode(viewportMode);
      viewerRef.current.setSymbolMap(symbolMap);

      // Auto-fit on first load of a new image, on a project switch, OR on a committed
      // dimension change (D-02/D-04). The fit math keys on the grid dims alone, so
      // fitting here — after setData installs the new dims — re-fits cleanly with no
      // zoom-jump. A post-process slider tick (same dims) never re-fits.
      const fitDimsKey = `${matchCols}x${matchRows}`;
      if (
        lastFitImageRef.current !== image ||
        (activeProjectId && lastFitProjectRef.current !== activeProjectId) ||
        lastFitDimsRef.current !== fitDimsKey
      ) {
        viewerRef.current.fitToContainer();
        lastFitImageRef.current = image;
        lastFitProjectRef.current = activeProjectId;
        lastFitDimsRef.current = fitDimsKey;
      }
    }
  }, [image, matchResult, activeCandidates, drillStyle, highlightedColor, matchCols, matchRows, drillType, activeProjectId, viewportMode, symbolMap]);

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

  // Re-fit the single-mount canvas when Refine (step 2) becomes the visible screen.
  // The canvas <main> is display:none on Upload/Supplies/Order, so its container
  // measures 0 there; re-entering Refine must re-measure the now-visible canvas
  // WITHOUT remounting the viewer (D-14). Guarded on a live viewer + step 2.
  useEffect(() => {
    if (wizard.step === 2) {
      viewerRef.current?.fitToContainer();
    }
  }, [wizard.step]);

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
    let computedRows = rows;
    if (image) {
      const ar = image.naturalWidth / image.naturalHeight;
      const computedHeight = val / ar;
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

    // D-02: auto-recompute the match on the debounced, clamp-guarded custom size.
    scheduleCustomRecompute(computedCols, computedRows);
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
    let computedCols = cols;
    if (image) {
      const ar = image.naturalWidth / image.naturalHeight;
      const computedWidth = val * ar;
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

    // D-02: auto-recompute the match on the debounced, clamp-guarded custom size.
    scheduleCustomRecompute(computedCols, computedRows);
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
        setHighlightedColor(null);
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
        // The FIRST upload commits (a match computes); a re-upload after a match already
        // exists stays uncommitted so the worker never silently re-fires — the new image
        // is committed by the next dimension-change auto-recompute (D-02 is scoped to
        // dimension changes; image-swap commit is the ingest/D-08 domain).
        // ME-02: excludedColors + selectedPreset feed candidatesKey, which the match hook
        // keys on. Resetting them on the uncommitted re-upload path would silently re-fire
        // the worker on the OLD committed image, so reset them only on the committing path.
        if (!matchResult) {
          setExcludedColors(new Set());
          setSelectedPreset('custom');
          setMatchInputs({ image: img, cols, rows: newRows });
        }

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
        cols: matchCols,
        rows: matchRows,
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
        cols: matchCols,
        rows: matchRows,
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

  // D-07 SINGLE-SOURCE QUOTE: derive the ONE itemized customer quote from the same
  // reconciled orderPlan + curated canvas base + vendor shipping. Supplies (this
  // phase) and Order (wave 5) both render THIS object verbatim, so their totals can
  // never diverge. The legacy inline `totalCostSafetyCents` (below) is deliberately
  // left untouched — it still feeds the legacy Step3/Step4 bodies until Phase 25 (SC5).
  const orderQuote = buildOrderQuote({
    supplyPlan: orderPlan,
    canvasBaseCost,
    vendor: selectedVendor,
  });

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

  // ── Refine screen props (23-03, D-03..D-06) ────────────────────────────────
  // App derives every displayed figure; RefineScreen renders pure (Pattern 2).
  // SizeCards get pre-computed inch strings + drill counts (density.ts). Edge
  // cleanup maps onto enableSmoothing/smoothingStrength; the color slider drives
  // the NEW enableReduce/targetColorCount post-process tier. Size selection sets
  // live cols/rows only → the existing soft-invalidate/Recompute owns the worker.
  const refineSizePresets = REFINE_SIZE_PRESETS.map(p => {
    const { widthIn, heightIn } = gridToInches(p.cols, p.rows);
    return {
      label: p.label,
      cols: p.cols,
      rows: p.rows,
      tag: p.tag,
      inches: `${formatInches(widthIn)} × ${formatInches(heightIn)} in`,
      drillCount: p.cols * p.rows,
    };
  });
  // Edge-cleanup value: Off (0) when smoothing disabled, else the strength (1-3).
  const edgeCleanup = (enableSmoothing ? Math.min(3, Math.max(0, smoothingStrength)) : 0) as 0 | 1 | 2 | 3;
  // Distinct colors currently rendered (post smooth/reduce) — the live readout beside
  // the slider so a smoothing dead-zone reads "already at N", not a broken control.
  const currentColorCount = Object.keys(matchResult?.counts ?? {}).length;
  // Slider thumb: sits at the top (detectedColorCount) until the user opts into reduce.
  const refineColorTarget = enableReduce ? targetColorCount : detectedColorCount;

  const refineProps: RefineScreenProps = {
    sizePresets: refineSizePresets,
    cols,
    rows,
    onSelectSize: (c: number, r: number) => {
      // Worker tier (D-02): set live cols/rows AND auto-fire the recompute at once.
      // A SizeCard is a discrete preset, so firing immediately (no debounce) is safe —
      // handleRecomputeMatch commits {image, c, r} explicitly, avoiding stale React
      // state, and the fire-once setMatchInputs commit keeps the B2 abort-race guard.
      setCols(c);
      setRows(r);
      setWidthInput(String(c));
      setHeightInput(String(r));
      setSelectedPreset('custom');
      handleRecomputeMatch(c, r);
    },
    widthInput,
    heightInput,
    onWidthChange: handleWidthChange,
    onHeightChange: handleHeightChange,
    edgeCleanup,
    onEdgeCleanupChange: (v: 0 | 1 | 2 | 3) => {
      // Post-process tier (D-03): pure main-thread re-render, no worker, no staleness.
      if (v === 0) {
        setEnableSmoothing(false);
      } else {
        setEnableSmoothing(true);
        setSmoothingStrength(v);
      }
    },
    colorTarget: refineColorTarget,
    detectedColorCount,
    currentColorCount,
    onColorTargetChange: (n: number) => {
      // Post-process tier (D-03/Pitfall 3): flip reduce on and clamp to [8, detected].
      // WR-02: with <= 8 detected colors there is nothing to reduce; ignore the input
      // so the clamp can never force targetColorCount = 8 above the detected count (a
      // nonsensical reduce ceiling). The RefineScreen also hides the slider here.
      if (detectedColorCount <= 8) return;
      setEnableReduce(true);
      setTargetColorCount(Math.max(8, Math.min(n, detectedColorCount)));
    },
    selectedBaseKit,
    onKitChange: setSelectedBaseKit,
    drillStyle,
    onShapeChange: setDrillStyle,
    excludedColors,
    onToggleExclude: toggleColorExclusion,
    baseCandidates,
  };

  // SUPPLIES-01/02 (D-07): the pure Supplies screen reads the already-joined supply
  // rows (sortedMatches) + symbolMap + the static dye-lot sentence + the SINGLE-SOURCE
  // orderQuote. No cents math or table assembly leaks into the screen (props-only).
  const suppliesProps: SuppliesScreenProps = {
    rows: sortedMatches,
    symbolMap,
    dyeLotWhy: DYE_LOT_WHY_SENTENCE,
    totalSafetyDrills,
    totalPackets,
    quote: orderQuote,
  };

  // ORDER-01: the auto-filled LOCKED spec size, derived ONCE from the committed
  // match grid via the single density source (gridToInches, 2.5mm/dot) so the
  // spec label, the packet's canvasSpec, and the canvas cost can never desync.
  const { widthIn: orderWidthIn, heightIn: orderHeightIn } = gridToInches(matchCols, matchRows);
  const orderSizeLabel = `${formatInches(orderWidthIn)} × ${formatInches(orderHeightIn)} in`;
  const orderGridLabel = `${matchCols}×${matchRows}`;

  // ORDER-01: editing the finish or ship-to invalidates the just-downloaded packet,
  // so re-surface the CTA (clear the honest terminal state) — the user can download
  // an updated file. Never a silent no-op after an edit.
  const handleFinishChange = (next: OrderFinish) => {
    setFinish(next);
    setPacketDownloaded(false);
  };
  const handleShipToChange = (patch: Partial<OrderPacketShipTo>) => {
    setShipTo(prev => ({ ...prev, ...patch }));
    setPacketDownloaded(false);
  };

  // ORDER-02 (D-08/D-09): complete the flow by DOWNLOADING a versioned,
  // self-contained JSON packet — the honest client-side handoff. The CSPRNG id
  // (generateUUID, never Math.random) + timestamp are generated HERE and injected
  // into the PURE buildOrderPacket serializer. The packet is written to an
  // application/json Blob and downloaded via the export.ts anchor + createObjectURL
  // + deferred-revoke idiom (export.ts:260-288). Ship-to is embedded in the Blob
  // ONLY — there is NO fetch/network call (D-08). On failure the shared actionError
  // banner surfaces (never a silent throw); on success the honest terminal state.
  const handleDownloadOrderPacket = () => {
    if (!matchResult) return;
    setActionError(null);
    try {
      const packetId = generateUUID();
      const colorNames = Object.fromEntries(sortedMatches.map(m => [m.code, m.name]));
      const packet = buildOrderPacket({
        packetId,
        createdAt: new Date().toISOString(),
        design: {
          cols: matchCols,
          rows: matchRows,
          grid: matchResult.matches,
          drillShape: drillStyle,
          drillType,
        },
        finish,
        vendor: selectedVendor,
        supplyPlan: orderPlan,
        colorNames,
        quote: orderQuote,
        shipTo,
      });

      const blob = new Blob([JSON.stringify(packet, null, 2)], { type: 'application/json' });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `gempixel-order-${packetId.slice(0, 8)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      // Defer revocation so the download thread has started (export.ts idiom).
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);

      setPacketDownloaded(true);
    } catch (err) {
      console.error('Failed to build the order packet:', err);
      setActionError('Couldn’t build the order packet. Please try again.');
    }
  };

  // ORDER-01/02 (D-01/D-07): the pure Order screen reads the LOCKED spec, the finish
  // selection, the client-only ship-to, and the SAME single-source orderQuote that
  // Supplies renders (so Supplies total === Order total by construction, D-07).
  const orderProps: OrderScreenProps = {
    product: LOCKED_CANVAS_PRODUCT,
    sizeLabel: orderSizeLabel,
    gridLabel: orderGridLabel,
    finish,
    onFinishChange: handleFinishChange,
    shipTo,
    onShipToChange: handleShipToChange,
    quote: orderQuote,
    onDownloadPacket: handleDownloadOrderPacket,
    packetDownloaded,
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
      bottomBar={
        /* Relocated wizard nav footer (D-05) — Back/Next re-homed to the shell's
           fixed Zone 3 so Next stays hittable without page scroll (SC9). Ids and
           handlers preserved verbatim so navigation + reset tests pass unchanged:
           #wizard-back-btn / #wizard-next-btn; Next is disabled purely by
           !canEnter(step+1); the final step hides Next. StepBar + wizard.goTo own
           navigation (D-02 retired the stale forward-nav block). The inner row is
           width-capped to the 1180px card frame so Back/Next align with content. */
        <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between">
          {wizard.step > 1 ? (
            <button
              id="wizard-back-btn"
              onClick={wizard.back}
              className="cursor-pointer text-xs font-bold text-muted transition-colors hover:text-ink"
            >
              &lt; Back
            </button>
          ) : (
            <div className="w-[42px] select-none">&nbsp;</div>
          )}

          {wizard.step < 4 ? (
            <button
              id="wizard-next-btn"
              onClick={wizard.next}
              disabled={!wizard.canEnter(wizard.step + 1)}
              className="cursor-pointer rounded-md bg-accent px-4 py-2 text-xs font-bold text-on-accent transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next Step →
            </button>
          ) : (
            <div className="w-[72px] select-none">&nbsp;</div>
          )}
        </div>
      }
    >
    {/* Centered Atelier viewport frame (UI-SPEC A1-A4) — the four screens are the
        shell's PRIMARY content, hosted in AtelierShell's Zone 2 scroll region
        (D-05); this wrapper centers + width-caps the inner content at the fixed
        1180px card frame on the cream Atelier background. This replaces the retired
        dark 3-column shell (the bg-slate-950 wrapper + 320px left "My Images" aside
        + center <main> + right Color-Legend/DMC aside). UAT Test 26 gap closed. */}
    <div className="relative min-h-full bg-bg print:h-auto">
      <div className="mx-auto flex min-h-full w-full max-w-[1180px] flex-col px-4 py-4 print:p-0">

        {/* Hoisted error banners (frame scope) — surface on ANY step, not only while
            the canvas is visible (they moved out of CanvasWorkspace in Plan 08).
            matchError = worker/decode failures; actionError = imperative one-shot
            failures (ERR-01), dismissible. Text-only (never dangerouslySetInnerHTML)
            so a crafted error string cannot inject markup. */}
        {matchError && (
          <div className="no-print mb-3 max-w-md self-center rounded-lg border border-rose-500/60 bg-rose-950/90 px-4 py-2.5 text-xs font-medium text-rose-100 shadow-lg">
            Couldn't process the image: {matchError}
          </div>
        )}
        {actionError && (
          <div className="fixed top-16 left-1/2 z-[60] flex max-w-md -translate-x-1/2 items-start gap-3 rounded-lg border border-rose-500/60 bg-rose-950/95 px-4 py-2.5 text-xs font-medium text-rose-100 no-print shadow-lg backdrop-blur">
            <span>{actionError}</span>
            <button
              type="button"
              aria-label="Dismiss error"
              onClick={() => setActionError(null)}
              className="-mr-1 -mt-0.5 shrink-0 px-1 text-sm leading-none text-rose-300 transition-colors hover:text-rose-100"
            >
              ×
            </button>
          </div>
        )}

        {/* Relocated frame action row — the still-needed options that used to live in
            the retired left drawer: New/Reset (#new-project-btn → resetWorkspace) and
            Save (#save-project-btn → save modal). Recent projects + load + remove live
            inside UploadScreen on step 1 (D-10); the top-bar Save pill still works too. */}
        <div className="no-print mb-3 flex items-center justify-end gap-2">
          <button
            id="new-project-btn"
            onClick={resetWorkspace}
            className="cursor-pointer rounded-[var(--radius-control)] border border-border bg-panel px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-border hover:text-ink"
            title="Reset the workspace to start a new image"
          >
            New
          </button>
          <button
            id="save-project-btn"
            onClick={() => {
              setSaveProjectName(activeProjectId ? (projectsRegistry.find(p => p.id === activeProjectId)?.name || '') : `Diamond Art ${projectsRegistry.length + 1}`);
              setSaveModalOpen(true);
            }}
            disabled={!matchResult}
            className="cursor-pointer rounded-[var(--radius-control)] border border-border bg-panel px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-border disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save project
          </button>
        </div>

        {/* Screens + single-mount canvas as a flex row. On Refine (step 2) the visible
            children read as [CanvasWorkspace preview | RefineScreen 360px rail]; on
            Upload/Supplies/Order the canvas is display:none and the sole visible panel
            fills the frame (justify-center keeps the single-column Upload centered).
            The panels stay always-mounted, display-toggled siblings (D-14): visible =
            display:contents (layout transparent), hidden = display:none; each is
            no-print (screens never print — the canvas sheet + supply/legend report
            print artifacts are separate). Because the panels use display:contents,
            each screen's OWN root is the flex item (RefineScreen is w-[360px], the
            others fill). */}
        <div className="flex min-h-0 flex-1 flex-row justify-center @max-[640px]:flex-col @max-[640px]:justify-start @max-[640px]:overflow-y-auto">

          {/* Single-mount canvas preview — an always-rendered frame sibling shown only
              on Refine (step 2) and display:none otherwise, so the CanvasViewer element
              is NEVER unmounted on a step change (D-14). A step-2 useEffect re-fits it
              because it measures 0 while hidden. `print:block` is composed
              UNCONDITIONALLY (D-03/WR-01): off-Refine the class is `hidden print:block`
              — display:none on screen, block in print — so a plain Ctrl+P prints the
              canvas grid from ANY step, not just Refine. The beforeprint hook re-fits the
              backing store even while display:none. The dedicated report/legend print
              modes still `display:none !important` this <main>, so there is no
              double-print conflict (those modes win via !important). */}
          <main className={`print:block ${wizard.step === 2 ? 'relative flex min-w-0 flex-1 flex-col @max-[640px]:sticky @max-[640px]:top-0 @max-[640px]:h-[45dvh] @max-[640px]:flex-none @max-[640px]:z-10' : 'hidden'}`}>
            <CanvasWorkspace
              canvasRef={canvasRef}
              image={image}
              matchResult={matchResult}
              viewportMode={viewportMode}
              setViewportMode={setViewportMode}
              onZoomIn={() => viewerRef.current?.zoomIn()}
              onZoomOut={() => viewerRef.current?.zoomOut()}
              onFit={() => viewerRef.current?.fitToContainer()}
              zoomScale={zoomScale}
              cols={cols}
              rows={rows}
              symbolMap={symbolMap}
              leftLegendColors={leftLegendColors}
              rightLegendColors={rightLegendColors}
              loading={loading}
              loadingPhase={loadingPhase}
              progress={progress}
            />
          </main>

        <div data-step-panel="1" className={wizard.step === 1 ? 'contents no-print' : 'hidden'}>
          <UploadScreen
            dropZoneRef={dropZoneRef}
            isDragOver={isDragOver}
            handleFileChange={handleFileChange}
            handleDragOver={handleDragOver}
            handleDragLeave={handleDragLeave}
            handleDrop={handleDrop}
            projectsRegistry={projectsRegistry}
            loadProject={loadProject}
            onDeleteProject={(id) => {
              projectStore.remove(id);
              setProjectsRegistry(projectStore.list());
              if (activeProjectId === id) {
                setActiveProjectId(null);
                restore(null);
              }
            }}
          />
        </div>

        <div data-step-panel="2" className={wizard.step === 2 ? 'contents no-print' : 'hidden'}>
          <RefineScreen {...refineProps} />
        </div>

        <div data-step-panel="3" className={wizard.step === 3 ? 'contents no-print' : 'hidden'}>
          {USE_NEW_SUPPLIES ? (
            <SuppliesScreen {...suppliesProps} />
          ) : (
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
        </div>

        <div data-step-panel="4" className={wizard.step === 4 ? 'contents no-print' : 'hidden'}>
          <OrderScreen {...orderProps} />
        </div>


        </div>

      </div>
    </div>

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
    </AtelierShell>
  );
}
