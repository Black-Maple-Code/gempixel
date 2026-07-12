import { VENDOR_REGISTRY } from '../../../engine/checkout';
import { safeStorage } from '../../../engine/safeStorage';

/**
 * Step3Canvas — despite the name, the wizard's "Cost & Order" form: canvas print
 * partner, canvas price/shipping, the optimize-bags toggle + per-bag pricing,
 * cost breakdown, order/download/print actions, sizing advice, printer doors, and
 * affiliate settings. Pure presentational component.
 *
 * Note: the pixel-canvas viewport HUD and the interactive color legend <aside>
 * are persistent chrome rendered OUTSIDE the wizard-step gate in App — they are
 * intentionally NOT part of this component.
 */
export interface SizingAdvice {
  gridIn: string;
  gridCm: string;
  framer: string;
  canvasOnlyIn: string;
  canvasOnlyCm: string;
  combinedIn: string;
  combinedCm: string;
}

export interface Step3CanvasProps {
  selectedVendor: 'lumaprints' | 'prodigi' | 'finerworks';
  setSelectedVendor: (v: 'lumaprints' | 'prodigi' | 'finerworks') => void;
  canvasBaseCost: number;
  setCanvasBaseCost: (v: number) => void;
  canvasShippingEstimate: number;
  setCanvasShippingEstimate: (v: number) => void;
  optimizeBagsCost: boolean;
  setOptimizeBagsCost: (v: boolean) => void;
  priceDb: Record<200 | 500 | 1000 | 2000, number>;
  updatePriceDb: (size: 200 | 500 | 1000 | 2000, value: number) => void;
  drillBagSize: number;
  setDrillBagSize: (v: number) => void;
  drillPacketCost: number;
  setDrillPacketCost: (v: number) => void;
  totalSafetyDrills: number;
  totalPackets: number;
  safetyDrillCost: number;
  totalCostSafety: number;
  matchResult: { matches: string[]; counts: Record<string, number> } | null;
  sizingAdviceData: SizingAdvice;
  affiliateTag: string;
  setAffiliateTag: (v: string) => void;
  affiliateApp: 'ref' | 'rfsn' | 'none';
  setAffiliateApp: (v: 'ref' | 'rfsn' | 'none') => void;
  unmappedLog: string[];
  setUnmappedLog: (v: string[]) => void;
  handleShopifyCheckout: () => void;
  handleDownloadCanvasOnly: () => void;
  handleDownloadCombinedCanvasSheet: () => void;
  printLegendSheetOnly: () => void;
  printReport: () => void;
}

export function Step3Canvas(props: Step3CanvasProps) {
  const {
    selectedVendor,
    setSelectedVendor,
    canvasBaseCost,
    setCanvasBaseCost,
    canvasShippingEstimate,
    setCanvasShippingEstimate,
    optimizeBagsCost,
    setOptimizeBagsCost,
    priceDb,
    updatePriceDb,
    drillBagSize,
    setDrillBagSize,
    drillPacketCost,
    setDrillPacketCost,
    totalSafetyDrills,
    totalPackets,
    safetyDrillCost,
    totalCostSafety,
    matchResult,
    sizingAdviceData,
    affiliateTag,
    setAffiliateTag,
    affiliateApp,
    setAffiliateApp,
    unmappedLog,
    setUnmappedLog,
    handleShopifyCheckout,
    handleDownloadCanvasOnly,
    handleDownloadCombinedCanvasSheet,
    printLegendSheetOnly,
    printReport,
  } = props;

  return (
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
                        safeStorage.removeItem('gempixel_unmapped_colors_log');
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
  );
}
