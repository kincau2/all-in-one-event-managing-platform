/**
 * @aioemp/seatmap-editor — Seat dots layer
 *
 * Renders compiled seats as lightweight Konva Circles.
 * Uses sceneFunc for maximum performance with 2000+ seats.
 * Seats are NOT individually draggable (parametric model).
 */

import React, { useMemo } from 'react';
import { Shape } from 'react-konva';
import type { CompiledSeat } from '@aioemp/seatmap-core';
import type Konva from 'konva';

interface Props {
  seats: CompiledSeat[];
}

const DEFAULT_SEAT_RADIUS = 8;
const SEAT_FILL = '#4B49AC';
const SEAT_STROKE = '#3a389a';

/**
 * Render all seats using a single Konva Shape with a custom sceneFunc.
 * This is significantly faster than rendering thousands of Circle nodes.
 */
export const SeatDots: React.FC<Props> = React.memo(({ seats }) => {
  // Pre-compute nothing extra — seats already have x, y
  const seatData = useMemo(() => seats, [seats]);

  if (seatData.length === 0) return null;

  return (
    <Shape
      sceneFunc={(ctx: Konva.Context, shape: Konva.Shape) => {
        ctx.beginPath();
        for (let i = 0; i < seatData.length; i++) {
          const s = seatData[i];
          const r = s.radius ?? DEFAULT_SEAT_RADIUS;
          ctx.moveTo(s.x + r, s.y);
          ctx.arc(s.x, s.y, r, 0, Math.PI * 2, false);
        }
        ctx.closePath();
        ctx.fillStrokeShape(shape);
      }}
      fill={SEAT_FILL}
      stroke={SEAT_STROKE}
      strokeWidth={1}
    />
  );
});

SeatDots.displayName = 'SeatDots';
