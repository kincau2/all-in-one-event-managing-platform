/**
 * @aioemp/seatmap-core — public barrel export
 */

/* ── Schemas (Zod) ── */
export {
  LayoutSchema,
  PrimitiveSchema,
  CompiledSeatSchema,
  BoundsSchema,
  CompiledSchema,
  CanvasSchema,
  TransformSchema,
  PointSchema,
  RowLabelSchema,
  GridAisleGapSchema,
  ArcAisleGapSchema,
  SeatsPerRowSchema,
  StagePrimitiveSchema,
  LabelPrimitiveSchema,
  ObstaclePrimitiveSchema,
  SeatBlockGridSchema,
  SeatBlockArcSchema,
  SeatBlockWedgeSchema,
  CompiledRowLabelSchema,
  RowLabelDisplaySchema,
} from './schema.js';

/* ── Types ── */
export type {
  Layout,
  LayoutInput,
  Primitive,
  PrimitiveInput,
  CompiledSeat,
  Bounds,
  Compiled,
  Canvas,
  Transform,
  Point,
  RowLabel,
  GridAisleGap,
  ArcAisleGap,
  SeatsPerRow,
  StagePrimitive,
  LabelPrimitive,
  ObstaclePrimitive,
  SeatBlockGrid,
  SeatBlockArc,
  SeatBlockWedge,
  CompiledRowLabel,
  RowLabelDisplay,
} from './types.js';

/* ── Compile ── */
export {
  compileLayout,
  validateAndCompile,
  computeBounds,
  type CompileResult,
} from './compile-layout.js';
export { compileGrid, type GridCompileResult } from './compile-grid.js';
export { compileArc, type ArcCompileResult } from './compile-arc.js';
export { compileWedge } from './compile-wedge.js';

/* ── seat_key utilities ── */
export { buildSeatKeyMap, type SeatKeyMap } from './seat-key.js';

/* ── Rotation pivot ── */
export {
  gridPivotOffset,
  arcPivotOffset,
  GRID_PAD,
  GRID_LBL_W,
  ARC_PAD,
  ARC_LBL_ANG,
} from './pivot.js';

/* ── General utilities ── */
export {
  degToRad,
  rotatePoint,
  generateRowLabel,
  indexToLabel,
  labelToIndex,
  getSeatsPerRow,
  generateUUID,
  round2,
} from './utils.js';
