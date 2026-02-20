/**
 * @aioemp/seatmap-editor — Konva canvas with zoom/pan
 *
 * Renders all primitives + compiled seats on a Konva Stage.
 * Supports:
 *  - Mouse-wheel zoom (centered on pointer)
 *  - Middle-click / space+drag panning
 *  - Click-to-select primitives
 *  - Click-on-empty to deselect
 */

import React, { useRef, useCallback, useEffect } from 'react';
import { Stage, Layer, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import { useEditorStore } from '../store';
import { PrimitiveRenderer } from './PrimitiveRenderer';
import { SeatDots } from './SeatDots';

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;

export const EditorCanvas: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => {
  const stageRef = useRef<Konva.Stage>(null);

  const stageX = useEditorStore((s) => s.stageX);
  const stageY = useEditorStore((s) => s.stageY);
  const stageScale = useEditorStore((s) => s.stageScale);
  const setViewport = useEditorStore((s) => s.setViewport);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const layout = useEditorStore((s) => s.layout);
  const compiledSeats = useEditorStore((s) => s.compiledSeats);
  const selectedIds = useEditorStore((s) => s.selectedIds);

  /* ── Zoom on wheel ── */
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const factor = 1.08;
      let newScale = direction > 0 ? oldScale * factor : oldScale / factor;
      newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      const newX = pointer.x - mousePointTo.x * newScale;
      const newY = pointer.y - mousePointTo.y * newScale;

      setViewport(newX, newY, newScale);
    },
    [setViewport],
  );

  /* ── Pan on drag (stage is draggable) ── */
  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (e.target !== stageRef.current) return;
      setViewport(e.target.x(), e.target.y(), stageScale);
    },
    [setViewport, stageScale],
  );

  /* ── Click on empty to deselect ── */
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Only if we clicked the stage itself (not a shape)
      if (e.target === stageRef.current) {
        clearSelection();
      }
    },
    [clearSelection],
  );

  /* ── Keyboard shortcuts (undo/redo/delete) ── */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const store = useEditorStore.getState();
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Undo: Ctrl/Cmd+Z
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        store.undo();
      }
      // Redo: Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        store.redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        store.redo();
      }
      // Delete / Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (store.selectedIds.length > 0) {
          e.preventDefault();
          store.removePrimitives(store.selectedIds);
        }
      }
      // Duplicate: Ctrl/Cmd+D
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        if (store.selectedIds.length > 0) {
          e.preventDefault();
          store.duplicatePrimitives(store.selectedIds);
        }
      }
      // Escape: deselect + reset tool
      if (e.key === 'Escape') {
        store.clearSelection();
        store.setActiveTool('select');
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      x={stageX}
      y={stageY}
      scaleX={stageScale}
      scaleY={stageScale}
      draggable
      onWheel={handleWheel}
      onDragEnd={handleDragEnd}
      onClick={handleStageClick}
      onTap={handleStageClick}
      style={{ background: '#f0f0f0' }}
    >
      {/* Background canvas area */}
      <Layer>
        <Rect
          x={0}
          y={0}
          width={layout.canvas.w}
          height={layout.canvas.h}
          fill="#ffffff"
          shadowColor="rgba(0,0,0,0.1)"
          shadowBlur={10}
          shadowOffsetX={2}
          shadowOffsetY={2}
        />
        <Text
          x={4}
          y={layout.canvas.h + 8}
          text={`${layout.canvas.w} × ${layout.canvas.h} px`}
          fontSize={11}
          fill="#999"
        />
      </Layer>

      {/* Primitives (non-seat visual elements) */}
      <Layer>
        {layout.primitives.map((prim) => (
          <PrimitiveRenderer
            key={prim.id}
            primitive={prim}
            isSelected={selectedIds.includes(prim.id)}
          />
        ))}
      </Layer>

      {/* Compiled seats — lightweight circles */}
      <Layer listening={false}>
        <SeatDots seats={compiledSeats} />
      </Layer>
    </Stage>
  );
};
