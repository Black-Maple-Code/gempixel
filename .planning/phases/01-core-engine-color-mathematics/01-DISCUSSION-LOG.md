# Phase 1: Core Engine & Color Mathematics - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-06
**Phase:** 1-Core Engine & Color Mathematics
**Areas discussed:** Color Science Library Integration, Static Color Index Storage & Format, Matching Logic & Extensibility

---

## Color Science Library Integration

### Question 1: Which culori import method should be used?
| Option | Description | Selected |
|--------|-------------|----------|
| Import tree-shakable functions from culori/fn and register modes manually | Optimize bundle size by tree-shaking | ✓ |
| Import directly from main culori entry point | Simpler syntax | |
| You decide | Let the agent choose | |

**User's choice:** Import tree-shakable functions from culori/fn and register modes manually to optimize bundle size
**Notes:** None.

### Question 2: How should transparent/semi-transparent pixels be handled?
| Option | Description | Selected |
|--------|-------------|----------|
| Blend with a solid background color (e.g. white) | Blend with a solid white background | ✓ |
| Ignore transparent pixels entirely | Render them as empty/transparent | |
| You decide | Let the agent choose | |

**User's choice:** Blend transparent/semi-transparent pixels with a solid background color (e.g., white) before color matching
**Notes:** None.

### Question 3: How should the color matching cache be structured?
| Option | Description | Selected |
|--------|-------------|----------|
| Exact in-memory Map cache | Cleared at the start of each run | ✓ |
| Lossy/quantized cache | Quantized RGB to increase cache hits | |
| You decide | Let the agent choose | |

**User's choice:** Use an exact in-memory Map cache mapping RGB values to matched DMC colors, cleared at the start of each matching run
**Notes:** None.

### Question 4: How should the sRGB-to-CIELAB conversion logic be executed?
| Option | Description | Selected |
|--------|-------------|----------|
| Culori's built-in automatic multi-step converter | Standard conversion based on D65 reference white | ✓ |
| Write custom math | Avoid loading Culori's space conversion modules | |
| You decide | Let the agent choose | |

**User's choice:** Use Culori's built-in automatic multi-step converter (register modeRgb, modeXyz, modeLab, and use converter('lab'))
**Notes:** None.

---

## Static Color Index Storage & Format

### Question 1: Where and how should the static Art Dot color indexes be stored?
| Option | Description | Selected |
|--------|-------------|----------|
| Compile directly into a TypeScript file as constants | Zero network fetch overhead | ✓ |
| Store as static JSON files in the public directory | Fetch dynamically | |
| You decide | Let the agent choose | |

**User's choice:** Compile color indexes directly into a TypeScript file as constants, bundling them with the app for instant loading and zero network fetch overhead
**Notes:** None.

### Question 2: How should DMC color codes (IDs) be stored?
| Option | Description | Selected |
|--------|-------------|----------|
| Store color codes as strings | Faithful to DMC designations (e.g., "310", "BLANC") | ✓ |
| Normalize to integers where possible | Numeric conversion with custom overrides | |
| You decide | Let the agent choose | |

**User's choice:** Store color codes as strings (e.g. "310", "BLANC", "ECRU") to faithfully preserve DMC names and designations
**Notes:** None.

### Question 3: How should overlapping colors in 100/200 datasets be structured?
| Option | Description | Selected |
|--------|-------------|----------|
| Single unified catalog with membership metadata | Prevent duplication and streamline lookups | ✓ |
| Two completely separate arrays/files | Load separately | |
| You decide | Let the agent choose | |

**User's choice:** A single unified catalog containing all unique colors, with membership metadata (e.g. tag: ["100", "200"]) to prevent duplication and streamline lookups
**Notes:** None.

### Question 4: Should the compiled color index include pre-calculated CIELAB coordinates?
| Option | Description | Selected |
|--------|-------------|----------|
| Store both RGB hex and pre-calculated CIELAB coordinates | Avoid converting reference colors during matching | ✓ |
| Store only RGB hex | Calculate CIELAB dynamically at init | |
| You decide | Let the agent choose | |

**User's choice:** Store both RGB hex codes (for drawing the canvas UI) and pre-calculated CIELAB L/a/b coordinates (to avoid converting reference colors during matches)
**Notes:** None.

---

## Matching Logic & Extensibility

### Question 1: How should matching API be designed for Web Worker offloading?
| Option | Description | Selected |
|--------|-------------|----------|
| Design matching functions to accept flat, serializable inputs | Flat arrays and primitives | ✓ |
| Design using rich domain classes | Classes converted at boundary crossings | |
| You decide | Let the agent choose | |

**User's choice:** Design matching functions to accept flat, serializable inputs (e.g., flat Uint8ClampedArray for image data, array of active DMC codes) to make integration with Web Workers seamless
**Notes:** None.

### Question 2: How should custom sub-palette filtering be handled in the matching loop?
| Option | Description | Selected |
|--------|-------------|----------|
| Pre-filter reference color index | Pass only active candidates to the matching loop | ✓ |
| Pass entire list with mask | Check availability inside tight math loop | |
| You decide | Let the agent choose | |

**User's choice:** Pre-filter the reference color index before entering the matching loop, passing only active color candidates to the distance-matching algorithm
**Notes:** None.

### Question 3: How should the matching algorithm handle rare color ties?
| Option | Description | Selected |
|--------|-------------|----------|
| Pick first encountered color (stable matching) | High performance and deterministic | ✓ |
| Dynamically resolve by lightness | Choose color closest in lightness | |
| You decide | Let the agent choose | |

**User's choice:** Pick the first encountered color in the reference array (stable matching) to ensure deterministic outcomes and high performance
**Notes:** None.

### Question 4: What structure should the color matching engine return?
| Option | Description | Selected |
|--------|-------------|----------|
| Flat array of DMC codes + count summary object | Streamlined payload for drawing and reporting | ✓ |
| 2D array of full color metadata objects | Richer data structure per cell | |
| You decide | Let the agent choose | |

**User's choice:** Return a flat array of matched DMC codes (matching grid cell positions) and a separate aggregated count summary object for supplies
**Notes:** None.

---

## the agent's Discretion

None. All key areas were resolved by user choice.

## Deferred Ideas

None.
