# Phase 5: Supply Partnerships & Checkout Integration - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the client-side integrations to order custom canvases matching project layouts and build shopping carts at Diamond Drills USA using browser-native links.

</domain>

<decisions>
## Implementation Decisions

### Sizing & Redirects
- **D-01:** Transfer canvas sizing details to partner suppliers via direct URL query parameters. The supplier URL opens pre-filled with the active canvas dimensions (width/height, rows/cols) and shape selection.
- **D-02:** Shopify Add-to-Cart redirects. Compile all required bag sizes and quantities into a single Shopify Add-to-Cart redirect link (e.g. `https://diamonddrillsusa.com/cart/{variant_id}:{qty},...`) with an optional affiliate parameter.
- **D-03:** Store affiliate referral parameters as a customizable config option or settings input, allowing developers to test cart compilation in sandbox mode before live referral links are deployed.

### UX Button Placements
- **D-04:** Place Canvas Ordering and Drill Cart checkout options within a dedicated action card inside the Quote tab (beside the artist profit and supplies cost calculations).

### the agent's Discretion
- The variant ID static mapping structure and retrieval mechanism from Diamond Drills USA Shopify data endpoints is left to the developer's discretion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/REQUIREMENTS.md` §PARTNER-01 — Custom canvas ordering redirect link specifications.
- `.planning/REQUIREMENTS.md` §PARTNER-02 — Diamond Drills USA cart compiler requirements.
- `.planning/ROADMAP.md` §Phase 5 — Goal and success criteria for this phase.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/App.tsx` — Supply legend, pricing configurations, and net profit calculations.
- `src/engine/palette.ts` — Standard manufacturer DMC lists and indexes.

</code_context>
