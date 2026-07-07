# Context: Phase 06 (Commission Workspace & Streamlined Artist UX)

## Goal
Implement local portfolio workspace tracking, save custom commissions (metadata, files, configurations), and clean up sidebar input hierarchy into a simplified wizard format.

## User Decisions

This document registers the design and architecture decisions for Phase 6.

### D-01: Workspace Database Schema
What metadata is saved for each commission project in local storage?
*   **Decided:**
    *   `id`: string (UUID or timestamp)
    *   `name`: string (project/client name)
    *   `dateCreated`: string (ISO timestamp)
    *   `dateModified`: string (ISO timestamp)
    *   `imageName`: string (original file name)
    *   `dimensions`: `{ cols: number, rows: number }`
    *   `drillStyle`: `'square' | 'round'`
    *   `selectedBaseKit`: `'all' | '100' | '200'`
    *   `safetyMargin`: number
    *   `laborMarkup`: number
    *   `kitBaseCost`: number
    *   `drillPacketCost`: number
    *   `excludedDmcCodes`: string[] (sub-palette exclusion state)
    *   `pricesPerBagSize`: record of prices for bag sizes 200, 500, 1000, 2000
    *   `drillType`: `'standard' | 'ab' | 'glow' | 'crystal'`
    *   `canvasTemplate`: string
    *   `affiliateTag`: string
    *   `affiliateApp`: `'ref' | 'rfsn' | 'none'`
    *   `gridData`: number[] | null (1D array of matched color index pointers to reconstruct the matched grid quickly without raw image data URL)

### D-02: LocalStorage Size Optimization
Since `localStorage` is capped at 5MB, how do we store projects without crashing?
*   **Decided:**
    *   Do **NOT** store the raw uploaded high-resolution image data URL (which is often 2MB-10MB).
    *   Save only the compiled DMC color grid array (~4KB) and a small thumbnail image data URL (~10KB) to support unlimited projects.

### D-03: Consolidated 4-Step Wizard Navigation
How do we organize the left sidebar controls into a 4-step wizard journey?
*   **Decided:**
    1.  **Step 1: Upload** (Image picker, cover/contain behavior, recent uploads panel)
    2.  **Step 2: Canvas Size & Style** (Grid presets dropdown, custom width/height input, square vs. round toggle)
    3.  **Step 3: Legend & Palette** (Base kit selection, supply list checklist table, color highlighting)
    4.  **Step 4: Quoting & Checkout** (Pricing costing calculator inputs, checkout cart buttons, partner presets/affiliate settings)

### D-04: Workspace Switcher UI
Where should the project portfolio dashboard and workspace switcher be located?
*   **Decided:**
    *   Add a collapsible **"My Commissions"** drawer at the top of the Left Sidebar.
