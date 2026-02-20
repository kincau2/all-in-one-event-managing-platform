/**
 * Tests — Zod schema validation
 */
import { describe, it, expect } from 'vitest';
import {
  LayoutSchema,
  SeatBlockGridSchema,
  SeatBlockArcSchema,
  SeatBlockWedgeSchema,
  StagePrimitiveSchema,
  LabelPrimitiveSchema,
  ObstaclePrimitiveSchema,
} from '../src/schema.js';

/* ── Helpers ── */

function minLayout(primitives: unknown[] = []) {
  return {
    schemaVersion: 1,
    canvas: { w: 800, h: 600 },
    primitives,
  };
}

/* ── Layout ── */

describe('LayoutSchema', () => {
  it('accepts a minimal valid layout', () => {
    const result = LayoutSchema.safeParse(minLayout());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('');
      expect(result.data.canvas.unit).toBe('px');
      expect(result.data.compiled.seats).toEqual([]);
    }
  });

  it('rejects missing schemaVersion', () => {
    const result = LayoutSchema.safeParse({ canvas: { w: 800, h: 600 }, primitives: [] });
    expect(result.success).toBe(false);
  });

  it('rejects invalid schemaVersion', () => {
    const result = LayoutSchema.safeParse({ schemaVersion: 2, canvas: { w: 800, h: 600 }, primitives: [] });
    expect(result.success).toBe(false);
  });

  it('rejects canvas with non-positive dimensions', () => {
    const result = LayoutSchema.safeParse({ schemaVersion: 1, canvas: { w: 0, h: 600 }, primitives: [] });
    expect(result.success).toBe(false);
  });
});

/* ── Stage ── */

describe('StagePrimitiveSchema', () => {
  it('accepts a valid stage', () => {
    const result = StagePrimitiveSchema.safeParse({
      id: 's1', type: 'stage', width: 200, height: 50,
    });
    expect(result.success).toBe(true);
  });

  it('rejects stage with zero width', () => {
    const result = StagePrimitiveSchema.safeParse({
      id: 's1', type: 'stage', width: 0, height: 50,
    });
    expect(result.success).toBe(false);
  });
});

/* ── Label ── */

describe('LabelPrimitiveSchema', () => {
  it('accepts a valid label with default fontSize', () => {
    const result = LabelPrimitiveSchema.safeParse({
      id: 'l1', type: 'label', text: 'Section A',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fontSize).toBe(16);
    }
  });
});

/* ── Obstacle ── */

describe('ObstaclePrimitiveSchema', () => {
  it('accepts a valid obstacle', () => {
    const result = ObstaclePrimitiveSchema.safeParse({
      id: 'o1', type: 'obstacle', width: 40, height: 40,
    });
    expect(result.success).toBe(true);
  });
});

/* ── seatBlockGrid ── */

describe('SeatBlockGridSchema', () => {
  it('accepts a full grid definition', () => {
    const result = SeatBlockGridSchema.safeParse({
      id: 'g1',
      type: 'seatBlockGrid',
      rows: 5,
      cols: 10,
      seatSpacingX: 30,
      seatSpacingY: 35,
      section: 'Main',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.origin).toEqual({ x: 0, y: 0 });
      expect(result.data.numbering).toBe('L2R');
      expect(result.data.aisleGaps).toEqual([]);
      expect(result.data.rowLabel).toEqual({ start: 'A', direction: 'asc' });
    }
  });

  it('rejects grid with zero rows', () => {
    const result = SeatBlockGridSchema.safeParse({
      id: 'g1', type: 'seatBlockGrid',
      rows: 0, cols: 10, seatSpacingX: 30, seatSpacingY: 35,
    });
    expect(result.success).toBe(false);
  });

  it('accepts aisle gaps', () => {
    const result = SeatBlockGridSchema.safeParse({
      id: 'g1', type: 'seatBlockGrid',
      rows: 3, cols: 10, seatSpacingX: 30, seatSpacingY: 35,
      aisleGaps: [{ afterCol: 4, gapPx: 40 }],
    });
    expect(result.success).toBe(true);
  });
});

/* ── seatBlockArc ── */

describe('SeatBlockArcSchema', () => {
  it('accepts a valid arc with start/delta seatsPerRow', () => {
    const result = SeatBlockArcSchema.safeParse({
      id: 'a1', type: 'seatBlockArc',
      center: { x: 400, y: 400 },
      rowCount: 5, startRadius: 200, radiusStep: 35,
      startAngleDeg: -60, endAngleDeg: 60,
      seatsPerRow: { start: 18, delta: 2 },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid arc with array seatsPerRow', () => {
    const result = SeatBlockArcSchema.safeParse({
      id: 'a2', type: 'seatBlockArc',
      center: { x: 400, y: 400 },
      rowCount: 3, startRadius: 200, radiusStep: 35,
      startAngleDeg: -60, endAngleDeg: 60,
      seatsPerRow: [18, 20, 22],
    });
    expect(result.success).toBe(true);
  });
});

/* ── seatBlockWedge ── */

describe('SeatBlockWedgeSchema', () => {
  it('accepts a valid wedge', () => {
    const result = SeatBlockWedgeSchema.safeParse({
      id: 'w1', type: 'seatBlockWedge',
      center: { x: 500, y: 500 },
      innerRadius: 100, outerRadius: 300,
      startAngleDeg: 0, endAngleDeg: 45,
      rowCount: 4,
      seatsPerRow: { start: 8, delta: 2 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects wedge with outerRadius = 0', () => {
    const result = SeatBlockWedgeSchema.safeParse({
      id: 'w1', type: 'seatBlockWedge',
      center: { x: 0, y: 0 },
      innerRadius: 0, outerRadius: 0,
      startAngleDeg: 0, endAngleDeg: 90,
      rowCount: 1, seatsPerRow: [5],
    });
    expect(result.success).toBe(false);
  });
});

/* ── Layout with mixed primitives ── */

describe('Layout with primitives', () => {
  it('accepts layout with mixed primitive types', () => {
    const result = LayoutSchema.safeParse(
      minLayout([
        { id: 's1', type: 'stage', width: 200, height: 50 },
        { id: 'l1', type: 'label', text: 'Balcony' },
        {
          id: 'g1', type: 'seatBlockGrid',
          rows: 3, cols: 8, seatSpacingX: 30, seatSpacingY: 35,
        },
        {
          id: 'a1', type: 'seatBlockArc',
          center: { x: 400, y: 400 },
          rowCount: 2, startRadius: 200, radiusStep: 35,
          startAngleDeg: -60, endAngleDeg: 60,
          seatsPerRow: [10, 12],
        },
      ]),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.primitives).toHaveLength(4);
    }
  });

  it('rejects layout with unknown primitive type', () => {
    const result = LayoutSchema.safeParse(
      minLayout([{ id: 'x', type: 'unknown_thing' }]),
    );
    expect(result.success).toBe(false);
  });
});
