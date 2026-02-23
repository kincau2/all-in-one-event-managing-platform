/**
 * Tests — compileGrid
 */
import { describe, it, expect } from 'vitest';
import { compileGrid } from '../src/compile-grid.js';
import type { SeatBlockGrid, CompiledSeat } from '../src/types.js';
import { SeatBlockGridSchema } from '../src/schema.js';
import type { SeatKeyMap } from '../src/seat-key.js';

/* ── Helpers ── */

function parseGrid(raw: Record<string, unknown>): SeatBlockGrid {
  return SeatBlockGridSchema.parse(raw);
}

const EMPTY_MAP: SeatKeyMap = new Map();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ── Tests ── */

describe('compileGrid', () => {
  it('produces the correct number of seats', () => {
    const prim = parseGrid({
      id: 'g1', type: 'seatBlockGrid',
      rows: 3, cols: 4, seatSpacingX: 30, seatSpacingY: 35,
    });
    const seats = compileGrid(prim, EMPTY_MAP);
    expect(seats).toHaveLength(12);
  });

  it('assigns valid UUIDs to every seat_key', () => {
    const prim = parseGrid({
      id: 'g1', type: 'seatBlockGrid',
      rows: 2, cols: 3, seatSpacingX: 30, seatSpacingY: 35,
    });
    const seats = compileGrid(prim, EMPTY_MAP);
    for (const s of seats) {
      expect(s.seat_key).toMatch(UUID_RE);
    }
  });

  it('computes correct positions for a simple grid', () => {
    const prim = parseGrid({
      id: 'g1', type: 'seatBlockGrid',
      origin: { x: 100, y: 50 },
      rows: 2, cols: 3,
      seatSpacingX: 30, seatSpacingY: 40,
    });
    const seats = compileGrid(prim, EMPTY_MAP);

    // Row 0, Col 0
    expect(seats[0].x).toBe(100);
    expect(seats[0].y).toBe(50);

    // Row 0, Col 2
    expect(seats[2].x).toBe(160);
    expect(seats[2].y).toBe(50);

    // Row 1, Col 0
    expect(seats[3].x).toBe(100);
    expect(seats[3].y).toBe(90);
  });

  it('generates correct labels with L2R numbering', () => {
    const prim = parseGrid({
      id: 'g1', type: 'seatBlockGrid',
      rows: 2, cols: 3, seatSpacingX: 30, seatSpacingY: 35,
    });
    const seats = compileGrid(prim, EMPTY_MAP);

    // Row A: A-01, A-02, A-03
    expect(seats[0].label).toBe('A-01');
    expect(seats[1].label).toBe('A-02');
    expect(seats[2].label).toBe('A-03');

    // Row B: B-01, B-02, B-03
    expect(seats[3].label).toBe('B-01');
    expect(seats[4].label).toBe('B-02');
  });

  it('generates correct labels with R2L numbering', () => {
    const prim = parseGrid({
      id: 'g2', type: 'seatBlockGrid',
      rows: 1, cols: 4, seatSpacingX: 30, seatSpacingY: 35,
      numbering: 'R2L',
    });
    const seats = compileGrid(prim, EMPTY_MAP);

    // Col 0 (leftmost) → number 4 (max), Col 3 (rightmost) → number 1
    expect(seats[0].label).toBe('A-04');
    expect(seats[0].number).toBe(4);
    expect(seats[3].label).toBe('A-01');
    expect(seats[3].number).toBe(1);
  });

  it('applies aisle gaps correctly', () => {
    const prim = parseGrid({
      id: 'g3', type: 'seatBlockGrid',
      rows: 1, cols: 5, seatSpacingX: 30, seatSpacingY: 35,
      aisleGaps: [{ afterCol: 2, gapPx: 20 }],
    });
    const seats = compileGrid(prim, EMPTY_MAP);

    // Col 0: 0 * 30 + 0 gap = 0
    expect(seats[0].x).toBe(0);
    // Col 2: 2 * 30 + 0 gap = 60 (gap is AFTER col 2, so col 2 not affected)
    expect(seats[2].x).toBe(60);
    // Col 3: 3 * 30 + 20 gap = 110
    expect(seats[3].x).toBe(110);
    // Col 4: 4 * 30 + 20 gap = 140
    expect(seats[4].x).toBe(140);
  });

  it('applies multiple aisle gaps', () => {
    const prim = parseGrid({
      id: 'g4', type: 'seatBlockGrid',
      rows: 1, cols: 8, seatSpacingX: 30, seatSpacingY: 35,
      aisleGaps: [
        { afterCol: 2, gapPx: 20 },
        { afterCol: 5, gapPx: 30 },
      ],
    });
    const seats = compileGrid(prim, EMPTY_MAP);

    // Col 0: 0
    expect(seats[0].x).toBe(0);
    // Col 3: 3*30 + 20 = 110
    expect(seats[3].x).toBe(110);
    // Col 6: 6*30 + 20 + 30 = 230
    expect(seats[6].x).toBe(230);
  });

  it('applies descending row labels', () => {
    const prim = parseGrid({
      id: 'g5', type: 'seatBlockGrid',
      rows: 3, cols: 1, seatSpacingX: 30, seatSpacingY: 35,
      rowLabel: { start: 'C', direction: 'desc' },
    });
    const seats = compileGrid(prim, EMPTY_MAP);
    expect(seats[0].row).toBe('C');
    expect(seats[1].row).toBe('B');
    expect(seats[2].row).toBe('A');
  });

  it('sets section when provided', () => {
    const prim = parseGrid({
      id: 'g6', type: 'seatBlockGrid',
      rows: 1, cols: 1, seatSpacingX: 30, seatSpacingY: 35,
      section: 'VIP',
    });
    const seats = compileGrid(prim, EMPTY_MAP);
    expect(seats[0].section).toBe('VIP');
  });

  it('handles transform translation', () => {
    const prim = parseGrid({
      id: 'g7', type: 'seatBlockGrid',
      rows: 1, cols: 1, seatSpacingX: 30, seatSpacingY: 35,
      transform: { x: 100, y: 200 },
    });
    const seats = compileGrid(prim, EMPTY_MAP);
    expect(seats[0].x).toBe(100);
    expect(seats[0].y).toBe(200);
  });

  it('handles transform rotation (90°)', () => {
    const prim = parseGrid({
      id: 'g8', type: 'seatBlockGrid',
      origin: { x: 0, y: 0 },
      rows: 1, cols: 2, seatSpacingX: 30, seatSpacingY: 35,
      transform: { rotation: 90 },
    });
    const seats = compileGrid(prim, EMPTY_MAP);

    // Pivot = center of dotted area = (3, 0) for this grid
    // Col 0 at origin (0,0) → rotated 90° around (3,0) → (3, -3)
    expect(seats[0].x).toBeCloseTo(3, 1);
    expect(seats[0].y).toBeCloseTo(-3, 1);

    // Col 1 at (30, 0) → rotated 90° around (3,0) → (3, 27)
    expect(seats[1].x).toBeCloseTo(3, 1);
    expect(seats[1].y).toBeCloseTo(27, 1);
  });

  it('stores correct meta for key preservation', () => {
    const prim = parseGrid({
      id: 'myGrid', type: 'seatBlockGrid',
      rows: 2, cols: 3, seatSpacingX: 30, seatSpacingY: 35,
    });
    const seats = compileGrid(prim, EMPTY_MAP);

    expect(seats[0].meta).toEqual({ primitiveId: 'myGrid', logicalRow: 0, logicalSeat: 0 });
    expect(seats[4].meta).toEqual({ primitiveId: 'myGrid', logicalRow: 1, logicalSeat: 1 });
  });

  it('generates 2000+ seats without error', () => {
    const prim = parseGrid({
      id: 'big', type: 'seatBlockGrid',
      rows: 50, cols: 50, seatSpacingX: 25, seatSpacingY: 30,
    });
    const seats = compileGrid(prim, EMPTY_MAP);
    expect(seats).toHaveLength(2500);
    // Spot-check last seat
    const last = seats[seats.length - 1];
    expect(last.row).toBe('AX'); // 50th letter (0-indexed 49) → AX
    expect(last.number).toBe(50);
  });
});
