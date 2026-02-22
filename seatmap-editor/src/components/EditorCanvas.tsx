/**
 * @aioemp/seatmap-editor — Konva canvas (v2 interaction engine)
 *
 * All mouse/keyboard interaction is handled here:
 *  - Wheel zoom (centered on pointer)
 *  - Pan: middle-button drag OR space + left-drag
 *  - blockSelect: rubber-band to select seat-block primitives; click primitive to select
 *  - seatSelect: rubber-band to select individual seats; click seat to toggle exclusion
 *  - Drag-to-move: left-drag on an already-selected primitive
 *  - Drag-to-create: left-drag in addGrid / addArc tool → creates block from rectangle
 *  - Arrow keys: pan viewport when nothing selected; move selected primitives otherwise
 *  - Delete / Backspace: remove selected blocks or exclude selected seats
 */

import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import { Stage, Layer, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import { useEditorStore } from '../store';
import { generateUUID } from '@aioemp/seatmap-core';
import { PrimitiveRenderer } from './PrimitiveRenderer';
import { SeatDots } from './SeatDots';

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const PAN_PX = 20;
const MOVE_PX = 1;
const MOVE_SHIFT_PX = 10;

type InteractionMode = 'idle' | 'panning' | 'selecting' | 'moving' | 'creating';

interface DragRect {
  x: number; y: number; w: number; h: number;
}

/** Hit-test: find the primitiveId under the pointer (or null). */
function primitiveUnderPointer(stage: Konva.Stage): string | null {
  const pos = stage.getPointerPosition();
  if (!pos) return null;
  // Konva stores `attrs` on each node — we tagged shapes with primitiveId via the `attrs` prop.
  const shapes = stage.getAllIntersections(pos);
  for (const shape of shapes) {
    const pid = (shape as any).attrs?.primitiveId;
    if (pid) return pid as string;
  }
  return null;
}

/** Convert pointer position to world coordinates. */
function pointerToWorld(stage: Konva.Stage): { x: number; y: number } | null {
  const pos = stage.getPointerPosition();
  if (!pos) return null;
  const scale = stage.scaleX();
  return {
    x: (pos.x - stage.x()) / scale,
    y: (pos.y - stage.y()) / scale,
  };
}

export const EditorCanvas: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => {
  const stageRef = useRef<Konva.Stage>(null);

  /* ── Store selectors ── */
  const stageX = useEditorStore((s) => s.stageX);
  const stageY = useEditorStore((s) => s.stageY);
  const stageScale = useEditorStore((s) => s.stageScale);
  const setViewport = useEditorStore((s) => s.setViewport);
  const layout = useEditorStore((s) => s.layout);
  const compiledSeats = useEditorStore((s) => s.compiledSeats);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const selectedSeatKeys = useEditorStore((s) => s.selectedSeatKeys);
  const activeTool = useEditorStore((s) => s.activeTool);

  /* ── Interaction state (ref for perf — no re-renders during drag) ── */
  const modeRef = useRef<InteractionMode>('idle');
  const panStartRef = useRef({ sx: 0, sy: 0, px: 0, py: 0 });
  const dragOriginRef = useRef({ wx: 0, wy: 0 });
  const spaceDownRef = useRef(false);

  /* ── Rubber-band / creation preview rect (state for rendering) ── */
  const [selRect, setSelRect] = useState<DragRect | null>(null);
  const [createRect, setCreateRect] = useState<DragRect | null>(null);

  /* ── Excluded seat keys (visual only — computed from layout) ── */
  const excludedSeatKeys = useMemo(() => new Set<string>(), [layout.primitives, compiledSeats]);

  /* ── selectedSeatKeys as Set for SeatDots ── */
  const selectedSeatKeysSet = useMemo(
    () => new Set(selectedSeatKeys),
    [selectedSeatKeys],
  );

  /* ── Wheel zoom ── */
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const dir = e.evt.deltaY > 0 ? -1 : 1;
      const factor = 1.08;
      let ns = dir > 0 ? oldScale * factor : oldScale / factor;
      ns = Math.max(MIN_SCALE, Math.min(MAX_SCALE, ns));

      const mp = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };
      setViewport(pointer.x - mp.x * ns, pointer.y - mp.y * ns, ns);
    },
    [setViewport],
  );

  /* ── MouseDown ── */
  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current;
      if (!stage) return;
      const evt = e.evt;
      const store = useEditorStore.getState();
      const tool = store.activeTool;

      /* Middle-button or Space+Left → pan */
      if (evt.button === 1 || (evt.button === 0 && spaceDownRef.current)) {
        modeRef.current = 'panning';
        panStartRef.current = { sx: store.stageX, sy: store.stageY, px: evt.clientX, py: evt.clientY };
        evt.preventDefault();
        return;
      }

      if (evt.button !== 0) return;

      const world = pointerToWorld(stage);
      if (!world) return;

      /* addGrid / addArc → drag-to-create */
      if (tool === 'addGrid' || tool === 'addArc') {
        modeRef.current = 'creating';
        dragOriginRef.current = { wx: world.x, wy: world.y };
        setCreateRect({ x: world.x, y: world.y, w: 0, h: 0 });
        return;
      }

      /* blockSelect / seatSelect */
      if (tool === 'blockSelect' || tool === 'seatSelect') {
        const pid = primitiveUnderPointer(stage);

        if (tool === 'blockSelect' && pid) {
          /* Click on a primitive */
          const alreadySelected = store.selectedIds.includes(pid);
          if (evt.shiftKey) {
            /* Shift+click: toggle in multi-select */
            if (alreadySelected) {
              store.setSelectedIds(store.selectedIds.filter((id) => id !== pid));
            } else {
              store.setSelectedIds([...store.selectedIds, pid]);
            }
          } else if (!alreadySelected) {
            store.setSelectedIds([pid]);
          }
          /* Start moving selected blocks */
          modeRef.current = 'moving';
          dragOriginRef.current = { wx: world.x, wy: world.y };
          store.pushSnapshot(); // snapshot before move
          return;
        }

        if (tool === 'blockSelect' && !pid) {
          /* Click on empty — start rubber-band */
          if (!evt.shiftKey) store.clearSelection();
          modeRef.current = 'selecting';
          dragOriginRef.current = { wx: world.x, wy: world.y };
          setSelRect({ x: world.x, y: world.y, w: 0, h: 0 });
          return;
        }

        if (tool === 'seatSelect') {
          /* Start rubber-band for seat selection */
          if (!evt.shiftKey) store.setSelectedSeatKeys([]);
          modeRef.current = 'selecting';
          dragOriginRef.current = { wx: world.x, wy: world.y };
          setSelRect({ x: world.x, y: world.y, w: 0, h: 0 });
          return;
        }
      }
    },
    [],
  );

  /* ── MouseMove ── */
  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current;
      if (!stage) return;
      const mode = modeRef.current;

      if (mode === 'panning') {
        const { sx, sy, px, py } = panStartRef.current;
        const dx = e.evt.clientX - px;
        const dy = e.evt.clientY - py;
        useEditorStore.getState().setViewport(sx + dx, sy + dy, useEditorStore.getState().stageScale);
        return;
      }

      const world = pointerToWorld(stage);
      if (!world) return;
      const ox = dragOriginRef.current.wx;
      const oy = dragOriginRef.current.wy;

      if (mode === 'selecting') {
        const rect: DragRect = {
          x: Math.min(ox, world.x),
          y: Math.min(oy, world.y),
          w: Math.abs(world.x - ox),
          h: Math.abs(world.y - oy),
        };
        setSelRect(rect);
        return;
      }

      if (mode === 'moving') {
        const dx = world.x - ox;
        const dy = world.y - oy;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          dragOriginRef.current = { wx: world.x, wy: world.y };
          const store = useEditorStore.getState();
          // Use direct move (no undo push — we already pushed in mouseDown)
          store.movePrimitivesBy(store.selectedIds, dx, dy);
        }
        return;
      }

      if (mode === 'creating') {
        const rect: DragRect = {
          x: Math.min(ox, world.x),
          y: Math.min(oy, world.y),
          w: Math.abs(world.x - ox),
          h: Math.abs(world.y - oy),
        };
        setCreateRect(rect);
        return;
      }
    },
    [],
  );

  /* ── MouseUp ── */
  const handleMouseUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const mode = modeRef.current;
      const stage = stageRef.current;
      modeRef.current = 'idle';

      if (mode === 'panning') {
        return;
      }

      if (mode === 'selecting' && selRect) {
        const store = useEditorStore.getState();
        const r = selRect;
        setSelRect(null);

        if (r.w < 3 && r.h < 3) {
          // Tiny rect = click on empty, already handled in mouseDown
          return;
        }

        if (store.activeTool === 'blockSelect') {
          /* Find primitives whose bounding box overlaps the rubber-band */
          const ids: string[] = [];
          for (const p of store.layout.primitives) {
            const bb = primitiveBBox(p);
            if (rectsOverlap(r, bb)) ids.push(p.id);
          }
          if (e.evt.shiftKey) {
            const merged = new Set([...store.selectedIds, ...ids]);
            store.setSelectedIds(Array.from(merged));
          } else {
            store.setSelectedIds(ids);
          }
        }

        if (store.activeTool === 'seatSelect') {
          /* Find compiled seats inside rubber-band */
          const keys: string[] = [];
          for (const seat of store.compiledSeats) {
            if (seat.x >= r.x && seat.x <= r.x + r.w &&
                seat.y >= r.y && seat.y <= r.y + r.h) {
              keys.push(seat.seat_key);
            }
          }
          if (e.evt.shiftKey) {
            const merged = new Set([...store.selectedSeatKeys, ...keys]);
            store.setSelectedSeatKeys(Array.from(merged));
          } else {
            store.setSelectedSeatKeys(keys);
          }
        }
        return;
      }

      if (mode === 'creating' && createRect) {
        const store = useEditorStore.getState();
        const r = createRect;
        setCreateRect(null);

        if (r.w < 20 || r.h < 20) {
          // Too small — treat as click; switch back to blockSelect
          store.setActiveTool('blockSelect');
          return;
        }

        if (store.activeTool === 'addGrid') {
          const spacingX = 30;
          const spacingY = 35;
          const cols = Math.max(1, Math.round(r.w / spacingX));
          const rows = Math.max(1, Math.round(r.h / spacingY));
          store.addPrimitive({
            id: generateUUID(),
            type: 'seatBlockGrid' as const,
            name: `Grid ${cols}×${rows}`,
            origin: { x: r.x, y: r.y },
            rows,
            cols,
            seatSpacingX: spacingX,
            seatSpacingY: spacingY,
            rowLabel: { mode: 'alpha' as const, start: 'A', direction: 'asc' as const },
            numbering: 'L2R' as const,
            aisleGaps: [],
            excludedSeats: [],
            section: '',
          } as any);
        }

        if (store.activeTool === 'addArc') {
          /* Arc from drag rect:
             - center is at rect top-center, offset up by startRadius
             - angle span computed from rect width
             - rows from rect height  */
          const startRadius = 1500;
          const radiusStep = 35;
          const rows = Math.max(1, Math.round(r.h / radiusStep));
          const halfWidth = r.w / 2;
          const halfAngleRad = Math.asin(Math.min(1, halfWidth / startRadius));
          const halfAngleDeg = (halfAngleRad * 180) / Math.PI;
          const centerX = r.x + r.w / 2;
          const centerY = r.y - startRadius;
          const startAngle = 90 - halfAngleDeg;
          const endAngle = 90 + halfAngleDeg;
          const seatsStart = Math.max(4, Math.round(r.w / 30));
          store.addPrimitive({
            id: generateUUID(),
            type: 'seatBlockArc' as const,
            name: 'Arc Block',
            center: { x: centerX, y: centerY },
            rowCount: rows,
            startRadius,
            radiusStep,
            radiusRatio: 1,
            startAngleDeg: Math.round(startAngle),
            endAngleDeg: Math.round(endAngle),
            seatsPerRow: { start: seatsStart, delta: 2 },
            rowLabel: { mode: 'alpha' as const, start: 'A', direction: 'asc' as const },
            numbering: 'L2R' as const,
            aisleGaps: [],
            excludedSeats: [],
            section: '',
          } as any);
        }

        // After creating, switch back to blockSelect
        store.setActiveTool('blockSelect');
        return;
      }

      if (mode === 'moving') {
        // Move complete — snapshot was already pushed in mouseDown
        return;
      }
    },
    [selRect, createRect],
  );

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const store = useEditorStore.getState();

      /* Space → enable pan mode */
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        spaceDownRef.current = true;
        return;
      }

      /* Undo / Redo */
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault(); store.undo(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault(); store.redo(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault(); store.redo(); return;
      }

      /* Delete / Backspace */
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (store.selectedIds.length > 0) {
          e.preventDefault();
          store.removePrimitives(store.selectedIds);
        } else if (store.selectedSeatKeys.length > 0) {
          e.preventDefault();
          store.removeSelectedSeats();
        }
        return;
      }

      /* Duplicate: Ctrl/Cmd+D */
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        if (store.selectedIds.length > 0) {
          e.preventDefault();
          store.duplicatePrimitives(store.selectedIds);
        }
        return;
      }

      /* Escape: deselect + reset tool */
      if (e.key === 'Escape') {
        store.clearSelection();
        store.setActiveTool('blockSelect');
        return;
      }

      /* Arrow keys */
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? MOVE_SHIFT_PX : MOVE_PX;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;

        if (store.selectedIds.length > 0) {
          /* Move selected primitives */
          store.pushSnapshot();
          store.movePrimitivesBy(store.selectedIds, dx, dy);
        } else {
          /* Pan viewport */
          store.setViewport(
            store.stageX - dx * PAN_PX,
            store.stageY - dy * PAN_PX,
            store.stageScale,
          );
        }
        return;
      }

      /* Tool shortcuts */
      if (!e.ctrlKey && !e.metaKey) {
        if (e.key === 'v' || e.key === 'V') store.setActiveTool('blockSelect');
        if (e.key === 's' || e.key === 'S') store.setActiveTool('seatSelect');
        if (e.key === 'g' || e.key === 'G') store.setActiveTool('addGrid');
        if (e.key === 'a' || e.key === 'A') store.setActiveTool('addArc');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDownRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  /* ── Cursor ── */
  const cursor = useMemo(() => {
    if (spaceDownRef.current) return 'grab';
    switch (activeTool) {
      case 'seatSelect': return 'crosshair';
      case 'addGrid':
      case 'addArc': return 'crosshair';
      default: return 'default';
    }
  }, [activeTool]);

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      x={stageX}
      y={stageY}
      scaleX={stageScale}
      scaleY={stageScale}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ background: '#e8e8e8', cursor }}
    >
      {/* Background canvas area */}
      <Layer>
        <Rect
          x={0}
          y={0}
          width={layout.canvas.w}
          height={layout.canvas.h}
          fill="#ffffff"
          shadowColor="rgba(0,0,0,0.08)"
          shadowBlur={12}
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

      {/* Primitives */}
      <Layer>
        {layout.primitives.map((prim) => (
          <PrimitiveRenderer
            key={prim.id}
            primitive={prim}
            isSelected={selectedIds.includes(prim.id)}
          />
        ))}
      </Layer>

      {/* Compiled seats */}
      <Layer listening={false}>
        <SeatDots
          seats={compiledSeats}
          excludedSeatKeys={excludedSeatKeys}
          selectedSeatKeys={selectedSeatKeysSet}
        />
      </Layer>

      {/* Rubber-band selection rectangle */}
      {selRect && selRect.w > 0 && selRect.h > 0 && (
        <Layer listening={false}>
          <Rect
            x={selRect.x}
            y={selRect.y}
            width={selRect.w}
            height={selRect.h}
            fill="rgba(75,73,172,0.08)"
            stroke="#4B49AC"
            strokeWidth={1}
            dash={[4, 4]}
          />
        </Layer>
      )}

      {/* Drag-to-create preview rectangle */}
      {createRect && createRect.w > 0 && createRect.h > 0 && (
        <Layer listening={false}>
          <Rect
            x={createRect.x}
            y={createRect.y}
            width={createRect.w}
            height={createRect.h}
            fill="rgba(75,73,172,0.12)"
            stroke="#4B49AC"
            strokeWidth={2}
            dash={[6, 3]}
          />
        </Layer>
      )}
    </Stage>
  );
};

/* ── Helpers ── */

/** Compute a world-space bounding box for a primitive. */
function primitiveBBox(p: any): DragRect {
  const tx = p.transform?.x ?? 0;
  const ty = p.transform?.y ?? 0;

  if (p.type === 'stage' || p.type === 'obstacle') {
    return { x: tx, y: ty, w: p.width, h: p.height };
  }
  if (p.type === 'label') {
    // Rough estimate — label bounding box is hard to compute without canvas
    const est = (p.text?.length ?? 5) * (p.fontSize ?? 18) * 0.6;
    return { x: tx, y: ty, w: est, h: (p.fontSize ?? 18) * 1.3 };
  }
  if (p.type === 'seatBlockGrid') {
    const ox = p.origin.x + tx;
    const oy = p.origin.y + ty;
    return { x: ox, y: oy, w: p.cols * p.seatSpacingX, h: p.rows * p.seatSpacingY };
  }
  if (p.type === 'seatBlockArc' || p.type === 'seatBlockWedge') {
    const cx = (p.center?.x ?? 0) + tx;
    const cy = (p.center?.y ?? 0) + ty;
    const outerR = p.type === 'seatBlockArc'
      ? p.startRadius + p.rowCount * p.radiusStep
      : p.outerRadius;
    return { x: cx - outerR, y: cy - outerR, w: outerR * 2, h: outerR * 2 };
  }
  return { x: tx, y: ty, w: 0, h: 0 };
}

/** Check if two rectangles overlap. */
function rectsOverlap(a: DragRect, b: DragRect): boolean {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}
