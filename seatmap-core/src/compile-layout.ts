/**
 * @aioemp/seatmap-core — Layout compiler (orchestrator)
 *
 * Iterates primitives, dispatches to the per-type compilers,
 * aggregates compiled seats, and computes bounds.
 */

import type { Layout, CompiledSeat, Bounds, CompiledRowLabel } from './types.js';
import { LayoutSchema } from './schema.js';
import { compileGrid } from './compile-grid.js';
import { compileArc } from './compile-arc.js';
import { compileWedge } from './compile-wedge.js';
import { round2 } from './utils.js';

/* ──────────────────────────────────────────────
 * compileLayout
 * ────────────────────────────────────────────── */

/**
 * Compile all seat-producing primitives within a Layout.
 *
 * Seat keys are deterministic (derived from primitiveId + row + seat index),
 * so no previous layout is needed for key preservation.
 *
 * @param layout - A **parsed** Layout object (already validated).
 * @returns A new Layout with `compiled.seats` and `compiled.bounds` populated.
 */
export function compileLayout(layout: Layout): Layout {
  const allSeats: CompiledSeat[] = [];
  const allRowLabels: CompiledRowLabel[] = [];
  const globalSeatRadius = layout.seatRadius ?? 10;

  for (const primitive of layout.primitives) {
    switch (primitive.type) {
      case 'seatBlockGrid': {
        const result = compileGrid(primitive, globalSeatRadius);
        allSeats.push(...result.seats);
        allRowLabels.push(...result.rowLabels);
        break;
      }
      case 'seatBlockArc': {
        const result = compileArc(primitive, globalSeatRadius);
        allSeats.push(...result.seats);
        allRowLabels.push(...result.rowLabels);
        break;
      }
      case 'seatBlockWedge':
        allSeats.push(...compileWedge(primitive, globalSeatRadius));
        break;
      // stage, label, obstacle — decorative, produce no seats
    }
  }

  const bounds = computeBounds(allSeats);

  return {
    ...layout,
    compiled: { seats: allSeats, rowLabels: allRowLabels, bounds },
  };
}

/* ──────────────────────────────────────────────
 * validateAndCompile  (Zod parse → compile in one call)
 * ────────────────────────────────────────────── */

export type CompileResult =
  | { success: true; layout: Layout }
  | { success: false; errors: import('zod').ZodError };

/**
 * Parse raw JSON with Zod, then compile if valid.
 *
 * @param rawLayout - Untrusted input (e.g. from REST body / localStorage).
 */
export function validateAndCompile(rawLayout: unknown): CompileResult {
  const result = LayoutSchema.safeParse(rawLayout);

  if (!result.success) {
    return { success: false, errors: result.error };
  }

  const compiled = compileLayout(result.data);
  return { success: true, layout: compiled };
}

/* ──────────────────────────────────────────────
 * computeBounds
 * ────────────────────────────────────────────── */

export function computeBounds(seats: CompiledSeat[]): Bounds {
  if (seats.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const s of seats) {
    if (s.x < minX) minX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.x > maxX) maxX = s.x;
    if (s.y > maxY) maxY = s.y;
  }

  return {
    minX: round2(minX),
    minY: round2(minY),
    maxX: round2(maxX),
    maxY: round2(maxY),
  };
}
