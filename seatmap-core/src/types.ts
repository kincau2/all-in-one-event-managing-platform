/**
 * @aioemp/seatmap-core — TypeScript Types (inferred from Zod schemas)
 */

import { z } from 'zod';
import {
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
  ImagePrimitiveSchema,
  SeatBlockGridSchema,
  SeatBlockArcSchema,
  SeatBlockWedgeSchema,
  CompiledRowLabelSchema,
  RowLabelDisplaySchema,
} from './schema.js';

/* ── Inferred output types (post-parse, with defaults applied) ── */

export type Layout = z.infer<typeof LayoutSchema>;
export type Primitive = z.infer<typeof PrimitiveSchema>;
export type CompiledSeat = z.infer<typeof CompiledSeatSchema>;
export type Bounds = z.infer<typeof BoundsSchema>;
export type Compiled = z.infer<typeof CompiledSchema>;
export type Canvas = z.infer<typeof CanvasSchema>;
export type Transform = z.infer<typeof TransformSchema>;
export type Point = z.infer<typeof PointSchema>;
export type RowLabel = z.infer<typeof RowLabelSchema>;
export type GridAisleGap = z.infer<typeof GridAisleGapSchema>;
export type ArcAisleGap = z.infer<typeof ArcAisleGapSchema>;
export type SeatsPerRow = z.infer<typeof SeatsPerRowSchema>;
export type StagePrimitive = z.infer<typeof StagePrimitiveSchema>;
export type LabelPrimitive = z.infer<typeof LabelPrimitiveSchema>;
export type ObstaclePrimitive = z.infer<typeof ObstaclePrimitiveSchema>;
export type ImagePrimitive = z.infer<typeof ImagePrimitiveSchema>;
export type SeatBlockGrid = z.infer<typeof SeatBlockGridSchema>;
export type SeatBlockArc = z.infer<typeof SeatBlockArcSchema>;
export type SeatBlockWedge = z.infer<typeof SeatBlockWedgeSchema>;
export type CompiledRowLabel = z.infer<typeof CompiledRowLabelSchema>;
export type RowLabelDisplay = z.infer<typeof RowLabelDisplaySchema>;

/* ── Input types (before parse, for callers feeding raw data) ── */

export type LayoutInput = z.input<typeof LayoutSchema>;
export type PrimitiveInput = z.input<typeof PrimitiveSchema>;
