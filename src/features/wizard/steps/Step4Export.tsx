/**
 * Step4Export — despite the name, the wizard's final "Save" step: the diamond-art
 * summary stats, the "Save to My Images" form (update / save-as-copy / save), and
 * the reset button. Pure presentational component. (Export/print/cart actions live
 * in Step3Canvas; "BUY SUPPLIES" lives in the persistent legend aside.)
 */
export interface Step4ExportProps {
  cols: number;
  rows: number;
  unit: 'cm' | 'inch' | 'grid';
  matchResult: { matches: string[]; counts: Record<string, number> } | null;
  drillStyle: 'square' | 'round';
  drillType: 'standard' | 'ab' | 'glow' | 'crystal';
  totalSafetyDrills: number;
  totalCostSafety: number;
  saveProjectName: string;
  setSaveProjectName: (v: string) => void;
  activeProjectId: string | null;
  saveSuccessMsg: string;
  handleSaveProject: (name: string, forceNewId?: boolean) => boolean;
  showSaveSuccess: () => void;
  resetWorkspace: () => void;
}

export function Step4Export(props: Step4ExportProps) {
  const {
    cols,
    rows,
    unit,
    matchResult,
    drillStyle,
    drillType,
    totalSafetyDrills,
    totalCostSafety,
    saveProjectName,
    setSaveProjectName,
    activeProjectId,
    saveSuccessMsg,
    handleSaveProject,
    showSaveSuccess,
    resetWorkspace,
  } = props;

  return (
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
                          if (handleSaveProject(saveProjectName)) showSaveSuccess();
                        }}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2 rounded cursor-pointer transition-colors"
                      >
                        Update
                      </button>
                      <button
                        onClick={() => {
                          if (handleSaveProject(saveProjectName, true)) showSaveSuccess();
                        }}
                        className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold py-2 rounded cursor-pointer transition-colors"
                      >
                        Save as Copy
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        if (handleSaveProject(saveProjectName)) showSaveSuccess();
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
  );
}
