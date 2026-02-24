/**
 * @aioemp/seatmap-editor — Primitive Renderer
 *
 * Pure visual renderer for a single primitive.
 * No event handlers — all interaction is handled by EditorCanvas.
 * Each shape gets attrs.primitiveId for hit-test identification.
 * Arc/Wedge: draws only the seated sector (not a full circle).
 */

import React, { useEffect, useState } from 'react';
import { Rect, Text, Group, Circle, Shape, Image as KonvaImage } from 'react-konva';
import type { Primitive } from '@aioemp/seatmap-core';
import {
  gridPivotOffset,
  arcPivotOffset,
  GRID_PAD,
  GRID_LBL_W,
  ARC_PAD,
  ARC_LBL_ANG,
} from '@aioemp/seatmap-core';
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

    case 'label': {
      const lp = primitive as any;
      const textW = (lp.text?.length ?? 5) * (lp.fontSize ?? 18) * 0.6;
      const textH = (lp.fontSize ?? 18) * 1.3;
      const lPivotX = textW / 2;
      const lPivotY = textH / 2;
      return (
        <Group x={tx + lPivotX} y={ty + lPivotY} rotation={rotation}
          offsetX={lPivotX} offsetY={lPivotY}
          attrs={{ primitiveId: primitive.id }}>
          {isSelected && (
            <Rect
              x={-4}
              y={-2}
              width={textW + 8}
              height={textH + 4}
              fill="transparent"
              stroke={SELECTION_STROKE}
              strokeWidth={1.5}
              dash={SELECTION_DASH}
              cornerRadius={3}
              attrs={{ primitiveId: primitive.id }}
            />
          )}
          <Text
            x={0}
            y={0}
            text={lp.text}
            fontSize={lp.fontSize}
            fill={lp.fontColor ?? '#333333'}
            fontStyle={lp.fontWeight ?? 'normal'}
            attrs={{ primitiveId: primitive.id }}
          />
          {isSelected && (
            <>
              <Circle x={0} y={0} radius={5} fill={SELECTION_STROKE} stroke="#fff" strokeWidth={1.5}
                attrs={{ rotateHandle: true, primitiveId: primitive.id }} />
              <Circle x={textW} y={0} radius={5} fill={SELECTION_STROKE} stroke="#fff" strokeWidth={1.5}
                attrs={{ rotateHandle: true, primitiveId: primitive.id }} />
              <Circle x={textW} y={textH} radius={5} fill={SELECTION_STROKE} stroke="#fff" strokeWidth={1.5}
                attrs={{ rotateHandle: true, primitiveId: primitive.id }} />
              <Circle x={0} y={textH} radius={5} fill={SELECTION_STROKE} stroke="#fff" strokeWidth={1.5}
                attrs={{ rotateHandle: true, primitiveId: primitive.id }} />
            </>
          )}
        </Group>
      );
    }

    case 'obstacle': {
      const op = primitive as any;
      const oPivotX = op.width / 2;
      const oPivotY = op.height / 2;
      const EDGE = 6; // invisible edge hit area thickness
      return (
        <Group x={tx + oPivotX} y={ty + oPivotY} rotation={rotation}
          offsetX={oPivotX} offsetY={oPivotY}
          attrs={{ primitiveId: primitive.id }}>
          <Rect
            x={0}
            y={0}
            width={op.width}
            height={op.height}
            fill={op.color ?? '#ffcccc'}
            stroke={isSelected ? SELECTION_STROKE : (op.borderColor ?? '#cc5555')}
            strokeWidth={sw}
            dash={isSelected ? SELECTION_DASH : undefined}
            cornerRadius={op.borderRadius ?? 0}
            attrs={{ primitiveId: primitive.id }}
          />
          {isSelected && (
            <>
              {/* Resize edge hit areas (invisible fat rects along each edge) */}
              {/* Top edge */}
              <Rect x={EDGE} y={-EDGE / 2} width={op.width - 2 * EDGE} height={EDGE}
                fill="transparent" attrs={{ resizeEdge: 'top', primitiveId: primitive.id }} />
              {/* Bottom edge */}
              <Rect x={EDGE} y={op.height - EDGE / 2} width={op.width - 2 * EDGE} height={EDGE}
                fill="transparent" attrs={{ resizeEdge: 'bottom', primitiveId: primitive.id }} />
              {/* Left edge */}
              <Rect x={-EDGE / 2} y={EDGE} width={EDGE} height={op.height - 2 * EDGE}
                fill="transparent" attrs={{ resizeEdge: 'left', primitiveId: primitive.id }} />
              {/* Right edge */}
              <Rect x={op.width - EDGE / 2} y={EDGE} width={EDGE} height={op.height - 2 * EDGE}
                fill="transparent" attrs={{ resizeEdge: 'right', primitiveId: primitive.id }} />
              {/* Corner rotation handles */}
              <Circle x={0} y={0} radius={5} fill={SELECTION_STROKE} stroke="#fff" strokeWidth={1.5}
                attrs={{ rotateHandle: true, primitiveId: primitive.id }} />
              <Circle x={op.width} y={0} radius={5} fill={SELECTION_STROKE} stroke="#fff" strokeWidth={1.5}
                attrs={{ rotateHandle: true, primitiveId: primitive.id }} />
              <Circle x={op.width} y={op.height} radius={5} fill={SELECTION_STROKE} stroke="#fff" strokeWidth={1.5}
                attrs={{ rotateHandle: true, primitiveId: primitive.id }} />
              <Circle x={0} y={op.height} radius={5} fill={SELECTION_STROKE} stroke="#fff" strokeWidth={1.5}
                attrs={{ rotateHandle: true, primitiveId: primitive.id }} />
            </>
          )}
        </Group>
      );
    }

    case 'seatBlockGrid': {
      const gp = primitive as any;
      const ox = gp.origin.x + tx;
      const oy = gp.origin.y + ty;
      const gridSection = gp.section || '';
      const seatW = (gp.cols - 1) * gp.seatSpacingX;
      const seatH = (gp.rows - 1) * gp.seatSpacingY;
      const rectW = seatW + 2 * GRID_PAD + 2 * GRID_LBL_W;
      const rectH = seatH + 2 * GRID_PAD;
      const lx = -GRID_PAD - GRID_LBL_W;
      const ly = -GRID_PAD;
      const pivot = gridPivotOffset(gp.cols, gp.rows, gp.seatSpacingX, gp.seatSpacingY);
      return (
        <Group x={ox + pivot.x} y={oy + pivot.y} rotation={rotation}
          offsetX={pivot.x} offsetY={pivot.y}
          attrs={{ primitiveId: primitive.id }}>
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
      const outerRx = outerBase * ratio + ARC_PAD;
      const outerRy = outerBase + ARC_PAD;
      const innerRx = Math.max(0, innerBase * ratio - ARC_PAD);
      const innerRy = Math.max(0, innerBase - ARC_PAD);
      const angPad = outerBase > 0 ? (ARC_PAD + ARC_LBL_ANG) / outerBase : 0;
      const startRad = (ap.startAngleDeg * Math.PI) / 180 - angPad;
      const endRad = (ap.endAngleDeg * Math.PI) / 180 + angPad;
      const arcSection = ap.section || '';
      /* Bounding box in local coords (center = 0,0) */
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
      const arcPivot = arcPivotOffset(ap.startRadius, ap.rowCount, ap.radiusStep, ratio, ap.startAngleDeg, ap.endAngleDeg);
      return (
        <Group x={cx + arcPivot.x} y={cy + arcPivot.y} rotation={rotation}
          offsetX={arcPivot.x} offsetY={arcPivot.y}
          attrs={{ primitiveId: primitive.id }}>
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

    case 'image': {
      const ip = primitive as any;
      const iPivotX = ip.width / 2;
      const iPivotY = ip.height / 2;
      const EDGE = 6;
      return (
        <ImagePrimRenderer
          primitive={primitive}
          tx={tx}
          ty={ty}
          rotation={rotation}
          isSelected={isSelected}
          iPivotX={iPivotX}
          iPivotY={iPivotY}
          EDGE={EDGE}
        />
      );
    }

    default:
      return null;
  }
};

/* ── Image primitive sub-component (needs state for async image load) ── */

interface ImagePrimProps {
  primitive: Primitive;
  tx: number;
  ty: number;
  rotation: number;
  isSelected: boolean;
  iPivotX: number;
  iPivotY: number;
  EDGE: number;
}

const ImagePrimRenderer: React.FC<ImagePrimProps> = ({
  primitive,
  tx,
  ty,
  rotation,
  isSelected,
  iPivotX,
  iPivotY,
  EDGE,
}) => {
  const ip = primitive as any;
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!ip.src) { setImg(null); return; }
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => setImg(image);
    image.onerror = () => setImg(null);
    image.src = ip.src;
  }, [ip.src]);

  return (
    <Group
      x={tx + iPivotX}
      y={ty + iPivotY}
      rotation={rotation}
      offsetX={iPivotX}
      offsetY={iPivotY}
      attrs={{ primitiveId: primitive.id }}
    >
      {img ? (
        <KonvaImage
          x={0}
          y={0}
          width={ip.width}
          height={ip.height}
          image={img}
          stroke={isSelected ? SELECTION_STROKE : undefined}
          strokeWidth={isSelected ? 2 : 0}
          dash={isSelected ? SELECTION_DASH : undefined}
          attrs={{ primitiveId: primitive.id }}
        />
      ) : (
        <Rect
          x={0}
          y={0}
          width={ip.width}
          height={ip.height}
          fill="#f0f0f0"
          stroke={isSelected ? SELECTION_STROKE : '#ccc'}
          strokeWidth={isSelected ? 2 : 1}
          dash={isSelected ? SELECTION_DASH : [4, 4]}
          attrs={{ primitiveId: primitive.id }}
        />
      )}
      {isSelected && (
        <>
          {/* Resize edge hit areas */}
          <Rect x={EDGE} y={-EDGE / 2} width={ip.width - 2 * EDGE} height={EDGE}
            fill="transparent" attrs={{ resizeEdge: 'top', primitiveId: primitive.id }} />
          <Rect x={EDGE} y={ip.height - EDGE / 2} width={ip.width - 2 * EDGE} height={EDGE}
            fill="transparent" attrs={{ resizeEdge: 'bottom', primitiveId: primitive.id }} />
          <Rect x={-EDGE / 2} y={EDGE} width={EDGE} height={ip.height - 2 * EDGE}
            fill="transparent" attrs={{ resizeEdge: 'left', primitiveId: primitive.id }} />
          <Rect x={ip.width - EDGE / 2} y={EDGE} width={EDGE} height={ip.height - 2 * EDGE}
            fill="transparent" attrs={{ resizeEdge: 'right', primitiveId: primitive.id }} />
          {/* Corner rotation handles */}
          <Circle x={0} y={0} radius={5} fill={SELECTION_STROKE} stroke="#fff" strokeWidth={1.5}
            attrs={{ rotateHandle: true, primitiveId: primitive.id }} />
          <Circle x={ip.width} y={0} radius={5} fill={SELECTION_STROKE} stroke="#fff" strokeWidth={1.5}
            attrs={{ rotateHandle: true, primitiveId: primitive.id }} />
          <Circle x={ip.width} y={ip.height} radius={5} fill={SELECTION_STROKE} stroke="#fff" strokeWidth={1.5}
            attrs={{ rotateHandle: true, primitiveId: primitive.id }} />
          <Circle x={0} y={ip.height} radius={5} fill={SELECTION_STROKE} stroke="#fff" strokeWidth={1.5}
            attrs={{ rotateHandle: true, primitiveId: primitive.id }} />
        </>
      )}
    </Group>
  );
};
