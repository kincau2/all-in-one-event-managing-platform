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
      const gp = primitive as any;
      const ox = gp.origin.x + tx;
      const oy = gp.origin.y + ty;
      const gridSection = gp.section || '';
      const seatW = (gp.cols - 1) * gp.seatSpacingX;
      const seatH = (gp.rows - 1) * gp.seatSpacingY;
      const gPad = 16;
      const lblW = 24;
      const rectW = seatW + 2 * gPad + lblW;
      const rectH = seatH + 2 * gPad;
      // Local coords relative to origin (rotation center)
      const lx = -gPad - lblW;
      const ly = -gPad;
      return (
        <Group x={ox} y={oy} rotation={rotation} attrs={{ primitiveId: primitive.id }}>
          {gridSection !== '' && (
            <Text x={lx} y={ly - 16} text={gridSection} fontSize={13}
              fill="#4B49AC" fontStyle="bold" />
          )}
          <Rect
            x={lx}
            y={ly}
            width={rectW}
            height={rectH}
            fill="transparent"
            stroke={stroke}
            strokeWidth={sw}
            dash={dash}
            attrs={{ primitiveId: primitive.id }}
          />
          {isSelected && (
            <>
              <Circle x={lx} y={ly} radius={5} fill={SELECTION_STROKE} stroke="#fff" strokeWidth={1.5}
                attrs={{ rotateHandle: true, primitiveId: primitive.id }} />
              <Circle x={lx + rectW} y={ly} radius={5} fill={SELECTION_STROKE} stroke="#fff" strokeWidth={1.5}
                attrs={{ rotateHandle: true, primitiveId: primitive.id }} />
              <Circle x={lx + rectW} y={ly + rectH} radius={5} fill={SELECTION_STROKE} stroke="#fff" strokeWidth={1.5}
                attrs={{ rotateHandle: true, primitiveId: primitive.id }} />
              <Circle x={lx} y={ly + rectH} radius={5} fill={SELECTION_STROKE} stroke="#fff" strokeWidth={1.5}
                attrs={{ rotateHandle: true, primitiveId: primitive.id }} />
            </>
          )}
        </Group>
      );
    }

    case 'seatBlockArc': {
      const ap = primitive as any;
      const cx = ap.center.x + tx;
      const cy = ap.center.y + ty;
      const ratio = ap.radiusRatio ?? 1;
      const innerBase = ap.startRadius;
      const outerBase = ap.startRadius + (ap.rowCount - 1) * ap.radiusStep;
      const pad = 16;           // radial pixel padding
      const lblAng = 28;        // extra angular pixels for row labels
      const outerRx = outerBase * ratio + pad;
      const outerRy = outerBase + pad;
      const innerRx = Math.max(0, innerBase * ratio - pad);
      const innerRy = Math.max(0, innerBase - pad);
      const angPad = outerBase > 0 ? (pad + lblAng) / outerBase : 0;
      const startRad = (ap.startAngleDeg * Math.PI) / 180 - angPad;
      const endRad = (ap.endAngleDeg * Math.PI) / 180 + angPad;
      const arcSection = ap.section || '';
      /* Bounding box in local coords (center = 0,0) */
      let sMinX = 0, sMinY = 0, sMaxX = 0, sMaxY = 0;
      for (let i = 0; i <= 32; i++) {
        const a = startRad + ((endRad - startRad) * i) / 32;
        const cos = Math.cos(a), sin = Math.sin(a);
        for (const [rx, ry] of [[innerRx, innerRy], [outerRx, outerRy]] as const) {
          const px = rx * cos, py = ry * sin;
          sMinX = Math.min(sMinX, px); sMinY = Math.min(sMinY, py);
          sMaxX = Math.max(sMaxX, px); sMaxY = Math.max(sMaxY, py);
        }
      }
      return (
        <Group x={cx} y={cy} rotation={rotation} attrs={{ primitiveId: primitive.id }}>
          {arcSection !== '' && (
            <Text x={sMinX} y={sMinY - 16} text={arcSection} fontSize={13}
              fill="#4B49AC" fontStyle="bold" />
          )}
          <Shape
            attrs={{ primitiveId: primitive.id }}
            sceneFunc={(ctx: Konva.Context, shape: Konva.Shape) => {
              const c = ctx as any;
              drawSectorPath(
                c, 0, 0,
                outerRx, outerRy,
                innerRx, innerRy,
                startRad, endRad,
              );
              ctx.fillStrokeShape(shape);
            }}
            fill="transparent"
            stroke={stroke}
            strokeWidth={sw}
            dash={dash}
          />
          <Circle x={0} y={0} radius={3} fill={isSelected ? SELECTION_STROKE : '#4B49AC'}
            attrs={{ primitiveId: primitive.id }} />
          {isSelected && (
            <>
              <Circle x={sMinX} y={sMinY} radius={5} fill={SELECTION_STROKE} stroke="#fff" strokeWidth={1.5}
                attrs={{ rotateHandle: true, primitiveId: primitive.id }} />
              <Circle x={sMaxX} y={sMinY} radius={5} fill={SELECTION_STROKE} stroke="#fff" strokeWidth={1.5}
                attrs={{ rotateHandle: true, primitiveId: primitive.id }} />
              <Circle x={sMaxX} y={sMaxY} radius={5} fill={SELECTION_STROKE} stroke="#fff" strokeWidth={1.5}
                attrs={{ rotateHandle: true, primitiveId: primitive.id }} />
              <Circle x={sMinX} y={sMaxY} radius={5} fill={SELECTION_STROKE} stroke="#fff" strokeWidth={1.5}
                attrs={{ rotateHandle: true, primitiveId: primitive.id }} />
            </>
          )}
        </Group>
      );
    }

    case 'seatBlockWedge': {
      const wp = primitive as any;
      const cx = wp.center.x + tx;
      const cy = wp.center.y + ty;
      const wInnerR = wp.innerRadius;
      const wOuterR = wp.outerRadius;
      const startRad = (wp.startAngleDeg * Math.PI) / 180;
      const endRad = (wp.endAngleDeg * Math.PI) / 180;
      return (
        <Group attrs={{ primitiveId: primitive.id }}>
          <Shape
            attrs={{ primitiveId: primitive.id }}
            sceneFunc={(ctx: Konva.Context, shape: Konva.Shape) => {
              const c = ctx as any;
              drawSectorPath(c, cx, cy, wOuterR, wOuterR, wInnerR, wInnerR, startRad, endRad);
              ctx.fillStrokeShape(shape);
            }}
            fill="transparent"
            stroke={stroke}
            strokeWidth={sw}
            dash={dash}
          />
          <Circle x={cx} y={cy} radius={3} fill={isSelected ? SELECTION_STROKE : '#4B49AC'}
            attrs={{ primitiveId: primitive.id }} />
        </Group>
      );
    }

    default:
      return null;
  }
};
