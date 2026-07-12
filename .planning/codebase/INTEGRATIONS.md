# External Integrations

**Analysis Date:** 2026-07-12

## APIs & External Services

This is a privacy-first, fully client-side app. There are **no server-side API calls, no backend, and no SDK-based integrations.** External services appear only as (a) outbound hyperlinks/affiliate deep-links and (b) a static font CDN. No image or user data is transmitted to any service.

**Web Font CDN:**
- Google Fonts - `@import url('https://fonts.googleapis.com/...')` in `src/index.css` (families: Outfit, JetBrains Mono, Pixelify Sans, Newsreader). CSS-only; no JS SDK.

**Affiliate / Vendor Deep Links (outbound hrefs only):**
- A Diamond Painting - `adiamondpainting.com` custom canvas template, default in `src/App.tsx` (`canvasTemplate`).
- Panda Crafty - `pandacraftysteam.com` (`src/App.tsx`).
- Diamond Drills USA - `diamonddrillsusa.com`, per-item product links and cart base URL (`src/App.tsx`, `src/engine/checkout.ts` `baseUrl`).
- AliExpress - `aliexpress.com` DMC drill search links (`src/App.tsx`).
- Temu - `temu.com` DMC drill search links (`src/App.tsx`).

**Canvas Print Vendors (pricing/upload links, `VENDOR_REGISTRY` in `src/engine/checkout.ts`):**
- Lumaprints - `lumaprints.com/canvas-prints/`
- Prodigi - `prodigi.com/products/canvas/rolled-canvas/`
- FinerWorks - `finerworks.com/createaprint/default.aspx`

These are static/templated URLs opened in the browser; the app does not authenticate or POST to them.

## Data Storage

**Databases:**
- None. No database, no ORM.

**Client Persistence:**
- `window.localStorage` - All persistence centralized in `src/engine/projectStore.ts`. Keys include:
  - `gempixel_workspace_registry` - project registry index
  - `gempixel_project_<id>` - per-project saved data
  - `gempixel_recent_images` - recent image list (with quota-eviction handling)
  - `gempixel_theme`, `gempixel_enable_substitution`, `gempixel_substitution_threshold`, `gempixel_enable_smoothing`, `gempixel_smoothing_strength`, `gempixel_unmapped_colors_log`, `gempixel_affiliate_tag`, `gempixel_affiliate_app`, `gempixel_canvas_template` - user settings in `src/App.tsx`.

**File Storage:**
- Local filesystem only, via browser. Images loaded through HTML5 File API + `URL.createObjectURL`; exports produced as blobs and downloaded via `URL.createObjectURL` (`src/engine/export.ts`).

**Caching:**
- In-memory RGBA match cache (invalidated on palette change) — no external cache service.

## Authentication & Identity

- None. No login, no auth provider, no user accounts. Identity is not a concept in this app.

## Monitoring & Observability

**Error Tracking:**
- None.

**Logs:**
- No external logging. A domain-level `gempixel_unmapped_colors_log` array is kept in `localStorage` to record DMC colors that failed to map.

## CI/CD & Deployment

**Hosting:**
- Static hosting (any static host/CDN). Build via `npm run build` → `dist/`.

**CI Pipeline:**
- None detected in repository (no workflow/pipeline config present).

## Environment Configuration

**Required env vars:**
- None. No `.env*` files present; no runtime secrets.

**Secrets location:**
- Not applicable — the app holds no secrets or API keys. Affiliate tags are user-entered and stored in `localStorage` (`gempixel_affiliate_tag`).

## Webhooks & Callbacks

**Incoming:**
- None.

**Outgoing:**
- None (no fetch/XHR calls). All external interaction is user-initiated navigation via anchor links.

## Concurrency Boundary

- Web Worker - `src/engine/matcher.worker.ts` instantiated by `src/engine/worker-client.ts` (`new Worker(workerUrl, { type: 'module' })`). This is an internal thread boundary, not an external integration, but is the primary cross-context message channel (row-batched progress + abort signaling).

---

*Integration audit: 2026-07-12*
