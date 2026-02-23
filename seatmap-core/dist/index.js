// src/schema.ts
import { z } from "zod";
var PointSchema = z.object({
  x: z.number(),
  y: z.number()
});
var TransformSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  rotation: z.number().default(0)
});
var RowLabelSchema = z.object({
  mode: z.enum(["alpha", "numeric"]).default("alpha"),
  start: z.string().min(1).default("A"),
  direction: z.enum(["asc", "desc"]).default("asc")
});
var GridAisleGapSchema = z.object({
  afterCol: z.number().int().nonnegative(),
  gapPx: z.number().positive()
});
var ArcAisleGapSchema = z.object({
  afterSeatIndex: z.number().int().nonnegative(),
  gapAngleDeg: z.number().positive().optional(),
  gapPx: z.number().positive().optional()
});
var SeatsPerRowSchema = z.union([
  z.object({
    start: z.number().int().positive(),
    delta: z.number().int()
  }),
  z.array(z.number().int().positive()).min(1)
]);
var primitiveBase = {
  id: z.string().min(1),
  name: z.string().optional(),
  label: z.string().optional(),
  transform: TransformSchema.optional()
};
var StagePrimitiveSchema = z.object({
  ...primitiveBase,
  type: z.literal("stage"),
  width: z.number().positive(),
  height: z.number().positive()
});
var LabelPrimitiveSchema = z.object({
  ...primitiveBase,
  type: z.literal("label"),
  text: z.string(),
  fontSize: z.number().positive().default(16)
});
var ObstaclePrimitiveSchema = z.object({
  ...primitiveBase,
  type: z.literal("obstacle"),
  width: z.number().positive(),
  height: z.number().positive()
});
var SeatBlockGridSchema = z.object({
  ...primitiveBase,
  type: z.literal("seatBlockGrid"),
  origin: PointSchema.default({ x: 0, y: 0 }),
  rows: z.number().int().positive(),
  cols: z.number().int().positive(),
  seatSpacingX: z.number().positive(),
  seatSpacingY: z.number().positive(),
  seatRadius: z.number().positive().optional(),
  startSeatNumber: z.number().int().positive().default(1),
  rowLabel: RowLabelSchema.default({ mode: "alpha", start: "A", direction: "asc" }),
  numbering: z.enum(["L2R", "R2L"]).default("L2R"),
  aisleGaps: z.array(GridAisleGapSchema).default([]),
  excludedSeats: z.array(z.tuple([z.number().int(), z.number().int()])).default([]),
  section: z.string().default("")
});
var SeatBlockArcSchema = z.object({
  ...primitiveBase,
  type: z.literal("seatBlockArc"),
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
  startSeatNumber: z.number().int().positive().default(1),
  rowLabel: RowLabelSchema.default({ mode: "alpha", start: "A", direction: "asc" }),
  numbering: z.enum(["L2R", "R2L"]).default("L2R"),
  aisleGaps: z.array(ArcAisleGapSchema).default([]),
  excludedSeats: z.array(z.tuple([z.number().int(), z.number().int()])).default([]),
  section: z.string().default("")
});
var SeatBlockWedgeSchema = z.object({
  ...primitiveBase,
  type: z.literal("seatBlockWedge"),
  center: PointSchema,
  innerRadius: z.number().nonnegative(),
  outerRadius: z.number().positive(),
  startAngleDeg: z.number(),
  endAngleDeg: z.number(),
  rowCount: z.number().int().positive(),
  seatsPerRow: SeatsPerRowSchema,
  seatRadius: z.number().positive().optional(),
  rowLabel: RowLabelSchema.default({ mode: "alpha", start: "A", direction: "asc" }),
  numbering: z.enum(["L2R", "R2L"]).default("L2R"),
  excludedSeats: z.array(z.tuple([z.number().int(), z.number().int()])).default([]),
  section: z.string().default("")
});
var PrimitiveSchema = z.discriminatedUnion("type", [
  StagePrimitiveSchema,
  LabelPrimitiveSchema,
  ObstaclePrimitiveSchema,
  SeatBlockGridSchema,
  SeatBlockArcSchema,
  SeatBlockWedgeSchema
]);
var CompiledSeatSchema = z.object({
  seat_key: z.string().uuid(),
  label: z.string(),
  section: z.string().optional(),
  row: z.string().optional(),
  number: z.number().int().positive().optional(),
  x: z.number(),
  y: z.number(),
  radius: z.number().positive().optional(),
  rotation: z.number().optional(),
  meta: z.record(z.any()).optional()
});
var BoundsSchema = z.object({
  minX: z.number(),
  minY: z.number(),
  maxX: z.number(),
  maxY: z.number()
});
var CompiledSchema = z.object({
  seats: z.array(CompiledSeatSchema),
  bounds: BoundsSchema
});
var CanvasSchema = z.object({
  w: z.number().positive(),
  h: z.number().positive(),
  unit: z.string().default("px")
});
var LayoutSchema = z.object({
  schemaVersion: z.literal(1),
  title: z.string().default(""),
  canvas: CanvasSchema,
  seatRadius: z.number().positive().default(10),
  seatFill: z.string().default("#4B49AC"),
  seatStroke: z.string().default("#3a389a"),
  seatFont: z.string().default("-apple-system, sans-serif"),
  seatFontWeight: z.enum(["normal", "bold"]).default("bold"),
  seatFontColor: z.string().default("#ffffff"),
  seatFontSize: z.number().nonnegative().default(0),
  rowFontColor: z.string().default("#666666"),
  rowFontSize: z.number().positive().default(11),
  rowFontWeight: z.enum(["normal", "bold"]).default("bold"),
  bgColor: z.string().default("#ffffff"),
  bgImage: z.string().default(""),
  primitives: z.array(PrimitiveSchema),
  compiled: CompiledSchema.default({
    seats: [],
    bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  })
});

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
var GRID_PAD = 16;
var GRID_LBL_W = 24;
var ARC_PAD = 16;
var ARC_LBL_ANG = 28;
function gridPivotOffset(cols, rows, seatSpacingX, seatSpacingY) {
  const seatW = (cols - 1) * seatSpacingX;
  const seatH = (rows - 1) * seatSpacingY;
  const lx = -GRID_PAD - GRID_LBL_W;
  const ly = -GRID_PAD;
  const rectW = seatW + 2 * GRID_PAD + GRID_LBL_W;
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
  let sMinX = 0, sMinY = 0, sMaxX = 0, sMaxY = 0;
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
function compileGrid(primitive, keyMap, globalSeatRadius = 10) {
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
    transform
  } = primitive;
  const seatRadius = primitive.seatRadius ?? globalSeatRadius;
  const startNum = primitive.startSeatNumber ?? 1;
  const seats = [];
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
      const gapSum = aisleGaps.filter((g) => g.afterCol < c).reduce((sum, g) => sum + g.gapPx, 0);
      let x = origin.x + c * seatSpacingX + gapSum;
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
      const logicalKey = `${id}:${r}:${c}`;
      const seat_key = keyMap.get(logicalKey) ?? generateUUID();
      seats.push({
        seat_key,
        label,
        section: section || void 0,
        row: rowLabelStr,
        number: seatNumber,
        x: round2(x),
        y: round2(y),
        radius: seatRadius,
        meta: { primitiveId: id, logicalRow: r, logicalSeat: c }
      });
    }
  }
  return seats;
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
function compileArc(primitive, keyMap, globalSeatRadius = 10) {
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
      const logicalKey = `${id}:${r}:${s}`;
      const seat_key = keyMap.get(logicalKey) ?? generateUUID();
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

// src/compile-wedge.ts
function compileWedge(primitive, keyMap, globalSeatRadius = 10) {
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
      const logicalKey = `${id}:${r}:${s}`;
      const seat_key = keyMap.get(logicalKey) ?? generateUUID();
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

// src/seat-key.ts
function buildSeatKeyMap(existingSeats) {
  const map = /* @__PURE__ */ new Map();
  for (const seat of existingSeats) {
    const m = seat.meta;
    if (m && typeof m.primitiveId === "string" && typeof m.logicalRow === "number" && typeof m.logicalSeat === "number") {
      const key = `${m.primitiveId}:${m.logicalRow}:${m.logicalSeat}`;
      map.set(key, seat.seat_key);
    }
  }
  return map;
}

// src/compile-layout.ts
function compileLayout(layout, existingLayout) {
  const keyMap = existingLayout?.compiled?.seats ? buildSeatKeyMap(existingLayout.compiled.seats) : /* @__PURE__ */ new Map();
  const allSeats = [];
  const globalSeatRadius = layout.seatRadius ?? 10;
  for (const primitive of layout.primitives) {
    switch (primitive.type) {
      case "seatBlockGrid":
        allSeats.push(...compileGrid(primitive, keyMap, globalSeatRadius));
        break;
      case "seatBlockArc":
        allSeats.push(...compileArc(primitive, keyMap, globalSeatRadius));
        break;
      case "seatBlockWedge":
        allSeats.push(...compileWedge(primitive, keyMap, globalSeatRadius));
        break;
    }
  }
  const bounds = computeBounds(allSeats);
  return {
    ...layout,
    compiled: { seats: allSeats, bounds }
  };
}
function validateAndCompile(rawLayout, existingLayout) {
  const result = LayoutSchema.safeParse(rawLayout);
  if (!result.success) {
    return { success: false, errors: result.error };
  }
  const compiled = compileLayout(result.data, existingLayout);
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
export {
  ARC_LBL_ANG,
  ARC_PAD,
  ArcAisleGapSchema,
  BoundsSchema,
  CanvasSchema,
  CompiledSchema,
  CompiledSeatSchema,
  GRID_LBL_W,
  GRID_PAD,
  GridAisleGapSchema,
  LabelPrimitiveSchema,
  LayoutSchema,
  ObstaclePrimitiveSchema,
  PointSchema,
  PrimitiveSchema,
  RowLabelSchema,
  SeatBlockArcSchema,
  SeatBlockGridSchema,
  SeatBlockWedgeSchema,
  SeatsPerRowSchema,
  StagePrimitiveSchema,
  TransformSchema,
  arcPivotOffset,
  buildSeatKeyMap,
  compileArc,
  compileGrid,
  compileLayout,
  compileWedge,
  computeBounds,
  degToRad,
  generateRowLabel,
  generateUUID,
  getSeatsPerRow,
  gridPivotOffset,
  indexToLabel,
  labelToIndex,
  rotatePoint,
  round2,
  validateAndCompile
};
