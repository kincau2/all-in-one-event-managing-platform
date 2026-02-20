import * as zod from 'zod';
import { z } from 'zod';

/**
 * @aioemp/seatmap-core — Zod Schema Definitions
 *
 * Canonical layout JSON schema for the parametric seatmap builder.
 * Every primitive, compiled seat, and the root layout are validated here.
 */

declare const PointSchema: z.ZodObject<{
    x: z.ZodNumber;
    y: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    x: number;
    y: number;
}, {
    x: number;
    y: number;
}>;
declare const TransformSchema: z.ZodObject<{
    x: z.ZodDefault<z.ZodNumber>;
    y: z.ZodDefault<z.ZodNumber>;
    rotation: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    x: number;
    y: number;
    rotation: number;
}, {
    x?: number | undefined;
    y?: number | undefined;
    rotation?: number | undefined;
}>;
declare const RowLabelSchema: z.ZodObject<{
    start: z.ZodDefault<z.ZodString>;
    direction: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    start: string;
    direction: "asc" | "desc";
}, {
    start?: string | undefined;
    direction?: "asc" | "desc" | undefined;
}>;
declare const GridAisleGapSchema: z.ZodObject<{
    afterCol: z.ZodNumber;
    gapPx: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    afterCol: number;
    gapPx: number;
}, {
    afterCol: number;
    gapPx: number;
}>;
declare const ArcAisleGapSchema: z.ZodObject<{
    afterSeatIndex: z.ZodNumber;
    gapAngleDeg: z.ZodOptional<z.ZodNumber>;
    gapPx: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    afterSeatIndex: number;
    gapPx?: number | undefined;
    gapAngleDeg?: number | undefined;
}, {
    afterSeatIndex: number;
    gapPx?: number | undefined;
    gapAngleDeg?: number | undefined;
}>;
declare const SeatsPerRowSchema: z.ZodUnion<[z.ZodObject<{
    start: z.ZodNumber;
    delta: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    start: number;
    delta: number;
}, {
    start: number;
    delta: number;
}>, z.ZodArray<z.ZodNumber, "many">]>;
declare const StagePrimitiveSchema: z.ZodObject<{
    type: z.ZodLiteral<"stage">;
    width: z.ZodNumber;
    height: z.ZodNumber;
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    transform: z.ZodOptional<z.ZodObject<{
        x: z.ZodDefault<z.ZodNumber>;
        y: z.ZodDefault<z.ZodNumber>;
        rotation: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
        rotation: number;
    }, {
        x?: number | undefined;
        y?: number | undefined;
        rotation?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "stage";
    width: number;
    height: number;
    id: string;
    name?: string | undefined;
    label?: string | undefined;
    transform?: {
        x: number;
        y: number;
        rotation: number;
    } | undefined;
}, {
    type: "stage";
    width: number;
    height: number;
    id: string;
    name?: string | undefined;
    label?: string | undefined;
    transform?: {
        x?: number | undefined;
        y?: number | undefined;
        rotation?: number | undefined;
    } | undefined;
}>;
declare const LabelPrimitiveSchema: z.ZodObject<{
    type: z.ZodLiteral<"label">;
    text: z.ZodString;
    fontSize: z.ZodDefault<z.ZodNumber>;
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    transform: z.ZodOptional<z.ZodObject<{
        x: z.ZodDefault<z.ZodNumber>;
        y: z.ZodDefault<z.ZodNumber>;
        rotation: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
        rotation: number;
    }, {
        x?: number | undefined;
        y?: number | undefined;
        rotation?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "label";
    id: string;
    text: string;
    fontSize: number;
    name?: string | undefined;
    label?: string | undefined;
    transform?: {
        x: number;
        y: number;
        rotation: number;
    } | undefined;
}, {
    type: "label";
    id: string;
    text: string;
    name?: string | undefined;
    label?: string | undefined;
    transform?: {
        x?: number | undefined;
        y?: number | undefined;
        rotation?: number | undefined;
    } | undefined;
    fontSize?: number | undefined;
}>;
declare const ObstaclePrimitiveSchema: z.ZodObject<{
    type: z.ZodLiteral<"obstacle">;
    width: z.ZodNumber;
    height: z.ZodNumber;
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    transform: z.ZodOptional<z.ZodObject<{
        x: z.ZodDefault<z.ZodNumber>;
        y: z.ZodDefault<z.ZodNumber>;
        rotation: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
        rotation: number;
    }, {
        x?: number | undefined;
        y?: number | undefined;
        rotation?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "obstacle";
    width: number;
    height: number;
    id: string;
    name?: string | undefined;
    label?: string | undefined;
    transform?: {
        x: number;
        y: number;
        rotation: number;
    } | undefined;
}, {
    type: "obstacle";
    width: number;
    height: number;
    id: string;
    name?: string | undefined;
    label?: string | undefined;
    transform?: {
        x?: number | undefined;
        y?: number | undefined;
        rotation?: number | undefined;
    } | undefined;
}>;
declare const SeatBlockGridSchema: z.ZodObject<{
    type: z.ZodLiteral<"seatBlockGrid">;
    origin: z.ZodDefault<z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
    }, {
        x: number;
        y: number;
    }>>;
    rows: z.ZodNumber;
    cols: z.ZodNumber;
    seatSpacingX: z.ZodNumber;
    seatSpacingY: z.ZodNumber;
    seatRadius: z.ZodDefault<z.ZodNumber>;
    rowLabel: z.ZodDefault<z.ZodObject<{
        start: z.ZodDefault<z.ZodString>;
        direction: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    }, "strip", z.ZodTypeAny, {
        start: string;
        direction: "asc" | "desc";
    }, {
        start?: string | undefined;
        direction?: "asc" | "desc" | undefined;
    }>>;
    numbering: z.ZodDefault<z.ZodEnum<["L2R", "R2L"]>>;
    aisleGaps: z.ZodDefault<z.ZodArray<z.ZodObject<{
        afterCol: z.ZodNumber;
        gapPx: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        afterCol: number;
        gapPx: number;
    }, {
        afterCol: number;
        gapPx: number;
    }>, "many">>;
    section: z.ZodDefault<z.ZodString>;
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    transform: z.ZodOptional<z.ZodObject<{
        x: z.ZodDefault<z.ZodNumber>;
        y: z.ZodDefault<z.ZodNumber>;
        rotation: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
        rotation: number;
    }, {
        x?: number | undefined;
        y?: number | undefined;
        rotation?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "seatBlockGrid";
    id: string;
    origin: {
        x: number;
        y: number;
    };
    rows: number;
    cols: number;
    seatSpacingX: number;
    seatSpacingY: number;
    seatRadius: number;
    rowLabel: {
        start: string;
        direction: "asc" | "desc";
    };
    numbering: "L2R" | "R2L";
    aisleGaps: {
        afterCol: number;
        gapPx: number;
    }[];
    section: string;
    name?: string | undefined;
    label?: string | undefined;
    transform?: {
        x: number;
        y: number;
        rotation: number;
    } | undefined;
}, {
    type: "seatBlockGrid";
    id: string;
    rows: number;
    cols: number;
    seatSpacingX: number;
    seatSpacingY: number;
    name?: string | undefined;
    label?: string | undefined;
    transform?: {
        x?: number | undefined;
        y?: number | undefined;
        rotation?: number | undefined;
    } | undefined;
    origin?: {
        x: number;
        y: number;
    } | undefined;
    seatRadius?: number | undefined;
    rowLabel?: {
        start?: string | undefined;
        direction?: "asc" | "desc" | undefined;
    } | undefined;
    numbering?: "L2R" | "R2L" | undefined;
    aisleGaps?: {
        afterCol: number;
        gapPx: number;
    }[] | undefined;
    section?: string | undefined;
}>;
declare const SeatBlockArcSchema: z.ZodObject<{
    type: z.ZodLiteral<"seatBlockArc">;
    center: z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
    }, {
        x: number;
        y: number;
    }>;
    rowCount: z.ZodNumber;
    startRadius: z.ZodNumber;
    radiusStep: z.ZodNumber;
    startAngleDeg: z.ZodNumber;
    endAngleDeg: z.ZodNumber;
    seatsPerRow: z.ZodUnion<[z.ZodObject<{
        start: z.ZodNumber;
        delta: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        start: number;
        delta: number;
    }, {
        start: number;
        delta: number;
    }>, z.ZodArray<z.ZodNumber, "many">]>;
    seatRadius: z.ZodDefault<z.ZodNumber>;
    aisleGaps: z.ZodDefault<z.ZodArray<z.ZodObject<{
        afterSeatIndex: z.ZodNumber;
        gapAngleDeg: z.ZodOptional<z.ZodNumber>;
        gapPx: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        afterSeatIndex: number;
        gapPx?: number | undefined;
        gapAngleDeg?: number | undefined;
    }, {
        afterSeatIndex: number;
        gapPx?: number | undefined;
        gapAngleDeg?: number | undefined;
    }>, "many">>;
    section: z.ZodDefault<z.ZodString>;
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    transform: z.ZodOptional<z.ZodObject<{
        x: z.ZodDefault<z.ZodNumber>;
        y: z.ZodDefault<z.ZodNumber>;
        rotation: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
        rotation: number;
    }, {
        x?: number | undefined;
        y?: number | undefined;
        rotation?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "seatBlockArc";
    id: string;
    seatRadius: number;
    aisleGaps: {
        afterSeatIndex: number;
        gapPx?: number | undefined;
        gapAngleDeg?: number | undefined;
    }[];
    section: string;
    center: {
        x: number;
        y: number;
    };
    rowCount: number;
    startRadius: number;
    radiusStep: number;
    startAngleDeg: number;
    endAngleDeg: number;
    seatsPerRow: {
        start: number;
        delta: number;
    } | number[];
    name?: string | undefined;
    label?: string | undefined;
    transform?: {
        x: number;
        y: number;
        rotation: number;
    } | undefined;
}, {
    type: "seatBlockArc";
    id: string;
    center: {
        x: number;
        y: number;
    };
    rowCount: number;
    startRadius: number;
    radiusStep: number;
    startAngleDeg: number;
    endAngleDeg: number;
    seatsPerRow: {
        start: number;
        delta: number;
    } | number[];
    name?: string | undefined;
    label?: string | undefined;
    transform?: {
        x?: number | undefined;
        y?: number | undefined;
        rotation?: number | undefined;
    } | undefined;
    seatRadius?: number | undefined;
    aisleGaps?: {
        afterSeatIndex: number;
        gapPx?: number | undefined;
        gapAngleDeg?: number | undefined;
    }[] | undefined;
    section?: string | undefined;
}>;
declare const SeatBlockWedgeSchema: z.ZodObject<{
    type: z.ZodLiteral<"seatBlockWedge">;
    center: z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
    }, {
        x: number;
        y: number;
    }>;
    innerRadius: z.ZodNumber;
    outerRadius: z.ZodNumber;
    startAngleDeg: z.ZodNumber;
    endAngleDeg: z.ZodNumber;
    rowCount: z.ZodNumber;
    seatsPerRow: z.ZodUnion<[z.ZodObject<{
        start: z.ZodNumber;
        delta: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        start: number;
        delta: number;
    }, {
        start: number;
        delta: number;
    }>, z.ZodArray<z.ZodNumber, "many">]>;
    seatRadius: z.ZodDefault<z.ZodNumber>;
    section: z.ZodDefault<z.ZodString>;
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    transform: z.ZodOptional<z.ZodObject<{
        x: z.ZodDefault<z.ZodNumber>;
        y: z.ZodDefault<z.ZodNumber>;
        rotation: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
        rotation: number;
    }, {
        x?: number | undefined;
        y?: number | undefined;
        rotation?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "seatBlockWedge";
    id: string;
    seatRadius: number;
    section: string;
    center: {
        x: number;
        y: number;
    };
    rowCount: number;
    startAngleDeg: number;
    endAngleDeg: number;
    seatsPerRow: {
        start: number;
        delta: number;
    } | number[];
    innerRadius: number;
    outerRadius: number;
    name?: string | undefined;
    label?: string | undefined;
    transform?: {
        x: number;
        y: number;
        rotation: number;
    } | undefined;
}, {
    type: "seatBlockWedge";
    id: string;
    center: {
        x: number;
        y: number;
    };
    rowCount: number;
    startAngleDeg: number;
    endAngleDeg: number;
    seatsPerRow: {
        start: number;
        delta: number;
    } | number[];
    innerRadius: number;
    outerRadius: number;
    name?: string | undefined;
    label?: string | undefined;
    transform?: {
        x?: number | undefined;
        y?: number | undefined;
        rotation?: number | undefined;
    } | undefined;
    seatRadius?: number | undefined;
    section?: string | undefined;
}>;
declare const PrimitiveSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"stage">;
    width: z.ZodNumber;
    height: z.ZodNumber;
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    transform: z.ZodOptional<z.ZodObject<{
        x: z.ZodDefault<z.ZodNumber>;
        y: z.ZodDefault<z.ZodNumber>;
        rotation: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
        rotation: number;
    }, {
        x?: number | undefined;
        y?: number | undefined;
        rotation?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "stage";
    width: number;
    height: number;
    id: string;
    name?: string | undefined;
    label?: string | undefined;
    transform?: {
        x: number;
        y: number;
        rotation: number;
    } | undefined;
}, {
    type: "stage";
    width: number;
    height: number;
    id: string;
    name?: string | undefined;
    label?: string | undefined;
    transform?: {
        x?: number | undefined;
        y?: number | undefined;
        rotation?: number | undefined;
    } | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"label">;
    text: z.ZodString;
    fontSize: z.ZodDefault<z.ZodNumber>;
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    transform: z.ZodOptional<z.ZodObject<{
        x: z.ZodDefault<z.ZodNumber>;
        y: z.ZodDefault<z.ZodNumber>;
        rotation: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
        rotation: number;
    }, {
        x?: number | undefined;
        y?: number | undefined;
        rotation?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "label";
    id: string;
    text: string;
    fontSize: number;
    name?: string | undefined;
    label?: string | undefined;
    transform?: {
        x: number;
        y: number;
        rotation: number;
    } | undefined;
}, {
    type: "label";
    id: string;
    text: string;
    name?: string | undefined;
    label?: string | undefined;
    transform?: {
        x?: number | undefined;
        y?: number | undefined;
        rotation?: number | undefined;
    } | undefined;
    fontSize?: number | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"obstacle">;
    width: z.ZodNumber;
    height: z.ZodNumber;
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    transform: z.ZodOptional<z.ZodObject<{
        x: z.ZodDefault<z.ZodNumber>;
        y: z.ZodDefault<z.ZodNumber>;
        rotation: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
        rotation: number;
    }, {
        x?: number | undefined;
        y?: number | undefined;
        rotation?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "obstacle";
    width: number;
    height: number;
    id: string;
    name?: string | undefined;
    label?: string | undefined;
    transform?: {
        x: number;
        y: number;
        rotation: number;
    } | undefined;
}, {
    type: "obstacle";
    width: number;
    height: number;
    id: string;
    name?: string | undefined;
    label?: string | undefined;
    transform?: {
        x?: number | undefined;
        y?: number | undefined;
        rotation?: number | undefined;
    } | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"seatBlockGrid">;
    origin: z.ZodDefault<z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
    }, {
        x: number;
        y: number;
    }>>;
    rows: z.ZodNumber;
    cols: z.ZodNumber;
    seatSpacingX: z.ZodNumber;
    seatSpacingY: z.ZodNumber;
    seatRadius: z.ZodDefault<z.ZodNumber>;
    rowLabel: z.ZodDefault<z.ZodObject<{
        start: z.ZodDefault<z.ZodString>;
        direction: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    }, "strip", z.ZodTypeAny, {
        start: string;
        direction: "asc" | "desc";
    }, {
        start?: string | undefined;
        direction?: "asc" | "desc" | undefined;
    }>>;
    numbering: z.ZodDefault<z.ZodEnum<["L2R", "R2L"]>>;
    aisleGaps: z.ZodDefault<z.ZodArray<z.ZodObject<{
        afterCol: z.ZodNumber;
        gapPx: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        afterCol: number;
        gapPx: number;
    }, {
        afterCol: number;
        gapPx: number;
    }>, "many">>;
    section: z.ZodDefault<z.ZodString>;
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    transform: z.ZodOptional<z.ZodObject<{
        x: z.ZodDefault<z.ZodNumber>;
        y: z.ZodDefault<z.ZodNumber>;
        rotation: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
        rotation: number;
    }, {
        x?: number | undefined;
        y?: number | undefined;
        rotation?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "seatBlockGrid";
    id: string;
    origin: {
        x: number;
        y: number;
    };
    rows: number;
    cols: number;
    seatSpacingX: number;
    seatSpacingY: number;
    seatRadius: number;
    rowLabel: {
        start: string;
        direction: "asc" | "desc";
    };
    numbering: "L2R" | "R2L";
    aisleGaps: {
        afterCol: number;
        gapPx: number;
    }[];
    section: string;
    name?: string | undefined;
    label?: string | undefined;
    transform?: {
        x: number;
        y: number;
        rotation: number;
    } | undefined;
}, {
    type: "seatBlockGrid";
    id: string;
    rows: number;
    cols: number;
    seatSpacingX: number;
    seatSpacingY: number;
    name?: string | undefined;
    label?: string | undefined;
    transform?: {
        x?: number | undefined;
        y?: number | undefined;
        rotation?: number | undefined;
    } | undefined;
    origin?: {
        x: number;
        y: number;
    } | undefined;
    seatRadius?: number | undefined;
    rowLabel?: {
        start?: string | undefined;
        direction?: "asc" | "desc" | undefined;
    } | undefined;
    numbering?: "L2R" | "R2L" | undefined;
    aisleGaps?: {
        afterCol: number;
        gapPx: number;
    }[] | undefined;
    section?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"seatBlockArc">;
    center: z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
    }, {
        x: number;
        y: number;
    }>;
    rowCount: z.ZodNumber;
    startRadius: z.ZodNumber;
    radiusStep: z.ZodNumber;
    startAngleDeg: z.ZodNumber;
    endAngleDeg: z.ZodNumber;
    seatsPerRow: z.ZodUnion<[z.ZodObject<{
        start: z.ZodNumber;
        delta: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        start: number;
        delta: number;
    }, {
        start: number;
        delta: number;
    }>, z.ZodArray<z.ZodNumber, "many">]>;
    seatRadius: z.ZodDefault<z.ZodNumber>;
    aisleGaps: z.ZodDefault<z.ZodArray<z.ZodObject<{
        afterSeatIndex: z.ZodNumber;
        gapAngleDeg: z.ZodOptional<z.ZodNumber>;
        gapPx: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        afterSeatIndex: number;
        gapPx?: number | undefined;
        gapAngleDeg?: number | undefined;
    }, {
        afterSeatIndex: number;
        gapPx?: number | undefined;
        gapAngleDeg?: number | undefined;
    }>, "many">>;
    section: z.ZodDefault<z.ZodString>;
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    transform: z.ZodOptional<z.ZodObject<{
        x: z.ZodDefault<z.ZodNumber>;
        y: z.ZodDefault<z.ZodNumber>;
        rotation: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
        rotation: number;
    }, {
        x?: number | undefined;
        y?: number | undefined;
        rotation?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "seatBlockArc";
    id: string;
    seatRadius: number;
    aisleGaps: {
        afterSeatIndex: number;
        gapPx?: number | undefined;
        gapAngleDeg?: number | undefined;
    }[];
    section: string;
    center: {
        x: number;
        y: number;
    };
    rowCount: number;
    startRadius: number;
    radiusStep: number;
    startAngleDeg: number;
    endAngleDeg: number;
    seatsPerRow: {
        start: number;
        delta: number;
    } | number[];
    name?: string | undefined;
    label?: string | undefined;
    transform?: {
        x: number;
        y: number;
        rotation: number;
    } | undefined;
}, {
    type: "seatBlockArc";
    id: string;
    center: {
        x: number;
        y: number;
    };
    rowCount: number;
    startRadius: number;
    radiusStep: number;
    startAngleDeg: number;
    endAngleDeg: number;
    seatsPerRow: {
        start: number;
        delta: number;
    } | number[];
    name?: string | undefined;
    label?: string | undefined;
    transform?: {
        x?: number | undefined;
        y?: number | undefined;
        rotation?: number | undefined;
    } | undefined;
    seatRadius?: number | undefined;
    aisleGaps?: {
        afterSeatIndex: number;
        gapPx?: number | undefined;
        gapAngleDeg?: number | undefined;
    }[] | undefined;
    section?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"seatBlockWedge">;
    center: z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
    }, {
        x: number;
        y: number;
    }>;
    innerRadius: z.ZodNumber;
    outerRadius: z.ZodNumber;
    startAngleDeg: z.ZodNumber;
    endAngleDeg: z.ZodNumber;
    rowCount: z.ZodNumber;
    seatsPerRow: z.ZodUnion<[z.ZodObject<{
        start: z.ZodNumber;
        delta: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        start: number;
        delta: number;
    }, {
        start: number;
        delta: number;
    }>, z.ZodArray<z.ZodNumber, "many">]>;
    seatRadius: z.ZodDefault<z.ZodNumber>;
    section: z.ZodDefault<z.ZodString>;
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    transform: z.ZodOptional<z.ZodObject<{
        x: z.ZodDefault<z.ZodNumber>;
        y: z.ZodDefault<z.ZodNumber>;
        rotation: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
        rotation: number;
    }, {
        x?: number | undefined;
        y?: number | undefined;
        rotation?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "seatBlockWedge";
    id: string;
    seatRadius: number;
    section: string;
    center: {
        x: number;
        y: number;
    };
    rowCount: number;
    startAngleDeg: number;
    endAngleDeg: number;
    seatsPerRow: {
        start: number;
        delta: number;
    } | number[];
    innerRadius: number;
    outerRadius: number;
    name?: string | undefined;
    label?: string | undefined;
    transform?: {
        x: number;
        y: number;
        rotation: number;
    } | undefined;
}, {
    type: "seatBlockWedge";
    id: string;
    center: {
        x: number;
        y: number;
    };
    rowCount: number;
    startAngleDeg: number;
    endAngleDeg: number;
    seatsPerRow: {
        start: number;
        delta: number;
    } | number[];
    innerRadius: number;
    outerRadius: number;
    name?: string | undefined;
    label?: string | undefined;
    transform?: {
        x?: number | undefined;
        y?: number | undefined;
        rotation?: number | undefined;
    } | undefined;
    seatRadius?: number | undefined;
    section?: string | undefined;
}>]>;
declare const CompiledSeatSchema: z.ZodObject<{
    seat_key: z.ZodString;
    label: z.ZodString;
    section: z.ZodOptional<z.ZodString>;
    row: z.ZodOptional<z.ZodString>;
    number: z.ZodOptional<z.ZodNumber>;
    x: z.ZodNumber;
    y: z.ZodNumber;
    rotation: z.ZodOptional<z.ZodNumber>;
    meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    x: number;
    y: number;
    label: string;
    seat_key: string;
    number?: number | undefined;
    rotation?: number | undefined;
    section?: string | undefined;
    row?: string | undefined;
    meta?: Record<string, any> | undefined;
}, {
    x: number;
    y: number;
    label: string;
    seat_key: string;
    number?: number | undefined;
    rotation?: number | undefined;
    section?: string | undefined;
    row?: string | undefined;
    meta?: Record<string, any> | undefined;
}>;
declare const BoundsSchema: z.ZodObject<{
    minX: z.ZodNumber;
    minY: z.ZodNumber;
    maxX: z.ZodNumber;
    maxY: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}, {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}>;
declare const CompiledSchema: z.ZodObject<{
    seats: z.ZodArray<z.ZodObject<{
        seat_key: z.ZodString;
        label: z.ZodString;
        section: z.ZodOptional<z.ZodString>;
        row: z.ZodOptional<z.ZodString>;
        number: z.ZodOptional<z.ZodNumber>;
        x: z.ZodNumber;
        y: z.ZodNumber;
        rotation: z.ZodOptional<z.ZodNumber>;
        meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
        label: string;
        seat_key: string;
        number?: number | undefined;
        rotation?: number | undefined;
        section?: string | undefined;
        row?: string | undefined;
        meta?: Record<string, any> | undefined;
    }, {
        x: number;
        y: number;
        label: string;
        seat_key: string;
        number?: number | undefined;
        rotation?: number | undefined;
        section?: string | undefined;
        row?: string | undefined;
        meta?: Record<string, any> | undefined;
    }>, "many">;
    bounds: z.ZodObject<{
        minX: z.ZodNumber;
        minY: z.ZodNumber;
        maxX: z.ZodNumber;
        maxY: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    }, {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    }>;
}, "strip", z.ZodTypeAny, {
    seats: {
        x: number;
        y: number;
        label: string;
        seat_key: string;
        number?: number | undefined;
        rotation?: number | undefined;
        section?: string | undefined;
        row?: string | undefined;
        meta?: Record<string, any> | undefined;
    }[];
    bounds: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    };
}, {
    seats: {
        x: number;
        y: number;
        label: string;
        seat_key: string;
        number?: number | undefined;
        rotation?: number | undefined;
        section?: string | undefined;
        row?: string | undefined;
        meta?: Record<string, any> | undefined;
    }[];
    bounds: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    };
}>;
declare const CanvasSchema: z.ZodObject<{
    w: z.ZodNumber;
    h: z.ZodNumber;
    unit: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    w: number;
    h: number;
    unit: string;
}, {
    w: number;
    h: number;
    unit?: string | undefined;
}>;
declare const LayoutSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    title: z.ZodDefault<z.ZodString>;
    canvas: z.ZodObject<{
        w: z.ZodNumber;
        h: z.ZodNumber;
        unit: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        w: number;
        h: number;
        unit: string;
    }, {
        w: number;
        h: number;
        unit?: string | undefined;
    }>;
    primitives: z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"stage">;
        width: z.ZodNumber;
        height: z.ZodNumber;
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        label: z.ZodOptional<z.ZodString>;
        transform: z.ZodOptional<z.ZodObject<{
            x: z.ZodDefault<z.ZodNumber>;
            y: z.ZodDefault<z.ZodNumber>;
            rotation: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            rotation: number;
        }, {
            x?: number | undefined;
            y?: number | undefined;
            rotation?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        type: "stage";
        width: number;
        height: number;
        id: string;
        name?: string | undefined;
        label?: string | undefined;
        transform?: {
            x: number;
            y: number;
            rotation: number;
        } | undefined;
    }, {
        type: "stage";
        width: number;
        height: number;
        id: string;
        name?: string | undefined;
        label?: string | undefined;
        transform?: {
            x?: number | undefined;
            y?: number | undefined;
            rotation?: number | undefined;
        } | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"label">;
        text: z.ZodString;
        fontSize: z.ZodDefault<z.ZodNumber>;
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        label: z.ZodOptional<z.ZodString>;
        transform: z.ZodOptional<z.ZodObject<{
            x: z.ZodDefault<z.ZodNumber>;
            y: z.ZodDefault<z.ZodNumber>;
            rotation: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            rotation: number;
        }, {
            x?: number | undefined;
            y?: number | undefined;
            rotation?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        type: "label";
        id: string;
        text: string;
        fontSize: number;
        name?: string | undefined;
        label?: string | undefined;
        transform?: {
            x: number;
            y: number;
            rotation: number;
        } | undefined;
    }, {
        type: "label";
        id: string;
        text: string;
        name?: string | undefined;
        label?: string | undefined;
        transform?: {
            x?: number | undefined;
            y?: number | undefined;
            rotation?: number | undefined;
        } | undefined;
        fontSize?: number | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"obstacle">;
        width: z.ZodNumber;
        height: z.ZodNumber;
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        label: z.ZodOptional<z.ZodString>;
        transform: z.ZodOptional<z.ZodObject<{
            x: z.ZodDefault<z.ZodNumber>;
            y: z.ZodDefault<z.ZodNumber>;
            rotation: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            rotation: number;
        }, {
            x?: number | undefined;
            y?: number | undefined;
            rotation?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        type: "obstacle";
        width: number;
        height: number;
        id: string;
        name?: string | undefined;
        label?: string | undefined;
        transform?: {
            x: number;
            y: number;
            rotation: number;
        } | undefined;
    }, {
        type: "obstacle";
        width: number;
        height: number;
        id: string;
        name?: string | undefined;
        label?: string | undefined;
        transform?: {
            x?: number | undefined;
            y?: number | undefined;
            rotation?: number | undefined;
        } | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"seatBlockGrid">;
        origin: z.ZodDefault<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
        }, {
            x: number;
            y: number;
        }>>;
        rows: z.ZodNumber;
        cols: z.ZodNumber;
        seatSpacingX: z.ZodNumber;
        seatSpacingY: z.ZodNumber;
        seatRadius: z.ZodDefault<z.ZodNumber>;
        rowLabel: z.ZodDefault<z.ZodObject<{
            start: z.ZodDefault<z.ZodString>;
            direction: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
        }, "strip", z.ZodTypeAny, {
            start: string;
            direction: "asc" | "desc";
        }, {
            start?: string | undefined;
            direction?: "asc" | "desc" | undefined;
        }>>;
        numbering: z.ZodDefault<z.ZodEnum<["L2R", "R2L"]>>;
        aisleGaps: z.ZodDefault<z.ZodArray<z.ZodObject<{
            afterCol: z.ZodNumber;
            gapPx: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            afterCol: number;
            gapPx: number;
        }, {
            afterCol: number;
            gapPx: number;
        }>, "many">>;
        section: z.ZodDefault<z.ZodString>;
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        label: z.ZodOptional<z.ZodString>;
        transform: z.ZodOptional<z.ZodObject<{
            x: z.ZodDefault<z.ZodNumber>;
            y: z.ZodDefault<z.ZodNumber>;
            rotation: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            rotation: number;
        }, {
            x?: number | undefined;
            y?: number | undefined;
            rotation?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        type: "seatBlockGrid";
        id: string;
        origin: {
            x: number;
            y: number;
        };
        rows: number;
        cols: number;
        seatSpacingX: number;
        seatSpacingY: number;
        seatRadius: number;
        rowLabel: {
            start: string;
            direction: "asc" | "desc";
        };
        numbering: "L2R" | "R2L";
        aisleGaps: {
            afterCol: number;
            gapPx: number;
        }[];
        section: string;
        name?: string | undefined;
        label?: string | undefined;
        transform?: {
            x: number;
            y: number;
            rotation: number;
        } | undefined;
    }, {
        type: "seatBlockGrid";
        id: string;
        rows: number;
        cols: number;
        seatSpacingX: number;
        seatSpacingY: number;
        name?: string | undefined;
        label?: string | undefined;
        transform?: {
            x?: number | undefined;
            y?: number | undefined;
            rotation?: number | undefined;
        } | undefined;
        origin?: {
            x: number;
            y: number;
        } | undefined;
        seatRadius?: number | undefined;
        rowLabel?: {
            start?: string | undefined;
            direction?: "asc" | "desc" | undefined;
        } | undefined;
        numbering?: "L2R" | "R2L" | undefined;
        aisleGaps?: {
            afterCol: number;
            gapPx: number;
        }[] | undefined;
        section?: string | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"seatBlockArc">;
        center: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
        }, {
            x: number;
            y: number;
        }>;
        rowCount: z.ZodNumber;
        startRadius: z.ZodNumber;
        radiusStep: z.ZodNumber;
        startAngleDeg: z.ZodNumber;
        endAngleDeg: z.ZodNumber;
        seatsPerRow: z.ZodUnion<[z.ZodObject<{
            start: z.ZodNumber;
            delta: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            start: number;
            delta: number;
        }, {
            start: number;
            delta: number;
        }>, z.ZodArray<z.ZodNumber, "many">]>;
        seatRadius: z.ZodDefault<z.ZodNumber>;
        aisleGaps: z.ZodDefault<z.ZodArray<z.ZodObject<{
            afterSeatIndex: z.ZodNumber;
            gapAngleDeg: z.ZodOptional<z.ZodNumber>;
            gapPx: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            afterSeatIndex: number;
            gapPx?: number | undefined;
            gapAngleDeg?: number | undefined;
        }, {
            afterSeatIndex: number;
            gapPx?: number | undefined;
            gapAngleDeg?: number | undefined;
        }>, "many">>;
        section: z.ZodDefault<z.ZodString>;
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        label: z.ZodOptional<z.ZodString>;
        transform: z.ZodOptional<z.ZodObject<{
            x: z.ZodDefault<z.ZodNumber>;
            y: z.ZodDefault<z.ZodNumber>;
            rotation: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            rotation: number;
        }, {
            x?: number | undefined;
            y?: number | undefined;
            rotation?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        type: "seatBlockArc";
        id: string;
        seatRadius: number;
        aisleGaps: {
            afterSeatIndex: number;
            gapPx?: number | undefined;
            gapAngleDeg?: number | undefined;
        }[];
        section: string;
        center: {
            x: number;
            y: number;
        };
        rowCount: number;
        startRadius: number;
        radiusStep: number;
        startAngleDeg: number;
        endAngleDeg: number;
        seatsPerRow: {
            start: number;
            delta: number;
        } | number[];
        name?: string | undefined;
        label?: string | undefined;
        transform?: {
            x: number;
            y: number;
            rotation: number;
        } | undefined;
    }, {
        type: "seatBlockArc";
        id: string;
        center: {
            x: number;
            y: number;
        };
        rowCount: number;
        startRadius: number;
        radiusStep: number;
        startAngleDeg: number;
        endAngleDeg: number;
        seatsPerRow: {
            start: number;
            delta: number;
        } | number[];
        name?: string | undefined;
        label?: string | undefined;
        transform?: {
            x?: number | undefined;
            y?: number | undefined;
            rotation?: number | undefined;
        } | undefined;
        seatRadius?: number | undefined;
        aisleGaps?: {
            afterSeatIndex: number;
            gapPx?: number | undefined;
            gapAngleDeg?: number | undefined;
        }[] | undefined;
        section?: string | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"seatBlockWedge">;
        center: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
        }, {
            x: number;
            y: number;
        }>;
        innerRadius: z.ZodNumber;
        outerRadius: z.ZodNumber;
        startAngleDeg: z.ZodNumber;
        endAngleDeg: z.ZodNumber;
        rowCount: z.ZodNumber;
        seatsPerRow: z.ZodUnion<[z.ZodObject<{
            start: z.ZodNumber;
            delta: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            start: number;
            delta: number;
        }, {
            start: number;
            delta: number;
        }>, z.ZodArray<z.ZodNumber, "many">]>;
        seatRadius: z.ZodDefault<z.ZodNumber>;
        section: z.ZodDefault<z.ZodString>;
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        label: z.ZodOptional<z.ZodString>;
        transform: z.ZodOptional<z.ZodObject<{
            x: z.ZodDefault<z.ZodNumber>;
            y: z.ZodDefault<z.ZodNumber>;
            rotation: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            rotation: number;
        }, {
            x?: number | undefined;
            y?: number | undefined;
            rotation?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        type: "seatBlockWedge";
        id: string;
        seatRadius: number;
        section: string;
        center: {
            x: number;
            y: number;
        };
        rowCount: number;
        startAngleDeg: number;
        endAngleDeg: number;
        seatsPerRow: {
            start: number;
            delta: number;
        } | number[];
        innerRadius: number;
        outerRadius: number;
        name?: string | undefined;
        label?: string | undefined;
        transform?: {
            x: number;
            y: number;
            rotation: number;
        } | undefined;
    }, {
        type: "seatBlockWedge";
        id: string;
        center: {
            x: number;
            y: number;
        };
        rowCount: number;
        startAngleDeg: number;
        endAngleDeg: number;
        seatsPerRow: {
            start: number;
            delta: number;
        } | number[];
        innerRadius: number;
        outerRadius: number;
        name?: string | undefined;
        label?: string | undefined;
        transform?: {
            x?: number | undefined;
            y?: number | undefined;
            rotation?: number | undefined;
        } | undefined;
        seatRadius?: number | undefined;
        section?: string | undefined;
    }>]>, "many">;
    compiled: z.ZodDefault<z.ZodObject<{
        seats: z.ZodArray<z.ZodObject<{
            seat_key: z.ZodString;
            label: z.ZodString;
            section: z.ZodOptional<z.ZodString>;
            row: z.ZodOptional<z.ZodString>;
            number: z.ZodOptional<z.ZodNumber>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            rotation: z.ZodOptional<z.ZodNumber>;
            meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            label: string;
            seat_key: string;
            number?: number | undefined;
            rotation?: number | undefined;
            section?: string | undefined;
            row?: string | undefined;
            meta?: Record<string, any> | undefined;
        }, {
            x: number;
            y: number;
            label: string;
            seat_key: string;
            number?: number | undefined;
            rotation?: number | undefined;
            section?: string | undefined;
            row?: string | undefined;
            meta?: Record<string, any> | undefined;
        }>, "many">;
        bounds: z.ZodObject<{
            minX: z.ZodNumber;
            minY: z.ZodNumber;
            maxX: z.ZodNumber;
            maxY: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            minX: number;
            minY: number;
            maxX: number;
            maxY: number;
        }, {
            minX: number;
            minY: number;
            maxX: number;
            maxY: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        seats: {
            x: number;
            y: number;
            label: string;
            seat_key: string;
            number?: number | undefined;
            rotation?: number | undefined;
            section?: string | undefined;
            row?: string | undefined;
            meta?: Record<string, any> | undefined;
        }[];
        bounds: {
            minX: number;
            minY: number;
            maxX: number;
            maxY: number;
        };
    }, {
        seats: {
            x: number;
            y: number;
            label: string;
            seat_key: string;
            number?: number | undefined;
            rotation?: number | undefined;
            section?: string | undefined;
            row?: string | undefined;
            meta?: Record<string, any> | undefined;
        }[];
        bounds: {
            minX: number;
            minY: number;
            maxX: number;
            maxY: number;
        };
    }>>;
}, "strip", z.ZodTypeAny, {
    schemaVersion: 1;
    title: string;
    canvas: {
        w: number;
        h: number;
        unit: string;
    };
    primitives: ({
        type: "stage";
        width: number;
        height: number;
        id: string;
        name?: string | undefined;
        label?: string | undefined;
        transform?: {
            x: number;
            y: number;
            rotation: number;
        } | undefined;
    } | {
        type: "label";
        id: string;
        text: string;
        fontSize: number;
        name?: string | undefined;
        label?: string | undefined;
        transform?: {
            x: number;
            y: number;
            rotation: number;
        } | undefined;
    } | {
        type: "obstacle";
        width: number;
        height: number;
        id: string;
        name?: string | undefined;
        label?: string | undefined;
        transform?: {
            x: number;
            y: number;
            rotation: number;
        } | undefined;
    } | {
        type: "seatBlockGrid";
        id: string;
        origin: {
            x: number;
            y: number;
        };
        rows: number;
        cols: number;
        seatSpacingX: number;
        seatSpacingY: number;
        seatRadius: number;
        rowLabel: {
            start: string;
            direction: "asc" | "desc";
        };
        numbering: "L2R" | "R2L";
        aisleGaps: {
            afterCol: number;
            gapPx: number;
        }[];
        section: string;
        name?: string | undefined;
        label?: string | undefined;
        transform?: {
            x: number;
            y: number;
            rotation: number;
        } | undefined;
    } | {
        type: "seatBlockArc";
        id: string;
        seatRadius: number;
        aisleGaps: {
            afterSeatIndex: number;
            gapPx?: number | undefined;
            gapAngleDeg?: number | undefined;
        }[];
        section: string;
        center: {
            x: number;
            y: number;
        };
        rowCount: number;
        startRadius: number;
        radiusStep: number;
        startAngleDeg: number;
        endAngleDeg: number;
        seatsPerRow: {
            start: number;
            delta: number;
        } | number[];
        name?: string | undefined;
        label?: string | undefined;
        transform?: {
            x: number;
            y: number;
            rotation: number;
        } | undefined;
    } | {
        type: "seatBlockWedge";
        id: string;
        seatRadius: number;
        section: string;
        center: {
            x: number;
            y: number;
        };
        rowCount: number;
        startAngleDeg: number;
        endAngleDeg: number;
        seatsPerRow: {
            start: number;
            delta: number;
        } | number[];
        innerRadius: number;
        outerRadius: number;
        name?: string | undefined;
        label?: string | undefined;
        transform?: {
            x: number;
            y: number;
            rotation: number;
        } | undefined;
    })[];
    compiled: {
        seats: {
            x: number;
            y: number;
            label: string;
            seat_key: string;
            number?: number | undefined;
            rotation?: number | undefined;
            section?: string | undefined;
            row?: string | undefined;
            meta?: Record<string, any> | undefined;
        }[];
        bounds: {
            minX: number;
            minY: number;
            maxX: number;
            maxY: number;
        };
    };
}, {
    schemaVersion: 1;
    canvas: {
        w: number;
        h: number;
        unit?: string | undefined;
    };
    primitives: ({
        type: "stage";
        width: number;
        height: number;
        id: string;
        name?: string | undefined;
        label?: string | undefined;
        transform?: {
            x?: number | undefined;
            y?: number | undefined;
            rotation?: number | undefined;
        } | undefined;
    } | {
        type: "label";
        id: string;
        text: string;
        name?: string | undefined;
        label?: string | undefined;
        transform?: {
            x?: number | undefined;
            y?: number | undefined;
            rotation?: number | undefined;
        } | undefined;
        fontSize?: number | undefined;
    } | {
        type: "obstacle";
        width: number;
        height: number;
        id: string;
        name?: string | undefined;
        label?: string | undefined;
        transform?: {
            x?: number | undefined;
            y?: number | undefined;
            rotation?: number | undefined;
        } | undefined;
    } | {
        type: "seatBlockGrid";
        id: string;
        rows: number;
        cols: number;
        seatSpacingX: number;
        seatSpacingY: number;
        name?: string | undefined;
        label?: string | undefined;
        transform?: {
            x?: number | undefined;
            y?: number | undefined;
            rotation?: number | undefined;
        } | undefined;
        origin?: {
            x: number;
            y: number;
        } | undefined;
        seatRadius?: number | undefined;
        rowLabel?: {
            start?: string | undefined;
            direction?: "asc" | "desc" | undefined;
        } | undefined;
        numbering?: "L2R" | "R2L" | undefined;
        aisleGaps?: {
            afterCol: number;
            gapPx: number;
        }[] | undefined;
        section?: string | undefined;
    } | {
        type: "seatBlockArc";
        id: string;
        center: {
            x: number;
            y: number;
        };
        rowCount: number;
        startRadius: number;
        radiusStep: number;
        startAngleDeg: number;
        endAngleDeg: number;
        seatsPerRow: {
            start: number;
            delta: number;
        } | number[];
        name?: string | undefined;
        label?: string | undefined;
        transform?: {
            x?: number | undefined;
            y?: number | undefined;
            rotation?: number | undefined;
        } | undefined;
        seatRadius?: number | undefined;
        aisleGaps?: {
            afterSeatIndex: number;
            gapPx?: number | undefined;
            gapAngleDeg?: number | undefined;
        }[] | undefined;
        section?: string | undefined;
    } | {
        type: "seatBlockWedge";
        id: string;
        center: {
            x: number;
            y: number;
        };
        rowCount: number;
        startAngleDeg: number;
        endAngleDeg: number;
        seatsPerRow: {
            start: number;
            delta: number;
        } | number[];
        innerRadius: number;
        outerRadius: number;
        name?: string | undefined;
        label?: string | undefined;
        transform?: {
            x?: number | undefined;
            y?: number | undefined;
            rotation?: number | undefined;
        } | undefined;
        seatRadius?: number | undefined;
        section?: string | undefined;
    })[];
    title?: string | undefined;
    compiled?: {
        seats: {
            x: number;
            y: number;
            label: string;
            seat_key: string;
            number?: number | undefined;
            rotation?: number | undefined;
            section?: string | undefined;
            row?: string | undefined;
            meta?: Record<string, any> | undefined;
        }[];
        bounds: {
            minX: number;
            minY: number;
            maxX: number;
            maxY: number;
        };
    } | undefined;
}>;

/**
 * @aioemp/seatmap-core — TypeScript Types (inferred from Zod schemas)
 */

type Layout = z.infer<typeof LayoutSchema>;
type Primitive = z.infer<typeof PrimitiveSchema>;
type CompiledSeat = z.infer<typeof CompiledSeatSchema>;
type Bounds = z.infer<typeof BoundsSchema>;
type Compiled = z.infer<typeof CompiledSchema>;
type Canvas = z.infer<typeof CanvasSchema>;
type Transform = z.infer<typeof TransformSchema>;
type Point = z.infer<typeof PointSchema>;
type RowLabel = z.infer<typeof RowLabelSchema>;
type GridAisleGap = z.infer<typeof GridAisleGapSchema>;
type ArcAisleGap = z.infer<typeof ArcAisleGapSchema>;
type SeatsPerRow = z.infer<typeof SeatsPerRowSchema>;
type StagePrimitive = z.infer<typeof StagePrimitiveSchema>;
type LabelPrimitive = z.infer<typeof LabelPrimitiveSchema>;
type ObstaclePrimitive = z.infer<typeof ObstaclePrimitiveSchema>;
type SeatBlockGrid = z.infer<typeof SeatBlockGridSchema>;
type SeatBlockArc = z.infer<typeof SeatBlockArcSchema>;
type SeatBlockWedge = z.infer<typeof SeatBlockWedgeSchema>;
type LayoutInput = z.input<typeof LayoutSchema>;
type PrimitiveInput = z.input<typeof PrimitiveSchema>;

/**
 * Compile all seat-producing primitives within a Layout.
 *
 * @param layout         - A **parsed** Layout object (already validated).
 * @param existingLayout - Previous layout whose compiled.seats are used
 *                         to preserve seat_keys.
 * @returns A new Layout with `compiled.seats` and `compiled.bounds` populated.
 */
declare function compileLayout(layout: Layout, existingLayout?: Layout): Layout;
type CompileResult = {
    success: true;
    layout: Layout;
} | {
    success: false;
    errors: zod.ZodError;
};
/**
 * Parse raw JSON with Zod, then compile if valid.
 *
 * @param rawLayout      - Untrusted input (e.g. from REST body / localStorage).
 * @param existingLayout - Previous layout for seat_key preservation.
 */
declare function validateAndCompile(rawLayout: unknown, existingLayout?: Layout): CompileResult;
declare function computeBounds(seats: CompiledSeat[]): Bounds;

/**
 * @aioemp/seatmap-core — seat_key preservation strategy
 *
 * Deterministic map: (primitiveId, logicalRow, logicalSeat) → seat_key.
 * On re-compile the same logical seat keeps its key; new seats get new keys;
 * removed seats simply drop out.
 */

/** Map key format: "primitiveId:logicalRow:logicalSeat" → UUID seat_key */
type SeatKeyMap = Map<string, string>;
/**
 * Build a lookup map from previously compiled seats.
 * Seats MUST carry `meta.primitiveId`, `meta.logicalRow`, `meta.logicalSeat`
 * (all compile functions in this library set those fields).
 */
declare function buildSeatKeyMap(existingSeats: CompiledSeat[]): SeatKeyMap;
/**
 * Resolve a seat_key for a logical position.
 * Returns the existing key if found, otherwise `null` (caller generates new).
 */
declare function resolveKey(keyMap: SeatKeyMap, primitiveId: string, logicalRow: number, logicalSeat: number): string | null;

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

declare function compileGrid(primitive: SeatBlockGrid, keyMap: SeatKeyMap): CompiledSeat[];

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

declare function compileArc(primitive: SeatBlockArc, keyMap: SeatKeyMap): CompiledSeat[];

/**
 * @aioemp/seatmap-core — Wedge block compiler
 *
 * Compiles a seatBlockWedge primitive into a flat list of CompiledSeat objects.
 *
 * A wedge is an arena pie-slice section bounded between innerRadius and
 * outerRadius and between startAngleDeg and endAngleDeg. Each row is at
 * an interpolated radius between inner and outer.
 *
 * Algorithm per row i:
 *   radius = innerRadius + i × (outerRadius − innerRadius) / (rowCount − 1)
 *   n      = seatsPerRow(i)
 *   θ_j    = startAngle + j × (endAngle − startAngle) / (n − 1)
 *   x = center.x + radius × cos(θ)
 *   y = center.y + radius × sin(θ)
 *   → rotate around center by transform.rotation
 *   → translate by (transform.x, transform.y)
 */

declare function compileWedge(primitive: SeatBlockWedge, keyMap: SeatKeyMap): CompiledSeat[];

/**
 * @aioemp/seatmap-core — Utility helpers
 */

/** Convert degrees to radians. */
declare function degToRad(deg: number): number;
/**
 * Rotate point (px, py) around center (cx, cy) by `angleDeg` degrees.
 */
declare function rotatePoint(px: number, py: number, cx: number, cy: number, angleDeg: number): {
    x: number;
    y: number;
};
/**
 * Convert a letter label to a 0-based index.
 * A → 0, B → 1, …, Z → 25, AA → 26, AB → 27 …
 */
declare function labelToIndex(label: string): number;
/**
 * Convert a 0-based index to a letter label.
 * 0 → A, 1 → B, …, 25 → Z, 26 → AA …
 */
declare function indexToLabel(index: number): string;
/**
 * Generate row label for a given row index.
 *
 * @param start  - Starting label (e.g. 'A')
 * @param rowIdx - 0-based row index
 * @param dir    - 'asc' (A→B→C) or 'desc' (Z→Y→X)
 */
declare function generateRowLabel(start: string, rowIdx: number, dir: 'asc' | 'desc'): string;
/**
 * Resolve the number of seats for a given row index.
 *
 * Accepts either:
 * - `{ start, delta }` — arithmetic progression
 * - `number[]` — explicit per-row counts (clamps to last element)
 */
declare function getSeatsPerRow(spec: SeatsPerRow, rowIndex: number): number;
/**
 * Generate a RFC 4122 v4 UUID.
 * Uses Web Crypto API when available, falls back to Math.random.
 */
declare function generateUUID(): string;
/** Round to 2 decimal places to avoid floating-point noise. */
declare function round2(n: number): number;

export { type ArcAisleGap, ArcAisleGapSchema, type Bounds, BoundsSchema, type Canvas, CanvasSchema, type CompileResult, type Compiled, CompiledSchema, type CompiledSeat, CompiledSeatSchema, type GridAisleGap, GridAisleGapSchema, type LabelPrimitive, LabelPrimitiveSchema, type Layout, type LayoutInput, LayoutSchema, type ObstaclePrimitive, ObstaclePrimitiveSchema, type Point, PointSchema, type Primitive, type PrimitiveInput, PrimitiveSchema, type RowLabel, RowLabelSchema, type SeatBlockArc, SeatBlockArcSchema, type SeatBlockGrid, SeatBlockGridSchema, type SeatBlockWedge, SeatBlockWedgeSchema, type SeatKeyMap, type SeatsPerRow, SeatsPerRowSchema, type StagePrimitive, StagePrimitiveSchema, type Transform, TransformSchema, buildSeatKeyMap, compileArc, compileGrid, compileLayout, compileWedge, computeBounds, degToRad, generateRowLabel, generateUUID, getSeatsPerRow, indexToLabel, labelToIndex, resolveKey, rotatePoint, round2, validateAndCompile };
