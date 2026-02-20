/**
 * @aioemp/seatmap-editor — Primitive Renderer
 *
 * Renders a single primitive as a Konva shape.
 * Non-seat primitives (stage, label, obstacle) are visual-only.
 * Seat-block primitives are rendered as a bounding outline.
 * Click on a primitive to select it.
 */

import React, { useCallback } from 'react';
import { Rect, Text, Group, Circle } from 'react-konva';
import type { Primitive } from '@aioemp/seatmap-core';
import { useEditorStore } from '../store';

interface Props {
  primitive: Primitive;
  isSelected: boolean;
}

const SELECTION_STROKE = '#4B49AC';
const SELECTION_DASH = [6, 3];

export const PrimitiveRenderer: React.FC<Props> = ({ primitive, isSelected }) => {
  const setSelectedIds = useEditorStore((s) => s.setSelectedIds);
  const updatePrimitive = useEditorStore((s) => s.updatePrimitive);

  const handleClick = useCallback(
    (e: any) => {
      e.cancelBubble = true; // prevent stage click from deselecting
      setSelectedIds([primitive.id]);
    },
    [primitive.id, setSelectedIds],
  );

  const handleDragEnd = useCallback(
    (e: any) => {
      const node = e.target;
      updatePrimitive(primitive.id, {
        transform: {
          x: Math.round(node.x()),
          y: Math.round(node.y()),
          rotation: primitive.transform?.rotation ?? 0,
        },
      } as any);
    },
    [primitive.id, primitive.transform, updatePrimitive],
  );

  const tx = primitive.transform?.x ?? 0;
  const ty = primitive.transform?.y ?? 0;
  const rotation = primitive.transform?.rotation ?? 0;

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
          strokeWidth={isSelected ? 2 : 1}
          dash={isSelected ? SELECTION_DASH : undefined}
          draggable
          onClick={handleClick}
          onTap={handleClick}
          onDragEnd={handleDragEnd}
          cornerRadius={4}
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
          draggable
          onClick={handleClick}
          onTap={handleClick}
          onDragEnd={handleDragEnd}
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
          strokeWidth={isSelected ? 2 : 1}
          dash={isSelected ? SELECTION_DASH : undefined}
          draggable
          onClick={handleClick}
          onTap={handleClick}
          onDragEnd={handleDragEnd}
          cornerRadius={2}
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
          stroke={isSelected ? SELECTION_STROKE : '#4B49AC44'}
          strokeWidth={isSelected ? 2 : 1}
          dash={isSelected ? SELECTION_DASH : [4, 4]}
          draggable
          onClick={handleClick}
          onTap={handleClick}
          onDragEnd={(e) => {
            const node = e.target;
            const newX = Math.round(node.x()) - primitive.origin.x;
            const newY = Math.round(node.y()) - primitive.origin.y;
            updatePrimitive(primitive.id, {
              transform: {
                x: newX,
                y: newY,
                rotation: primitive.transform?.rotation ?? 0,
              },
            } as any);
          }}
        />
      );
    }

    case 'seatBlockArc':
    case 'seatBlockWedge': {
      const cx = ('center' in primitive ? primitive.center.x : 0) + tx;
      const cy = ('center' in primitive ? primitive.center.y : 0) + ty;
      const r = primitive.type === 'seatBlockArc'
        ? primitive.startRadius + primitive.rowCount * primitive.radiusStep
        : primitive.outerRadius;
      return (
        <Group>
          <Circle
            x={cx}
            y={cy}
            radius={r}
            fill="transparent"
            stroke={isSelected ? SELECTION_STROKE : '#4B49AC44'}
            strokeWidth={isSelected ? 2 : 1}
            dash={isSelected ? SELECTION_DASH : [4, 4]}
            draggable
            onClick={handleClick}
            onTap={handleClick}
            onDragEnd={(e) => {
              const node = e.target;
              const centerX = 'center' in primitive ? primitive.center.x : 0;
              const centerY = 'center' in primitive ? primitive.center.y : 0;
              const newX = Math.round(node.x()) - centerX;
              const newY = Math.round(node.y()) - centerY;
              updatePrimitive(primitive.id, {
                transform: {
                  x: newX,
                  y: newY,
                  rotation: primitive.transform?.rotation ?? 0,
                },
              } as any);
            }}
          />
          {/* Center dot */}
          <Circle
            x={cx}
            y={cy}
            radius={4}
            fill={isSelected ? SELECTION_STROKE : '#4B49AC'}
          />
        </Group>
      );
    }

    default:
      return null;
  }
};
