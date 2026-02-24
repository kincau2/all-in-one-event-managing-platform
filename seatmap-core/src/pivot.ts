/**
 * @aioemp/seatmap-core — Rotation pivot helpers
 *
 * Compute the rotation pivot (center of the visual dotted area)
 * for grid and arc seat blocks.
 * Shared by the compiler and the editor renderer to ensure
 * compiled seat positions match the Konva visual.
 */

/* ── Visual constants (shared with PrimitiveRenderer) ── */

/** Pixel padding around the seat area in a grid block. */
export const GRID_PAD = 21;

/** Row-label column width (each side of grid dotted area). */
export const GRID_LBL_W = 24;

/** Radial pixel padding around an arc/wedge sector. */
export const ARC_PAD = 21;

/** Extra angular pixels for row labels in an arc block. */
export const ARC_LBL_ANG = 33;

/* ── Pivot offset functions ── */

/**
 * Rotation pivot offset for a grid block, in local coords relative to origin.
 * Returns the center of the visual dotted rectangle.
 */
export function gridPivotOffset(
  cols: number,
  rows: number,
  seatSpacingX: number,
  seatSpacingY: number,
): { x: number; y: number } {
  const seatW = (cols - 1) * seatSpacingX;
  const seatH = (rows - 1) * seatSpacingY;
  const lx = -GRID_PAD - GRID_LBL_W;
  const ly = -GRID_PAD;
  const rectW = seatW + 2 * GRID_PAD + 2 * GRID_LBL_W;
  const rectH = seatH + 2 * GRID_PAD;
  return { x: lx + rectW / 2, y: ly + rectH / 2 };
}

/**
 * Rotation pivot offset for an arc block, in local coords relative to center.
 * Returns the center of the visual dotted sector bounding box.
 */
export function arcPivotOffset(
  startRadius: number,
  rowCount: number,
  radiusStep: number,
  radiusRatio: number,
  startAngleDeg: number,
  endAngleDeg: number,
): { x: number; y: number } {
  const innerBase = startRadius;
  const outerBase = innerBase + (rowCount - 1) * radiusStep;
  const outerRx = outerBase * radiusRatio + ARC_PAD;
  const outerRy = outerBase + ARC_PAD;
  const innerRx = Math.max(0, innerBase * radiusRatio - ARC_PAD);
  const innerRy = Math.max(0, innerBase - ARC_PAD);
  const angPad = outerBase > 0 ? (ARC_PAD + ARC_LBL_ANG) / outerBase : 0;
  const startRad = (startAngleDeg * Math.PI) / 180 - angPad;
  const endRad = (endAngleDeg * Math.PI) / 180 + angPad;

  let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
  for (let i = 0; i <= 32; i++) {
    const a = startRad + ((endRad - startRad) * i) / 32;
    const cos = Math.cos(a), sin = Math.sin(a);
    for (const [rx, ry] of [[innerRx, innerRy], [outerRx, outerRy]] as const) {
      const px = rx * cos, py = ry * sin;
      sMinX = Math.min(sMinX, px); sMinY = Math.min(sMinY, py);
      sMaxX = Math.max(sMaxX, px); sMaxY = Math.max(sMaxY, py);
    }
  }

  return { x: (sMinX + sMaxX) / 2, y: (sMinY + sMaxY) / 2 };
}
