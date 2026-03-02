/**
 * Tests — compileLayout orchestrator + validateAndCompile
 */
import { describe, it, expect } from 'vitest';
import { compileLayout, validateAndCompile, computeBounds } from '../src/compile-layout.js';
import { LayoutSchema } from '../src/schema.js';
import type { Layout, CompiledSeat } from '../src/types.js';

/* ── Helpers ── */

function minLayout(primitives: unknown[] = []) {
  return {
    schemaVersion: 1 as const,
    canvas: { w: 800, h: 600 },
    primitives,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ── Tests ── */

describe('compileLayout', () => {
  it('returns empty compiled for layout with no seat blocks', () => {
    const layout = LayoutSchema.parse(minLayout([
      { id: 'l1', type: 'label', text: 'Info' },
      { id: 'o1', type: 'obstacle', width: 30, height: 30 },
    ]));
    const result = compileLayout(layout);
    expect(result.compiled.seats).toHaveLength(0);
    expect(result.compiled.bounds).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });

  it('compiles mixed grid + arc primitives', () => {
    const layout = LayoutSchema.parse(minLayout([
      {
        id: 'g1', type: 'seatBlockGrid',
        rows: 3, cols: 5, seatSpacingX: 30, seatSpacingY: 35,
      },
      {
        id: 'a1', type: 'seatBlockArc',
        center: { x: 400, y: 300 },
        rowCount: 2, startRadius: 150, radiusStep: 30,
        startAngleDeg: -30, endAngleDeg: 30,
        seatsPerRow: [6, 8],
      },
    ]));
    const result = compileLayout(layout);
    // Grid: 15 seats, Arc: 14 seats → 29 total
    expect(result.compiled.seats).toHaveLength(29);
    // All seats have valid UUIDs
    for (const s of result.compiled.seats) {
      expect(s.seat_key).toMatch(UUID_RE);
    }
  });

  it('computes correct bounds', () => {
    const layout = LayoutSchema.parse(minLayout([
      {
        id: 'g1', type: 'seatBlockGrid',
        origin: { x: 100, y: 50 },
        rows: 2, cols: 3, seatSpacingX: 30, seatSpacingY: 40,
      },
    ]));
    const result = compileLayout(layout);
    expect(result.compiled.bounds.minX).toBe(100);
    expect(result.compiled.bounds.minY).toBe(50);
    expect(result.compiled.bounds.maxX).toBe(160);
    expect(result.compiled.bounds.maxY).toBe(90);
  });

  it('preserves non-compiled layout fields', () => {
    const layout = LayoutSchema.parse({
      schemaVersion: 1,
      title: 'Test Hall',
      canvas: { w: 1600, h: 900, unit: 'px' },
      primitives: [
        { id: 'g1', type: 'seatBlockGrid', rows: 1, cols: 1, seatSpacingX: 30, seatSpacingY: 35 },
      ],
    });
    const result = compileLayout(layout);
    expect(result.title).toBe('Test Hall');
    expect(result.canvas.w).toBe(1600);
    expect(result.schemaVersion).toBe(1);
  });
});

describe('computeBounds', () => {
  it('returns zeroes for empty seat list', () => {
    expect(computeBounds([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });

  it('computes correct bounds for multiple seats', () => {
    const seats: CompiledSeat[] = [
      { seat_key: '00000000-0000-4000-8000-000000000001', label: 'A', x: 10, y: 20 },
      { seat_key: '00000000-0000-4000-8000-000000000002', label: 'B', x: -5, y: 100 },
      { seat_key: '00000000-0000-4000-8000-000000000003', label: 'C', x: 200, y: -30 },
    ];
    const bounds = computeBounds(seats);
    expect(bounds.minX).toBe(-5);
    expect(bounds.minY).toBe(-30);
    expect(bounds.maxX).toBe(200);
    expect(bounds.maxY).toBe(100);
  });
});

describe('validateAndCompile', () => {
  it('returns success + compiled layout for valid input', () => {
    const raw = minLayout([
      { id: 'g1', type: 'seatBlockGrid', rows: 2, cols: 3, seatSpacingX: 30, seatSpacingY: 35 },
    ]);
    const result = validateAndCompile(raw);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.layout.compiled.seats).toHaveLength(6);
    }
  });

  it('returns failure with Zod errors for invalid input', () => {
    const result = validateAndCompile({ schemaVersion: 99 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.issues.length).toBeGreaterThan(0);
    }
  });

  it('produces deterministic keys across independent calls', () => {
    const raw = minLayout([
      { id: 'g1', type: 'seatBlockGrid', rows: 2, cols: 2, seatSpacingX: 30, seatSpacingY: 35 },
    ]);
    const first = validateAndCompile(raw);
    expect(first.success).toBe(true);
    if (!first.success) return;

    const second = validateAndCompile(raw);
    expect(second.success).toBe(true);
    if (!second.success) return;

    for (let i = 0; i < first.layout.compiled.seats.length; i++) {
      expect(second.layout.compiled.seats[i].seat_key).toBe(
        first.layout.compiled.seats[i].seat_key,
      );
    }
  });
});
