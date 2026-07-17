import { useState } from 'preact/hooks';
import type { DmcColor } from '../../engine/types';
import { SizeCard } from '../../ui/SizeCard';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Slider } from '../../ui/Slider';
import { cn } from '../../ui/cn';

/** A fully pre-derived size preset (App computes inches + drillCount, D-05 / Pattern 2). */
export interface RefineSizePreset {
  label: string;
  cols: number;
  rows: number;
  /** Pre-formatted inch string, e.g. "8 × 5.3 in" (via gridToInches/formatInches). */
  inches: string;
  /** Live drill count (cols × rows). */
  drillCount: number;
  /** Optional badge, e.g. "BEST". */
  tag?: string;
}

/**
 * RefineScreen — the canvas-first "Refine" keystone screen (step 2, REFINE-01..05).
 *
 * PURE / props-only (D-01): App.tsx stays the sole state owner; this component owns
 * NO domain state and imports NO engine *value* (only the `DmcColor` type). Every
 * displayed figure (inch strings, drill counts, current/detected color counts) is a
 * fully-computed prop (Pattern 2). The only local state is two presentational
 * disclosure flags (custom-size + advanced) — never domain data.
 *
 * Two-tier reactivity (D-02/D-03) — the load-bearing seam:
 *  - **Size selection = worker tier.** `onSelectSize` sets live cols/rows in App and
 *    App auto-fires the recompute (a SizeCard fires at once; a custom-size edit fires on
 *    a debounce). The screen NEVER fires the worker itself (no B2 abort-race per click).
 *  - **Edge-cleanup + color slider = post-process tier.** They drive the hook's
 *    smooth/reduce memo (main thread) — live every tick, no worker re-fire, no staleness.
 *
 * The color slider's `max` is `detectedColorCount` (raw-keyed, stable under drag —
 * Pitfall 3), never a post-reduce counts length, so the thumb never jumps.
 */
export interface RefineScreenProps {
  // ── Size (worker tier) ──────────────────────────────────────────────
  sizePresets: RefineSizePreset[];
  cols: number;
  rows: number;
  /** Sets live cols/rows in App only — the soft-invalidate owns the re-match. */
  onSelectSize: (cols: number, rows: number) => void;
  // custom size (App owns the clamp precedent; the screen forwards strings)
  widthInput: string;
  heightInput: string;
  onWidthChange: (v: string) => void;
  onHeightChange: (v: string) => void;
  // ── Edge cleanup (post-process tier) → enableSmoothing + smoothingStrength ──
  edgeCleanup: 0 | 1 | 2 | 3;
  onEdgeCleanupChange: (v: 0 | 1 | 2 | 3) => void;
  // ── Color count (post-process tier) → enableReduce + targetColorCount ──
  colorTarget: number;
  detectedColorCount: number;
  currentColorCount: number;
  onColorTargetChange: (n: number) => void;
  // ── Advanced (kit / color-exclusion / drill-shape) ──────────────────
  selectedBaseKit: 'all' | '100' | '200';
  onKitChange: (k: 'all' | '100' | '200') => void;
  drillStyle: 'square' | 'round';
  onShapeChange: (s: 'square' | 'round') => void;
  excludedColors: Set<string>;
  onToggleExclude: (code: string) => void;
  baseCandidates: DmcColor[];
}

export function RefineScreen(props: RefineScreenProps) {
  const {
    sizePresets,
    cols,
    rows,
    onSelectSize,
    widthInput,
    heightInput,
    onWidthChange,
    onHeightChange,
    edgeCleanup,
    onEdgeCleanupChange,
    colorTarget,
    detectedColorCount,
    currentColorCount,
    onColorTargetChange,
    selectedBaseKit,
    onKitChange,
    drillStyle,
    onShapeChange,
    excludedColors,
    onToggleExclude,
    baseCandidates,
  } = props;

  // Presentational-only disclosure flags (never domain data). `advancedOpen` also
  // gates the heavy color-exclusion list so it is not mounted while collapsed.
  const [customOpen, setCustomOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <section
      data-screen="refine"
      className="flex w-full max-w-[320px] min-h-0 flex-col gap-6 overflow-y-auto border-l border-border bg-panel p-6 text-ink @max-[640px]:w-full @max-[640px]:overflow-visible @max-[640px]:border-l-0"
    >
      {/* ── Size (worker tier) ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <h2 className="font-serif text-[18px] font-semibold leading-[1.2] text-ink">
          How big should it be?
        </h2>
        <div className="flex flex-col gap-2">
          {sizePresets.map((preset) => (
            <SizeCard
              key={`${preset.cols}x${preset.rows}`}
              label={preset.label}
              gridDims={`${preset.cols}×${preset.rows} grid`}
              inches={preset.inches}
              drillCount={preset.drillCount}
              selected={cols === preset.cols && rows === preset.rows}
              onSelect={() => onSelectSize(preset.cols, preset.rows)}
              tag={preset.tag}
            />
          ))}
        </div>

        {/* Custom-size footer: accent link toggles a grid-native cols/rows entry.
            Clamps live in App's width/height handlers — the screen forwards strings. */}
        <p className="text-xs text-muted">
          Bigger canvas = more detail &amp; more drills.{' '}
          <button
            type="button"
            aria-expanded={customOpen}
            onClick={() => setCustomOpen((v) => !v)}
            className="font-semibold text-accent hover:underline"
          >
            Custom size
          </button>
        </p>

        {customOpen && (
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-faint">
              Width
              <input
                id="refine-width"
                type="number"
                min={1}
                value={widthInput}
                onInput={(e) => onWidthChange((e.currentTarget as HTMLInputElement).value)}
                className="w-20 rounded-[var(--radius-control)] border border-border bg-panel-2 px-2 py-1 text-sm text-ink"
              />
            </label>
            <span className="pb-1.5 text-muted">×</span>
            <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-faint">
              Height
              <input
                id="refine-height"
                type="number"
                min={1}
                value={heightInput}
                onInput={(e) => onHeightChange((e.currentTarget as HTMLInputElement).value)}
                className="w-20 rounded-[var(--radius-control)] border border-border bg-panel-2 px-2 py-1 text-sm text-ink"
              />
            </label>
          </div>
        )}

      </div>

      {/* ── Edge cleanup (post-process tier) ───────────────────────────── */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
          Edge cleanup · smooths ragged edges
        </span>
        <SegmentedControl<string>
          label="Edge cleanup"
          value={String(edgeCleanup)}
          onChange={(v) => onEdgeCleanupChange(Number(v) as 0 | 1 | 2 | 3)}
          options={[
            { value: '0', label: 'Off' },
            { value: '1', label: 'Light' },
            { value: '2', label: 'Med' },
            { value: '3', label: 'Strong' },
          ]}
        />
      </div>

      {/* ── Drill shape (promoted out of Advanced — a primary choice) ────── */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
          Drill shape
        </span>
        <SegmentedControl<'square' | 'round'>
          label="Drill shape"
          value={drillStyle}
          onChange={onShapeChange}
          options={[
            { value: 'square', label: 'Square' },
            { value: 'round', label: 'Round' },
          ]}
        />
      </div>

      {/* ── Color count (post-process tier) ────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
          Color count · {currentColorCount} of {detectedColorCount} matched
        </span>
        {/* WR-02: the slider's floor is 8, so with fewer than 9 detected colors there is
            nothing to reduce and `max < min` would make the native range degenerate
            (it silently clamps max up to min, pinning the thumb). Only render the
            control when detectedColorCount > 8; otherwise show an inert note. The
            `Math.max(8, …)` guard keeps `min <= max` even in edge renders. */}
        {detectedColorCount > 8 ? (
          <>
            <Slider
              value={colorTarget}
              min={8}
              max={Math.max(8, detectedColorCount)}
              onChange={onColorTargetChange}
              ariaLabel="Color count"
              ariaValueText={`${currentColorCount} of ${detectedColorCount} matched`}
            />
            <p className="text-xs text-muted">
              {detectedColorCount} colors matched. Lowering merges rare one-off drills into a
              shade you already use.
            </p>
          </>
        ) : (
          <p className="text-xs text-muted">
            {detectedColorCount} colors matched — already at the minimum palette, nothing to reduce.
          </p>
        )}
      </div>

      {/* ── Advanced (kit / color-exclusion / drill-shape) ─────────────── */}
      <details
        className="flex flex-col gap-2 border-t border-border pt-3"
        onToggle={(e) => setAdvancedOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        {/* SC5: an explicit clickable affordance — a caret that flips on open + a
            settings-inside hint — so the group reads as an openable settings drawer,
            not plain bold text. The native disclosure triangle is hidden in favor of
            the state-driven caret. */}
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
          <span
            aria-hidden="true"
            className={cn(
              'inline-block text-[10px] text-muted transition-transform',
              advancedOpen && 'rotate-90',
            )}
          >
            ▸
          </span>
          <span>Advanced</span>
          <span className="font-mono text-[10px] font-normal uppercase tracking-wider text-faint">
            kit · colors
          </span>
        </summary>

        <div className="mt-3 flex flex-col gap-4">
          {/* Kit */}
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-faint">Kit</span>
            <select
              value={selectedBaseKit}
              onChange={(e) => onKitChange((e.currentTarget as HTMLSelectElement).value as 'all' | '100' | '200')}
              className="rounded-[var(--radius-control)] border border-border bg-panel-2 px-2 py-1.5 text-sm text-ink"
            >
              <option value="all">All colors</option>
              <option value="100">100-color kit</option>
              <option value="200">200-color kit</option>
            </select>
          </label>

          {/* Color exclusion (heavy list — mounted only while Advanced is open). */}
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
              Exclude colors
            </span>
            {advancedOpen && (
              <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-[var(--radius-control)] border border-border bg-panel-2 p-2">
                {baseCandidates.map((c) => (
                  <label key={c.dmc} className="flex items-center gap-2 text-xs text-ink">
                    <input
                      type="checkbox"
                      checked={excludedColors.has(c.dmc)}
                      onChange={() => onToggleExclude(c.dmc)}
                    />
                    <span
                      className={cn('inline-block h-3 w-3 shrink-0 rounded-[2px] border border-border')}
                      style={{ backgroundColor: c.hex }}
                    />
                    <span className="font-mono">{c.dmc}</span>
                    <span className="truncate text-muted">{c.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </details>
    </section>
  );
}
