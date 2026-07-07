# Technical Research: Phase 06 (Commission Workspace & Streamlined Artist UX)

## User Constraints
*   **Decisions Made:**
    *   **D-01 (Workspace Schema):** Save full calculator states, active base kit, safety margins, and exclusions.
    *   **D-02 (Storage Optimization):** Do not store raw high-res images in local storage to prevent crash/quota limit errors. Instead, save the compiled grid color coordinates array (~4KB) and a small thumbnail image data URL (~10KB).
    *   **D-03 (4-Step Wizard layout):** Group sidebar controls into four logical sequential tabs: Ingestion/Upload, Canvas Size/Style, Legend/Palette, and Quoting/Checkout.
    *   **D-04 (Workspace switcher UI):** Render a collapsible **"My Commissions"** portfolio drawer at the very top of the Left Sidebar.

## Standard Stack
*   **State Management:** Native Preact component hooks (`useState`, `useRef`, `useEffect`) and native `localStorage` API.
*   **Compression/Optimization:** Use standard JSON stringification. To compress the color grid array, store it as a single flat array of DMC palette index numbers rather than verbose color objects.

## Architecture Patterns
*   **Split Storage Registry:**
    *   `gempixel_workspace_registry`: A small JSON array storing high-level metadata (id, name, thumbnail data URL, dateModified) for all projects to render the switcher list quickly.
    *   `gempixel_project_${id}`: Large individual JSON objects storing the full state of each project (grid array, size settings, custom pricing, etc.). Loaded only on demand when the project is active.
*   **Wizard Routing:**
    *   Wizard state is managed via a tab state `const [wizardStep, setWizardStep] = useState<number>(1)` in the main application component.
    *   Sidebar layout renders elements conditionally based on the active step, replacing tab-based navigation with a linear progression bar.

## Don't Hand-Roll
*   Do not hand-roll a full SQLite or IndexedDB database wrapper unless standard `localStorage` fails. The 5MB storage limit is more than sufficient for 50+ projects if raw images are excluded (average project size: ~15KB).

## Common Pitfalls
*   **Corrupted Data Reloads:** If a project config contains invalid state, it can crash the app on startup. Wrap the loading logic in `try/catch` blocks and fall back to clean default states.
*   **Aspect Ratio Misalignment:** If gridData is restored, make sure columns and rows are updated first before drawing, otherwise the canvas viewer drawing boundaries will mismatch.

## Code Examples

### Split Storage Pattern
```typescript
interface ProjectSummary {
  id: string;
  name: string;
  thumbnail: string; // low-res data url
  dateModified: string;
}

interface ProjectData {
  id: string;
  cols: number;
  rows: number;
  gridData: number[]; // 1D array of matched color index pointers
  // ... rest of the settings state
}

// Saving a project
export function saveProject(summary: ProjectSummary, data: ProjectData) {
  // Update registry
  const registryStr = localStorage.getItem('gempixel_workspace_registry') || '[]';
  const registry: ProjectSummary[] = JSON.parse(registryStr);
  const index = registry.findIndex(p => p.id === summary.id);
  if (index >= 0) {
    registry[index] = summary;
  } else {
    registry.push(summary);
  }
  localStorage.setItem('gempixel_workspace_registry', JSON.stringify(registry));
  
  // Save project data
  localStorage.setItem(`gempixel_project_${data.id}`, JSON.stringify(data));
}
```
