# Feature Research — v3.0 Two-Mode Viewport Experience

**Domain:** Client-side creative-commerce tool (image → gem-art planner) pivoting to a two-mode (self-serve Artist / done-for-you Customer) viewport-native experience with quote-based, manual/offline fulfillment.
**Researched:** 2026-07-12
**Confidence:** MEDIUM-HIGH — UX patterns grounded in how best-in-class creative tools (Figma, Canva) and custom / print-on-demand order flows behave; dependency notes grounded in a direct read of `checkout.ts`, `variants.ts`, `bagPlanner.ts`, PROJECT.md, and the v2.1 requirements archive. Manual/offline fulfillment for a made-to-order craft product is a lightly-standardized space, so some Customer-flow specifics are reasoned from adjacent industries (RFQ/quote requests, custom-commission Etsy shops) rather than a single canonical competitor.

> Supersedes the earlier v1-era FEATURES.md (local-image / color-engine table stakes are now shipped features and out of scope to re-research). This edition covers only the five v3.0 target feature areas.

## How the target features typically work (expected behavior)

### 1. Viewport-native interactive wizard
Best-in-class creative tools (Figma, Canva, Photopea, Photoroom) do **not** drive users through page-flipping wizard screens. They keep the artboard/canvas central and surface controls **contextually**:
- **Contextual toolbars / property panels** anchored to the current object or task, not a permanently-expanded sidebar (Figma's selection toolbar, Canva's floating context bar).
- **Progressive disclosure**: only step-relevant controls are shown; advanced options sit behind a disclosure toggle.
- **First-run coach marks / spotlight tours**: a lightweight, dismissible overlay pointing at one control at a time ("this is where you set canvas size"), with "seen" state persisted so it never re-nags. Escape / click-away always dismisses.
- **A single prominent primary action** ("Next: choose colors", "Get my quote") always visible and contextual, rather than symmetric Back/Next chrome. GemPixel already moved this way in Phase 9 (NAV-01/02/03 HUD).

Expected behavior: users stay focused on the image the whole time, act on in-canvas affordances, and are guided by *what appears next to what they're doing* rather than by navigating discrete screens.

### 2. Customer vs Artist mode split
One product, two intents. Comparable patterns: Squarespace/Wix "what do you want to do" intent pickers, marketplace "buy vs sell" entry, Canva's "personal vs team" onboarding fork.
- A **mode selector at entry** with plain-language descriptions ("I'm making my own canvas" vs "I want one made for me").
- The choice is **persisted** (localStorage) and **reversible** at any time via an always-available switch — never a hard, irreversible gate.
- Each mode **hides irrelevant surfaces** rather than forking into two apps: Artist sees drill-cart + self-order vendor links; Customer sees the quote + Buy / order-packet flow and hides the affiliate-cart plumbing.

Expected behavior: a returning user lands back in their last mode; a shared link can pre-select a mode; switching modes preserves the current design.

### 3. Customer purchase flow with manual/offline fulfillment (order packet)
For made-to-order / custom-commission products with no instant automated checkout, the established pattern is a **quote / order request**, not cart-and-pay. The customer reviews an itemized summary and submits a **structured order packet** that a human fulfills offline. A well-formed packet contains:
- **Design artifact**: the grid/symbol preview PNG (what they're buying).
- **Canvas spec**: size, shape (square/round), selected vendor, orientation.
- **Optimized gem-bag list**: per-color bag breakdown, total bag count, dye-lot notes, safety margin.
- **Price breakdown**: canvas cost + drills cost + **% service/handling fee** + shipping + grand total.
- **Order metadata**: human-readable order/reference ID, timestamp, app version, customer contact info.
- **Review-before-submit** screen and a **saved/downloadable confirmation** (the customer keeps a receipt).

**Large/complex orders are flagged for human review** against simple thresholds (total drills, color count, canvas area, dollar total) with clear messaging that the order is a *request* and someone will follow up — not an instant charge.

Expected behavior: customer confirms an itemized summary, understands this is a request (not a paid checkout), submits, and receives a confirmation they can save.

### 4. Percent-based service/handling fee
Marketplaces and done-for-you services (Etsy handling fees, delivery-app "service fees") show handling as its **own itemized line** with both the **percentage and the dollar amount**, computed on a defined base (goods subtotal). Disclosure is pre-submit, with a tooltip explaining what it covers (sourcing, quality check, packing). It is never silently baked into item prices.

### 5. Gem-bag purchase optimization surfaced to the user
Users need to *trust* "fewest bags while keeping dye-lot consistency." What they need to see: the **per-color bag breakdown** ("2×200, 1×2000"), the **total bag count and cost**, and a plain-language explanation of **why** (a color under the dye-lot ceiling stays on a single 200-count bag so the color is consistent with no visible seams; bulk colors are cost-minimized). GemPixel's `bagPlanner.ts` already computes exactly this; v3.0's job is to *surface and explain* it trustworthily — which depends on the pricing being correct (PRICE-01/02).

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Contextual in-viewport controls (extend Phase 9 HUD) surfacing step-relevant options near the canvas | Modern creative tools keep the canvas central; sidebar-heavy flows feel dated | MEDIUM | Extends existing HUD (NAV-02). Migrate wizard-step controls into contextual panels; keep one prominent primary CTA |
| Single always-visible primary action ("Next…", "Get quote") | Users need a clear "what next" without hunting | LOW | Already partly done (NAV-01). Make it mode- and step-aware |
| Mode selector at entry (Artist vs Customer) with plain-language copy | Two audiences must self-identify before the flow tailors itself | LOW-MEDIUM | Persist via existing `usePersistentState` (STORE-02). Must be reversible |
| Always-available mode switch that preserves the current design | Users mis-pick or want to explore the other path | LOW | Do NOT reset the project on switch |
| Mode-conditional surfaces (hide irrelevant controls per mode) | Each audience should see only its tools | MEDIUM | Single flow, conditional rendering — not two apps |
| Review-before-submit order summary (Customer) with itemized totals | Nobody submits an order without seeing what/why/how much | MEDIUM | Assemble from existing pricing pipeline + design preview |
| Itemized price breakdown: canvas + drills + fee + shipping + total | Transparent pricing is the #1 customer expectation in custom/POD | LOW-MEDIUM | Depends on PRICE-01/02/DATA-01 fixes to be trustworthy |
| Service/handling fee shown as its own line (% and $) pre-submit | Hidden fees destroy trust; itemization is the norm | LOW | Configurable %; tooltip explaining coverage |
| Saved/downloadable order confirmation with a reference ID | Customer needs a receipt for an offline-fulfilled order | LOW-MEDIUM | PNG/PDF via existing print/export path + JSON packet |
| Per-color gem-bag breakdown + total bags + total cost, visible | Trust that they aren't overbuying and colors will match | LOW | `bagPlanner.planColorSupply` already returns `bagsText`; surface it |
| Plain-language dye-lot explanation (tooltip) | "Fewest bags" is meaningless without the *why* | LOW | One tooltip; rule already lives in `bagPlanner` (≤800 → single 200s) |
| Correct, non-$0 bag pricing including the 500-count tier | A quote with a wrong/free bag price is not submittable | MEDIUM | **`bagPlanner.defaultPacketCost` currently has NO 500 tier** — the PRICE-01 bug; fix before quotes are trustworthy |
| Dismissible-and-persisted first-run guidance | Users expect help once, not every visit | LOW-MEDIUM | Persist "seen" flag; escape / click-away dismiss |
| Vendor cleanup — Lumaprints + FinerWorks only (remove Prodigi) | Offering a vendor you won't fulfill through is confusing | LOW | Edit `VENDOR_REGISTRY` + `calculateCanvasCost` vendorKey union in `checkout.ts` |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Coach-mark spotlight tour that adapts to the chosen mode | Onboards each audience to only the controls it needs | MEDIUM | Build lightweight (see anti-features re: tour libs); tie to mode + HUD |
| Self-contained order-packet file (JSON + human-readable PNG/PDF) that round-trips into the future v4.0 admin backend | Manual fulfillment now, zero rework when the backend lands | MEDIUM | Design the schema deliberately now; this is the bridge to v4.0 |
| Automatic large/complex-order flagging with clear "we'll confirm" messaging | Sets expectations, prevents under-quoting, signals human care | LOW-MEDIUM | Simple thresholds (drills/colors/area/$). No backend needed |
| "Why these bags" explainer showing dye-lot rule + savings vs naive packing | Turns an opaque optimizer into a trust-builder | LOW-MEDIUM | Compare `bagPlanner` output to a naive pack; both are pure functions |
| Deep-link / URL param to launch directly into a mode | Artist shares a "design your own" link; a shop shares "order one" | LOW | Read a query param on mount; still client-side |
| Mode-tailored, in-context guidance copy (Artist = self-serve tips; Customer = reassurance) | Same engine, two voices — feels purpose-built for each user | LOW | Copy + conditional rendering |
| Configurable service-fee % with a value-explaining tooltip | Frames the fee as quality/handling, not a surcharge | LOW | Store the % in settings via `usePersistentState` |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real in-app checkout / payment processing (Stripe, PayPal SDK) | "Buy" implies instant pay | Requires PCI-scope, server, secrets — breaks client-side/private ethos; explicitly deferred to v4.0 | Generate an order packet + manual/offline fulfillment; payment handled out-of-band this milestone |
| Order-management backend / admin dashboard / order queue now | Someone has to receive the order | It's a whole backend — this milestone is frontend-first | Emit a v4.0-ready packet (download / `mailto:` / clipboard); build the backend in v4.0 |
| User accounts / login / roles to gate the two modes | "Customer vs Artist sounds like user roles" | Auth = server + PII storage = breaks lightweight/private constraint | Mode is a persisted client preference, freely switchable — no identity required |
| Forking into two separate apps/codebases for the two modes | "The flows are different" | Doubles maintenance; the v2.1 profile flags *regression* as a top frustration | One flow, mode-conditional surfaces and config |
| Heavy guided-tour dependency (Shepherd.js, Intro.js, driver.js) | Fast way to add coach marks | Adds bundle weight; the stack explicitly avoids non-essential deps (GEMINI.md "what NOT to use") | ~1 lightweight positioned overlay component in Preact + a persisted "seen" flag |
| Modal, canvas-blocking linear wizard (page-flip screens) | Familiar step-by-step pattern | Contradicts the viewport-native goal; hides the very image being designed | Non-modal contextual panels anchored in/around the viewport |
| Server-side PII storage of customer contact details | "We need the customer's info to fulfill" | Storing PII server-side crosses privacy + compliance lines this milestone avoids | Contact info travels *inside* the exported packet the customer submits; nothing persisted server-side in v3.0 |
| Real-time vendor inventory / stock checks against Diamond Drills / printers | "Show if bags are in stock" | Requires live vendor APIs = backend + fragility | Static variant table (`variants.ts`) + integrity test (DATA-01); flag *unmapped* colors, don't check stock |
| Sales-tax / VAT calculation on the quote | "A real quote has tax" | Jurisdictional tax = rules engine or a taxed-checkout backend | Show subtotal + %-fee + shipping; taxes handled at manual fulfillment / v4.0 |
| Exposing raw Shopify variant IDs or letting users hand-edit each bag | "Power users want control" | Leaks implementation detail; hand-tuning breaks the dye-lot / cost guarantees | Show human-readable `2×200, 1×2000`; keep packing automatic with a "why" explainer |
| Emailing the order from the browser (SMTP / email API) | "Just email me the order" | Needs a mail backend / exposed API key | `mailto:` prefilled link or a downloadable packet the user sends — no server |
| Gamified / progress-nagging onboarding (streaks, % complete badges) | "Boost engagement" | Nags a utility user; conflicts with the clean, design-conscious UX profile | Quiet, dismiss-once coach marks; a simple contextual "what next" |

## Feature Dependencies

```
Mode selector (Artist/Customer)
    └──requires──> usePersistentState (STORE-02, shipped) for persistence
    └──gates──────> mode-conditional viewport surfaces

Viewport-native wizard
    └──requires──> Phase 9 HUD (NAV-01/02/03, shipped)
    └──requires──> App.tsx wizard state machine (ARTIST-02, shipped) — refactored, not replaced
    └──enhanced-by> coach-mark tour (adapts to selected mode)

Customer order packet ("Buy")
    └──requires──> design preview export (export.ts / EXPORT-01, shipped) → PNG
    └──requires──> bagPlanner.planColorSupply (shipped) → optimized gem-bag list
    └──requires──> checkout.ts calculateCanvasCost + VENDOR_REGISTRY (shipped) → canvas spec + cost
    └──requires──> project store (ARTIST-01, shipped) → reference / persistence
    └──requires──> % service fee → trustworthy TOTAL
    └──requires──> large-order flagging (thresholds)

% service fee  &  Gem-bag optimization surfacing
    └──both require──> PRICE-01, PRICE-02, DATA-01 (pulled into v3.0) — accurate pricing
                         └── PRICE-01 blocker lives in bagPlanner.defaultPacketCost (missing 500 tier)

Vendor cleanup (remove Prodigi)
    └──touches──> checkout.ts VENDOR_REGISTRY + calculateCanvasCost vendorKey union
    └──conflicts-with──> any UI still offering a Prodigi dropdown option (EXPORT/VENDOR-01)
```

### Dependency Notes
- **Order packet requires accurate pricing (PRICE-01/02, DATA-01):** the packet's grand total = canvas + drills(+margin) + %fee + shipping. If a bag size is mispriced or treated as $0, the quote (and therefore the fee and total) is wrong. This is why PROJECT.md pulls the deferred pricing requirements into v3.0. The concrete blocker is visible in `bagPlanner.ts::defaultPacketCost` — it prices 200/1000/2000/5000 tiers but **omits the 500-count tier**, so a 500 bag falls through to a wrong/undefined price.
- **Everything in Customer mode composes existing pure modules:** `bagPlanner`, `checkout.ts` (cost + vendor registry), `export.ts` (PNG), and the project store already exist and are pure/client-side. v3.0 is largely *composition + presentation*, not new engine work — which keeps it aligned with the client-side constraint.
- **Mode split wraps, not replaces, the wizard:** the Phase 9 HUD and Phase 6 wizard state machine are the substrate; mode is a conditional layer over them. Avoid rebuilding the wizard from scratch.
- **Vendor cleanup is a small but cross-cutting edit:** removing Prodigi changes the `'lumaprints' | 'prodigi' | 'finerworks'` union in `checkout.ts` (registry + `calculateCanvasCost` signature) and any UI dropdown; do it early so the Customer canvas-spec only ever offers fulfillable vendors.
- **Watch `calculateCanvasCost` interpolation for the quote:** its linear interpolation between pricing points can yield unrounded, odd-looking quote figures — acceptable for an estimate, but for a customer-facing quote consider rounding to a tidy value so the total reads as trustworthy.
- **Coach-mark tour conflicts with a tour-library dependency:** the value is a *lightweight* in-viewport tour; pulling in Intro.js/Shepherd would violate the stack's explicit "avoid non-essential deps" stance.

## MVP Definition

### Launch With (v3.0 core)
- [ ] Mode selector (Artist/Customer) + persisted, reversible switch — the pivot's defining feature
- [ ] Vendor cleanup (remove Prodigi; Lumaprints + FinerWorks only) — small, unblocks a clean canvas spec
- [ ] Pricing accuracy: PRICE-01 (500-bag), PRICE-02 (no $0 size), DATA-01 (variant integrity test) — everything downstream trusts this
- [ ] Customer "Buy" → structured order packet (design PNG + gem-bag list + canvas spec + %fee + itemized totals) with review-before-submit and a saved confirmation
- [ ] % service fee as an itemized, disclosed line
- [ ] Surface the existing gem-bag optimization (per-color bags, total, cost) + one dye-lot "why" tooltip
- [ ] Migrate the most-used wizard controls into contextual in-viewport surfaces (extend HUD)

### Add After Validation (v3.x)
- [ ] Adaptive coach-mark first-run tour per mode — add once the two flows are stable
- [ ] Large/complex-order auto-flagging with "we'll confirm" messaging — trigger: real orders start arriving
- [ ] Deep-link/URL param to launch a specific mode — trigger: users want to share mode-specific links
- [ ] "Why these bags" savings-vs-naive explainer — trigger: users question the bag counts

### Future Consideration (v4.0+)
- [ ] Order-management backend + admin dashboard (the packet's downstream consumer) — defer: it's a whole backend
- [ ] Automated payments — defer: PCI/server scope; manual/offline is intentional for v3.0
- [ ] Direct printer/vendor API fulfillment & live inventory — defer: external APIs + backend

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Mode selector + reversible switch | HIGH | LOW-MEDIUM | P1 |
| Pricing accuracy (PRICE-01/02, DATA-01) | HIGH | MEDIUM | P1 |
| Vendor cleanup (remove Prodigi) | MEDIUM | LOW | P1 |
| Customer order packet + review-before-submit + confirmation | HIGH | MEDIUM | P1 |
| Itemized % service fee | HIGH | LOW | P1 |
| Surface gem-bag optimization + dye-lot tooltip | HIGH | LOW | P1 |
| Migrate wizard controls into contextual HUD surfaces | MEDIUM-HIGH | MEDIUM | P1/P2 |
| Large/complex-order flagging | MEDIUM | LOW-MEDIUM | P2 |
| Adaptive coach-mark tour | MEDIUM | MEDIUM | P2 |
| Mode deep-linking | LOW-MEDIUM | LOW | P3 |
| "Why these bags" savings explainer | MEDIUM | LOW-MEDIUM | P3 |

**Priority key:** P1 = must have for the milestone · P2 = should have, add when possible · P3 = nice to have.

## Competitor / Reference Feature Analysis

| Feature | Creative tools (Figma / Canva) | Custom-order / POD & marketplaces | GemPixel's v3.0 approach |
|---------|--------------------------------|-----------------------------------|--------------------------|
| Progressive guidance | Contextual toolbars + dismiss-once coach marks; canvas stays central | N/A | Extend Phase 9 HUD into contextual surfaces; lightweight, mode-aware coach marks (no tour lib) |
| Audience/intent split | Onboarding forks (personal/team), persisted | Buyer vs seller dashboards (account-gated) | Persisted, reversible **client** mode preference — no accounts |
| Purchase/fulfillment | N/A | Cart+pay OR custom "request a quote" for made-to-order | Quote/order **packet** for manual/offline fulfillment; payment out-of-band |
| Fee disclosure | N/A | Itemized service/handling line (% + $), pre-checkout | Itemized, configurable %-fee line with a coverage tooltip |
| Supply/bag optimization | N/A | Usually hidden backend logic | Surface the existing dye-lot-aware `bagPlanner` output + a plain-language "why" |

## Sources

- Figma vs Canva UX comparisons (contextual UI, canvas-centric interaction, onboarding/learning curve) — [Style Factory](https://www.stylefactoryproductions.com/blog/canva-vs-figma), [LogRocket](https://blog.logrocket.com/ux-design/figma-vs-canva/), [Designity](https://www.designity.com/blog/figma-vs-canva)
- Print-on-demand / manual fulfillment order handling & customer expectations (transparent pricing, order-detail packets, manual order routing, communication) — [Order Desk POD fulfillment KB](https://help.orderdesk.com/order-desk-101/print-on-demand-fulfillment/), [Shopify: Print on Demand](https://www.shopify.com/blog/print-on-demand), [Printful](https://www.printful.com/print-on-demand)
- GemPixel codebase (direct read): `src/engine/bagPlanner.ts` (dye-lot rule, cost minimization, `defaultPacketCost` missing 500 tier), `src/engine/checkout.ts` (`VENDOR_REGISTRY` incl. Prodigi, `calculateCanvasCost` interpolation), `src/engine/variants.ts` (drill variant lookup), `.planning/PROJECT.md`, `.planning/milestones/v2.1-REQUIREMENTS.md`

---
*Feature research for: two-mode viewport creative-commerce tool (GemPixel v3.0)*
*Researched: 2026-07-12*
