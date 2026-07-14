import { RefObject } from 'preact';
import { useState } from 'preact/hooks';
import type { ProjectSummary, RecentImage } from '../../engine/projectStore';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';

/**
 * UploadScreen — the canvas-first "Upload" screen (step 1, UPLOAD-01, D-10).
 *
 * PURE / props-only (D-01): App.tsx stays the sole state owner. This component
 * owns NO domain state and imports NO engine *value* (only the `ProjectSummary`
 * / `RecentImage` types). It composes the existing ingest surface (drag/drop +
 * browse) plus an inline recent-projects list sourced from `projectStore.list()`
 * (surfaced by App as `projectsRegistry`); selecting a chip calls `loadProject`
 * to rehydrate state and advance into the flow — no modal picker, no worker run.
 *
 * Canvas-size selection is intentionally absent here — it moved to Refine
 * (SC1 / D-10). The only local state permitted is a tiny presentational flag
 * tracking which recent chip is mid "Remove? Yes / Cancel" confirmation.
 *
 * Security (T-23-02-01): project/image names come from localStorage (user- or
 * import-controlled) and render as TEXT only — Preact escapes by default and
 * this file uses NO `dangerouslySetInnerHTML`.
 */
export interface UploadScreenProps {
  image: HTMLImageElement | null;
  imageName: string;
  dropZoneRef: RefObject<HTMLDivElement>;
  isDragOver: boolean;
  handleFileChange: (e: Event) => void;
  handleDragOver: (e: DragEvent) => void;
  handleDragLeave: (e: DragEvent) => void;
  handleDrop: (e: DragEvent) => void;
  imageFitMode: 'cover' | 'contain';
  setImageFitMode: (v: 'cover' | 'contain') => void;
  recentImages: RecentImage[];
  loadRecentImage: (entry: RecentImage) => void;
  deleteRecentImage: (id: string, e: Event) => void;
  /** Saved projects (`projectStore.list()`); has thumbnails — the D-10 list. */
  projectsRegistry: ProjectSummary[];
  /** Rehydrate ALL state from a saved project + advance into the flow. */
  loadProject: (id: string) => void;
  /**
   * Delete a saved project by its id (CR-01). App wires this to
   * `projectStore.remove(id)` + registry refresh + active-project cleanup —
   * the Remove chip must target the SAVED-PROJECTS list, never the unrelated
   * recent-uploads list.
   */
  onDeleteProject: (id: string) => void;
}

export function UploadScreen(props: UploadScreenProps) {
  const {
    dropZoneRef,
    isDragOver,
    handleFileChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    projectsRegistry,
    loadProject,
  } = props;

  // Presentational-only: id of the chip currently showing "Remove? Yes / Cancel".
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  return (
    <section
      data-screen="upload"
      className="flex flex-col items-center gap-6 py-8 text-ink"
    >
      {/* Display title + subtitle (Copywriting Contract). */}
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="font-serif text-[34px] font-semibold leading-[1.15] text-ink-strong">
          Photo → Diamond chart
        </h2>
        <p className="max-w-[460px] text-sm text-muted">
          Drop a photo to begin. We'll match it to DMC colors and plan your drills.
        </p>
      </div>

      {/* Dropzone 560×250, 2px dashed #C9BFA6, bg --panel, radius 14px. */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('upload-file-input')?.click()}
        className={cn(
          'flex w-[560px] max-w-full flex-col items-center justify-center gap-4',
          'h-[250px] cursor-pointer rounded-[14px] border-2 border-dashed bg-panel',
          'transition-all',
          isDragOver
            ? 'border-accent bg-[#EAF2EF]'
            : 'border-[#C9BFA6] hover:border-accent',
        )}
      >
        {/* 3×3 gem-color pixel motif. */}
        <div className="grid grid-cols-3 gap-1" aria-hidden="true">
          {['#0E6E5C', '#A85A11', '#C9BFA6', '#8AB4A6', '#E0C36B', '#3A3A38', '#D98C8C', '#6E8FB0', '#B7A6C9'].map(
            (c, i) => (
              <span
                key={i}
                className="h-3 w-3 rounded-[2px]"
                style={{ backgroundColor: c }}
              />
            ),
          )}
        </div>

        <span className="text-sm text-muted">Drag &amp; drop, or</span>

        {/* Browse — green primary. stopPropagation so the outer zone click
            doesn't double-fire the hidden input. */}
        <Button
          variant="primary"
          onClick={(e) => {
            e.stopPropagation();
            document.getElementById('upload-file-input')?.click();
          }}
        >
          Browse files
        </Button>

        <input
          id="upload-file-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* RECENT row — omitted entirely when there are no saved projects
          (empty-state omission, Copywriting Contract). Names render as TEXT. */}
      {projectsRegistry.length > 0 && (
        <div className="flex w-[560px] max-w-full flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
            Recent
          </span>
          <div className="flex flex-wrap gap-2">
            {projectsRegistry.map((project) => {
              const confirming = confirmingId === project.id;
              return (
                <div
                  key={project.id}
                  className="group relative flex items-center gap-2 rounded-[var(--radius-control)] border border-border bg-panel-2 p-1.5"
                >
                  <button
                    type="button"
                    onClick={() => loadProject(project.id)}
                    className="flex items-center gap-2 text-left"
                  >
                    <span className="h-9 w-9 shrink-0 overflow-hidden rounded-[6px] border border-border bg-panel">
                      <img
                        src={project.thumbnail}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </span>
                    <span className="max-w-[140px] truncate text-xs font-semibold text-ink">
                      {project.name}
                    </span>
                  </button>

                  {confirming ? (
                    <span className="flex items-center gap-1 text-[10px]">
                      <span className="text-muted">Remove?</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmingId(null);
                          props.onDeleteProject(project.id);
                        }}
                        className="font-semibold text-accent hover:underline"
                      >
                        Yes
                      </button>
                      <span className="text-faint">/</span>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        className="text-muted hover:underline"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(project.id)}
                      className="text-[10px] text-faint opacity-0 transition-opacity hover:text-muted group-hover:opacity-100"
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
