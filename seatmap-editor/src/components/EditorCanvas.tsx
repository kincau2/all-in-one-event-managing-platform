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
import { Stage, Layer, Rect, Text, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import { useEditorStore } from '../store';
import {
  generateUUID,
  gridPivotOffset,
  arcPivotOffset,
  GRID_PAD,
  GRID_LBL_W,
  ARC_PAD,
  ARC_LBL_ANG,
} from '@aioemp/seatmap-core';
import { PrimitiveRenderer } from './PrimitiveRenderer';
import { SeatDots } from './SeatDots';
import { LAYOUT_STYLE_DEFAULTS } from '../layoutDefaults';

/**
 * Load an image URL into an HTMLImageElement.
 * Returns null while loading or if the URL is empty.
 */
function useImage(url: string): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) { setImage(null); return; }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    img.src = url;
    return () => { img.onload = null; img.onerror = null; };
  }, [url]);
  return image;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const PAN_PX = 20;
const MOVE_PX = 1;
const MOVE_SHIFT_PX = 10;

type InteractionMode = 'idle' | 'panning' | 'selecting' | 'moving' | 'creating' | 'rotating' | 'resizing';

interface DragRect {
  x: number; y: number; w: number; h: number;
}

/** Hit-test: find the primitiveId under the pointer (or null).
 *  Iterates shapes in reverse so the topmost (last-rendered) shape wins. */
function primitiveUnderPointer(stage: Konva.Stage): string | null {
  const pos = stage.getPointerPosition();
  if (!pos) return null;
  const shapes = stage.getAllIntersections(pos);
  for (let i = shapes.length - 1; i >= 0; i--) {
    let node: any = shapes[i];
    while (node && node !== stage) {
      const pid = node.attrs?.primitiveId;
      if (pid) return pid as string;
      node = node.parent;
    }
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

/** Hit-test: find a rotation-handle node under the pointer. Returns primitiveId or null.
 *  Iterates in reverse so the topmost handle wins. */
function rotateHandleUnderPointer(stage: Konva.Stage): string | null {
  const pos = stage.getPointerPosition();
  if (!pos) return null;
  const shapes = stage.getAllIntersections(pos);
  for (let i = shapes.length - 1; i >= 0; i--) {
    let node: any = shapes[i];
    while (node && node !== stage) {
      if (node.attrs?.rotateHandle && node.attrs?.primitiveId) {
        return node.attrs.primitiveId as string;
      }
      node = node.parent;
    }
  }
  return null;
}

type ResizeEdge = 'top' | 'bottom' | 'left' | 'right';

/** Hit-test: find a resize-edge rect. Returns { primitiveId, edge } or null. */
function resizeEdgeUnderPointer(stage: Konva.Stage): { primitiveId: string; edge: ResizeEdge } | null {
  const pos = stage.getPointerPosition();
  if (!pos) return null;
  const shapes = stage.getAllIntersections(pos);
  for (let i = shapes.length - 1; i >= 0; i--) {
    let node: any = shapes[i];
    while (node && node !== stage) {
      if (node.attrs?.resizeEdge && node.attrs?.primitiveId) {
        return { primitiveId: node.attrs.primitiveId as string, edge: node.attrs.resizeEdge as ResizeEdge };
      }
      node = node.parent;
    }
  }
  return null;
}

/** Map resize edge → CSS cursor, accounting for primitive rotation. */
function resizeCursor(edge: ResizeEdge, rotationDeg: number): string {
  const base: Record<ResizeEdge, number> = { top: 0, right: 90, bottom: 180, left: 270 };
  const angle = ((base[edge] + rotationDeg) % 360 + 360) % 360;
  // Map angle to nearest cursor direction
  if (angle < 22.5 || angle >= 337.5) return 'ns-resize';
  if (angle < 67.5) return 'nesw-resize';
  if (angle < 112.5) return 'ew-resize';
  if (angle < 157.5) return 'nwse-resize';
  if (angle < 202.5) return 'ns-resize';
  if (angle < 247.5) return 'nesw-resize';
  if (angle < 292.5) return 'ew-resize';
  return 'nwse-resize';
}

/** Compute the rotation center for a primitive (in world coords). */
function getRotationCenter(p: any): { x: number; y: number } {
  const tx = p.transform?.x ?? 0;
  const ty = p.transform?.y ?? 0;
  if (p.type === 'seatBlockGrid') {
    const pivot = gridPivotOffset(p.cols, p.rows, p.seatSpacingX, p.seatSpacingY);
    return { x: p.origin.x + tx + pivot.x, y: p.origin.y + ty + pivot.y };
  }
  if (p.type === 'seatBlockArc') {
    const pivot = arcPivotOffset(p.startRadius, p.rowCount, p.radiusStep, p.radiusRatio ?? 1, p.startAngleDeg, p.endAngleDeg);
    return { x: (p.center?.x ?? 0) + tx + pivot.x, y: (p.center?.y ?? 0) + ty + pivot.y };
  }
  if (p.type === 'seatBlockWedge') {
    return { x: (p.center?.x ?? 0) + tx, y: (p.center?.y ?? 0) + ty };
  }
  if (p.type === 'obstacle' || p.type === 'stage') {
    return { x: tx + (p.width ?? 0) / 2, y: ty + (p.height ?? 0) / 2 };
  }
  if (p.type === 'label') {
    const estW = (p.text?.length ?? 5) * (p.fontSize ?? 18) * 0.6;
    const estH = (p.fontSize ?? 18) * 1.3;
    return { x: tx + estW / 2, y: ty + estH / 2 };
  }
  return { x: tx, y: ty };
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
  const compiledRowLabels = useEditorStore((s) => s.compiledRowLabels);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const selectedSeatKeys = useEditorStore((s) => s.selectedSeatKeys);
  const activeTool = useEditorStore((s) => s.activeTool);

  /* ── Interaction state (ref for perf — no re-renders during drag) ── */
  const modeRef = useRef<InteractionMode>('idle');
  const panStartRef = useRef({ sx: 0, sy: 0, px: 0, py: 0 });
  const dragOriginRef = useRef({ wx: 0, wy: 0 });
  const spaceDownRef = useRef(false);

  /* ── Rotation interaction refs ── */
  const rotatePrimIdRef = useRef('');
  const rotateCenterRef = useRef({ x: 0, y: 0 });
  const rotateStartAngleRef = useRef(0);
  const rotateInitialRotRef = useRef(0);

  /* ── Resize interaction refs ── */
  const resizePrimIdRef = useRef('');
  const resizeEdgeRef = useRef<ResizeEdge>('right');
  const resizeInitialRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  /* ── Dynamic cursor state ── */
  const [dynCursor, setDynCursor] = useState<string | null>(null);

  /* ── Rubber-band / creation preview rect (state for rendering) ── */
  const [selRect, setSelRect] = useState<DragRect | null>(null);
  const [createRect, setCreateRect] = useState<DragRect | null>(null);

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

      /* Rotation handle → start rotating */
      if (tool === 'blockSelect') {
        const rotatePid = rotateHandleUnderPointer(stage);
        if (rotatePid) {
          const prim = store.layout.primitives.find((p) => p.id === rotatePid);
          if (prim) {
            const center = getRotationCenter(prim as any);
            rotatePrimIdRef.current = rotatePid;
            rotateCenterRef.current = center;
            rotateStartAngleRef.current =
              (Math.atan2(world.y - center.y, world.x - center.x) * 180) / Math.PI;
            rotateInitialRotRef.current = (prim as any).transform?.rotation ?? 0;
            store.pushSnapshot();
            modeRef.current = 'rotating';
            return;
          }
        }

        /* Resize edge → start resizing obstacle */
        const resizeHit = resizeEdgeUnderPointer(stage);
        if (resizeHit) {
          const prim = store.layout.primitives.find((p) => p.id === resizeHit.primitiveId) as any;
          if (prim && prim.type === 'obstacle') {
            resizePrimIdRef.current = resizeHit.primitiveId;
            resizeEdgeRef.current = resizeHit.edge;
            resizeInitialRef.current = {
              x: prim.transform?.x ?? 0,
              y: prim.transform?.y ?? 0,
              w: prim.width,
              h: prim.height,
            };
            dragOriginRef.current = { wx: world.x, wy: world.y };
            store.pushSnapshot();
            modeRef.current = 'resizing';
            return;
          }
        }
      }

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
          } else {
            /* Already selected — bring to front of its tier so it's on top */
            store.bringToFront([pid]);
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

      if (mode === 'rotating') {
        const center = rotateCenterRef.current;
        const currentAngle =
          (Math.atan2(world.y - center.y, world.x - center.x) * 180) / Math.PI;
        const delta = currentAngle - rotateStartAngleRef.current;
        let newRotation = rotateInitialRotRef.current + delta;
        if (e.evt.shiftKey) {
          // Photoshop-like: snap to nearest 45° multiple
          newRotation = Math.round(newRotation / 45) * 45;
        } else {
          newRotation = Math.round(newRotation * 10) / 10;
        }
        useEditorStore.getState().rotatePrimitive(rotatePrimIdRef.current, newRotation);
        return;
      }

      if (mode === 'resizing') {
        const store = useEditorStore.getState();
        const prim = store.layout.primitives.find((p) => p.id === resizePrimIdRef.current) as any;
        if (!prim) return;
        const rot = (prim.transform?.rotation ?? 0) * Math.PI / 180;
        const dxWorld = world.x - ox;
        const dyWorld = world.y - oy;
        // Project delta into the local rotated coordinate system
        const dLocal = {
          x: dxWorld * Math.cos(-rot) - dyWorld * Math.sin(-rot),
          y: dxWorld * Math.sin(-rot) + dyWorld * Math.cos(-rot),
        };
        const init = resizeInitialRef.current;
        const edge = resizeEdgeRef.current;
        let newX = init.x, newY = init.y, newW = init.w, newH = init.h;
        if (edge === 'right')  { newW = Math.max(10, init.w + dLocal.x); }
        if (edge === 'left')   { newW = Math.max(10, init.w - dLocal.x); newX = init.x + (init.w - newW) * Math.cos(rot); newY = init.y + (init.w - newW) * Math.sin(rot); }
        if (edge === 'bottom') { newH = Math.max(10, init.h + dLocal.y); }
        if (edge === 'top')    { newH = Math.max(10, init.h - dLocal.y); newX = init.x - (init.h - newH) * Math.sin(rot); newY = init.y + (init.h - newH) * Math.cos(rot); }
        store.resizeObstacle(
          resizePrimIdRef.current,
          Math.round(newX),
          Math.round(newY),
          Math.round(newW),
          Math.round(newH),
        );
        return;
      }

      /* Idle hover — update cursor for rotation handles & resize edges */
      if (mode === 'idle') {
        const store = useEditorStore.getState();
        if (store.activeTool !== 'blockSelect') {
          if (dynCursor) setDynCursor(null);
          return;
        }
        // Check rotation handle
        if (rotateHandleUnderPointer(stage)) {
          setDynCursor('grab');
          return;
        }
        // Check resize edge
        const resizeHit = resizeEdgeUnderPointer(stage);
        if (resizeHit) {
          const prim = store.layout.primitives.find((p) => p.id === resizeHit.primitiveId) as any;
          const rot = prim?.transform?.rotation ?? 0;
          setDynCursor(resizeCursor(resizeHit.edge, rot));
          return;
        }
        if (dynCursor) setDynCursor(null);
      }
    },
    [dynCursor],
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

      if (mode === 'rotating') {
        // Rotation is already applied continuously via rotatePrimitive; snapshot was pushed in mouseDown.
        return;
      }

      if (mode === 'resizing') {
        // Resize is already applied continuously; snapshot was pushed in mouseDown.
        setDynCursor(null);
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
          const spacingX = 38;
          const spacingY = 38;
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
            rowLabelDisplay: 'left' as const,
            numbering: 'L2R' as const,
            aisleGaps: [],
            excludedSeats: [],
            section: '',
          } as any);
        }

        if (store.activeTool === 'addArc') {
          /* Arc from drag rect:
             - center is at rect top-center, offset up by startRadius
             - rows from rect height  */
          const startRadius = 1500;
          const radiusStep = 38;
          const rows = Math.max(1, Math.round(r.h / radiusStep));
          const centerX = r.x + r.w / 2;
          const centerY = r.y - startRadius;
          const seatsStart = Math.max(4, Math.round(r.w / 38));
          store.addPrimitive({
            id: generateUUID(),
            type: 'seatBlockArc' as const,
            name: 'Arc Block',
            center: { x: centerX, y: centerY },
            rowCount: rows,
            startRadius,
            radiusStep,
            radiusRatio: 0.9,
            startAngleDeg: 80,
            endAngleDeg: 100,
            seatsPerRow: { start: seatsStart, delta: 0 },
            rowLabel: { mode: 'alpha' as const, start: 'A', direction: 'asc' as const },
            rowLabelDisplay: 'left' as const,
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
        // In seatSelect mode, prioritise seat exclusion over block deletion
        if (store.activeTool === 'seatSelect' && store.selectedSeatKeys.length > 0) {
          e.preventDefault();
          store.removeSelectedSeats();
        } else if (store.selectedIds.length > 0) {
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
    if (dynCursor) return dynCursor;
    if (spaceDownRef.current) return 'grab';
    switch (activeTool) {
      case 'addGrid':
      case 'addArc': return 'crosshair';
      default: return 'default';
    }
  }, [activeTool, dynCursor]);

  /* ── Background color & image from layout ── */
  const bgColor = (layout as any).bgColor ?? LAYOUT_STYLE_DEFAULTS.bgColor;
  const bgImageUrl: string = (layout as any).bgImage ?? LAYOUT_STYLE_DEFAULTS.bgImage;
  const bgImg = useImage(bgImageUrl);

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
          fill={bgColor}
          shadowColor="rgba(0,0,0,0.08)"
          shadowBlur={12}
          shadowOffsetX={2}
          shadowOffsetY={2}
        />
        {bgImg && (
          <KonvaImage
            image={bgImg}
            x={0}
            y={0}
            width={layout.canvas.w}
            height={layout.canvas.h}
          />
        )}
        <Text
          x={4}
          y={layout.canvas.h + 8}
          text={`${layout.canvas.w} × ${layout.canvas.h} px`}
          fontSize={11}
          fill="#999"
        />
      </Layer>

      {/* Primitives (non-label) — sorted by type-tier; within each tier array order = stacking */}
      <Layer>
        {(() => {
          const TIER: Record<string, number> = {
            stage: 0,
            obstacle: 1,
            seatBlockGrid: 2,
            seatBlockArc: 2,
          };
          const nonLabels = layout.primitives
            .filter((p) => p.type !== 'label')
            .sort((a, b) => {
              const ta = TIER[a.type] ?? 2;
              const tb = TIER[b.type] ?? 2;
              return ta - tb;
            });
          return nonLabels.map((prim) => (
            <PrimitiveRenderer
              key={prim.id}
              primitive={prim}
              isSelected={selectedIds.includes(prim.id)}
            />
          ));
        })()}
      </Layer>

      {/* Compiled seats */}
      <Layer listening={false}>
        <SeatDots
          seats={compiledSeats}
          rowLabels={compiledRowLabels}
          selectedSeatKeys={selectedSeatKeysSet}
        />
      </Layer>

      {/* Labels — always on top of seats */}
      <Layer>
        {layout.primitives
          .filter((p) => p.type === 'label')
          .map((prim) => (
            <PrimitiveRenderer
              key={prim.id}
              primitive={prim}
              isSelected={selectedIds.includes(prim.id)}
            />
          ))}
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

      {/* Drag-to-create preview rectangle with seat count */}
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
          <Text
            x={createRect.x}
            y={createRect.y + createRect.h / 2 - 10}
            width={createRect.w}
            text={createPreviewText(activeTool, createRect)}
            fontSize={14}
            fill="#4B49AC"
            fontStyle="bold"
            align="center"
          />
        </Layer>
      )}
    </Stage>
  );
};

/* ── Helpers ── */

/** Compute a world-space bounding box for a primitive (rotation-aware). */
function primitiveBBox(p: any): DragRect {
  const tx = p.transform?.x ?? 0;
  const ty = p.transform?.y ?? 0;
  const rot = p.transform?.rotation ?? 0;

  if (p.type === 'stage' || p.type === 'obstacle') {
    const bb = { x: tx, y: ty, w: p.width, h: p.height };
    if (rot !== 0) {
      return rotatedAABB(bb, { x: tx + p.width / 2, y: ty + p.height / 2 }, rot);
    }
    return bb;
  }
  if (p.type === 'label') {
    const est = (p.text?.length ?? 5) * (p.fontSize ?? 18) * 0.6;
    const estH = (p.fontSize ?? 18) * 1.3;
    const bb = { x: tx, y: ty, w: est, h: estH };
    if (rot !== 0) {
      return rotatedAABB(bb, { x: tx + est / 2, y: ty + estH / 2 }, rot);
    }
    return bb;
  }
  if (p.type === 'seatBlockGrid') {
    const ox = p.origin.x + tx;
    const oy = p.origin.y + ty;
    const seatW = (p.cols - 1) * p.seatSpacingX;
    const seatH = (p.rows - 1) * p.seatSpacingY;
    const bb = { x: ox - GRID_PAD - GRID_LBL_W, y: oy - GRID_PAD, w: seatW + 2 * GRID_PAD + GRID_LBL_W, h: seatH + 2 * GRID_PAD };
    if (rot !== 0) {
      const pivot = gridPivotOffset(p.cols, p.rows, p.seatSpacingX, p.seatSpacingY);
      return rotatedAABB(bb, { x: ox + pivot.x, y: oy + pivot.y }, rot);
    }
    return bb;
  }
  if (p.type === 'seatBlockArc') {
    const cx = (p.center?.x ?? 0) + tx;
    const cy = (p.center?.y ?? 0) + ty;
    const ratio = p.radiusRatio ?? 1;
    const innerBase = p.startRadius ?? 200;
    const outerBase = innerBase + ((p.rowCount ?? 1) - 1) * (p.radiusStep ?? 38);
    const outerRx = outerBase * ratio + ARC_PAD;
    const outerRy = outerBase + ARC_PAD;
    const innerRx = Math.max(0, innerBase * ratio - ARC_PAD);
    const innerRy = Math.max(0, innerBase - ARC_PAD);
    const angPad = outerBase > 0 ? (ARC_PAD + ARC_LBL_ANG) / outerBase : 0;
    const aStartRad = ((p.startAngleDeg ?? 0) * Math.PI) / 180 - angPad;
    const aEndRad = ((p.endAngleDeg ?? 0) * Math.PI) / 180 + angPad;
    const pivot = arcPivotOffset(p.startRadius ?? 200, p.rowCount ?? 1, p.radiusStep ?? 38, ratio, p.startAngleDeg ?? 0, p.endAngleDeg ?? 0);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const radRot = (rot * Math.PI) / 180;
    const cosR = Math.cos(radRot), sinR = Math.sin(radRot);
    for (let i = 0; i <= 32; i++) {
      const a = aStartRad + ((aEndRad - aStartRad) * i) / 32;
      const cos = Math.cos(a), sin = Math.sin(a);
      for (const [rx, ry] of [[innerRx, innerRy], [outerRx, outerRy]] as const) {
        let dlx = rx * cos - pivot.x, dly = ry * sin - pivot.y;
        if (rot !== 0) {
          const rlx = dlx * cosR - dly * sinR;
          const rly = dlx * sinR + dly * cosR;
          dlx = rlx; dly = rly;
        }
        const sx = cx + pivot.x + dlx, sy = cy + pivot.y + dly;
        minX = Math.min(minX, sx); minY = Math.min(minY, sy);
        maxX = Math.max(maxX, sx); maxY = Math.max(maxY, sy);
      }
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  if (p.type === 'seatBlockWedge') {
    const cx = (p.center?.x ?? 0) + tx;
    const cy = (p.center?.y ?? 0) + ty;
    const outerR = p.outerRadius ?? 300;
    return { x: cx - outerR, y: cy - outerR, w: outerR * 2, h: outerR * 2 };
  }
  return { x: tx, y: ty, w: 0, h: 0 };
}

/** Compute AABB of a rotated rectangle. */
function rotatedAABB(
  bb: DragRect,
  center: { x: number; y: number },
  rotDeg: number,
): DragRect {
  const rad = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const corners = [
    { x: bb.x, y: bb.y },
    { x: bb.x + bb.w, y: bb.y },
    { x: bb.x + bb.w, y: bb.y + bb.h },
    { x: bb.x, y: bb.y + bb.h },
  ];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of corners) {
    const dx = c.x - center.x, dy = c.y - center.y;
    const rx = center.x + dx * cos - dy * sin;
    const ry = center.y + dx * sin + dy * cos;
    minX = Math.min(minX, rx); minY = Math.min(minY, ry);
    maxX = Math.max(maxX, rx); maxY = Math.max(maxY, ry);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Check if two rectangles overlap. */
function rectsOverlap(a: DragRect, b: DragRect): boolean {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

/** Estimate seat count for drag-to-create preview. */
function createPreviewText(tool: string, r: DragRect): string {
  if (tool === 'addGrid') {
    const cols = Math.max(1, Math.round(r.w / 38));
    const rows = Math.max(1, Math.round(r.h / 38));
    return `${cols} \u00d7 ${rows} = ${cols * rows} seats`;
  }
  if (tool === 'addArc') {
    const rows = Math.max(1, Math.round(r.h / 38));
    const seatsStart = Math.max(4, Math.round(r.w / 38));
    let total = 0;
    for (let i = 0; i < rows; i++) total += seatsStart;
    return `${rows} rows \u2248 ${total} seats`;
  }
  return '';
}
