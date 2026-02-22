/**
 * @aioemp/seatmap-core — Layout compiler (orchestrator)
 *
 * Iterates primitives, dispatches to the per-type compilers,
 * aggregates compiled seats, and computes bounds.
 */

import type { Layout, CompiledSeat, Bounds } from './types.js';
import { LayoutSchema } from './schema.js';
import { compileGrid } from './compile-grid.js';
import { compileArc } from './compile-arc.js';
import { compileWedge } from './compile-wedge.js';
import { buildSeatKeyMap, type SeatKeyMap } from './seat-key.js';
import { round2 } from './utils.js';

/* ──────────────────────────────────────────────
 * compileLayout
 * ────────────────────────────────────────────── */

/**
 * Compile all seat-producing primitives within a Layout.
 *
 * @param layout         - A **parsed** Layout object (already validated).
 * @param existingLayout - Previous layout whose compiled.seats are used
 *                         to preserve seat_keys.
 * @returns A new Layout with `compiled.seats` and `compiled.bounds` populated.
 */
export function compileLayout(
  layout: Layout,
  existingLayout?: Layout,
): Layout {
  // Build key map from existing compiled seats for preservation
  const keyMap: SeatKeyMap = existingLayout?.compiled?.seats
    ? buildSeatKeyMap(existingLayout.compiled.seats)
    : new Map();

  const allSeats: CompiledSeat[] = [];
  const globalSeatRadius = layout.seatRadius ?? 10;

  for (const primitive of layout.primitives) {
    switch (primitive.type) {
      case 'seatBlockGrid':
        allSeats.push(...compileGrid(primitive, keyMap, globalSeatRadius));
        break;
      case 'seatBlockArc':
        allSeats.push(...compileArc(primitive, keyMap, globalSeatRadius));
        break;
      case 'seatBlockWedge':
        allSeats.push(...compileWedge(primitive, keyMap, globalSeatRadius));
        break;
      // stage, label, obstacle — decorative, produce no seats
    }
  }

  const bounds = computeBounds(allSeats);

  return {
    ...layout,
    compiled: { seats: allSeats, bounds },
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
 * @param rawLayout      - Untrusted input (e.g. from REST body / localStorage).
 * @param existingLayout - Previous layout for seat_key preservation.
 */
export function validateAndCompile(
  rawLayout: unknown,
  existingLayout?: Layout,
): CompileResult {
  const result = LayoutSchema.safeParse(rawLayout);

  if (!result.success) {
    return { success: false, errors: result.error };
  }

  const compiled = compileLayout(result.data, existingLayout);
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
