/**
 * @aioemp/seatmap-editor — Zustand store
 *
 * Central state for the seatmap editor. Manages:
 * - Layout (primitives + compiled seats)
 * - Selection
 * - Undo / Redo (snapshot-based)
 * - Canvas viewport (zoom, pan)
 * - Save / draft status
 * - Lock state
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  Layout,
  Primitive,
  CompiledSeat,
} from '@aioemp/seatmap-core';
import {
  compileLayout,
  generateUUID,
} from '@aioemp/seatmap-core';

/* ── Types ── */

export type Tool =
  | 'blockSelect'
  | 'seatSelect'
  | 'addGrid'
  | 'addArc'
  | 'addWedge'
  | 'addStage'
  | 'addLabel'
  | 'addObstacle';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface EditorState {
  /* ── Layout data ── */
  seatmapId: number | null;
  layout: Layout;
  compiledSeats: CompiledSeat[];

  /* ── Selection ── */
  selectedIds: string[];
  selectedSeatKeys: string[];

  /* ── Tool ── */
  activeTool: Tool;

  /* ── Undo / Redo ── */
  undoStack: Layout[];
  redoStack: Layout[];

  /* ── Viewport ── */
  stageX: number;
  stageY: number;
  stageScale: number;
  snapToGrid: boolean;

  /* ── Save ── */
  saveStatus: SaveStatus;
  isDirty: boolean;

  /* ── Lock ── */
  lockToken: string | null;
  lockOwnerId: number | null;
  lockOwnerName: string | null;
  isLocked: boolean;

  /* ── Actions ── */
  initLayout: (layout: Layout) => void;
  recompile: () => void;

  addPrimitive: (primitive: Primitive) => void;
  updatePrimitive: (id: string, patch: Partial<Primitive>) => void;
  removePrimitives: (ids: string[]) => void;
  duplicatePrimitives: (ids: string[]) => void;

  setSelectedIds: (ids: string[]) => void;
  clearSelection: () => void;
  setSelectedSeatKeys: (keys: string[]) => void;
  toggleSeatExclusion: (primitiveId: string, logicalRow: number, logicalSeat: number) => void;
  removeSelectedSeats: () => void;
  movePrimitivesBy: (ids: string[], dx: number, dy: number) => void;

  updateCanvas: (patch: Partial<Layout['canvas']>) => void;
  updateLayoutSeatRadius: (radius: number) => void;

  setActiveTool: (tool: Tool) => void;

  undo: () => void;
  redo: () => void;
  pushSnapshot: () => void;

  setViewport: (x: number, y: number, scale: number) => void;
  toggleSnapToGrid: () => void;

  setSaveStatus: (status: SaveStatus) => void;
  markDirty: () => void;
  markClean: () => void;

  setLock: (token: string | null, ownerId: number | null, ownerName: string | null, isLocked?: boolean) => void;
}

/* ── Default layout ── */

const DEFAULT_LAYOUT: Layout = {
  schemaVersion: 1 as const,
  title: '',
  canvas: { w: 1600, h: 900, unit: 'px' },
  seatRadius: 10,
  primitives: [],
  compiled: {
    seats: [],
    bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
  },
} as Layout;

/* ── Max undo depth ── */
const MAX_UNDO = 50;

/* ── Store ── */

export const useEditorStore = create<EditorState>()(
  immer((set, get) => ({
    /* ── Initial state ── */
    seatmapId: null,
    layout: DEFAULT_LAYOUT,
    compiledSeats: [],
    selectedIds: [],
    selectedSeatKeys: [],
    activeTool: 'blockSelect',
    undoStack: [],
    redoStack: [],
    stageX: 0,
    stageY: 0,
    stageScale: 1,
    snapToGrid: false,
    saveStatus: 'idle',
    isDirty: false,
    lockToken: null,
    lockOwnerId: null,
    lockOwnerName: null,
    isLocked: false,

    /* ── Layout initialisation ── */
    initLayout(layout) {
      set((s) => {
        s.layout = layout;
        s.compiledSeats = layout.compiled?.seats ?? [];
        s.selectedIds = [];
        s.undoStack = [];
        s.redoStack = [];
        s.isDirty = false;
        s.saveStatus = 'idle';
      });
    },

    /* ── Recompile ── */
    recompile() {
      set((s) => {
        const previousLayout = { ...s.layout };
        const compiled = compileLayout(s.layout, previousLayout);
        s.layout = compiled;
        s.compiledSeats = compiled.compiled.seats;
      });
    },

    /* ── Primitive CRUD ── */
    addPrimitive(primitive) {
      const state = get();
      state.pushSnapshot();
      set((s) => {
        s.layout.primitives.push(primitive as any);
        s.selectedIds = [primitive.id];
        s.activeTool = 'blockSelect';
        s.isDirty = true;
      });
      get().recompile();
    },

    updatePrimitive(id, patch) {
      const state = get();
      state.pushSnapshot();
      set((s) => {
        const idx = s.layout.primitives.findIndex((p: Primitive) => p.id === id);
        if (idx === -1) return;
        // Merge patch into primitive (type is immutable)
        const prim = s.layout.primitives[idx];
        Object.assign(prim, patch);
        s.isDirty = true;
      });
      get().recompile();
    },

    removePrimitives(ids) {
      const state = get();
      state.pushSnapshot();
      set((s) => {
        s.layout.primitives = s.layout.primitives.filter(
          (p: Primitive) => !ids.includes(p.id),
        );
        s.selectedIds = s.selectedIds.filter((sid: string) => !ids.includes(sid));
        s.isDirty = true;
      });
      get().recompile();
    },

    duplicatePrimitives(ids) {
      const state = get();
      state.pushSnapshot();
      set((s) => {
        const newIds: string[] = [];
        for (const id of ids) {
          const orig = s.layout.primitives.find((p: Primitive) => p.id === id);
          if (!orig) continue;
          const clone = JSON.parse(JSON.stringify(orig));
          clone.id = generateUUID();
          if (clone.name) clone.name = clone.name + ' (copy)';
          // Offset position slightly so it's visible
          if (clone.transform) {
            clone.transform.x = (clone.transform.x || 0) + 30;
            clone.transform.y = (clone.transform.y || 0) + 30;
          } else if (clone.origin) {
            clone.origin.x += 30;
            clone.origin.y += 30;
          } else if (clone.center) {
            clone.center.x += 30;
            clone.center.y += 30;
          }
          s.layout.primitives.push(clone);
          newIds.push(clone.id);
        }
        s.selectedIds = newIds;
        s.isDirty = true;
      });
      get().recompile();
    },

    /* ── Selection ── */
    setSelectedIds(ids) {
      set((s) => { s.selectedIds = ids; });
    },
    clearSelection() {
      set((s) => { s.selectedIds = []; s.selectedSeatKeys = []; });
    },
    setSelectedSeatKeys(keys) {
      set((s) => { s.selectedSeatKeys = keys; });
    },
    toggleSeatExclusion(primitiveId, logicalRow, logicalSeat) {
      const state = get();
      state.pushSnapshot();
      set((s) => {
        const idx = s.layout.primitives.findIndex((p: Primitive) => p.id === primitiveId);
        if (idx === -1) return;
        const prim = s.layout.primitives[idx] as any;
        if (!prim.excludedSeats) prim.excludedSeats = [];
        const existing = prim.excludedSeats.findIndex(
          (e: [number, number]) => e[0] === logicalRow && e[1] === logicalSeat,
        );
        if (existing >= 0) {
          prim.excludedSeats.splice(existing, 1);
        } else {
          prim.excludedSeats.push([logicalRow, logicalSeat]);
        }
        s.isDirty = true;
      });
      get().recompile();
    },
    removeSelectedSeats() {
      const state = get();
      if (state.selectedSeatKeys.length === 0) return;
      state.pushSnapshot();
      set((s) => {
        for (const seatKey of s.selectedSeatKeys) {
          const seat = s.compiledSeats.find((cs: CompiledSeat) => cs.seat_key === seatKey);
          if (!seat) continue;
          const primId = (seat.meta as any)?.primitiveId;
          if (!primId) continue;
          const primIdx = s.layout.primitives.findIndex((p: Primitive) => p.id === primId);
          if (primIdx === -1) continue;
          const prim = s.layout.primitives[primIdx] as any;
          if (!prim.excludedSeats) prim.excludedSeats = [];
          const logicalRow = (seat.meta as any)?.logicalRow;
          const logicalSeat = (seat.meta as any)?.logicalSeat;
          if (logicalRow !== undefined && logicalSeat !== undefined) {
            const already = prim.excludedSeats.some(
              ([r, c]: [number, number]) => r === logicalRow && c === logicalSeat,
            );
            if (!already) prim.excludedSeats.push([logicalRow, logicalSeat]);
          }
        }
        s.selectedSeatKeys = [];
        s.isDirty = true;
      });
      get().recompile();
    },
    movePrimitivesBy(ids, dx, dy) {
      set((s) => {
        for (const id of ids) {
          const idx = s.layout.primitives.findIndex((p: Primitive) => p.id === id);
          if (idx === -1) continue;
          const prim = s.layout.primitives[idx] as any;
          if (prim.origin) {
            prim.origin.x += dx;
            prim.origin.y += dy;
          } else if (prim.center) {
            prim.center.x += dx;
            prim.center.y += dy;
          } else if (prim.transform) {
            prim.transform.x = (prim.transform.x || 0) + dx;
            prim.transform.y = (prim.transform.y || 0) + dy;
          }
        }
        s.isDirty = true;
      });
      get().recompile();
    },

    /* ── Canvas / Layout ── */
    updateCanvas(patch) {
      const state = get();
      state.pushSnapshot();
      set((s) => {
        Object.assign(s.layout.canvas, patch);
        s.isDirty = true;
      });
    },
    updateLayoutSeatRadius(radius) {
      const state = get();
      state.pushSnapshot();
      set((s) => {
        (s.layout as any).seatRadius = radius;
        s.isDirty = true;
      });
      get().recompile();
    },

    /* ── Tool ── */
    setActiveTool(tool) {
      set((s) => { s.activeTool = tool; });
    },

    /* ── Undo / Redo ── */
    pushSnapshot() {
      set((s) => {
        const snapshot = JSON.parse(JSON.stringify(s.layout));
        s.undoStack.push(snapshot);
        if (s.undoStack.length > MAX_UNDO) {
          s.undoStack.shift();
        }
        s.redoStack = [];
      });
    },

    undo() {
      set((s) => {
        if (s.undoStack.length === 0) return;
        const snapshot = s.undoStack.pop()!;
        s.redoStack.push(JSON.parse(JSON.stringify(s.layout)));
        s.layout = snapshot;
        s.compiledSeats = snapshot.compiled?.seats ?? [];
        s.isDirty = true;
      });
    },

    redo() {
      set((s) => {
        if (s.redoStack.length === 0) return;
        const snapshot = s.redoStack.pop()!;
        s.undoStack.push(JSON.parse(JSON.stringify(s.layout)));
        s.layout = snapshot;
        s.compiledSeats = snapshot.compiled?.seats ?? [];
        s.isDirty = true;
      });
    },

    /* ── Viewport ── */
    setViewport(x, y, scale) {
      set((s) => {
        s.stageX = x;
        s.stageY = y;
        s.stageScale = scale;
      });
    },
    toggleSnapToGrid() {
      set((s) => { s.snapToGrid = !s.snapToGrid; });
    },

    /* ── Save status ── */
    setSaveStatus(status) {
      set((s) => { s.saveStatus = status; });
    },
    markDirty() {
      set((s) => { s.isDirty = true; s.saveStatus = 'idle'; });
    },
    markClean() {
      set((s) => { s.isDirty = false; s.saveStatus = 'saved'; });
    },

    /* ── Lock ── */
    setLock(token, ownerId, ownerName, isLocked) {
      set((s) => {
        s.lockToken = token;
        s.lockOwnerId = ownerId;
        s.lockOwnerName = ownerName;
        s.isLocked = isLocked ?? (ownerId !== null && ownerId !== window.aioemp?.user_id);
      });
    },
  })),
);
