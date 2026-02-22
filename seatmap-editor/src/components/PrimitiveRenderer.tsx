/**
 * @aioemp/seatmap-editor — Primitive Renderer
 *
 * Pure visual renderer for a single primitive.
 * No event handlers — all interaction is handled by EditorCanvas.
 * Each shape gets attrs.primitiveId for hit-test identification.
 * Arc/Wedge: draws only the seated sector (not a full circle).
 */

import React from 'react';
import { Rect, Text, Group, Circle, Shape } from 'react-konva';
import type { Primitive } from '@aioemp/seatmap-core';
import type Konva from 'konva';

interface Props {
  primitive: Primitive;
  isSelected: boolean;
}

const SELECTION_STROKE = '#4B49AC';
const SELECTION_DASH = [6, 3];
const OUTLINE_COLOR = '#4B49AC44';
const OUTLINE_DASH = [4, 4];

/** Draw an ellipse arc sector as a closed path (ring between inner and outer radius). */
function drawSectorPath(
  c: any,
  cx: number,
  cy: number,
  outerRx: number,
  outerRy: number,
  innerRx: number,
  innerRy: number,
  startRad: number,
  endRad: number,
) {
  const steps = 48;
  c.beginPath();
  // Outer arc (start → end)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = startRad + (endRad - startRad) * t;
    const x = cx + outerRx * Math.cos(angle);
    const y = cy + outerRy * Math.sin(angle);
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  // Inner arc (end → start, reverse)
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const angle = startRad + (endRad - startRad) * t;
    const x = cx + innerRx * Math.cos(angle);
    const y = cy + innerRy * Math.sin(angle);
    c.lineTo(x, y);
  }
  c.closePath();
}

export const PrimitiveRenderer: React.FC<Props> = ({ primitive, isSelected }) => {
  const tx = primitive.transform?.x ?? 0;
  const ty = primitive.transform?.y ?? 0;
  const rotation = primitive.transform?.rotation ?? 0;
  const stroke = isSelected ? SELECTION_STROKE : OUTLINE_COLOR;
  const sw = isSelected ? 2 : 1;
  const dash = isSelected ? SELECTION_DASH : OUTLINE_DASH;

  switch (primitive.type) {
    case 'stage':
      return (
        <Rect
          x={tx}
          y={ty}
          width={primitive.width}
          height={primitive.height}
          rotation={rotation}
          fill="#e0e0e0"
          stroke={isSelected ? SELECTION_STROKE : '#999'}
          strokeWidth={sw}
          dash={isSelected ? SELECTION_DASH : undefined}
          cornerRadius={4}
          attrs={{ primitiveId: primitive.id }}
        />
      );

    case 'label':
      return (
        <Text
          x={tx}
          y={ty}
          text={primitive.text}
          fontSize={primitive.fontSize}
          fill={isSelected ? SELECTION_STROKE : '#333'}
          fontStyle={isSelected ? 'bold' : 'normal'}
          rotation={rotation}
          attrs={{ primitiveId: primitive.id }}
        />
      );

    case 'obstacle':
      return (
        <Rect
          x={tx}
          y={ty}
          width={primitive.width}
          height={primitive.height}
          rotation={rotation}
          fill="#ffcccc"
          stroke={isSelected ? SELECTION_STROKE : '#cc5555'}
          strokeWidth={sw}
          dash={isSelected ? SELECTION_DASH : undefined}
          cornerRadius={2}
          attrs={{ primitiveId: primitive.id }}
        />
      );

    case 'seatBlockGrid': {
      const w = primitive.cols * primitive.seatSpacingX;
      const h = primitive.rows * primitive.seatSpacingY;
      const ox = primitive.origin.x + tx;
      const oy = primitive.origin.y + ty;
      return (
        <Rect
          x={ox}
          y={oy}
          width={w}
          height={h}
          rotation={rotation}
          fill="transparent"
          stroke={stroke}
          strokeWidth={sw}
          dash={dash}
          attrs={{ primitiveId: primitive.id }}
        />
      );
    }

    case 'seatBlockArc': {
      const cx = primitive.center.x + tx;
      const cy = primitive.center.y + ty;
      const ratio = (primitive as any).radiusRatio ?? 1;
      const innerR = primitive.startRadius;
      const outerR = primitive.startRadius + primitive.rowCount * primitive.radiusStep;
      const startRad = (primitive.startAngleDeg * Math.PI) / 180;
      const endRad = (primitive.endAngleDeg * Math.PI) / 180;
      return (
        <Group attrs={{ primitiveId: primitive.id }}>
          <Shape
            sceneFunc={(ctx: Konva.Context, shape: Konva.Shape) => {
              const c = ctx as any;
              drawSectorPath(
                c, cx, cy,
                outerR * ratio, outerR,
                innerR * ratio, innerR,
                startRad, endRad,
              );
              ctx.fillStrokeShape(shape);
            }}
            fill="transparent"
            stroke={stroke}
            strokeWidth={sw}
            dash={dash}
          />
          <Circle x={cx} y={cy} radius={3} fill={isSelected ? SELECTION_STROKE : '#4B49AC'} />
        </Group>
      );
    }

    case 'seatBlockWedge': {
      const cx = primitive.center.x + tx;
      const cy = primitive.center.y + ty;
      const innerR = primitive.innerRadius;
      const outerR = primitive.outerRadius;
      const startRad = (primitive.startAngleDeg * Math.PI) / 180;
      const endRad = (primitive.endAngleDeg * Math.PI) / 180;
      return (
        <Group attrs={{ primitiveId: primitive.id }}>
          <Shape
            sceneFunc={(ctx: Konva.Context, shape: Konva.Shape) => {
              const c = ctx as any;
              drawSectorPath(c, cx, cy, outerR, outerR, innerR, innerR, startRad, endRad);
              ctx.fillStrokeShape(shape);
            }}
            fill="transparent"
            stroke={stroke}
            strokeWidth={sw}
            dash={dash}
          />
          <Circle x={cx} y={cy} radius={3} fill={isSelected ? SELECTION_STROKE : '#4B49AC'} />
        </Group>
      );
    }

    default:
      return null;
  }
};
