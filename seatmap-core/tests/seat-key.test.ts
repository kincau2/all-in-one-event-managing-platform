/**
 * Tests — seat_key preservation
 */
import { describe, it, expect } from 'vitest';
import { buildSeatKeyMap, resolveKey } from '../src/seat-key.js';
import { compileGrid } from '../src/compile-grid.js';
import { compileArc } from '../src/compile-arc.js';
import { compileLayout } from '../src/compile-layout.js';
import { SeatBlockGridSchema, SeatBlockArcSchema, LayoutSchema } from '../src/schema.js';
import type { SeatKeyMap } from '../src/seat-key.js';
import type { CompiledSeat, Layout } from '../src/types.js';

/* ── Helpers ── */

const EMPTY_MAP: SeatKeyMap = new Map();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ── Tests ── */

describe('buildSeatKeyMap', () => {
  it('builds map from seats with valid meta', () => {
    const seats: CompiledSeat[] = [
      {
        seat_key: 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee',
        label: 'A-01', x: 0, y: 0,
        meta: { primitiveId: 'g1', logicalRow: 0, logicalSeat: 0 },
      },
      {
        seat_key: 'ffffffff-1111-4222-3333-444444444444',
        label: 'A-02', x: 30, y: 0,
        meta: { primitiveId: 'g1', logicalRow: 0, logicalSeat: 1 },
      },
    ];
    const map = buildSeatKeyMap(seats);
    expect(map.size).toBe(2);
    expect(map.get('g1:0:0')).toBe('aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee');
    expect(map.get('g1:0:1')).toBe('ffffffff-1111-4222-3333-444444444444');
  });

  it('ignores seats without proper meta', () => {
    const seats: CompiledSeat[] = [
      { seat_key: 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee', label: 'X', x: 0, y: 0 },
      { seat_key: 'ffffffff-1111-4222-3333-444444444444', label: 'Y', x: 0, y: 0, meta: { foo: 'bar' } },
    ];
    const map = buildSeatKeyMap(seats);
    expect(map.size).toBe(0);
  });
});

describe('resolveKey', () => {
  it('returns existing key when found', () => {
    const map: SeatKeyMap = new Map([['g1:0:0', 'my-key']]);
    expect(resolveKey(map, 'g1', 0, 0)).toBe('my-key');
  });

  it('returns null when not found', () => {
    const map: SeatKeyMap = new Map();
    expect(resolveKey(map, 'g1', 0, 0)).toBeNull();
  });
});

describe('seat_key preservation through compile', () => {
  it('preserves keys when re-compiling grid with identical params', () => {
    const prim = SeatBlockGridSchema.parse({
      id: 'g1', type: 'seatBlockGrid',
      rows: 3, cols: 4, seatSpacingX: 30, seatSpacingY: 35,
    });

    // First compile — generates new keys
    const firstSeats = compileGrid(prim, EMPTY_MAP);

    // Build key map from first compile
    const keyMap = buildSeatKeyMap(firstSeats);

    // Second compile — should preserve all keys
    const secondSeats = compileGrid(prim, keyMap);

    expect(firstSeats).toHaveLength(secondSeats.length);
    for (let i = 0; i < firstSeats.length; i++) {
      expect(secondSeats[i].seat_key).toBe(firstSeats[i].seat_key);
    }
  });

  it('preserves keys when changing spacing (positions change, keys stay)', () => {
    const prim1 = SeatBlockGridSchema.parse({
      id: 'g2', type: 'seatBlockGrid',
      rows: 2, cols: 3, seatSpacingX: 30, seatSpacingY: 35,
    });
    const prim2 = SeatBlockGridSchema.parse({
      id: 'g2', type: 'seatBlockGrid',
      rows: 2, cols: 3, seatSpacingX: 40, seatSpacingY: 45,
    });

    const first = compileGrid(prim1, EMPTY_MAP);
    const keyMap = buildSeatKeyMap(first);
    const second = compileGrid(prim2, keyMap);

    // Keys preserved
    for (let i = 0; i < first.length; i++) {
      expect(second[i].seat_key).toBe(first[i].seat_key);
    }

    // Positions changed
    expect(second[1].x).not.toBe(first[1].x);
  });

  it('generates new keys for added seats, preserves existing', () => {
    // Start with 2×3
    const prim1 = SeatBlockGridSchema.parse({
      id: 'g3', type: 'seatBlockGrid',
      rows: 2, cols: 3, seatSpacingX: 30, seatSpacingY: 35,
    });
    // Expand to 3×3 (added row)
    const prim2 = SeatBlockGridSchema.parse({
      id: 'g3', type: 'seatBlockGrid',
      rows: 3, cols: 3, seatSpacingX: 30, seatSpacingY: 35,
    });

    const first = compileGrid(prim1, EMPTY_MAP);
    const keyMap = buildSeatKeyMap(first);
    const second = compileGrid(prim2, keyMap);

    expect(second).toHaveLength(9);

    // First 6 seats keep their keys
    for (let i = 0; i < 6; i++) {
      expect(second[i].seat_key).toBe(first[i].seat_key);
    }

    // New 3 seats have new UUIDs (different from any in first)
    const firstKeys = new Set(first.map((s) => s.seat_key));
    for (let i = 6; i < 9; i++) {
      expect(second[i].seat_key).toMatch(UUID_RE);
      expect(firstKeys.has(second[i].seat_key)).toBe(false);
    }
  });

  it('drops keys for removed seats', () => {
    // Start with 3×3
    const prim1 = SeatBlockGridSchema.parse({
      id: 'g4', type: 'seatBlockGrid',
      rows: 3, cols: 3, seatSpacingX: 30, seatSpacingY: 35,
    });
    // Shrink to 2×3
    const prim2 = SeatBlockGridSchema.parse({
      id: 'g4', type: 'seatBlockGrid',
      rows: 2, cols: 3, seatSpacingX: 30, seatSpacingY: 35,
    });

    const first = compileGrid(prim1, EMPTY_MAP);
    const keyMap = buildSeatKeyMap(first);
    const second = compileGrid(prim2, keyMap);

    expect(second).toHaveLength(6);

    // First 6 seats preserved
    for (let i = 0; i < 6; i++) {
      expect(second[i].seat_key).toBe(first[i].seat_key);
    }

    // The 3 removed seats' keys no longer appear
    const secondKeys = new Set(second.map((s) => s.seat_key));
    for (let i = 6; i < 9; i++) {
      expect(secondKeys.has(first[i].seat_key)).toBe(false);
    }
  });

  it('preserves keys for arc when changing angle range', () => {
    const prim1 = SeatBlockArcSchema.parse({
      id: 'arc1', type: 'seatBlockArc',
      center: { x: 0, y: 0 },
      rowCount: 2, startRadius: 100, radiusStep: 30,
      startAngleDeg: -60, endAngleDeg: 60,
      seatsPerRow: [5, 7],
    });
    const prim2 = SeatBlockArcSchema.parse({
      id: 'arc1', type: 'seatBlockArc',
      center: { x: 0, y: 0 },
      rowCount: 2, startRadius: 100, radiusStep: 30,
      startAngleDeg: -45, endAngleDeg: 45, // different range
      seatsPerRow: [5, 7],
    });

    const first = compileArc(prim1, EMPTY_MAP);
    const keyMap = buildSeatKeyMap(first);
    const second = compileArc(prim2, keyMap);

    // Same total seats
    expect(second).toHaveLength(first.length);

    // Keys preserved (same primitiveId + logical positions)
    for (let i = 0; i < first.length; i++) {
      expect(second[i].seat_key).toBe(first[i].seat_key);
    }

    // But positions are different
    expect(second[0].x).not.toBe(first[0].x);
  });

  it('preserves keys across full compileLayout cycle', () => {
    const raw = {
      schemaVersion: 1,
      canvas: { w: 800, h: 600 },
      primitives: [
        {
          id: 'g1', type: 'seatBlockGrid',
          rows: 3, cols: 5, seatSpacingX: 30, seatSpacingY: 35,
        },
        {
          id: 'a1', type: 'seatBlockArc',
          center: { x: 400, y: 400 },
          rowCount: 2, startRadius: 150, radiusStep: 30,
          startAngleDeg: -45, endAngleDeg: 45,
          seatsPerRow: [8, 10],
        },
      ],
    };

    const layout1 = compileLayout(LayoutSchema.parse(raw));
    const layout2 = compileLayout(LayoutSchema.parse(raw), layout1);

    for (let i = 0; i < layout1.compiled.seats.length; i++) {
      expect(layout2.compiled.seats[i].seat_key).toBe(
        layout1.compiled.seats[i].seat_key,
      );
    }
  });
});
