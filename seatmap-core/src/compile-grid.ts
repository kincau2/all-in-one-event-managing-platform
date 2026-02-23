/**
 * @aioemp/seatmap-core — Grid block compiler
 *
 * Compiles a seatBlockGrid primitive into a flat list of CompiledSeat objects.
 *
 * Algorithm:
 *   x = origin.x + col × spacingX + Σ(gaps before col)
 *   y = origin.y + row × spacingY
 *   → rotate around origin by transform.rotation
 *   → translate by (transform.x, transform.y)
 */

import type { SeatBlockGrid, CompiledSeat } from './types.js';
import type { SeatKeyMap } from './seat-key.js';
import { generateRowLabel, generateUUID, rotatePoint, round2 } from './utils.js';
import { gridPivotOffset } from './pivot.js';

export function compileGrid(
  primitive: SeatBlockGrid,
  keyMap: SeatKeyMap,
  globalSeatRadius: number = 10,
): CompiledSeat[] {
  const {
    id,
    origin,
    rows,
    cols,
    seatSpacingX,
    seatSpacingY,
    rowLabel,
    numbering,
    aisleGaps,
    excludedSeats,
    section,
    transform,
  } = primitive;

  const seatRadius = primitive.seatRadius ?? globalSeatRadius;
  const startNum = (primitive as any).startSeatNumber ?? 1;
  const seats: CompiledSeat[] = [];

  /* ── Rotation pivot = center of dotted area ── */
  const pivot = gridPivotOffset(cols, rows, seatSpacingX, seatSpacingY);
  const pivotCx = origin.x + pivot.x;
  const pivotCy = origin.y + pivot.y;

  for (let r = 0; r < rows; r++) {
    const rowLabelStr = generateRowLabel(
      rowLabel.start,
      r,
      rowLabel.direction,
      rowLabel.mode ?? 'alpha',
    );

    for (let c = 0; c < cols; c++) {
      /* ── Skip excluded seats ── */
      if (excludedSeats?.some(([er, ec]) => er === r && ec === c)) continue;

      /* ── Position in local coordinate space ── */

      // Sum aisle gaps whose afterCol index is before this column
      const gapSum = aisleGaps
        .filter((g) => g.afterCol < c)
        .reduce((sum, g) => sum + g.gapPx, 0);

      let x = origin.x + c * seatSpacingX + gapSum;
      let y = origin.y + r * seatSpacingY;

      /* ── Apply rotation around pivot (center of dotted area) ── */
      if (transform?.rotation) {
        const rotated = rotatePoint(x, y, pivotCx, pivotCy, transform.rotation);
        x = rotated.x;
        y = rotated.y;
      }

      /* ── Apply global translation ── */
      x += transform?.x ?? 0;
      y += transform?.y ?? 0;

      /* ── Numbering / label ── */
      const seatNumber = numbering === 'R2L' ? (cols - c) + (startNum - 1) : c + startNum;
      const label = `${rowLabelStr}-${String(seatNumber).padStart(2, '0')}`;

      /* ── seat_key: preserve or generate ── */
      const logicalKey = `${id}:${r}:${c}`;
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
        meta: { primitiveId: id, logicalRow: r, logicalSeat: c },
      });
    }
  }

  return seats;
}
