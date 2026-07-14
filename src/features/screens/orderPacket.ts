/**
 * orderPacket.ts — the versioned, self-contained order-packet serializer
 * (ORDER-02 / D-08). This is the honest client-side handoff artifact: the user
 * completes the four-screen flow by downloading ONE JSON file that carries
 * everything a print lab / vendor needs to fulfil the order — with NO payment,
 * NO server round-trip, and NO PII beyond the ship-to the user typed (D-09).
 *
 * PURE / deterministic by design: `buildOrderPacket` takes the `packetId` and
 * `createdAt` as INJECTED inputs (never calls `generateUUID()` or `new Date()`
 * itself) so it is fully unit-testable and side-effect free. It composes only
 * frozen engine types (`OrderSupplyPlan`, `OrderQuote`) + the pure
 * `gridToInches` density helper — no DOM, no Blob, no network.
 *
 * The App-level download handler (`handleDownloadOrderPacket`) injects the
 * CSPRNG id + timestamp and performs the Blob download; this module only shapes
 * the object. Ship-to is embedded here and NEVER transmitted (D-08).
 *
 * Forward-compatibility: the top-level `schemaVersion` string lets a future
 * v5.0 backend detect and migrate older packets. Field naming is intentionally
 * self-describing (D-08 discretion).
 */
import { gridToInches } from '../../engine/density';
import type { OrderSupplyPlan } from '../../engine/bagPlanner';
import type { OrderQuote } from '../../engine/quote';

/** The single, canonical packet schema version (bump on any breaking change). */
export const ORDER_PACKET_SCHEMA_VERSION = '1.0';

/** The fixed, LOCKED canvas product — always "Rolled Canvas" (D-08). */
export const LOCKED_CANVAS_PRODUCT = 'Rolled Canvas';

/** A finish is a fixed UI enum with NO price impact (ORDER-01, RESEARCH Q3). */
export type OrderFinish = 'trimmed' | 'wrap';

/**
 * Client-only ship-to block. Free text the user typed; embedded in the packet
 * and NEVER sent over the network (D-08). Rendered as plain text (no injection
 * sink) — the packet is inert JSON.
 */
export interface OrderPacketShipTo {
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/** One optimized gem-bag line, derived from an `OrderSupplyPlan` safety row. */
export interface OrderPacketGemBag {
  /** DMC code, e.g. "310". */
  dmc: string;
  /** DMC color name (App-joined from DMC_PALETTE), e.g. "Black". */
  name: string;
  /** Bag breakdown by size, e.g. { "200": 2 } (post-JSON keys are strings). */
  bySize: Record<string, number>;
  /** Total bags/packets for this color (on the +10% safety basis). */
  packets: number;
  /** Total drills purchased for this color (on the +10% safety basis). */
  drills: number;
}

/** Integer-cents snapshot of one quote line (a subset of QuoteLineItem). */
export interface OrderPacketQuoteLine {
  key: string;
  label: string;
  /** Integer cents (never a float) — carried verbatim from the OrderQuote. */
  cents: number;
}

/**
 * The self-contained, versioned order packet (ORDER-02 / D-08). Every field is
 * plain JSON — no functions, DOM nodes, or handles — so
 * `JSON.parse(JSON.stringify(packet))` deep-equals the packet.
 */
export interface OrderPacket {
  /** Schema version for forward-compat with the future v5.0 backend. */
  schemaVersion: string;
  /** CSPRNG id (injected — `generateUUID()` at the call site, never here). */
  packetId: string;
  /** ISO-8601 creation timestamp (injected — never `new Date()` here). */
  createdAt: string;
  /** The chart/design reference — self-contained (the full grid is embedded). */
  design: {
    cols: number;
    rows: number;
    /** Flat row-major DMC codes — the chart itself, self-contained. */
    grid: string[];
    drillShape: 'square' | 'round';
    drillType: string;
  };
  /** The LOCKED, auto-filled print spec (ORDER-01). */
  canvasSpec: {
    /** Always "Rolled Canvas" (LOCKED, D-08). */
    product: typeof LOCKED_CANVAS_PRODUCT;
    /** Derived from the grid via gridToInches (2.5mm/dot). */
    widthIn: number;
    heightIn: number;
    finish: OrderFinish;
    vendor: string;
  };
  /** Optimized gem-bag list from the shared supply plan. */
  gemBags: OrderPacketGemBag[];
  /** Integer-cents quote snapshot — the SAME OrderQuote Supplies renders. */
  quote: {
    lineItems: OrderPacketQuoteLine[];
    totalCents: number;
    ratesAsOf: string;
  };
  /** Client-only ship-to (embedded, never transmitted — D-08). */
  shipTo: OrderPacketShipTo;
}

/** Injected inputs for {@link buildOrderPacket} — all data, no side effects. */
export interface BuildOrderPacketInput {
  /** CSPRNG id — injected so the serializer stays pure/deterministic. */
  packetId: string;
  /** ISO timestamp — injected so the serializer stays pure/deterministic. */
  createdAt: string;
  /** The chart reference (cols/rows + the full row-major grid + drill spec). */
  design: {
    cols: number;
    rows: number;
    grid: string[];
    drillShape: 'square' | 'round';
    drillType: string;
  };
  /** Selected finish (fixed enum, no price impact). */
  finish: OrderFinish;
  /** Canvas vendor id. */
  vendor: string;
  /** The shared, reconciled supply plan — `rows` become `gemBags`. */
  supplyPlan: OrderSupplyPlan;
  /** DMC code → color name (App-joined from DMC_PALETTE) for gem-bag labels. */
  colorNames: Record<string, string>;
  /** The single-source customer quote (the SAME object Supplies renders). */
  quote: OrderQuote;
  /** Client-only ship-to block. */
  shipTo: OrderPacketShipTo;
}

/**
 * Assemble one self-contained, versioned {@link OrderPacket} from injected data.
 *
 * PURE: no `generateUUID()`, no `new Date()`, no DOM/Blob/network. `product` is
 * pinned to "Rolled Canvas" unconditionally (LOCKED, D-08); the canvas size is
 * derived from the grid via the pure `gridToInches`. The quote is snapshotted to
 * integer cents verbatim (no re-summation — single source, D-07). Ship-to is
 * embedded as-is and never leaves the client.
 */
export function buildOrderPacket(input: BuildOrderPacketInput): OrderPacket {
  const { widthIn, heightIn } = gridToInches(input.design.cols, input.design.rows);

  const gemBags: OrderPacketGemBag[] = input.supplyPlan.rows.map((row) => ({
    dmc: row.code,
    name: input.colorNames[row.code] ?? '',
    // Object.entries normalizes the Record<number, number> bySize into the
    // string-keyed shape JSON round-trips to (self-contained, no NaN keys).
    bySize: Object.fromEntries(
      Object.entries(row.safety.bySize).map(([size, qty]) => [String(size), qty]),
    ),
    packets: row.safety.packets,
    drills: row.safety.totalDrills,
  }));

  const quote = {
    lineItems: input.quote.lineItems.map((li) => ({
      key: li.key,
      label: li.label,
      cents: li.cents,
    })),
    totalCents: input.quote.totalCents,
    ratesAsOf: input.quote.ratesAsOf,
  };

  return {
    schemaVersion: ORDER_PACKET_SCHEMA_VERSION,
    packetId: input.packetId,
    createdAt: input.createdAt,
    design: {
      cols: input.design.cols,
      rows: input.design.rows,
      grid: input.design.grid,
      drillShape: input.design.drillShape,
      drillType: input.design.drillType,
    },
    canvasSpec: {
      product: LOCKED_CANVAS_PRODUCT,
      widthIn,
      heightIn,
      finish: input.finish,
      vendor: input.vendor,
    },
    gemBags,
    quote,
    shipTo: input.shipTo,
  };
}
