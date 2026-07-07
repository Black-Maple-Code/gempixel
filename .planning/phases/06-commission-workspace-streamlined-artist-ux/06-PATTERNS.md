# Pattern Map: Phase 06 (Commission Workspace & Streamlined Artist UX)

## Files to Modify/Create

We will modify existing files to add the wizard workflow and database logic:
1.  **`src/App.tsx` [MODIFY]**:
    *   State hooks for the current workspace list, selected project, active wizard step, and naming modal views.
    *   Saves and loads states, and updates drawing offsets and canvas dimensions upon project switching.
    *   Renders wizard progress bar and step panels.
2.  **`src/__tests__/App.test.tsx` [MODIFY]**:
    *   Integrates unit tests asserting project loading, portfolio switching, deletion, and wizard tab step controls.

---

## Code Analogs & Excerpts

### Analog 1: Tab Selection State
We will transform the current Tab switcher state into a 4-step wizard tracker.
*   **Source File:** [App.tsx](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/App.tsx#L170-L175)
*   **Pattern to copy:**
    ```typescript
    const [activeTab, setActiveTab] = useState<'files' | 'size' | 'quote'>('files');
    ```
*   **Target Pattern:**
    ```typescript
    const [wizardStep, setWizardStep] = useState<number>(1);
    ```

### Analog 2: LocalStorage Persistent Handlers
We will use split localStorage keys following the pattern used to store client parameters.
*   **Source File:** [App.tsx](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/App.tsx#L190-L205)
*   **Pattern to copy:**
    ```typescript
    const [canvasTemplate, setCanvasTemplate] = useState<string>(() => {
      return localStorage.getItem('gempixel_canvas_template') || '...';
    });
    useEffect(() => {
      localStorage.setItem('gempixel_canvas_template', canvasTemplate);
    }, [canvasTemplate]);
    ```
*   **Target Pattern:**
    ```typescript
    const [projectsRegistry, setProjectsRegistry] = useState<ProjectSummary[]>(() => {
      const saved = localStorage.getItem('gempixel_workspace_registry');
      return saved ? JSON.parse(saved) : [];
    });
    ```

### Analog 3: Modal Dialog Overlays
We will reuse the backdrop glassmorphic styling from the help modal to render our Save Project input dialog.
*   **Source File:** [App.tsx](file:///C:/Users/rickf/.gemini/antigravity/scratch/gempixel/src/App.tsx#L1680-L1690)
*   **Pattern to copy:**
    ```html
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-4 flex flex-col gap-4">
        ...
      </div>
    </div>
    ```
