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
import { arcPivotOffset } from './pivot.js';

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
  globalSeatRadius: number = 10,
): CompiledSeat[] {
  const {
    id,
    center,
    rowCount,
    startRadius,
    radiusStep,
    radiusRatio = 1,
    startAngleDeg,
    endAngleDeg,
    seatsPerRow,
    aisleGaps,
    excludedSeats,
    section,
    transform,
  } = primitive;

  const seatRadius = primitive.seatRadius ?? globalSeatRadius;
  const rowLabel = primitive.rowLabel ?? { mode: 'alpha' as const, start: 'A', direction: 'asc' as const };
  const numbering = primitive.numbering ?? 'L2R';
  const startNum = (primitive as any).startSeatNumber ?? 1;
  const seats: CompiledSeat[] = [];

  /* ── Rotation pivot = center of dotted area ── */
  const pivot = arcPivotOffset(startRadius, rowCount, radiusStep, radiusRatio, startAngleDeg, endAngleDeg);
  const pivotCx = center.x + pivot.x;
  const pivotCy = center.y + pivot.y;

  for (let r = 0; r < rowCount; r++) {
    const baseRadius = startRadius + r * radiusStep;
    const radiusX = baseRadius * radiusRatio;
    const radiusY = baseRadius;
    const n = getSeatsPerRow(seatsPerRow, r);
    if (n <= 0) continue;

    const rowLabelStr = generateRowLabel(
      rowLabel.start,
      r,
      rowLabel.direction,
      rowLabel.mode ?? 'alpha',
    );

    /* ── Resolve aisle gap angles for this radius ── */
    // Use the average radius for gap angle conversion (approximation for ellipses).
    const avgRadius = (radiusX + radiusY) / 2;
    const gaps = resolveGaps(aisleGaps, avgRadius);
    const totalGapAngle = gaps.reduce((s, g) => s + g.angleDeg, 0);

    /* ── Usable angle & step ── */
    const totalAngle = endAngleDeg - startAngleDeg;
    const usableAngle = totalAngle - totalGapAngle;
    // For a single seat, place at the midpoint of the arc.
    const step = n > 1 ? usableAngle / (n - 1) : 0;

    for (let s = 0; s < n; s++) {
      /* ── Skip excluded seats ── */
      if (excludedSeats?.some(([er, ec]) => er === r && ec === s)) continue;

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

      // Ellipse: x uses radiusX, y uses radiusY.
      let x = center.x + radiusX * Math.cos(angleRad);
      let y = center.y + radiusY * Math.sin(angleRad);

      /* ── Apply rotation around pivot (center of dotted area) ── */
      if (transform?.rotation) {
        const rotated = rotatePoint(x, y, pivotCx, pivotCy, transform.rotation);
        x = rotated.x;
        y = rotated.y;
      }

      /* ── Apply global translation ── */
      x += transform?.x ?? 0;
      y += transform?.y ?? 0;

      /* ── Label / key ── */
      const seatNumber = numbering === 'R2L' ? (n - s) + (startNum - 1) : s + startNum;
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
        radius: seatRadius,
        rotation: round2(angleDeg + 90), // tangent direction
        meta: { primitiveId: id, logicalRow: r, logicalSeat: s },
      });
    }
  }

  return seats;
}
