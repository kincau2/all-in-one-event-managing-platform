/**
 * @aioemp/seatmap-core — Wedge block compiler
 *
 * Compiles a seatBlockWedge primitive into a flat list of CompiledSeat objects.
 *
 * A wedge is an arena pie-slice section bounded between innerRadius and
 * outerRadius and between startAngleDeg and endAngleDeg. Each row is at
 * an interpolated radius between inner and outer.
 *
 * Algorithm per row i:
 *   radius = innerRadius + i × (outerRadius − innerRadius) / (rowCount − 1)
 *   n      = seatsPerRow(i)
 *   θ_j    = startAngle + j × (endAngle − startAngle) / (n − 1)
 *   x = center.x + radius × cos(θ)
 *   y = center.y + radius × sin(θ)
 *   → rotate around center by transform.rotation
 *   → translate by (transform.x, transform.y)
 */

import type { SeatBlockWedge, CompiledSeat } from './types.js';
import { deterministicSeatKey } from './seat-key.js';
import {
  degToRad,
  generateRowLabel,
  getSeatsPerRow,
  rotatePoint,
  round2,
} from './utils.js';

export function compileWedge(
  primitive: SeatBlockWedge,
  globalSeatRadius: number = 10,
): CompiledSeat[] {
  const {
    id,
    center,
    innerRadius,
    outerRadius,
    startAngleDeg,
    endAngleDeg,
    rowCount,
    seatsPerRow,
    excludedSeats,
    section,
    transform,
  } = primitive;

  const seatRadius = primitive.seatRadius ?? globalSeatRadius;
  const rowLabel = primitive.rowLabel ?? { mode: 'alpha' as const, start: 'A', direction: 'asc' as const };
  const numbering = primitive.numbering ?? 'L2R';
  const seats: CompiledSeat[] = [];
  const totalAngle = endAngleDeg - startAngleDeg;

  for (let r = 0; r < rowCount; r++) {
    /* ── Interpolate radius between inner & outer ── */
    const radius =
      rowCount === 1
        ? (innerRadius + outerRadius) / 2
        : innerRadius + r * ((outerRadius - innerRadius) / (rowCount - 1));

    const n = getSeatsPerRow(seatsPerRow, r);
    if (n <= 0) continue;

    const rowLabelStr = generateRowLabel(
      rowLabel.start,
      r,
      rowLabel.direction,
      rowLabel.mode ?? 'alpha',
    );

    for (let s = 0; s < n; s++) {
      /* ── Skip excluded seats ── */
      if (excludedSeats?.some(([er, ec]) => er === r && ec === s)) continue;

      /* ── Distribute seats evenly along the wedge arc ── */
      const angleDeg =
        n === 1
          ? startAngleDeg + totalAngle / 2
          : startAngleDeg + s * (totalAngle / (n - 1));

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
      const seatNumber = numbering === 'R2L' ? n - s : s + 1;
      const label = `${rowLabelStr}-${String(seatNumber).padStart(2, '0')}`;

      const seat_key = deterministicSeatKey(id, r, s);

      seats.push({
        seat_key,
        label,
        section: section || undefined,
        row: rowLabelStr,
        number: seatNumber,
        x: round2(x),
        y: round2(y),
        radius: seatRadius,
        rotation: round2(angleDeg + 90), // tangent direction
        meta: { primitiveId: id, logicalRow: r, logicalSeat: s },
      });
    }
  }

  return seats;
}
