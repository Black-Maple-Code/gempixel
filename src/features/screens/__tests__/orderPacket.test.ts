import { describe, it, expect } from 'vitest';
import {
  buildOrderPacket,
  ORDER_PACKET_SCHEMA_VERSION,
  LOCKED_CANVAS_PRODUCT,
  type BuildOrderPacketInput,
} from '../orderPacket';
import type { OrderSupplyPlan } from '../../../engine/bagPlanner';
import type { OrderQuote } from '../../../engine/quote';

/**
 * orderPacket serializer contract (23-05, ORDER-02, D-08/D-09). PURE module —
 * node env (no jsdom). Proves the packet is versioned, self-contained
 * (JSON-round-trippable), carries no PII beyond the passed ship-to / no secrets
 * (exact top-level key set), and locks `product` to "Rolled Canvas". The
 * serializer must call NO `generateUUID()`/`new Date()`/DOM internally — the id
 * + timestamp are injected, so identical inputs yield an identical packet.
 */
describe('buildOrderPacket — versioned, self-contained, honest packet', () => {
  const makeSupplyPlan = (): OrderSupplyPlan => ({
    rows: [
      {
        code: '310',
        exact: { bySize: { 200: 2 }, totalDrills: 400, packets: 2, hasUnpricedSize: false, unpricedSizes: [] },
        safety: { bySize: { 200: 3 }, totalDrills: 600, packets: 3, hasUnpricedSize: false, unpricedSizes: [] },
        costExact: 0.5,
        costSafety: 0.75,
        bagsText: '3×200',
        hasUnpricedSize: false,
        unpricedSizes: [],
      },
    ],
    totalPackets: 3,
    totalDrills: 600,
    optimizedCostCents: 75,
    naiveCostCents: 75,
    savingsCents: 0,
    savingsPct: 0,
    hasUnpricedSize: false,
    unpricedColorCodes: [],
  });

  const makeQuote = (): OrderQuote => ({
    lineItems: [
      { key: 'drills', label: 'Drills', cents: 75, estimate: false },
      { key: 'canvas', label: 'Canvas print', cents: 1500, estimate: true, note: 'rates as of 2026-07-14' },
      { key: 'shipping', label: 'Shipping (est.)', cents: 800, estimate: true },
      { key: 'tax', label: 'Tax', cents: 0, estimate: true, note: 'calculated at vendor checkout' },
    ],
    totalCents: 2375,
    ratesAsOf: '2026-07-14',
    canvasPriced: true,
  });

  const makeInput = (overrides: Partial<BuildOrderPacketInput> = {}): BuildOrderPacketInput => ({
    packetId: 'fixed-uuid-1234-5678',
    createdAt: '2026-07-14T12:00:00.000Z',
    design: {
      cols: 80,
      rows: 53,
      grid: ['310', '310', '321', '310'],
      drillShape: 'square',
      drillType: 'standard',
    },
    finish: 'trimmed',
    vendor: 'lumaprints',
    supplyPlan: makeSupplyPlan(),
    colorNames: { '310': 'Black' },
    quote: makeQuote(),
    shipTo: {
      name: 'Ada Lovelace',
      addressLine1: '1 Analytical Way',
      city: 'London',
      state: '',
      postalCode: 'EC1',
      country: 'UK',
    },
    ...overrides,
  });

  it('carries the schemaVersion for forward-compat with a future backend', () => {
    const packet = buildOrderPacket(makeInput());
    expect(packet.schemaVersion).toBe(ORDER_PACKET_SCHEMA_VERSION);
    expect(typeof packet.schemaVersion).toBe('string');
    expect(packet.schemaVersion).toBe('1.0');
  });

  it('is JSON-round-trippable (self-contained: no functions/DOM/handles)', () => {
    const packet = buildOrderPacket(makeInput());
    const roundTripped = JSON.parse(JSON.stringify(packet));
    expect(roundTripped).toEqual(packet);
  });

  it('exposes ONLY the expected top-level keys (no stray PII/secret)', () => {
    const packet = buildOrderPacket(makeInput());
    expect(Object.keys(packet).sort()).toEqual(
      ['canvasSpec', 'createdAt', 'design', 'gemBags', 'packetId', 'quote', 'schemaVersion', 'shipTo'].sort(),
    );
  });

  it('locks canvasSpec.product to "Rolled Canvas" regardless of input', () => {
    const packet = buildOrderPacket(makeInput({ finish: 'wrap', vendor: 'anything' }));
    expect(packet.canvasSpec.product).toBe(LOCKED_CANVAS_PRODUCT);
    expect(packet.canvasSpec.product).toBe('Rolled Canvas');
  });

  it('derives canvasSpec size from the grid via gridToInches (2.5mm/dot)', () => {
    const packet = buildOrderPacket(makeInput({ design: { cols: 80, rows: 53, grid: [], drillShape: 'round', drillType: 'ab' } }));
    // gridToInches = cols/10, rows/10 (DOTS_PER_INCH = 10).
    expect(packet.canvasSpec.widthIn).toBe(8);
    expect(packet.canvasSpec.heightIn).toBe(5.3);
  });

  it('derives gemBags from the supply plan safety rows (dmc/name/bySize/packets/drills)', () => {
    const packet = buildOrderPacket(makeInput());
    expect(packet.gemBags).toHaveLength(1);
    const bag = packet.gemBags[0];
    expect(bag.dmc).toBe('310');
    expect(bag.name).toBe('Black');
    expect(bag.bySize).toEqual({ '200': 3 }); // safety pack, string-keyed after normalize
    expect(bag.packets).toBe(3);
    expect(bag.drills).toBe(600);
  });

  it('snapshots the quote as integer-cents line items + total + ratesAsOf (single source)', () => {
    const packet = buildOrderPacket(makeInput());
    expect(packet.quote.totalCents).toBe(2375);
    expect(packet.quote.ratesAsOf).toBe('2026-07-14');
    expect(packet.quote.lineItems).toEqual([
      { key: 'drills', label: 'Drills', cents: 75 },
      { key: 'canvas', label: 'Canvas print', cents: 1500 },
      { key: 'shipping', label: 'Shipping (est.)', cents: 800 },
      { key: 'tax', label: 'Tax', cents: 0 },
    ]);
  });

  it('embeds the passed ship-to verbatim and adds NO other PII field', () => {
    const shipTo = {
      name: 'Grace Hopper',
      addressLine1: '2 Compiler Ct',
      city: 'Arlington',
      state: 'VA',
      postalCode: '22201',
      country: 'US',
    };
    const packet = buildOrderPacket(makeInput({ shipTo }));
    expect(packet.shipTo).toEqual(shipTo);
  });

  it('is deterministic — identical injected inputs yield an identical packet', () => {
    const a = buildOrderPacket(makeInput());
    const b = buildOrderPacket(makeInput());
    expect(a).toEqual(b);
  });
});
