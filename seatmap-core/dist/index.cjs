"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ARC_LBL_ANG: () => ARC_LBL_ANG,
  ARC_PAD: () => ARC_PAD,
  ArcAisleGapSchema: () => ArcAisleGapSchema,
  BoundsSchema: () => BoundsSchema,
  CanvasSchema: () => CanvasSchema,
  CompiledRowLabelSchema: () => CompiledRowLabelSchema,
  CompiledSchema: () => CompiledSchema,
  CompiledSeatSchema: () => CompiledSeatSchema,
  GRID_LBL_W: () => GRID_LBL_W,
  GRID_PAD: () => GRID_PAD,
  GridAisleGapSchema: () => GridAisleGapSchema,
  ImagePrimitiveSchema: () => ImagePrimitiveSchema,
  LabelPrimitiveSchema: () => LabelPrimitiveSchema,
  LayoutSchema: () => LayoutSchema,
  ObstaclePrimitiveSchema: () => ObstaclePrimitiveSchema,
  PointSchema: () => PointSchema,
  PrimitiveSchema: () => PrimitiveSchema,
  RowLabelDisplaySchema: () => RowLabelDisplaySchema,
  RowLabelSchema: () => RowLabelSchema,
  SeatBlockArcSchema: () => SeatBlockArcSchema,
  SeatBlockGridSchema: () => SeatBlockGridSchema,
  SeatBlockWedgeSchema: () => SeatBlockWedgeSchema,
  SeatsPerRowSchema: () => SeatsPerRowSchema,
  StagePrimitiveSchema: () => StagePrimitiveSchema,
  TransformSchema: () => TransformSchema,
  arcPivotOffset: () => arcPivotOffset,
  compileArc: () => compileArc,
  compileGrid: () => compileGrid,
  compileLayout: () => compileLayout,
  compileWedge: () => compileWedge,
  computeBounds: () => computeBounds,
  degToRad: () => degToRad,
  deterministicSeatKey: () => deterministicSeatKey,
  generateRowLabel: () => generateRowLabel,
  generateUUID: () => generateUUID,
  getSeatsPerRow: () => getSeatsPerRow,
  gridPivotOffset: () => gridPivotOffset,
  indexToLabel: () => indexToLabel,
  labelToIndex: () => labelToIndex,
  rotatePoint: () => rotatePoint,
  round2: () => round2,
  validateAndCompile: () => validateAndCompile
});
module.exports = __toCommonJS(index_exports);

// src/schema.ts
var import_zod = require("zod");
var PointSchema = import_zod.z.object({
  x: import_zod.z.number(),
  y: import_zod.z.number()
});
var TransformSchema = import_zod.z.object({
  x: import_zod.z.number().default(0),
  y: import_zod.z.number().default(0),
  rotation: import_zod.z.number().default(0)
});
var RowLabelSchema = import_zod.z.object({
  mode: import_zod.z.enum(["alpha", "numeric"]).default("alpha"),
  start: import_zod.z.string().min(1).default("A"),
  direction: import_zod.z.enum(["asc", "desc"]).default("asc")
});
var GridAisleGapSchema = import_zod.z.object({
  afterCol: import_zod.z.number().int().nonnegative(),
  gapPx: import_zod.z.number().positive()
});
var ArcAisleGapSchema = import_zod.z.object({
  afterSeatIndex: import_zod.z.number().int().nonnegative(),
  gapAngleDeg: import_zod.z.number().positive().optional(),
  gapPx: import_zod.z.number().positive().optional()
});
var RowLabelDisplaySchema = import_zod.z.enum(["none", "left", "right", "both"]).default("left");
var SeatsPerRowSchema = import_zod.z.union([
  import_zod.z.object({
    start: import_zod.z.number().int().positive(),
    delta: import_zod.z.number().int()
  }),
  import_zod.z.array(import_zod.z.number().int().positive()).min(1)
]);
var primitiveBase = {
  id: import_zod.z.string().min(1),
  name: import_zod.z.string().optional(),
  label: import_zod.z.string().optional(),
  transform: TransformSchema.optional()
};
var StagePrimitiveSchema = import_zod.z.object({
  ...primitiveBase,
  type: import_zod.z.literal("stage"),
  width: import_zod.z.number().positive(),
  height: import_zod.z.number().positive()
});
var LabelPrimitiveSchema = import_zod.z.object({
  ...primitiveBase,
  type: import_zod.z.literal("label"),
  text: import_zod.z.string(),
  fontSize: import_zod.z.number().positive().default(16),
  fontColor: import_zod.z.string().default("#333333"),
  fontWeight: import_zod.z.enum(["normal", "bold"]).default("normal")
});
var ObstaclePrimitiveSchema = import_zod.z.object({
  ...primitiveBase,
  type: import_zod.z.literal("obstacle"),
  width: import_zod.z.number().positive(),
  height: import_zod.z.number().positive(),
  color: import_zod.z.string().default("#ffcccc"),
  borderColor: import_zod.z.string().default("#cc5555"),
  borderRadius: import_zod.z.number().nonnegative().default(0)
});
var ImagePrimitiveSchema = import_zod.z.object({
  ...primitiveBase,
  type: import_zod.z.literal("image"),
  src: import_zod.z.string().min(1),
  width: import_zod.z.number().positive(),
  height: import_zod.z.number().positive()
});
var SeatBlockGridSchema = import_zod.z.object({
  ...primitiveBase,
  type: import_zod.z.literal("seatBlockGrid"),
  origin: PointSchema.default({ x: 0, y: 0 }),
  rows: import_zod.z.number().int().positive(),
  cols: import_zod.z.number().int().positive(),
  seatSpacingX: import_zod.z.number().positive(),
  seatSpacingY: import_zod.z.number().positive(),
  seatRadius: import_zod.z.number().positive().optional(),
  startSeatNumber: import_zod.z.number().int().positive().default(1),
  rowLabel: RowLabelSchema.default({ mode: "alpha", start: "A", direction: "asc" }),
  numbering: import_zod.z.enum(["L2R", "R2L"]).default("L2R"),
  aisleGaps: import_zod.z.array(GridAisleGapSchema).default([]),
  excludedSeats: import_zod.z.array(import_zod.z.tuple([import_zod.z.number().int(), import_zod.z.number().int()])).default([]),
  section: import_zod.z.string().default(""),
  rowLabelDisplay: RowLabelDisplaySchema
});
var SeatBlockArcSchema = import_zod.z.object({
  ...primitiveBase,
  type: import_zod.z.literal("seatBlockArc"),
  center: PointSchema,
  rowCount: import_zod.z.number().int().positive(),
  startRadius: import_zod.z.number().positive(),
  radiusStep: import_zod.z.number().positive(),
  /** Horizontal / vertical radius ratio. 1 = circle; >1 = wider ellipse; <1 = taller ellipse. */
  radiusRatio: import_zod.z.number().positive().default(1),
  startAngleDeg: import_zod.z.number(),
  endAngleDeg: import_zod.z.number(),
  seatsPerRow: SeatsPerRowSchema,
  seatRadius: import_zod.z.number().positive().optional(),
  startSeatNumber: import_zod.z.number().int().positive().default(1),
  rowLabel: RowLabelSchema.default({ mode: "alpha", start: "A", direction: "asc" }),
  numbering: import_zod.z.enum(["L2R", "R2L"]).default("L2R"),
  aisleGaps: import_zod.z.array(ArcAisleGapSchema).default([]),
  excludedSeats: import_zod.z.array(import_zod.z.tuple([import_zod.z.number().int(), import_zod.z.number().int()])).default([]),
  section: import_zod.z.string().default(""),
  rowLabelDisplay: RowLabelDisplaySchema
});
var SeatBlockWedgeSchema = import_zod.z.object({
  ...primitiveBase,
  type: import_zod.z.literal("seatBlockWedge"),
  center: PointSchema,
  innerRadius: import_zod.z.number().nonnegative(),
  outerRadius: import_zod.z.number().positive(),
  startAngleDeg: import_zod.z.number(),
  endAngleDeg: import_zod.z.number(),
  rowCount: import_zod.z.number().int().positive(),
  seatsPerRow: SeatsPerRowSchema,
  seatRadius: import_zod.z.number().positive().optional(),
  rowLabel: RowLabelSchema.default({ mode: "alpha", start: "A", direction: "asc" }),
  numbering: import_zod.z.enum(["L2R", "R2L"]).default("L2R"),
  excludedSeats: import_zod.z.array(import_zod.z.tuple([import_zod.z.number().int(), import_zod.z.number().int()])).default([]),
  section: import_zod.z.string().default("")
});
var PrimitiveSchema = import_zod.z.discriminatedUnion("type", [
  StagePrimitiveSchema,
  LabelPrimitiveSchema,
  ObstaclePrimitiveSchema,
  ImagePrimitiveSchema,
  SeatBlockGridSchema,
  SeatBlockArcSchema,
  SeatBlockWedgeSchema
]);
var CompiledSeatSchema = import_zod.z.object({
  seat_key: import_zod.z.string().uuid(),
  label: import_zod.z.string(),
  section: import_zod.z.string().optional(),
  row: import_zod.z.string().optional(),
  number: import_zod.z.number().int().positive().optional(),
  x: import_zod.z.number(),
  y: import_zod.z.number(),
  radius: import_zod.z.number().positive().optional(),
  rotation: import_zod.z.number().optional(),
  meta: import_zod.z.record(import_zod.z.any()).optional()
});
var BoundsSchema = import_zod.z.object({
  minX: import_zod.z.number(),
  minY: import_zod.z.number(),
  maxX: import_zod.z.number(),
  maxY: import_zod.z.number()
});
var CompiledRowLabelSchema = import_zod.z.object({
  primitiveId: import_zod.z.string(),
  row: import_zod.z.string(),
  side: import_zod.z.enum(["left", "right"]),
  x: import_zod.z.number(),
  y: import_zod.z.number()
});
var CompiledSchema = import_zod.z.object({
  seats: import_zod.z.array(CompiledSeatSchema),
  rowLabels: import_zod.z.array(CompiledRowLabelSchema).default([]),
  bounds: BoundsSchema
});
var CanvasSchema = import_zod.z.object({
  w: import_zod.z.number().positive(),
  h: import_zod.z.number().positive(),
  unit: import_zod.z.string().default("px")
});
var LayoutSchema = import_zod.z.object({
  schemaVersion: import_zod.z.literal(1),
  title: import_zod.z.string().default(""),
  canvas: CanvasSchema,
  seatRadius: import_zod.z.number().positive().default(10),
  seatFill: import_zod.z.string().default("#4B49AC"),
  seatStroke: import_zod.z.string().default("#3a389a"),
  seatFont: import_zod.z.string().default("-apple-system, sans-serif"),
  seatFontWeight: import_zod.z.enum(["normal", "bold"]).default("bold"),
  seatFontColor: import_zod.z.string().default("#ffffff"),
  seatFontSize: import_zod.z.number().nonnegative().default(0),
  rowFontColor: import_zod.z.string().default("#666666"),
  rowFontSize: import_zod.z.number().positive().default(11),
  rowFontWeight: import_zod.z.enum(["normal", "bold"]).default("bold"),
  bgColor: import_zod.z.string().default("#ffffff"),
  bgImage: import_zod.z.string().default(""),
  primitives: import_zod.z.array(PrimitiveSchema),
  compiled: CompiledSchema.default({
    seats: [],
    rowLabels: [],
    bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  })
});

// src/seat-key.ts
function fnv1a(str, seed) {
  let h = seed;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function deterministicSeatKey(primitiveId, logicalRow, logicalSeat) {
  const input = `${primitiveId}:${logicalRow}:${logicalSeat}`;
  const h1 = fnv1a(input, 2166136261);
  const h2 = fnv1a(input, 84696351);
  const h3 = fnv1a(input, 439041101);
  const h4 = fnv1a(input, 2137939276);
  const hex = (n) => (n >>> 0).toString(16).padStart(8, "0");
  const a = hex(h1);
  const b = hex(h2);
  const c = hex(h3);
  const d = hex(h4);
  const variant = "89ab"[parseInt(c[0], 16) & 3];
  return a + "-" + b.slice(0, 4) + "-4" + b.slice(5, 8) + "-" + variant + c.slice(1, 4) + "-" + c.slice(4, 8) + d;
}

// src/utils.ts
function degToRad(deg) {
  return deg * Math.PI / 180;
}
function rotatePoint(px, py, cx, cy, angleDeg) {
  const rad = degToRad(angleDeg);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos
  };
}
function labelToIndex(label) {
  let idx = 0;
  for (let i = 0; i < label.length; i++) {
    idx = idx * 26 + (label.toUpperCase().charCodeAt(i) - 64);
  }
  return idx - 1;
}
function indexToLabel(index) {
  let n = index + 1;
  let label = "";
  while (n > 0) {
    n--;
    label = String.fromCharCode(65 + n % 26) + label;
    n = Math.floor(n / 26);
  }
  return label;
}
function generateRowLabel(start, rowIdx, dir, mode = "alpha") {
  if (mode === "numeric") {
    const startNum = parseInt(start, 10) || 1;
    const num = dir === "asc" ? startNum + rowIdx : startNum - rowIdx;
    return String(num);
  }
  const base = labelToIndex(start);
  const idx = dir === "asc" ? base + rowIdx : base - rowIdx;
  if (idx < 0) return String(idx);
  return indexToLabel(idx);
}
function getSeatsPerRow(spec, rowIndex) {
  if (Array.isArray(spec)) {
    return spec[Math.min(rowIndex, spec.length - 1)];
  }
  return spec.start + rowIndex * spec.delta;
}
function generateUUID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
function round2(n) {
  return Math.round(n * 100) / 100;
}

// src/pivot.ts
var GRID_PAD = 21;
var GRID_LBL_W = 24;
var ARC_PAD = 21;
var ARC_LBL_ANG = 43;
function gridPivotOffset(cols, rows, seatSpacingX, seatSpacingY) {
  const seatW = (cols - 1) * seatSpacingX;
  const seatH = (rows - 1) * seatSpacingY;
  const lx = -GRID_PAD - GRID_LBL_W;
  const ly = -GRID_PAD;
  const rectW = seatW + 2 * GRID_PAD + 2 * GRID_LBL_W;
  const rectH = seatH + 2 * GRID_PAD;
  return { x: lx + rectW / 2, y: ly + rectH / 2 };
}
function arcPivotOffset(startRadius, rowCount, radiusStep, radiusRatio, startAngleDeg, endAngleDeg) {
  const innerBase = startRadius;
  const outerBase = innerBase + (rowCount - 1) * radiusStep;
  const outerRx = outerBase * radiusRatio + ARC_PAD;
  const outerRy = outerBase + ARC_PAD;
  const innerRx = Math.max(0, innerBase * radiusRatio - ARC_PAD);
  const innerRy = Math.max(0, innerBase - ARC_PAD);
  const angPad = outerBase > 0 ? (ARC_PAD + ARC_LBL_ANG) / outerBase : 0;
  const startRad = startAngleDeg * Math.PI / 180 - angPad;
  const endRad = endAngleDeg * Math.PI / 180 + angPad;
  let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
  for (let i = 0; i <= 32; i++) {
    const a = startRad + (endRad - startRad) * i / 32;
    const cos = Math.cos(a), sin = Math.sin(a);
    for (const [rx, ry] of [[innerRx, innerRy], [outerRx, outerRy]]) {
      const px = rx * cos, py = ry * sin;
      sMinX = Math.min(sMinX, px);
      sMinY = Math.min(sMinY, py);
      sMaxX = Math.max(sMaxX, px);
      sMaxY = Math.max(sMaxY, py);
    }
  }
  return { x: (sMinX + sMaxX) / 2, y: (sMinY + sMaxY) / 2 };
}

// src/compile-grid.ts
function compileGrid(primitive, globalSeatRadius = 10) {
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
    transform
  } = primitive;
  const seatRadius = primitive.seatRadius ?? globalSeatRadius;
  const rowLabel = primitive.rowLabel ?? { mode: "alpha", start: "A", direction: "asc" };
  const numbering = primitive.numbering ?? "L2R";
  const startNum = primitive.startSeatNumber ?? 1;
  const rowLabelDisplay = primitive.rowLabelDisplay ?? "left";
  const seats = [];
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
      rowLabel.mode ?? "alpha"
    );
    for (let c = 0; c < cols; c++) {
      if (excludedSeats?.some(([er, ec]) => er === r && ec === c)) continue;
      let x = origin.x + c * seatSpacingX + gapBefore[c];
      let y = origin.y + r * seatSpacingY;
      if (transform?.rotation) {
        const rotated = rotatePoint(x, y, pivotCx, pivotCy, transform.rotation);
        x = rotated.x;
        y = rotated.y;
      }
      x += transform?.x ?? 0;
      y += transform?.y ?? 0;
      const seatNumber = numbering === "R2L" ? cols - c + (startNum - 1) : c + startNum;
      const label = `${rowLabelStr}-${String(seatNumber).padStart(2, "0")}`;
      const seat_key = deterministicSeatKey(id, r, c);
      seats.push({
        seat_key,
        label,
        section: section || void 0,
        row: rowLabelStr,
        number: seatNumber,
        x: round2(x),
        y: round2(y),
        radius: seatRadius,
        rotation: 0,
        meta: { primitiveId: id, logicalRow: r, logicalSeat: c }
      });
    }
  }
  const rowLabels = [];
  if (rowLabelDisplay !== "none") {
    for (let r = 0; r < rows; r++) {
      const rowLabelStr = generateRowLabel(
        rowLabel.start,
        r,
        rowLabel.direction,
        rowLabel.mode ?? "alpha"
      );
      const rowY = origin.y + r * seatSpacingY;
      if (rowLabelDisplay === "left" || rowLabelDisplay === "both") {
        let lx = origin.x - GRID_PAD - GRID_LBL_W * 0.5;
        let ly = rowY;
        if (transform?.rotation) {
          const rotated = rotatePoint(lx, ly, pivotCx, pivotCy, transform.rotation);
          lx = rotated.x;
          ly = rotated.y;
        }
        lx += transform?.x ?? 0;
        ly += transform?.y ?? 0;
        rowLabels.push({ primitiveId: id, row: rowLabelStr, side: "left", x: round2(lx), y: round2(ly) });
      }
      if (rowLabelDisplay === "right" || rowLabelDisplay === "both") {
        let rx = origin.x + seatW + GRID_PAD + GRID_LBL_W * 0.5;
        let ry = rowY;
        if (transform?.rotation) {
          const rotated = rotatePoint(rx, ry, pivotCx, pivotCy, transform.rotation);
          rx = rotated.x;
          ry = rotated.y;
        }
        rx += transform?.x ?? 0;
        ry += transform?.y ?? 0;
        rowLabels.push({ primitiveId: id, row: rowLabelStr, side: "right", x: round2(rx), y: round2(ry) });
      }
    }
  }
  return { seats, rowLabels };
}

// src/compile-arc.ts
function resolveGaps(aisleGaps, radius) {
  return aisleGaps.map((g) => {
    let angleDeg = g.gapAngleDeg;
    if (angleDeg === void 0 && g.gapPx !== void 0 && radius > 0) {
      angleDeg = g.gapPx / radius * (180 / Math.PI);
    }
    return { afterSeatIndex: g.afterSeatIndex, angleDeg: angleDeg ?? 0 };
  });
}
function compileArc(primitive, globalSeatRadius = 10) {
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
    transform
  } = primitive;
  const seatRadius = primitive.seatRadius ?? globalSeatRadius;
  const rowLabel = primitive.rowLabel ?? { mode: "alpha", start: "A", direction: "asc" };
  const numbering = primitive.numbering ?? "L2R";
  const startNum = primitive.startSeatNumber ?? 1;
  const rowLabelDisplay = primitive.rowLabelDisplay ?? "left";
  const seats = [];
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
      rowLabel.mode ?? "alpha"
    );
    const avgRadius = (radiusX + radiusY) / 2;
    const gaps = resolveGaps(aisleGaps, avgRadius);
    const totalGapAngle = gaps.reduce((s, g) => s + g.angleDeg, 0);
    const totalAngle = endAngleDeg - startAngleDeg;
    const usableAngle = totalAngle - totalGapAngle;
    const step = n > 1 ? usableAngle / (n - 1) : 0;
    for (let s = 0; s < n; s++) {
      if (excludedSeats?.some(([er, ec]) => er === r && ec === s)) continue;
      const baseAngle = n === 1 ? startAngleDeg + totalAngle / 2 : startAngleDeg + s * step;
      const accGap = gaps.filter((g) => g.afterSeatIndex < s).reduce((sum, g) => sum + g.angleDeg, 0);
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
      const seatNumber = numbering === "R2L" ? n - s + (startNum - 1) : s + startNum;
      const label = `${rowLabelStr}-${String(seatNumber).padStart(2, "0")}`;
      const seat_key = deterministicSeatKey(id, r, s);
      seats.push({
        seat_key,
        label,
        section: section || void 0,
        row: rowLabelStr,
        number: seatNumber,
        x: round2(x),
        y: round2(y),
        radius: seatRadius,
        rotation: round2(angleDeg + 90),
        meta: { primitiveId: id, logicalRow: r, logicalSeat: s }
      });
    }
  }
  const rowLabels = [];
  if (rowLabelDisplay !== "none") {
    for (let r = 0; r < rowCount; r++) {
      const baseRadius = startRadius + r * radiusStep;
      const radiusX = baseRadius * radiusRatio;
      const radiusY = baseRadius;
      const avgRadius = (radiusX + radiusY) / 2;
      const labelOffsetDeg = avgRadius > 0 ? (ARC_PAD + ARC_LBL_ANG * 0.5) / avgRadius * (180 / Math.PI) : 0;
      const rowLabelStr = generateRowLabel(
        rowLabel.start,
        r,
        rowLabel.direction,
        rowLabel.mode ?? "alpha"
      );
      if (rowLabelDisplay === "left" || rowLabelDisplay === "both") {
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
        rowLabels.push({ primitiveId: id, row: rowLabelStr, side: "left", x: round2(lx), y: round2(ly) });
      }
      if (rowLabelDisplay === "right" || rowLabelDisplay === "both") {
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
        rowLabels.push({ primitiveId: id, row: rowLabelStr, side: "right", x: round2(rx), y: round2(ry) });
      }
    }
  }
  return { seats, rowLabels };
}

// src/compile-wedge.ts
function compileWedge(primitive, globalSeatRadius = 10) {
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
    transform
  } = primitive;
  const seatRadius = primitive.seatRadius ?? globalSeatRadius;
  const rowLabel = primitive.rowLabel ?? { mode: "alpha", start: "A", direction: "asc" };
  const numbering = primitive.numbering ?? "L2R";
  const seats = [];
  const totalAngle = endAngleDeg - startAngleDeg;
  for (let r = 0; r < rowCount; r++) {
    const radius = rowCount === 1 ? (innerRadius + outerRadius) / 2 : innerRadius + r * ((outerRadius - innerRadius) / (rowCount - 1));
    const n = getSeatsPerRow(seatsPerRow, r);
    if (n <= 0) continue;
    const rowLabelStr = generateRowLabel(
      rowLabel.start,
      r,
      rowLabel.direction,
      rowLabel.mode ?? "alpha"
    );
    for (let s = 0; s < n; s++) {
      if (excludedSeats?.some(([er, ec]) => er === r && ec === s)) continue;
      const angleDeg = n === 1 ? startAngleDeg + totalAngle / 2 : startAngleDeg + s * (totalAngle / (n - 1));
      const angleRad = degToRad(angleDeg);
      let x = center.x + radius * Math.cos(angleRad);
      let y = center.y + radius * Math.sin(angleRad);
      if (transform?.rotation) {
        const rotated = rotatePoint(x, y, center.x, center.y, transform.rotation);
        x = rotated.x;
        y = rotated.y;
      }
      x += transform?.x ?? 0;
      y += transform?.y ?? 0;
      const seatNumber = numbering === "R2L" ? n - s : s + 1;
      const label = `${rowLabelStr}-${String(seatNumber).padStart(2, "0")}`;
      const seat_key = deterministicSeatKey(id, r, s);
      seats.push({
        seat_key,
        label,
        section: section || void 0,
        row: rowLabelStr,
        number: seatNumber,
        x: round2(x),
        y: round2(y),
        radius: seatRadius,
        rotation: round2(angleDeg + 90),
        // tangent direction
        meta: { primitiveId: id, logicalRow: r, logicalSeat: s }
      });
    }
  }
  return seats;
}

// src/compile-layout.ts
function compileLayout(layout) {
  const allSeats = [];
  const allRowLabels = [];
  const globalSeatRadius = layout.seatRadius ?? 10;
  for (const primitive of layout.primitives) {
    switch (primitive.type) {
      case "seatBlockGrid": {
        const result = compileGrid(primitive, globalSeatRadius);
        allSeats.push(...result.seats);
        allRowLabels.push(...result.rowLabels);
        break;
      }
      case "seatBlockArc": {
        const result = compileArc(primitive, globalSeatRadius);
        allSeats.push(...result.seats);
        allRowLabels.push(...result.rowLabels);
        break;
      }
      case "seatBlockWedge":
        allSeats.push(...compileWedge(primitive, globalSeatRadius));
        break;
    }
  }
  const bounds = computeBounds(allSeats);
  return {
    ...layout,
    compiled: { seats: allSeats, rowLabels: allRowLabels, bounds }
  };
}
function validateAndCompile(rawLayout) {
  const result = LayoutSchema.safeParse(rawLayout);
  if (!result.success) {
    return { success: false, errors: result.error };
  }
  const compiled = compileLayout(result.data);
  return { success: true, layout: compiled };
}
function computeBounds(seats) {
  if (seats.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of seats) {
    if (s.x < minX) minX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.x > maxX) maxX = s.x;
    if (s.y > maxY) maxY = s.y;
  }
  return {
    minX: round2(minX),
    minY: round2(minY),
    maxX: round2(maxX),
    maxY: round2(maxY)
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ARC_LBL_ANG,
  ARC_PAD,
  ArcAisleGapSchema,
  BoundsSchema,
  CanvasSchema,
  CompiledRowLabelSchema,
  CompiledSchema,
  CompiledSeatSchema,
  GRID_LBL_W,
  GRID_PAD,
  GridAisleGapSchema,
  ImagePrimitiveSchema,
  LabelPrimitiveSchema,
  LayoutSchema,
  ObstaclePrimitiveSchema,
  PointSchema,
  PrimitiveSchema,
  RowLabelDisplaySchema,
  RowLabelSchema,
  SeatBlockArcSchema,
  SeatBlockGridSchema,
  SeatBlockWedgeSchema,
  SeatsPerRowSchema,
  StagePrimitiveSchema,
  TransformSchema,
  arcPivotOffset,
  compileArc,
  compileGrid,
  compileLayout,
  compileWedge,
  computeBounds,
  degToRad,
  deterministicSeatKey,
  generateRowLabel,
  generateUUID,
  getSeatsPerRow,
  gridPivotOffset,
  indexToLabel,
  labelToIndex,
  rotatePoint,
  round2,
  validateAndCompile
});
