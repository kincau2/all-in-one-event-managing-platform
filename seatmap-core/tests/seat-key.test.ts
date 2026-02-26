/**
 * Tests — deterministicSeatKey
 */
import { describe, it, expect } from 'vitest';
import { deterministicSeatKey } from '../src/seat-key.js';
import { compileGrid } from '../src/compile-grid.js';
import { compileArc } from '../src/compile-arc.js';
import { compileLayout } from '../src/compile-layout.js';
import { SeatBlockGridSchema, LayoutSchema } from '../src/schema.js';

/* — Helpers — */

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/* — Tests — */

describe('deterministicSeatKey', () => {
  it('returns a valid UUID v4 string', () => {
    const key = deterministicSeatKey('prim-1', 0, 0);
    expect(key).toMatch(UUID_V4_RE);
    expect(key).toHaveLength(36);
  });

  it('is deterministic — same inputs always produce same output', () => {
    const a = deterministicSeatKey('abc-123', 5, 12);
    const b = deterministicSeatKey('abc-123', 5, 12);
    expect(a).toBe(b);
  });

  it('produces different keys for different seats in same primitive', () => {
    const k1 = deterministicSeatKey('prim', 0, 0);
    const k2 = deterministicSeatKey('prim', 0, 1);
    const k3 = deterministicSeatKey('prim', 1, 0);
    expect(k1).not.toBe(k2);
    expect(k1).not.toBe(k3);
    expect(k2).not.toBe(k3);
  });

  it('produces different keys for different primitives at same position', () => {
    const k1 = deterministicSeatKey('prim-a', 0, 0);
    const k2 = deterministicSeatKey('prim-b', 0, 0);
    expect(k1).not.toBe(k2);
  });

  it('generates 10 000 unique keys without collisions', () => {
    const keys = new Set<string>();
    for (let r = 0; r < 100; r++) {
      for (let c = 0; c < 100; c++) {
        keys.add(deterministicSeatKey('big-grid', r, c));
      }
    }
    expect(keys.size).toBe(10_000);
    for (const k of keys) {
      expect(k).toMatch(UUID_V4_RE);
    }
  });
});

describe('deterministic keys through compile', () => {
  it('grid produces identical keys across two independent compiles', () => {
    const prim = SeatBlockGridSchema.parse({
      id: 'g1', type: 'seatBlockGrid',
      rows: 3, cols: 4, seatSpacingX: 30, seatSpacingY: 35,
    });

    const { seats: first } = compileGrid(prim);
    const { seats: second } = compileGrid(prim);

    expect(first).toHaveLength(second.length);
    for (let i = 0; i < first.length; i++) {
      expect(second[i].seat_key).toBe(first[i].seat_key);
    }
  });

  it('changing spacing preserves seat_keys (positions change, keys stay)', () => {
    const prim1 = SeatBlockGridSchema.parse({
      id: 'g2', type: 'seatBlockGrid',
      rows: 2, cols: 3, seatSpacingX: 30, seatSpacingY: 35,
    });
    const prim2 = SeatBlockGridSchema.parse({
      id: 'g2', type: 'seatBlockGrid',
      rows: 2, cols: 3, seatSpacingX: 40, seatSpacingY: 45,
    });

    const { seats: first } = compileGrid(prim1);
    const { seats: second } = compileGrid(prim2);

    for (let i = 0; i < first.length; i++) {
      expect(second[i].seat_key).toBe(first[i].seat_key);
    }
    expect(second[1].x).not.toBe(first[1].x);
  });

  it('keys are deterministic across full compileLayout cycle', () => {
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
    const layout2 = compileLayout(LayoutSchema.parse(raw));

    for (let i = 0; i < layout1.compiled.seats.length; i++) {
      expect(layout2.compiled.seats[i].seat_key).toBe(
        layout1.compiled.seats[i].seat_key,
      );
    }
  });
});
