/**
 * @aioemp/seatmap-core — Arc block compiler
 *
 * Compiles a seatBlockArc primitive into a flat list of CompiledSeat objects,
 * plus row-label positions computed in local coords then rotated + translated.
 */

import type { SeatBlockArc, CompiledSeat, ArcAisleGap, CompiledRowLabel } from './types.js';
import type { SeatKeyMap } from './seat-key.js';
import {
  degToRad,
  generateRowLabel,
  generateUUID,
  getSeatsPerRow,
  rotatePoint,
  round2,
} from './utils.js';
import { arcPivotOffset, ARC_PAD, ARC_LBL_ANG } from './pivot.js';

/* -- Helpers -- */

interface ResolvedGap {
  afterSeatIndex: number;
  angleDeg: number;
}

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

/* -- Main compiler -- */

export interface ArcCompileResult {
  seats: CompiledSeat[];
  rowLabels: CompiledRowLabel[];
}

export function compileArc(
  primitive: SeatBlockArc,
  keyMap: SeatKeyMap,
  globalSeatRadius: number = 10,
): ArcCompileResult {
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
  const rowLabelDisplay = primitive.rowLabelDisplay ?? 'left';
  const seats: CompiledSeat[] = [];

  /* -- Rotation pivot = center of dotted area -- */
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

    const avgRadius = (radiusX + radiusY) / 2;
    const gaps = resolveGaps(aisleGaps, avgRadius);
    const totalGapAngle = gaps.reduce((s, g) => s + g.angleDeg, 0);

    const totalAngle = endAngleDeg - startAngleDeg;
    const usableAngle = totalAngle - totalGapAngle;
    const step = n > 1 ? usableAngle / (n - 1) : 0;

    for (let s = 0; s < n; s++) {
      if (excludedSeats?.some(([er, ec]) => er === r && ec === s)) continue;

      const baseAngle =
        n === 1
          ? startAngleDeg + totalAngle / 2
          : startAngleDeg + s * step;

      const accGap = gaps
        .filter((g) => g.afterSeatIndex < s)
        .reduce((sum, g) => sum + g.angleDeg, 0);

      const angleDeg = baseAngle + accGap;
      const angleRad = degToRad(angleDeg);

      let x = center.x + radiusX * Math.cos(angleRad);
      let y = center.y + radiusY * Math.sin(angleRad);

      if (transform?.rotation) {
        const rotated = rotatePoint(x, y, pivotCx, pivotCy, transform.rotation);
        x = rotated.x;
        y = rotated.y;
      }

      x += transform?.x ?? 0;
      y += transform?.y ?? 0;

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
        rotation: round2(angleDeg + 90),
        meta: { primitiveId: id, logicalRow: r, logicalSeat: s },
      });
    }
  }

  /* -- Row label positions -- */
  const rowLabels: CompiledRowLabel[] = [];

  if (rowLabelDisplay !== 'none') {
    for (let r = 0; r < rowCount; r++) {
      const baseRadius = startRadius + r * radiusStep;
      const radiusX = baseRadius * radiusRatio;
      const radiusY = baseRadius;
      const avgRadius = (radiusX + radiusY) / 2;

      /* Angular offset to push labels beyond the seat arc into the label zone */
      const labelOffsetDeg = avgRadius > 0
        ? (ARC_PAD + ARC_LBL_ANG * 0.5) / avgRadius * (180 / Math.PI)
        : 0;

      const rowLabelStr = generateRowLabel(
        rowLabel.start,
        r,
        rowLabel.direction,
        rowLabel.mode ?? 'alpha',
      );

      if (rowLabelDisplay === 'left' || rowLabelDisplay === 'both') {
        const angleRad = degToRad(startAngleDeg - labelOffsetDeg);
        let lx = center.x + radiusX * Math.cos(angleRad);
        let ly = center.y + radiusY * Math.sin(angleRad);
        if (transform?.rotation) {
          const rotated = rotatePoint(lx, ly, pivotCx, pivotCy, transform.rotation);
          lx = rotated.x;
          ly = rotated.y;
        }
        lx += transform?.x ?? 0;
        ly += transform?.y ?? 0;
        rowLabels.push({ primitiveId: id, row: rowLabelStr, side: 'left', x: round2(lx), y: round2(ly) });
      }

      if (rowLabelDisplay === 'right' || rowLabelDisplay === 'both') {
        const angleRad = degToRad(endAngleDeg + labelOffsetDeg);
        let rx = center.x + radiusX * Math.cos(angleRad);
        let ry = center.y + radiusY * Math.sin(angleRad);
        if (transform?.rotation) {
          const rotated = rotatePoint(rx, ry, pivotCx, pivotCy, transform.rotation);
          rx = rotated.x;
          ry = rotated.y;
        }
        rx += transform?.x ?? 0;
        ry += transform?.y ?? 0;
        rowLabels.push({ primitiveId: id, row: rowLabelStr, side: 'right', x: round2(rx), y: round2(ry) });
      }
    }
  }

  return { seats, rowLabels };
}
