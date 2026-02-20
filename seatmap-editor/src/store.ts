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
  | 'select'
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
  primitives: [],
  compiled: {
    seats: [],
    bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
  },
};

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
    activeTool: 'select',
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
        s.activeTool = 'select';
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
      set((s) => { s.selectedIds = []; });
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
