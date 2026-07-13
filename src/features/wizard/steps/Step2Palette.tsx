import { DmcColor } from '../../../engine/types';

/**
 * Step2Palette — the wizard's "Palette & Optimize" step: DMC kit + drill-type
 * selectors, low-count substitution controls, the exclude-colors checklist, and
 * the DMC supply-list legend table. Pure presentational component.
 *
 * The exclusion checklist iterates `baseCandidates` (the full kit), NOT
 * `activeCandidates` — otherwise already-excluded colors would vanish from the
 * list and exclusion would be irreversible.
 */
export interface LegendRow {
  code: string;
  hex: string;
  count: number;
  safety: number;
  bagsText: string;
  packets: number;
}

export interface Step2PaletteProps {
  selectedBaseKit: 'all' | '100' | '200';
  setSelectedBaseKit: (v: 'all' | '100' | '200') => void;
  setExcludedColors: (v: Set<string>) => void;
  drillType: 'standard' | 'ab' | 'glow' | 'crystal';
  setDrillType: (v: 'standard' | 'ab' | 'glow' | 'crystal') => void;
  enableSubstitution: boolean;
  setEnableSubstitution: (v: boolean) => void;
  substitutionThreshold: number;
  setSubstitutionThreshold: (v: number) => void;
  enableSmoothing: boolean;
  setEnableSmoothing: (v: boolean) => void;
  smoothingStrength: number;
  setSmoothingStrength: (v: number) => void;
  excludeListOpen: boolean;
  setExcludeListOpen: (v: boolean) => void;
  excludedColors: Set<string>;
  baseCandidates: DmcColor[];
  handleSelectAll: () => void;
  handleDeselectAll: () => void;
  toggleColorExclusion: (dmc: string) => void;
  sortedMatches: LegendRow[];
  highlightedColor: string | null;
  handleRowClick: (code: string) => void;
}

export function Step2Palette(props: Step2PaletteProps) {
  const {
    selectedBaseKit,
    setSelectedBaseKit,
    setExcludedColors,
    drillType,
    setDrillType,
    enableSubstitution,
    setEnableSubstitution,
    substitutionThreshold,
    setSubstitutionThreshold,
    enableSmoothing,
    setEnableSmoothing,
    smoothingStrength,
    setSmoothingStrength,
    excludeListOpen,
    setExcludeListOpen,
    excludedColors,
    baseCandidates,
    handleSelectAll,
    handleDeselectAll,
    toggleColorExclusion,
    sortedMatches,
    highlightedColor,
    handleRowClick,
  } = props;

  return (
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

                {/* Color-Boundary Smoothing Option */}
                <div className="flex flex-col gap-1.5 bg-slate-950/60 p-2.5 rounded border border-slate-850/50 shrink-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        id="smooth-colors-checkbox"
                        type="checkbox"
                        checked={enableSmoothing}
                        onChange={(e) => setEnableSmoothing((e.target as HTMLInputElement).checked)}
                        className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer shrink-0"
                      />
                      <label htmlFor="smooth-colors-checkbox" className="text-xs font-semibold text-slate-350 cursor-pointer select-none">
                        Clean color boundaries
                      </label>
                    </div>
                    <div className="tooltip-group">
                      <span className="text-[10px] text-slate-500 hover:text-slate-350 cursor-help w-3.5 h-3.5 rounded-full border border-slate-800 flex items-center justify-center font-bold">?</span>
                      <div className="tooltip-box">Dissolves orphaned drills and straightens blotchy edges for a cleaner chart. Departs slightly from the original photo.</div>
                    </div>
                  </div>
                  {enableSmoothing && (
                    <div className="flex flex-col gap-1 mt-1.5 pl-5 select-none">
                      <label className="text-[9px] uppercase tracking-wide text-slate-500 font-bold">Smoothing Strength</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="1"
                          max="3"
                          step="1"
                          value={smoothingStrength}
                          onInput={(e) => setSmoothingStrength(parseInt((e.target as HTMLInputElement).value, 10) || 1)}
                          className="flex-1 accent-indigo-500 cursor-pointer h-1 bg-slate-800 rounded appearance-none"
                        />
                        <span className="bg-slate-900 border border-slate-800/80 rounded px-1.5 py-0.5 text-[10px] font-bold font-mono text-slate-200 shrink-0 w-14 text-center shadow-inner">
                          {smoothingStrength === 1 ? 'Light' : smoothingStrength === 2 ? 'Medium' : 'Strong'}
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-500 italic mt-0.5 leading-tight">
                        Higher strength removes more speckle but reshapes fine detail.
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
                            {row.bagsText}
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
  );
}
