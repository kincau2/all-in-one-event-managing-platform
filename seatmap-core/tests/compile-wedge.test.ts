/**
 * Tests — compileWedge
 */
import { describe, it, expect } from 'vitest';
import { compileWedge } from '../src/compile-wedge.js';
import type { SeatBlockWedge } from '../src/types.js';
import { SeatBlockWedgeSchema } from '../src/schema.js';

/* ── Helpers ── */

function parseWedge(raw: Record<string, unknown>): SeatBlockWedge {
  return SeatBlockWedgeSchema.parse(raw);
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ── Tests ── */

describe('compileWedge', () => {
  it('produces the correct seat count', () => {
    const prim = parseWedge({
      id: 'w1', type: 'seatBlockWedge',
      center: { x: 0, y: 0 },
      innerRadius: 100, outerRadius: 200,
      startAngleDeg: 0, endAngleDeg: 45,
      rowCount: 3,
      seatsPerRow: { start: 6, delta: 2 },
    });
    const seats = compileWedge(prim);
    // Row 0: 6, Row 1: 8, Row 2: 10 → 24
    expect(seats).toHaveLength(24);
  });

  it('interpolates radius between inner and outer', () => {
    const prim = parseWedge({
      id: 'w2', type: 'seatBlockWedge',
      center: { x: 0, y: 0 },
      innerRadius: 100, outerRadius: 300,
      startAngleDeg: 0, endAngleDeg: 0, // all at angle 0° → x = radius
      rowCount: 3,
      seatsPerRow: [1, 1, 1],
    });
    const seats = compileWedge(prim);

    // Row 0: r = 100, Row 1: r = 200, Row 2: r = 300
    expect(seats[0].x).toBeCloseTo(100, 1);
    expect(seats[1].x).toBeCloseTo(200, 1);
    expect(seats[2].x).toBeCloseTo(300, 1);
  });

  it('uses midpoint radius for single-row wedge', () => {
    const prim = parseWedge({
      id: 'w3', type: 'seatBlockWedge',
      center: { x: 0, y: 0 },
      innerRadius: 100, outerRadius: 200,
      startAngleDeg: 0, endAngleDeg: 0,
      rowCount: 1,
      seatsPerRow: [1],
    });
    const seats = compileWedge(prim);
    // (100 + 200) / 2 = 150
    expect(seats[0].x).toBeCloseTo(150, 1);
  });

  it('distributes seats along the wedge angle', () => {
    const prim = parseWedge({
      id: 'w4', type: 'seatBlockWedge',
      center: { x: 0, y: 0 },
      innerRadius: 100, outerRadius: 100,
      startAngleDeg: 0, endAngleDeg: 90,
      rowCount: 1,
      seatsPerRow: [3],
    });
    const seats = compileWedge(prim);

    // 3 seats at 0°, 45°, 90° on radius 100
    expect(seats[0].x).toBeCloseTo(100, 1);          // cos(0°) = 1
    expect(seats[0].y).toBeCloseTo(0, 1);             // sin(0°) = 0
    expect(seats[1].x).toBeCloseTo(100 * Math.cos(Math.PI / 4), 1); // cos(45°)
    expect(seats[1].y).toBeCloseTo(100 * Math.sin(Math.PI / 4), 1); // sin(45°)
    expect(seats[2].x).toBeCloseTo(0, 0);             // cos(90°) ≈ 0
    expect(seats[2].y).toBeCloseTo(100, 1);            // sin(90°) = 1
  });

  it('assigns valid UUIDs', () => {
    const prim = parseWedge({
      id: 'w5', type: 'seatBlockWedge',
      center: { x: 0, y: 0 },
      innerRadius: 50, outerRadius: 200,
      startAngleDeg: -30, endAngleDeg: 30,
      rowCount: 2,
      seatsPerRow: [5, 7],
    });
    const seats = compileWedge(prim);
    for (const s of seats) {
      expect(s.seat_key).toMatch(UUID_RE);
    }
  });

  it('applies transform translation', () => {
    const prim = parseWedge({
      id: 'w6', type: 'seatBlockWedge',
      center: { x: 0, y: 0 },
      innerRadius: 100, outerRadius: 100,
      startAngleDeg: 0, endAngleDeg: 0,
      rowCount: 1,
      seatsPerRow: [1],
      transform: { x: 10, y: 20 },
    });
    const seats = compileWedge(prim);
    // Base: (100, 0) + transform → (110, 20)
    expect(seats[0].x).toBeCloseTo(110, 1);
    expect(seats[0].y).toBeCloseTo(20, 1);
  });

  it('stores correct meta for key preservation', () => {
    const prim = parseWedge({
      id: 'wedge1', type: 'seatBlockWedge',
      center: { x: 0, y: 0 },
      innerRadius: 100, outerRadius: 200,
      startAngleDeg: 0, endAngleDeg: 45,
      rowCount: 2,
      seatsPerRow: [3, 4],
    });
    const seats = compileWedge(prim);
    expect(seats[0].meta).toEqual({ primitiveId: 'wedge1', logicalRow: 0, logicalSeat: 0 });
    expect(seats[3].meta).toEqual({ primitiveId: 'wedge1', logicalRow: 1, logicalSeat: 0 });
  });
});
