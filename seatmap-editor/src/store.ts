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
  CompiledRowLabel,
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
  | 'addLabel'
  | 'addObstacle'
  | 'addImage';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface EditorState {
  /* ── Layout data ── */
  seatmapId: number | null;
  layout: Layout;
  compiledSeats: CompiledSeat[];
  compiledRowLabels: CompiledRowLabel[];

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

  /* ── Save ── */
  saveStatus: SaveStatus;
  isDirty: boolean;
  seatmapStatus: 'draft' | 'publish';

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
  bringToFront: (ids: string[]) => void;
  clearSelection: () => void;
  setSelectedSeatKeys: (keys: string[]) => void;
  toggleSeatExclusion: (primitiveId: string, logicalRow: number, logicalSeat: number) => void;
  removeSelectedSeats: () => void;
  movePrimitivesBy: (ids: string[], dx: number, dy: number) => void;
  resizeObstacle: (id: string, x: number, y: number, w: number, h: number) => void;
  rotatePrimitive: (id: string, rotation: number) => void;

  updateCanvas: (patch: Partial<Layout['canvas']>) => void;
  updateLayoutSeatRadius: (radius: number) => void;
  updateLayoutStyle: (patch: Record<string, any>) => void;

  setActiveTool: (tool: Tool) => void;

  undo: () => void;
  redo: () => void;
  pushSnapshot: () => void;

  setViewport: (x: number, y: number, scale: number) => void;

  setSaveStatus: (status: SaveStatus) => void;
  markDirty: () => void;
  markClean: () => void;
  setSeatmapStatus: (status: 'draft' | 'publish') => void;

  setLock: (token: string | null, ownerId: number | null, ownerName: string | null, isLocked?: boolean) => void;
}

/* ── Default layout ── */

const DEFAULT_LAYOUT: Layout = {
  schemaVersion: 1 as const,
  title: '',
  canvas: { w: 1600, h: 900, unit: 'px' },
  seatRadius: 10,
  seatFill: '#4B49AC',
  seatStroke: '#3a389a',
  seatFont: '-apple-system, sans-serif',
  seatFontWeight: 'bold',
  seatFontColor: '#ffffff',
  seatFontSize: 0,
  rowFontColor: '#666666',
  rowFontSize: 11,
  rowFontWeight: 'bold',
  bgColor: '#ffffff',
  bgImage: '',
  primitives: [],
  compiled: {
    seats: [],
    rowLabels: [],
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
    compiledRowLabels: [],
    selectedIds: [],
    selectedSeatKeys: [],
    activeTool: 'blockSelect',
    undoStack: [],
    redoStack: [],
    stageX: 0,
    stageY: 0,
    stageScale: 1,
    saveStatus: 'idle',
    isDirty: false,
    seatmapStatus: 'draft',
    lockToken: null,
    lockOwnerId: null,
    lockOwnerName: null,
    isLocked: false,

    /* ── Layout initialisation ── */
    initLayout(layout) {
      set((s) => {
        s.layout = layout;
        /* Always recompile on load so compiled positions
           match the current algorithm / constants rather
           than using potentially stale saved data. */
        const compiled = compileLayout(layout);
        s.layout = compiled;
        s.compiledSeats = compiled.compiled.seats;
        s.compiledRowLabels = (compiled.compiled as any)?.rowLabels ?? [];
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
        const compiled = compileLayout(s.layout);
        s.layout = compiled;
        s.compiledSeats = compiled.compiled.seats;
        s.compiledRowLabels = (compiled.compiled as any).rowLabels ?? [];
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
      if (ids.length > 0) get().bringToFront(ids);
    },
    bringToFront(ids) {
      set((s) => {
        const prims = s.layout.primitives as Primitive[];
        // Pull out the selected primitives, then append them at the end.
        // The tier-sort in the renderer still groups by type,
        // and within each tier the later array position renders on top.
        const selected: Primitive[] = [];
        const rest: Primitive[] = [];
        for (const p of prims) {
          if (ids.includes(p.id)) selected.push(p);
          else rest.push(p);
        }
        s.layout.primitives = [...rest, ...selected] as any;
      });
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

    resizeObstacle(id, x, y, w, h) {
      set((s) => {
        const idx = s.layout.primitives.findIndex((p: Primitive) => p.id === id);
        if (idx === -1) return;
        const prim = s.layout.primitives[idx] as any;
        if (!prim.transform) prim.transform = { x: 0, y: 0, rotation: 0 };
        prim.transform.x = x;
        prim.transform.y = y;
        prim.width = w;
        prim.height = h;
        s.isDirty = true;
      });
    },

    rotatePrimitive(id, rotation) {
      set((s) => {
        const idx = s.layout.primitives.findIndex((p: Primitive) => p.id === id);
        if (idx === -1) return;
        const prim = s.layout.primitives[idx] as any;
        if (!prim.transform) prim.transform = {};
        prim.transform.rotation = rotation;
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
    updateLayoutStyle(patch) {
      const state = get();
      state.pushSnapshot();
      set((s) => {
        Object.assign(s.layout as any, patch);
        s.isDirty = true;
      });
    },

    /* ── Tool ── */
    setActiveTool(tool) {
      set((s) => {
        s.activeTool = tool;
        // Clear cross-mode selections to avoid accidental block/seat conflicts
        if (tool === 'seatSelect') s.selectedIds = [];
        else s.selectedSeatKeys = [];
      });
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
        s.compiledRowLabels = (snapshot.compiled as any)?.rowLabels ?? [];
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
        s.compiledRowLabels = (snapshot.compiled as any)?.rowLabels ?? [];
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
    setSeatmapStatus(status) {
      set((s) => { s.seatmapStatus = status; });
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
