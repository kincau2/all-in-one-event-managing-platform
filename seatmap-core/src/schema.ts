/**
 * @aioemp/seatmap-core — Zod Schema Definitions
 *
 * Canonical layout JSON schema for the parametric seatmap builder.
 * Every primitive, compiled seat, and the root layout are validated here.
 */

import { z } from 'zod';

/* ──────────────────────────────────────────────
 * Shared sub-schemas
 * ────────────────────────────────────────────── */

export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const TransformSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  rotation: z.number().default(0),
});

export const RowLabelSchema = z.object({
  mode: z.enum(['alpha', 'numeric']).default('alpha'),
  start: z.string().min(1).default('A'),
  direction: z.enum(['asc', 'desc']).default('asc'),
});

export const GridAisleGapSchema = z.object({
  afterCol: z.number().int().nonnegative(),
  gapPx: z.number().positive(),
});

export const ArcAisleGapSchema = z.object({
  afterSeatIndex: z.number().int().nonnegative(),
  gapAngleDeg: z.number().positive().optional(),
  gapPx: z.number().positive().optional(),
});

export const SeatsPerRowSchema = z.union([
  z.object({
    start: z.number().int().positive(),
    delta: z.number().int(),
  }),
  z.array(z.number().int().positive()).min(1),
]);

/* ──────────────────────────────────────────────
 * Primitive base fields (shared by all)
 * ────────────────────────────────────────────── */

const primitiveBase = {
  id: z.string().min(1),
  name: z.string().optional(),
  label: z.string().optional(),
  transform: TransformSchema.optional(),
};

/* ──────────────────────────────────────────────
 * Non-seat primitives
 * ────────────────────────────────────────────── */

export const StagePrimitiveSchema = z.object({
  ...primitiveBase,
  type: z.literal('stage'),
  width: z.number().positive(),
  height: z.number().positive(),
});

export const LabelPrimitiveSchema = z.object({
  ...primitiveBase,
  type: z.literal('label'),
  text: z.string(),
  fontSize: z.number().positive().default(16),
});

export const ObstaclePrimitiveSchema = z.object({
  ...primitiveBase,
  type: z.literal('obstacle'),
  width: z.number().positive(),
  height: z.number().positive(),
});

/* ──────────────────────────────────────────────
 * Seat-block primitives
 * ────────────────────────────────────────────── */

export const SeatBlockGridSchema = z.object({
  ...primitiveBase,
  type: z.literal('seatBlockGrid'),
  origin: PointSchema.default({ x: 0, y: 0 }),
  rows: z.number().int().positive(),
  cols: z.number().int().positive(),
  seatSpacingX: z.number().positive(),
  seatSpacingY: z.number().positive(),
  seatRadius: z.number().positive().optional(),
  rowLabel: RowLabelSchema.default({ mode: 'alpha', start: 'A', direction: 'asc' }),
  numbering: z.enum(['L2R', 'R2L']).default('L2R'),
  aisleGaps: z.array(GridAisleGapSchema).default([]),
  excludedSeats: z.array(z.tuple([z.number().int(), z.number().int()])).default([]),
  section: z.string().default(''),
});

export const SeatBlockArcSchema = z.object({
  ...primitiveBase,
  type: z.literal('seatBlockArc'),
  center: PointSchema,
  rowCount: z.number().int().positive(),
  startRadius: z.number().positive(),
  radiusStep: z.number().positive(),
  /** Horizontal / vertical radius ratio. 1 = circle; >1 = wider ellipse; <1 = taller ellipse. */
  radiusRatio: z.number().positive().default(1),
  startAngleDeg: z.number(),
  endAngleDeg: z.number(),
  seatsPerRow: SeatsPerRowSchema,
  seatRadius: z.number().positive().optional(),
  rowLabel: RowLabelSchema.default({ mode: 'alpha', start: 'A', direction: 'asc' }),
  numbering: z.enum(['L2R', 'R2L']).default('L2R'),
  aisleGaps: z.array(ArcAisleGapSchema).default([]),
  excludedSeats: z.array(z.tuple([z.number().int(), z.number().int()])).default([]),
  section: z.string().default(''),
});

export const SeatBlockWedgeSchema = z.object({
  ...primitiveBase,
  type: z.literal('seatBlockWedge'),
  center: PointSchema,
  innerRadius: z.number().nonnegative(),
  outerRadius: z.number().positive(),
  startAngleDeg: z.number(),
  endAngleDeg: z.number(),
  rowCount: z.number().int().positive(),
  seatsPerRow: SeatsPerRowSchema,
  seatRadius: z.number().positive().optional(),
  rowLabel: RowLabelSchema.default({ mode: 'alpha', start: 'A', direction: 'asc' }),
  numbering: z.enum(['L2R', 'R2L']).default('L2R'),
  excludedSeats: z.array(z.tuple([z.number().int(), z.number().int()])).default([]),
  section: z.string().default(''),
});

/* ──────────────────────────────────────────────
 * Discriminated union of all primitives
 * ────────────────────────────────────────────── */

export const PrimitiveSchema = z.discriminatedUnion('type', [
  StagePrimitiveSchema,
  LabelPrimitiveSchema,
  ObstaclePrimitiveSchema,
  SeatBlockGridSchema,
  SeatBlockArcSchema,
  SeatBlockWedgeSchema,
]);

/* ──────────────────────────────────────────────
 * Compiled seat & bounds
 * ────────────────────────────────────────────── */

export const CompiledSeatSchema = z.object({
  seat_key: z.string().uuid(),
  label: z.string(),
  section: z.string().optional(),
  row: z.string().optional(),
  number: z.number().int().positive().optional(),
  x: z.number(),
  y: z.number(),
  radius: z.number().positive().optional(),
  rotation: z.number().optional(),
  meta: z.record(z.any()).optional(),
});

export const BoundsSchema = z.object({
  minX: z.number(),
  minY: z.number(),
  maxX: z.number(),
  maxY: z.number(),
});

export const CompiledSchema = z.object({
  seats: z.array(CompiledSeatSchema),
  bounds: BoundsSchema,
});

/* ──────────────────────────────────────────────
 * Canvas & root Layout
 * ────────────────────────────────────────────── */

export const CanvasSchema = z.object({
  w: z.number().positive(),
  h: z.number().positive(),
  unit: z.string().default('px'),
});

export const LayoutSchema = z.object({
  schemaVersion: z.literal(1),
  title: z.string().default(''),
  canvas: CanvasSchema,
  seatRadius: z.number().positive().default(10),
  primitives: z.array(PrimitiveSchema),
  compiled: CompiledSchema.default({
    seats: [],
    bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
  }),
});
