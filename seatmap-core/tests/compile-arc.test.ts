/**
 * Tests — compileArc
 */
import { describe, it, expect } from 'vitest';
import { compileArc } from '../src/compile-arc.js';
import type { SeatBlockArc } from '../src/types.js';
import { SeatBlockArcSchema } from '../src/schema.js';
import type { SeatKeyMap } from '../src/seat-key.js';

/* ── Helpers ── */

function parseArc(raw: Record<string, unknown>): SeatBlockArc {
  return SeatBlockArcSchema.parse(raw);
}

const EMPTY_MAP: SeatKeyMap = new Map();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ── Tests ── */

describe('compileArc', () => {
  it('produces the correct total seat count with start/delta', () => {
    const prim = parseArc({
      id: 'a1', type: 'seatBlockArc',
      center: { x: 400, y: 400 },
      rowCount: 3, startRadius: 200, radiusStep: 35,
      startAngleDeg: -60, endAngleDeg: 60,
      seatsPerRow: { start: 10, delta: 2 },
    });
    const seats = compileArc(prim, EMPTY_MAP);
    // Row 0: 10, Row 1: 12, Row 2: 14 → 36
    expect(seats).toHaveLength(36);
  });

  it('produces the correct total seat count with array seatsPerRow', () => {
    const prim = parseArc({
      id: 'a2', type: 'seatBlockArc',
      center: { x: 400, y: 400 },
      rowCount: 3, startRadius: 200, radiusStep: 35,
      startAngleDeg: -60, endAngleDeg: 60,
      seatsPerRow: [8, 10, 12],
    });
    const seats = compileArc(prim, EMPTY_MAP);
    expect(seats).toHaveLength(30);
  });

  it('places first and last seats at arc endpoints', () => {
    const prim = parseArc({
      id: 'a3', type: 'seatBlockArc',
      center: { x: 0, y: 0 },
      rowCount: 1, startRadius: 100, radiusStep: 30,
      startAngleDeg: 0, endAngleDeg: 90,
      seatsPerRow: [5],
    });
    const seats = compileArc(prim, EMPTY_MAP);
    expect(seats).toHaveLength(5);

    // First seat at 0°: x = 100*cos(0) = 100, y = 100*sin(0) = 0
    expect(seats[0].x).toBeCloseTo(100, 1);
    expect(seats[0].y).toBeCloseTo(0, 1);

    // Last seat at 90°: x = 100*cos(90°) ≈ 0, y = 100*sin(90°) = 100
    expect(seats[4].x).toBeCloseTo(0, 0);
    expect(seats[4].y).toBeCloseTo(100, 1);
  });

  it('radii increase per row', () => {
    const prim = parseArc({
      id: 'a4', type: 'seatBlockArc',
      center: { x: 0, y: 0 },
      rowCount: 3, startRadius: 100, radiusStep: 50,
      startAngleDeg: 0, endAngleDeg: 0, // all seats at 0°
      seatsPerRow: [1, 1, 1],
    });
    const seats = compileArc(prim, EMPTY_MAP);

    // Each seat is placed at angle 0° (single seat → midpoint = 0°)
    // Row 0: r=100, Row 1: r=150, Row 2: r=200
    expect(seats[0].x).toBeCloseTo(100, 1);
    expect(seats[1].x).toBeCloseTo(150, 1);
    expect(seats[2].x).toBeCloseTo(200, 1);
  });

  it('assigns valid UUIDs to every seat', () => {
    const prim = parseArc({
      id: 'a5', type: 'seatBlockArc',
      center: { x: 0, y: 0 },
      rowCount: 2, startRadius: 100, radiusStep: 30,
      startAngleDeg: -45, endAngleDeg: 45,
      seatsPerRow: [8, 10],
    });
    const seats = compileArc(prim, EMPTY_MAP);
    for (const s of seats) {
      expect(s.seat_key).toMatch(UUID_RE);
    }
  });

  it('generates row labels A, B, C, …', () => {
    const prim = parseArc({
      id: 'a6', type: 'seatBlockArc',
      center: { x: 0, y: 0 },
      rowCount: 3, startRadius: 100, radiusStep: 30,
      startAngleDeg: 0, endAngleDeg: 90,
      seatsPerRow: [2, 2, 2],
    });
    const seats = compileArc(prim, EMPTY_MAP);
    expect(seats[0].row).toBe('A');
    expect(seats[2].row).toBe('B');
    expect(seats[4].row).toBe('C');
  });

  it('applies aisle gap (angle) correctly', () => {
    // 5 seats from 0° to 100° with a 20° gap after seat 2
    const prim = parseArc({
      id: 'a7', type: 'seatBlockArc',
      center: { x: 0, y: 0 },
      rowCount: 1, startRadius: 100, radiusStep: 30,
      startAngleDeg: 0, endAngleDeg: 100,
      seatsPerRow: [5],
      aisleGaps: [{ afterSeatIndex: 2, gapAngleDeg: 20 }],
    });
    const seats = compileArc(prim, EMPTY_MAP);

    // Usable angle = 100 - 20 = 80
    // Step = 80 / 4 = 20
    // Seat 0: 0°
    // Seat 1: 20°
    // Seat 2: 40°
    // Seat 3: 60° + 20° gap = 80° (gap afterSeatIndex=2, so s=3 gets +20)
    // Seat 4: 80° + 20° gap = 100°

    // x = 100 * cos(angle), y = 100 * sin(angle)
    expect(seats[0].x).toBeCloseTo(100 * Math.cos(0), 1);
    expect(seats[2].x).toBeCloseTo(100 * Math.cos((40 * Math.PI) / 180), 1);
    expect(seats[3].x).toBeCloseTo(100 * Math.cos((80 * Math.PI) / 180), 1);
    expect(seats[4].x).toBeCloseTo(100 * Math.cos((100 * Math.PI) / 180), 1);
  });

  it('converts gapPx to angle when gapAngleDeg is absent', () => {
    // radius=100, gapPx=10 → gapAngle = (10/100)*(180/π) ≈ 5.73°
    const prim = parseArc({
      id: 'a8', type: 'seatBlockArc',
      center: { x: 0, y: 0 },
      rowCount: 1, startRadius: 100, radiusStep: 30,
      startAngleDeg: 0, endAngleDeg: 90,
      seatsPerRow: [3],
      aisleGaps: [{ afterSeatIndex: 0, gapPx: 10 }],
    });
    const seats = compileArc(prim, EMPTY_MAP);

    const expectedGapDeg = (10 / 100) * (180 / Math.PI);
    const usable = 90 - expectedGapDeg;
    const step = usable / 2;

    // Seat 0: angle = 0°
    // Seat 1: angle = step + expectedGapDeg  (gap after seat 0)
    // Seat 2: angle = 2*step + expectedGapDeg
    expect(seats[0].x).toBeCloseTo(100, 1); // cos(0) = 1
    const angle1 = step + expectedGapDeg;
    expect(seats[1].x).toBeCloseTo(100 * Math.cos((angle1 * Math.PI) / 180), 0);
  });

  it('applies transform translation', () => {
    const prim = parseArc({
      id: 'a9', type: 'seatBlockArc',
      center: { x: 0, y: 0 },
      rowCount: 1, startRadius: 100, radiusStep: 30,
      startAngleDeg: 0, endAngleDeg: 0,
      seatsPerRow: [1],
      transform: { x: 50, y: 75 },
    });
    const seats = compileArc(prim, EMPTY_MAP);
    // Single seat at 0°: base (100, 0) + transform (50, 75) = (150, 75)
    expect(seats[0].x).toBeCloseTo(150, 1);
    expect(seats[0].y).toBeCloseTo(75, 1);
  });

  it('sets rotation to tangent direction', () => {
    const prim = parseArc({
      id: 'a10', type: 'seatBlockArc',
      center: { x: 0, y: 0 },
      rowCount: 1, startRadius: 100, radiusStep: 30,
      startAngleDeg: 0, endAngleDeg: 90,
      seatsPerRow: [3],
    });
    const seats = compileArc(prim, EMPTY_MAP);
    // Seat at 0°: rotation = 0 + 90 = 90
    expect(seats[0].rotation).toBeCloseTo(90, 1);
    // Seat at 90°: rotation = 90 + 90 = 180
    expect(seats[2].rotation).toBeCloseTo(180, 1);
  });

  it('stores correct meta for key preservation', () => {
    const prim = parseArc({
      id: 'arc1', type: 'seatBlockArc',
      center: { x: 0, y: 0 },
      rowCount: 2, startRadius: 100, radiusStep: 30,
      startAngleDeg: 0, endAngleDeg: 90,
      seatsPerRow: [3, 4],
    });
    const seats = compileArc(prim, EMPTY_MAP);
    expect(seats[0].meta).toEqual({ primitiveId: 'arc1', logicalRow: 0, logicalSeat: 0 });
    // Row 1 starts at index 3 (after 3 seats in row 0)
    expect(seats[3].meta).toEqual({ primitiveId: 'arc1', logicalRow: 1, logicalSeat: 0 });
  });
});
