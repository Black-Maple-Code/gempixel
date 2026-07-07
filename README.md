# GemPixel 💎

GemPixel is a privacy-first, client-side utility web application designed for diamond painting and gem art planning. It takes any user-loaded image, downsamples it to a target grid, and matches the pixel colors to standard manufacturer DMC and Art Dot color reference indexes using high-precision color science math. 

The application runs entirely in-browser. Images are processed locally and never uploaded to any server.

---

## 🚀 Key Features

- **High-Precision Color Matching**: Converts sRGB pixels to CIELAB space and calculates matching reference colors using the **CIEDE2000** distance algorithm (more accurate to human perception than standard Euclidean RGB formulas).
- **Box Sampling Downscaler**: Uses custom Area Averaging (Box Sampling) to downscale images instead of basic linear scaling, ensuring color-accurate representative grid cells.
- **Cover/Crop Alignment**: Automatically crops images centered on the target aspect ratio, eliminating stretch distortion and padding cells.
- **Multi-threaded Worker Architecture**: Offloads CPU-intensive matching calculations to a persistent background **Web Worker** with row-batching progress updates and instant abort/cancel signaling to keep the UI at a fluid 60 FPS.
- **Intelligent RGBA Cache**: Persists matched pixel colors across canvas resizes and clears/invalidates only when the active candidate palette changes.
- **High-Performance Viewport**: Interactive HTML5 Canvas viewport supporting click-and-drag panning, scroll-to-zoom centered at the cursor position, and offscreen double-buffering blits with image smoothing disabled.
- **Drill Style Toggles**: Toggles display representation between **Square** (full cell coverage) and **Round** (circular drills showing a dark slate `#2D3748` backing through gaps).
- **Exclusion Customization & Selection Highlights**: Allows artists to uncheck specific colors to exclude them from calculations (with instant recalculation), and click legend rows to highlight coordinates by dimming all other cells to 20% opacity.
- **Supply Planning Margins**: Tabulates exact drill counts, adds a **+10% safety margin**, and rounds values up to recommend standard manufacturer **200-drill packets**.
- **Native Print-to-PDF Export**: Leverages custom CSS media queries (`@media print`) and native browser engines (`window.print()`) to format printable grids and checklists.

---

## 🛠️ Technology Stack

- **View Layer**: [Preact](https://preactjs.com/) (Lightweight ~4KB virtual DOM UI framework)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) (Utility-first CSS styling)
- **Bundler & Server**: [Vite](https://vite.dev/) (Native Web Worker module bundling)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Type safety for color coordinate structures)
- **Color Library**: [Culori](https://culorijs.org/) (Tree-shakable color converters)
- **Test Runner**: [Vitest](https://vitest.dev/) (Rapid test assertions)

---

## 📂 Codebase Layout

```
gempixel/
├── .planning/            # Project requirements, roadmap, and state logs
├── src/
│   ├── engine/           # Core mathematical and concurrency services
│   │   ├── __tests__/    # Automated unit tests
│   │   ├── color.ts      # Conversions (CIELAB), alpha blending, and match pipelines
│   │   ├── ingest.ts     # Presets, crop bounds, and Box Sampling downscaler
│   │   ├── palette.ts    # Compiled static DMC & Art Dot reference catalogs
│   │   ├── types.ts      # Shared coordinate interfaces (DmcColor, LabCoordinates)
│   │   ├── viewer.ts     # Panning, zooming, and offscreen canvas viewport
│   │   └── worker-client.ts # Worker thread client lifecycle manager
│   ├── __tests__/        # UI integration and print unit tests
│   ├── App.tsx           # Main Dashboard UI components and controller
│   ├── main.tsx          # Application entry point mounting App to DOM
│   └── index.css         # Tailwind directives and print stylesheet queries
├── index.html            # Main mounting index
├── package.json          # Dependency configurations
├── tsconfig.json         # TypeScript compiler configurations
└── vite.config.ts        # Vite plugins and server configurations
```

---

## ⚙️ Getting Started

### 1. Prerequisite
Ensure [Node.js](https://nodejs.org/) (v18+) is installed on your local machine.

### 2. Installation
Clone the repository and install all dependencies:
```bash
npm install
```

### 3. Development Server
Start the local Vite dev server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Build Bundle
Compile TypeScript files and create a production build in the `dist` directory:
```bash
npm run build
```

---

## 🧪 Testing

GemPixel utilizes Vitest with JSDOM to verify conversions, viewport transformations, and component mounting.

Run the test suite:
```bash
npm test
```

Currently, all **43 unit, integration, and rendering tests** are green and passing.
