/**
 * @aioemp/seatmap-core - Grid block compiler
 *
 * Compiles a seatBlockGrid primitive into a flat list of CompiledSeat objects,
 * plus row-label positions computed in local coords then rotated + translated.
 *
 * Algorithm:
 *   x = origin.x + col * spacingX + sum(gaps before col)
 *   y = origin.y + row * spacingY
 *   -> rotate around pivot by transform.rotation
 *   -> translate by (transform.x, transform.y)
 */

import type { SeatBlockGrid, CompiledSeat, CompiledRowLabel } from './types.js';
import { deterministicSeatKey } from './seat-key.js';
import { generateRowLabel, rotatePoint, round2 } from './utils.js';
import { gridPivotOffset, GRID_PAD, GRID_LBL_W } from './pivot.js';

export interface GridCompileResult {
  seats: CompiledSeat[];
  rowLabels: CompiledRowLabel[];
}

export function compileGrid(
  primitive: SeatBlockGrid,
  globalSeatRadius: number = 10,
): GridCompileResult {
  const {
    id,
    origin = { x: 0, y: 0 },
    rows,
    cols,
    seatSpacingX,
    seatSpacingY,
    aisleGaps = [],
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

  /* -- Build gap lookup: cumulative gap before each column -- */
  const gapBefore = new Float64Array(cols);
  let accGap = 0;
  for (let c = 0; c < cols; c++) {
    for (const g of aisleGaps) {
      if (g.afterCol === c - 1 && c > 0) {
        accGap += g.gapPx;
      }
    }
    gapBefore[c] = accGap;
  }

  /* -- Rotation pivot (center of dotted area) -- */
  const seatW = (cols - 1) * seatSpacingX + gapBefore[cols - 1];
  const seatH = (rows - 1) * seatSpacingY;
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
      if (excludedSeats?.some(([er, ec]) => er === r && ec === c)) continue;

      /* -- Position in local coords -- */
      let x = origin.x + c * seatSpacingX + gapBefore[c];
      let y = origin.y + r * seatSpacingY;

      /* -- Rotate around pivot -- */
      if (transform?.rotation) {
        const rotated = rotatePoint(x, y, pivotCx, pivotCy, transform.rotation);
        x = rotated.x;
        y = rotated.y;
      }

      /* -- Translate -- */
      x += transform?.x ?? 0;
      y += transform?.y ?? 0;

      /* -- Label / key -- */
      const seatNumber = numbering === 'R2L' ? (cols - c) + (startNum - 1) : c + startNum;
      const label = `${rowLabelStr}-${String(seatNumber).padStart(2, '0')}`;

      const seat_key = deterministicSeatKey(id, r, c);

      seats.push({
        seat_key,
        label,
        section: section || undefined,
        row: rowLabelStr,
        number: seatNumber,
        x: round2(x),
        y: round2(y),
        radius: seatRadius,
        rotation: 0,
        meta: { primitiveId: id, logicalRow: r, logicalSeat: c },
      });
    }
  }

  /* -- Row label positions -- */
  const rowLabels: CompiledRowLabel[] = [];

  if (rowLabelDisplay !== 'none') {
    for (let r = 0; r < rows; r++) {
      const rowLabelStr = generateRowLabel(
        rowLabel.start,
        r,
        rowLabel.direction,
        rowLabel.mode ?? 'alpha',
      );
      const rowY = origin.y + r * seatSpacingY;

      /* Left label: centered in the label column (between dotted edge and seat area) */
      if (rowLabelDisplay === 'left' || rowLabelDisplay === 'both') {
        let lx = origin.x - GRID_PAD - GRID_LBL_W * 0.5;
        let ly = rowY;
        if (transform?.rotation) {
          const rotated = rotatePoint(lx, ly, pivotCx, pivotCy, transform.rotation);
          lx = rotated.x;
          ly = rotated.y;
        }
        lx += transform?.x ?? 0;
        ly += transform?.y ?? 0;
        rowLabels.push({ primitiveId: id, row: rowLabelStr, side: 'left', x: round2(lx), y: round2(ly) });
      }

      /* Right label: padded to the right of the last column */
      if (rowLabelDisplay === 'right' || rowLabelDisplay === 'both') {
        let rx = origin.x + seatW + GRID_PAD + GRID_LBL_W * 0.5;
        let ry = rowY;
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
