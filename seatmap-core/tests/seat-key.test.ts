/**
 * Tests - seat_key preservation
 */
import { describe, it, expect } from 'vitest';
import { buildSeatKeyMap } from '../src/seat-key.js';
import { compileGrid } from '../src/compile-grid.js';
import { compileArc } from '../src/compile-arc.js';
import { compileLayout } from '../src/compile-layout.js';
import { SeatBlockGridSchema, SeatBlockArcSchema, LayoutSchema } from '../src/schema.js';
import type { SeatKeyMap } from '../src/seat-key.js';
import type { CompiledSeat, Layout } from '../src/types.js';

/* -- Helpers -- */

const EMPTY_MAP: SeatKeyMap = new Map();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* -- Tests -- */

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

describe('seat_key preservation through compile', () => {
  it('preserves keys when re-compiling grid with identical params', () => {
    const prim = SeatBlockGridSchema.parse({
      id: 'g1', type: 'seatBlockGrid',
      rows: 3, cols: 4, seatSpacingX: 30, seatSpacingY: 35,
    });

    const { seats: firstSeats } = compileGrid(prim, EMPTY_MAP);
    const keyMap = buildSeatKeyMap(firstSeats);
    const { seats: secondSeats } = compileGrid(prim, keyMap);

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

    const { seats: first } = compileGrid(prim1, EMPTY_MAP);
    const keyMap = buildSeatKeyMap(first);
    const { seats: second } = compileGrid(prim2, keyMap);

    for (let i = 0; i < first.length; i++) {
      expect(second[i].seat_key).toBe(first[i].seat_key);
    }
    expect(second[1].x).not.toBe(first[1].x);
  });

  it('generates new keys for added seats, preserves existing', () => {
    const prim1 = SeatBlockGridSchema.parse({
      id: 'g3', type: 'seatBlockGrid',
      rows: 2, cols: 3, seatSpacingX: 30, seatSpacingY: 35,
    });
    const prim2 = SeatBlockGridSchema.parse({
      id: 'g3', type: 'seatBlockGrid',
      rows: 3, cols: 3, seatSpacingX: 30, seatSpacingY: 35,
    });

    const { seats: first } = compileGrid(prim1, EMPTY_MAP);
    const keyMap = buildSeatKeyMap(first);
    const { seats: second } = compileGrid(prim2, keyMap);

    expect(second).toHaveLength(9);
    for (let i = 0; i < 6; i++) {
      expect(second[i].seat_key).toBe(first[i].seat_key);
    }
    const firstKeys = new Set(first.map((s) => s.seat_key));
    for (let i = 6; i < 9; i++) {
      expect(second[i].seat_key).toMatch(UUID_RE);
      expect(firstKeys.has(second[i].seat_key)).toBe(false);
    }
  });

  it('drops keys for removed seats', () => {
    const prim1 = SeatBlockGridSchema.parse({
      id: 'g4', type: 'seatBlockGrid',
      rows: 3, cols: 3, seatSpacingX: 30, seatSpacingY: 35,
    });
    const prim2 = SeatBlockGridSchema.parse({
      id: 'g4', type: 'seatBlockGrid',
      rows: 2, cols: 3, seatSpacingX: 30, seatSpacingY: 35,
    });

    const { seats: first } = compileGrid(prim1, EMPTY_MAP);
    const keyMap = buildSeatKeyMap(first);
    const { seats: second } = compileGrid(prim2, keyMap);

    expect(second).toHaveLength(6);
    for (let i = 0; i < 6; i++) {
      expect(second[i].seat_key).toBe(first[i].seat_key);
    }
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
      startAngleDeg: -45, endAngleDeg: 45,
      seatsPerRow: [5, 7],
    });

    const { seats: first } = compileArc(prim1, EMPTY_MAP);
    const keyMap = buildSeatKeyMap(first);
    const { seats: second } = compileArc(prim2, keyMap);

    expect(second).toHaveLength(first.length);
    for (let i = 0; i < first.length; i++) {
      expect(second[i].seat_key).toBe(first[i].seat_key);
    }
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
