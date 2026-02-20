/**
 * @aioemp/seatmap-core — Arc block compiler
 *
 * Compiles a seatBlockArc primitive into a flat list of CompiledSeat objects.
 *
 * Algorithm per row i:
 *   radius = startRadius + i × radiusStep
 *   n      = seatsPerRow(i)
 *   usable = (endAngle − startAngle) − Σ gapAngles
 *   step   = usable / (n − 1)          [seats at both endpoints]
 *   θ_j    = startAngle + j × step + Σ(gap angles before j)
 *   x = center.x + radius × cos(θ)
 *   y = center.y + radius × sin(θ)
 *   → rotate around center by transform.rotation
 *   → translate by (transform.x, transform.y)
 */

import type { SeatBlockArc, CompiledSeat, ArcAisleGap } from './types.js';
import type { SeatKeyMap } from './seat-key.js';
import {
  degToRad,
  generateRowLabel,
  generateUUID,
  getSeatsPerRow,
  rotatePoint,
  round2,
} from './utils.js';

/* ── Helpers ── */

interface ResolvedGap {
  afterSeatIndex: number;
  angleDeg: number;
}

/**
 * Resolve per-row aisle gaps:
 *   - `gapAngleDeg` used directly when provided.
 *   - `gapPx` converted to angle via arc-length formula:
 *       angle(deg) = (gapPx / radius) × (180 / π)
 */
function resolveGaps(
  aisleGaps: ArcAisleGap[],
  radius: number,
): ResolvedGap[] {
  return aisleGaps.map((g) => {
    let angleDeg = g.gapAngleDeg;
    if (angleDeg === undefined && g.gapPx !== undefined && radius > 0) {
      angleDeg = (g.gapPx / radius) * (180 / Math.PI);
    }
    return { afterSeatIndex: g.afterSeatIndex, angleDeg: angleDeg ?? 0 };
  });
}

/* ── Main compiler ── */

export function compileArc(
  primitive: SeatBlockArc,
  keyMap: SeatKeyMap,
): CompiledSeat[] {
  const {
    id,
    center,
    rowCount,
    startRadius,
    radiusStep,
    startAngleDeg,
    endAngleDeg,
    seatsPerRow,
    aisleGaps,
    section,
    transform,
  } = primitive;

  const seats: CompiledSeat[] = [];

  for (let r = 0; r < rowCount; r++) {
    const radius = startRadius + r * radiusStep;
    const n = getSeatsPerRow(seatsPerRow, r);
    if (n <= 0) continue;

    const rowLabelStr = generateRowLabel('A', r, 'asc');

    /* ── Resolve aisle gap angles for this radius ── */
    const gaps = resolveGaps(aisleGaps, radius);
    const totalGapAngle = gaps.reduce((s, g) => s + g.angleDeg, 0);

    /* ── Usable angle & step ── */
    const totalAngle = endAngleDeg - startAngleDeg;
    const usableAngle = totalAngle - totalGapAngle;
    // For a single seat, place at the midpoint of the arc.
    const step = n > 1 ? usableAngle / (n - 1) : 0;

    for (let s = 0; s < n; s++) {
      /* base angle for this seat */
      const baseAngle =
        n === 1
          ? startAngleDeg + totalAngle / 2
          : startAngleDeg + s * step;

      /* accumulated gap angle from all gaps before this seat index */
      const accGap = gaps
        .filter((g) => g.afterSeatIndex < s)
        .reduce((sum, g) => sum + g.angleDeg, 0);

      const angleDeg = baseAngle + accGap;
      const angleRad = degToRad(angleDeg);

      let x = center.x + radius * Math.cos(angleRad);
      let y = center.y + radius * Math.sin(angleRad);

      /* ── Apply rotation around center ── */
      if (transform?.rotation) {
        const rotated = rotatePoint(x, y, center.x, center.y, transform.rotation);
        x = rotated.x;
        y = rotated.y;
      }

      /* ── Apply global translation ── */
      x += transform?.x ?? 0;
      y += transform?.y ?? 0;

      /* ── Label / key ── */
      const seatNumber = s + 1;
      const label = `${rowLabelStr}-${String(seatNumber).padStart(2, '0')}`;

      const logicalKey = `${id}:${r}:${s}`;
      const seat_key = keyMap.get(logicalKey) ?? generateUUID();

      seats.push({
        seat_key,
        label,
        section: section || undefined,
        row: rowLabelStr,
        number: seatNumber,
        x: round2(x),
        y: round2(y),
        rotation: round2(angleDeg + 90), // tangent direction
        meta: { primitiveId: id, logicalRow: r, logicalSeat: s },
      });
    }
  }

  return seats;
}
