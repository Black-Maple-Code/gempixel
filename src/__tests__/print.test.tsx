// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render } from 'preact';
import { calculateSafetyPurchase, calculateFixedBagCost, App, DYE_LOT_WHY_SENTENCE } from '../App';
import { packColor, priceColorPack, planOrderSupply } from '../engine/bagPlanner';
import { DMC_PALETTE } from '../engine/palette';
import { formatUSD } from '../engine/money';

// Render the App only needs the heavy side-effect modules stubbed out (the same
// worker/viewer stubs App.test.tsx uses); the print-only report block is always
// in the DOM (jsdom applies no CSS, so `hidden print:block` is still queryable).
vi.mock('../engine/worker-client', () => ({
  MatcherClient: class MockMatcherClient {
    match = vi.fn();
    terminate = vi.fn();
  },
}));

vi.mock('../engine/viewer', () => ({
  CanvasViewer: class MockCanvasViewer {
    setData = vi.fn();
    setDrillStyle = vi.fn();
    setHighlightedColor = vi.fn();
    setDrillType = vi.fn();
    fitToContainer = vi.fn();
    destroy = vi.fn();
    setViewMode = vi.fn();
    setSymbolMap = vi.fn();
    setRoundBacking = vi.fn();
    setGridGap = vi.fn();
    zoomIn = vi.fn();
    zoomOut = vi.fn();
    resetZoom = vi.fn();
  },
}));

// Standard price table (bag size -> unit price) shared by the fixed-bag cases.
const priceDb = { 200: 0.25, 500: 0.55, 1000: 0.8, 2000: 1.4 };

describe('Safety margin calculations', () => {
  it('correctly rounds up counts to recommended standard 200 bags', () => {
    const result = calculateSafetyPurchase(350);
    expect(result.safety).toBe(385);
    expect(result.packets).toBe(2);
    expect(result.purchase).toBe(400);
  });

  it('handles boundary multiples correctly', () => {
    const result = calculateSafetyPurchase(181); // 181 * 1.1 = 199.1 -> 200 safety -> 1 packet -> 200 purchase
    expect(result.safety).toBe(200);
    expect(result.packets).toBe(1);
    expect(result.purchase).toBe(200);
  });

  it('supports custom bulk bag sizes in safety purchase calculations', () => {
    // 350 exact drills with 1000 bulk bag size
    const resultLarge = calculateSafetyPurchase(350, 1000);
    expect(resultLarge.safety).toBe(385);
    expect(resultLarge.packets).toBe(1);
    expect(resultLarge.purchase).toBe(1000);

    // 1500 exact drills with 1000 bulk bag size
    const resultTwoBags = calculateSafetyPurchase(1500, 1000);
    expect(resultTwoBags.safety).toBe(1650);
    expect(resultTwoBags.packets).toBe(2);
    expect(resultTwoBags.purchase).toBe(2000);
  });
});

describe('Fixed-bag cost is mapping-aware (WR-02)', () => {
  it('emits a $0 line for an unmapped-shape color (471 + square)', () => {
    // 471 has an empty `square: {}` mapping in variants.ts.
    const fixed = calculateFixedBagCost('471', 'square', 350, 200, 0.25);
    expect(fixed.costExact).toBe(0);
    expect(fixed.costSafety).toBe(0);
    expect(fixed.packets).toBe(0);
    expect(fixed.purchase).toBe(0);
    // +10% drill count is preserved (matches the optimized branch's Safety Margin column).
    expect(fixed.safety).toBe(385);
  });

  it('reconciles the estimate to the cart ($0) for the unmapped color', () => {
    // Compute the cart contribution exactly as checkout.ts does.
    const cartCost = priceColorPack(packColor('471', 'square', 350, priceDb), priceDb);
    expect(cartCost).toBe(0);
    // The cart drops the color entirely (no purchasable pack).
    expect(packColor('471', 'square', 350, priceDb).packets).toBe(0);
    // Estimate == cart: the divergence is closed.
    expect(calculateFixedBagCost('471', 'square', 350, 200, 0.25).costSafety).toBe(cartCost);
  });

  it('emits a $0 line for the second empty pair (798 + round)', () => {
    // 798 has an empty `round: {}` mapping in variants.ts.
    const fixed = calculateFixedBagCost('798', 'round', 350, 200, 0.25);
    expect(fixed.costSafety).toBe(0);
    expect(fixed.packets).toBe(0);
  });

  it('leaves a mapped color unchanged (310 + square regression guard)', () => {
    const fixed = calculateFixedBagCost('310', 'square', 350, 200, 0.25);
    expect(fixed.safety).toBe(385);
    expect(fixed.packets).toBe(2);
    expect(fixed.purchase).toBe(400);
    expect(fixed.costSafety).toBeCloseTo(0.5); // 2 * 0.25
    expect(fixed.costExact).toBeCloseTo(0.4375); // (350 / 200) * 0.25
  });
});

// The brute-force cost-minimizer `optimizeBags(target, prices)` was deleted in the
// Candidate 1 consolidation. Dye-lot-correct per-color packing is now covered by
// `src/engine/__tests__/bagPlanner.test.ts` (packColor / planColorSupply), and the
// estimate == cart property is asserted there against `compileShopifyCartLink`.

// D-03/WR-01: a plain Ctrl+P must print the canvas grid from EVERY step, not just
// Refine. The single-mount canvas <main> composes `print:block` unconditionally, so
// off-Refine its className is `hidden print:block` (display:none on screen, block in
// print). jsdom applies no CSS, so assert the className carries `print:block` while on
// a non-Refine step (App boots on step 1 / Upload). The dedicated report/legend print
// modes still hide <main> via CSS `!important`, so no double-print conflict here.
describe('Canvas <main> prints from every step (D-03/WR-01)', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    render(null, container);
    container.remove();
    vi.restoreAllMocks();
  });

  it('carries print:block on a non-Refine step (Upload / step 1)', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<App />, container);

    // App boots on step 1 (Upload) — the canvas <main> is display:none on screen.
    const main = container.querySelector('main') as HTMLElement;
    expect(main).toBeTruthy();
    // Off-Refine: hidden on screen, but print:block so a plain Ctrl+P still prints it.
    expect(main.className).toContain('hidden');
    expect(main.className).toContain('print:block');
  });
});

// BAG-03/BAG-02 · D-08/D-10: the redesigned printable "GemPixel Supply Plan
// Report" (the "Print Supply Report" button's output, isolated via
// print-only-report-mode) must be self-contained: a static savings/why banner,
// a per-color supply table, and the reconciled proposed total. jsdom applies no
// CSS, so the `.hidden` container is still queryable — assert on content/DOM
// structure, NOT computed visibility.
describe('Print supply report content (D-08/D-10, redesigned)', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    render(null, container);
    container.remove();
    vi.restoreAllMocks();
  });

  function renderApp() {
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<App />, container);
  }

  // Target the redesigned supply-report container (`.supply-report-print-container`),
  // which the "Print Supply Report" button reveals via print-only-report-mode.
  function getPrintReport(): HTMLElement {
    const report = container.querySelector('.supply-report-print-container');
    expect(report).toBeTruthy();
    return report as HTMLElement;
  }

  it('renders the static dye-lot sentence inside the supply report', () => {
    renderApp();
    const report = getPrintReport();
    expect(report.textContent).toContain(DYE_LOT_WHY_SENTENCE);
  });

  it('renders the savings headline inside the supply report (zero-state at empty plan)', () => {
    renderApp();
    const report = getPrintReport();
    // With no image loaded the shared aggregator reports no bulk savings, so the
    // mirrored headline is the truthful zero-state line (D-08) — still present,
    // never hidden.
    expect(report.textContent).toContain('No bulk savings at this size');
  });

  it('renders the report header and a reconciled proposed total', () => {
    renderApp();
    const report = getPrintReport();
    expect(report.textContent).toContain('GemPixel Supply Plan Report');
    // The proposed total is present and money-formatted ($X.XX) via money.ts.
    expect(report.textContent).toMatch(/Proposed total: \$\d+\.\d{2}/);
  });

  it('keeps the report sentence present in the static print mirror (empty plan)', () => {
    renderApp();
    // 23-04: the canvas-first SuppliesScreen (panel-3, always-mounted per D-14) now
    // renders the dye-lot sentence in its native <details> "Why these bags?" body, so
    // the sentence appears exactly twice — once in the static print mirror and once in
    // the on-screen Supplies disclosure. The invariant that MATTERS is that the print
    // mirror carries it independently (never relying on the on-screen expander being
    // open); that the Supplies disclosure also shows it is the intended relocation.
    const occurrences = (container.textContent || '').split(DYE_LOT_WHY_SENTENCE).length - 1;
    expect(occurrences).toBe(2);
    // And the static print mirror specifically carries it (independent of the expander).
    const report = container.querySelector('.supply-report-print-container') as HTMLElement;
    expect(report.textContent).toContain(DYE_LOT_WHY_SENTENCE);
  });
});

// BAG-02/BAG-03 · D-08/D-09/D-10: with a real plan loaded, the report carries the
// per-color supply rows + the matching savings headline, and the relocated
// "Why these bags?" expander (now in the Step 3 Cost & Order panel) exposes the
// full a11y contract.
describe('Populated supply report + relocated "Why these bags?" expander', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
    vi.restoreAllMocks();
  });

  const projectId = 'test-project-print-16-04';
  // Two DMC codes with real square drill variants; gridData carries palette
  // indices, so on load App rebuilds counts = { '150': 250, '151': 250 }.
  const idx150 = DMC_PALETTE.findIndex((c) => c.dmc === '150');
  const idx151 = DMC_PALETTE.findIndex((c) => c.dmc === '151');
  const priceDb = { 200: 0.6, 500: 1.1, 1000: 1.8, 2000: 3.2 } as Record<200 | 500 | 1000 | 2000, number>;
  const counts = { '150': 250, '151': 250 };

  const seedProject = () => {
    const nowStr = new Date().toISOString();
    const summary = { id: projectId, name: 'Print 16-04 Project', thumbnail: '', dateModified: nowStr, dateCreated: nowStr };
    const gridData = [...Array(250).fill(idx150), ...Array(250).fill(idx151)];
    const data = {
      id: projectId,
      name: 'Print 16-04 Project',
      dateCreated: nowStr,
      dateModified: nowStr,
      dimensions: { cols: 25, rows: 20 },
      drillStyle: 'square',
      selectedBaseKit: 'all',
      drillType: 'standard',
      kitBaseCost: 15,
      drillPacketCost: 0.25,
      pricesPerBagSize: priceDb,
      gridData,
    };
    localStorage.setItem('gempixel_workspace_registry', JSON.stringify([summary]));
    localStorage.setItem(`gempixel_project_${projectId}`, JSON.stringify(data));
  };

  const loadProjectToStep = async (targetStep: number) => {
    render(<App />, container);
    await new Promise((r) => setTimeout(r, 10));
    // Load via the always-mounted UploadScreen recent-project chip (D-10) — the
    // legacy "My Images" left drawer is retired in Plan 08. Each test here seeds
    // exactly one project, so the first recent chip's load button (the first
    // button inside a `.group.relative` chip) is that project; clicking it calls
    // the same App loadProject(id) the drawer row called.
    const chip = container.querySelector(
      '[data-screen="upload"] .group.relative button',
    ) as HTMLButtonElement;
    expect(chip).toBeTruthy();
    chip.click();
    await new Promise((r) => setTimeout(r, 10));
    for (let s = 1; s < targetStep; s++) {
      (container.querySelector('#wizard-next-btn') as HTMLButtonElement).click();
      await new Promise((r) => setTimeout(r, 10));
    }
  };

  it('renders per-color supply rows + the matching savings headline in the report', async () => {
    expect(idx150).toBeGreaterThanOrEqual(0);
    expect(idx151).toBeGreaterThanOrEqual(0);

    seedProject();
    await loadProjectToStep(3);

    const report = container.querySelector('.supply-report-print-container') as HTMLElement;
    expect(report).toBeTruthy();

    // A color name is present (150 = "Dusty Rose UT DK").
    expect(report.textContent).toContain('Dusty Rose UT DK');

    // The color's recommended bags text (quantity/bags) is present.
    const plan = planOrderSupply(counts, 'square', priceDb);
    const row150 = plan.rows.find((r) => r.code === '150');
    expect(row150).toBeTruthy();
    expect(report.textContent).toContain(row150!.bagsText);

    // The savings headline matches the aggregator (same string App builds).
    const expectedHeadline =
      plan.savingsCents > 0
        ? `Save ${formatUSD(plan.savingsCents)} (${plan.savingsPct}%) vs per-color`
        : 'No bulk savings at this size';
    expect(report.textContent).toContain(expectedHeadline);

    // The dye-lot sentence + a reconciled proposed total round out the report.
    expect(report.textContent).toContain(DYE_LOT_WHY_SENTENCE);
    expect(report.textContent).toMatch(/Proposed total: \$\d+\.\d{2}/);
  });

  // CR-01: a tampered/imported project whose kitBaseCost is non-finite (here a
  // scientific-notation string that parses to Infinity) reaches the render body's
  // toCents() total via loadProject — `??` only guards null/undefined. Before the
  // sanitizeMoney guard, toCents(Infinity) threw in the render body and white-
  // screened the app. The load + step-3 render must now complete without throwing
  // and produce a finite, money-formatted total.
  // RETIRED(26-03): "preserves saved per-bag prices when the loaded drillType differs (WR-01)"
  // read the restored prices back through the legacy Step3Canvas "Prices per Bag Size ($)"
  // input grid, which was deleted in 26-03 (SuppliesScreen is read-only, no price grid). The
  // WR-01 behavior itself — loadProject's skipDrillPresetRef guard preserving saved prices
  // across a differing drillType — still runs in App; only its price-grid readout is gone.
  // Strangler-close retirement (D-02), mirroring the Phase 23 aside-retargeting precedent.

  it('does not white-screen when a loaded project has a non-finite kitBaseCost (CR-01)', async () => {
    const nowStr = new Date().toISOString();
    const summary = { id: projectId, name: 'CR-01 Tampered', thumbnail: '', dateModified: nowStr, dateCreated: nowStr };
    const gridData = [...Array(250).fill(idx150), ...Array(250).fill(idx151)];
    const data = {
      id: projectId,
      name: 'CR-01 Tampered',
      dateCreated: nowStr,
      dateModified: nowStr,
      dimensions: { cols: 25, rows: 20 },
      drillStyle: 'square',
      selectedBaseKit: 'all',
      drillType: 'standard',
      // Tampered/oversized base cost: parseFloat('1e999') === Infinity.
      kitBaseCost: '1e999',
      drillPacketCost: 0.25,
      pricesPerBagSize: priceDb,
      gridData,
    };
    localStorage.setItem('gempixel_workspace_registry', JSON.stringify([summary]));
    localStorage.setItem(`gempixel_project_${projectId}`, JSON.stringify(data));

    // The whole load-to-step-3 flow must not throw (the render body runs toCents);
    // a throw here would reject this awaited promise and fail the test.
    await loadProjectToStep(3);

    // The estimate line rendered a finite, money-formatted total (base clamped to
    // 0) — never "Infinity"/"NaN" and never a crash.
    expect(container.textContent).toContain('Est. total');
    expect(container.textContent).toMatch(/\$\d+\.\d{2}/);
    expect(container.textContent).not.toContain('Infinity');
    expect(container.textContent).not.toContain('NaN');
  });

  // 23-04 re-home: the "Why these bags?" disclosure moved from the legacy Step3Canvas
  // (a custom aria-controls button + #why-these-bags-explainer region) to the
  // canvas-first SuppliesScreen, which uses a native <details>/<summary> (UI-SPEC
  // Component Inventory — a11y-native, zero-JS). Assert the native disclosure contract:
  // a <summary> named "Why these bags?" whose body is the static dye-lot sentence.
  it('exposes the native "Why these bags?" disclosure in the Supplies panel', async () => {
    seedProject();
    await loadProjectToStep(3);

    const step3 = container.querySelector('[data-step-panel="3"]') as HTMLElement;
    expect(step3.querySelector('[data-screen="supplies"]')).toBeTruthy();

    // Find the native <details> whose <summary> is "Why these bags?".
    const details = Array.from(step3.querySelectorAll('details')).find(
      (d) => d.querySelector('summary')?.textContent?.trim() === 'Why these bags?',
    ) as HTMLDetailsElement | undefined;
    expect(details).toBeTruthy();

    // Native <summary> is the a11y toggle (no custom aria-controls needed).
    const summary = details!.querySelector('summary') as HTMLElement;
    expect(summary.textContent?.trim()).toBe('Why these bags?');

    // The disclosure body is the single static dye-lot sentence (present in the DOM,
    // screen-reader accessible, regardless of open state).
    expect(details!.textContent).toContain(DYE_LOT_WHY_SENTENCE);
  });
});
