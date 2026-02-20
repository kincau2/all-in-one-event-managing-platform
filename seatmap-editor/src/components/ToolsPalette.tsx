/**
 * @aioemp/seatmap-editor — Tools Palette
 *
 * Left-side toolbar with buttons for:
 * - Select tool
 * - Add Grid / Arc / Wedge blocks
 * - Add Stage / Label / Obstacle
 * - Delete / Duplicate selected
 * - Undo / Redo
 * - Snap-to-grid toggle
 */

import React, { useCallback } from 'react';
import { generateUUID } from '@aioemp/seatmap-core';
import { useEditorStore, type Tool } from '../store';

/* ── Default primitive factories ── */

function createDefaultGrid() {
  return {
    id: generateUUID(),
    type: 'seatBlockGrid' as const,
    name: 'Grid Block',
    origin: { x: 100, y: 100 },
    rows: 5,
    cols: 10,
    seatSpacingX: 30,
    seatSpacingY: 35,
    seatRadius: 10,
    rowLabel: { start: 'A', direction: 'asc' as const },
    numbering: 'L2R' as const,
    aisleGaps: [],
    section: '',
  };
}

function createDefaultArc() {
  return {
    id: generateUUID(),
    type: 'seatBlockArc' as const,
    name: 'Arc Block',
    center: { x: 400, y: 400 },
    rowCount: 5,
    startRadius: 200,
    radiusStep: 35,
    startAngleDeg: -60,
    endAngleDeg: 60,
    seatsPerRow: { start: 18, delta: 2 },
    seatRadius: 10,
    aisleGaps: [],
    section: '',
  };
}

function createDefaultWedge() {
  return {
    id: generateUUID(),
    type: 'seatBlockWedge' as const,
    name: 'Wedge Block',
    center: { x: 400, y: 400 },
    innerRadius: 120,
    outerRadius: 300,
    startAngleDeg: -30,
    endAngleDeg: 30,
    rowCount: 4,
    seatsPerRow: { start: 8, delta: 2 },
    seatRadius: 10,
    section: '',
  };
}

function createDefaultStage() {
  return {
    id: generateUUID(),
    type: 'stage' as const,
    name: 'Stage',
    width: 300,
    height: 60,
    transform: { x: 100, y: 20, rotation: 0 },
  };
}

function createDefaultLabel() {
  return {
    id: generateUUID(),
    type: 'label' as const,
    name: 'Label',
    text: 'Section',
    fontSize: 18,
    transform: { x: 100, y: 100, rotation: 0 },
  };
}

function createDefaultObstacle() {
  return {
    id: generateUUID(),
    type: 'obstacle' as const,
    name: 'Obstacle',
    width: 60,
    height: 60,
    transform: { x: 200, y: 200, rotation: 0 },
  };
}

/* ── Component ── */

export const ToolsPalette: React.FC = () => {
  const activeTool = useEditorStore((s) => s.activeTool);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const undoStack = useEditorStore((s) => s.undoStack);
  const redoStack = useEditorStore((s) => s.redoStack);
  const snapToGrid = useEditorStore((s) => s.snapToGrid);
  const isLocked = useEditorStore((s) => s.isLocked);

  const setTool = useEditorStore((s) => s.setActiveTool);
  const addPrimitive = useEditorStore((s) => s.addPrimitive);
  const removePrimitives = useEditorStore((s) => s.removePrimitives);
  const duplicatePrimitives = useEditorStore((s) => s.duplicatePrimitives);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const toggleSnap = useEditorStore((s) => s.toggleSnapToGrid);

  const handleAdd = useCallback(
    (factory: () => any) => {
      if (isLocked) return;
      addPrimitive(factory());
    },
    [addPrimitive, isLocked],
  );

  const btnClass = (tool: Tool) =>
    `sme-tool-btn${activeTool === tool ? ' sme-tool-btn--active' : ''}`;

  return (
    <div className="sme-tools-palette">
      <div className="sme-tools-group">
        <div className="sme-tools-group__label">Tools</div>
        <button
          className={btnClass('select')}
          onClick={() => setTool('select')}
          title="Select (V)"
          disabled={isLocked}
        >
          <span className="dashicons dashicons-move" />
        </button>
      </div>

      <div className="sme-tools-group">
        <div className="sme-tools-group__label">Seat Blocks</div>
        <button
          className="sme-tool-btn"
          onClick={() => handleAdd(createDefaultGrid)}
          title="Add Grid Block"
          disabled={isLocked}
        >
          <span className="dashicons dashicons-grid-view" />
          <span className="sme-tool-btn__text">Grid</span>
        </button>
        <button
          className="sme-tool-btn"
          onClick={() => handleAdd(createDefaultArc)}
          title="Add Arc Block"
          disabled={isLocked}
        >
          <span className="dashicons dashicons-undo" />
          <span className="sme-tool-btn__text">Arc</span>
        </button>
        <button
          className="sme-tool-btn"
          onClick={() => handleAdd(createDefaultWedge)}
          title="Add Wedge Block"
          disabled={isLocked}
        >
          <span className="dashicons dashicons-chart-pie" />
          <span className="sme-tool-btn__text">Wedge</span>
        </button>
      </div>

      <div className="sme-tools-group">
        <div className="sme-tools-group__label">Decorations</div>
        <button
          className="sme-tool-btn"
          onClick={() => handleAdd(createDefaultStage)}
          title="Add Stage"
          disabled={isLocked}
        >
          <span className="dashicons dashicons-slides" />
          <span className="sme-tool-btn__text">Stage</span>
        </button>
        <button
          className="sme-tool-btn"
          onClick={() => handleAdd(createDefaultLabel)}
          title="Add Label"
          disabled={isLocked}
        >
          <span className="dashicons dashicons-editor-textcolor" />
          <span className="sme-tool-btn__text">Label</span>
        </button>
        <button
          className="sme-tool-btn"
          onClick={() => handleAdd(createDefaultObstacle)}
          title="Add Obstacle"
          disabled={isLocked}
        >
          <span className="dashicons dashicons-dismiss" />
          <span className="sme-tool-btn__text">Obstacle</span>
        </button>
      </div>

      <div className="sme-tools-group">
        <div className="sme-tools-group__label">Edit</div>
        <button
          className="sme-tool-btn"
          onClick={() => removePrimitives(selectedIds)}
          title="Delete (Del)"
          disabled={isLocked || selectedIds.length === 0}
        >
          <span className="dashicons dashicons-trash" />
        </button>
        <button
          className="sme-tool-btn"
          onClick={() => duplicatePrimitives(selectedIds)}
          title="Duplicate (Ctrl+D)"
          disabled={isLocked || selectedIds.length === 0}
        >
          <span className="dashicons dashicons-admin-page" />
        </button>
      </div>

      <div className="sme-tools-group">
        <div className="sme-tools-group__label">History</div>
        <button
          className="sme-tool-btn"
          onClick={undo}
          title="Undo (Ctrl+Z)"
          disabled={undoStack.length === 0}
        >
          <span className="dashicons dashicons-undo" />
        </button>
        <button
          className="sme-tool-btn"
          onClick={redo}
          title="Redo (Ctrl+Shift+Z)"
          disabled={redoStack.length === 0}
        >
          <span className="dashicons dashicons-redo" />
        </button>
      </div>

      <div className="sme-tools-group">
        <div className="sme-tools-group__label">View</div>
        <button
          className={`sme-tool-btn${snapToGrid ? ' sme-tool-btn--active' : ''}`}
          onClick={toggleSnap}
          title="Snap to Grid"
        >
          <span className="dashicons dashicons-align-none" />
          <span className="sme-tool-btn__text">Snap</span>
        </button>
      </div>
    </div>
  );
};
