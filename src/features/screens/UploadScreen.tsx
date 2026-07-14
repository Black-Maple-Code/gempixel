/**
 * UploadScreen — the canvas-first "Upload" screen (step 1, UPLOAD-01).
 *
 * PURE / props-only (D-01): App.tsx stays the sole state owner; this component
 * owns no domain state and imports no engine module. This is the minimal
 * strangler shell introduced in 23-01 behind the `USE_NEW_UPLOAD` flag — the
 * full ingest + recent-projects surface (D-10) lands in 23-02.
 */
export interface UploadScreenProps {}

export function UploadScreen(_props: UploadScreenProps) {
  return (
    <section data-screen="upload" className="text-muted text-sm">
      Upload screen (coming in 23-02)
    </section>
  );
}
