/**
 * @aioemp/seatmap-editor — Toolbar (v2)
 *
 * Horizontal toolbar:
 * [Back] | [Block-select · Seat-select] | [Draw Grid · Draw Arc] | [+Wedge · +Stage · +Label · +Obstacle]
 *       | [Delete · Duplicate] | [Undo · Redo] | [Snap · Zoom] | meta + Save
 *
 * Grid / Arc are now draw-tool toggles (drag-to-create on canvas).
 * Wedge / Stage / Label / Obstacle remain instant-add.
 */

import React, { useCallback } from 'react';
import { useEditorStore, type Tool } from '../store';
import { createDefaultStage, createDefaultLabel, createDefaultObstacle } from '../primitiveFactories';

/* ── Component ── */

interface ToolbarProps {
  onClose: () => void;
  onSave: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onClose, onSave }) => {
  const activeTool = useEditorStore((s) => s.activeTool);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const selectedSeatKeys = useEditorStore((s) => s.selectedSeatKeys);
  const undoStack = useEditorStore((s) => s.undoStack);
  const redoStack = useEditorStore((s) => s.redoStack);
  const snapToGrid = useEditorStore((s) => s.snapToGrid);
  const isLocked = useEditorStore((s) => s.isLocked);
  const lockOwnerName = useEditorStore((s) => s.lockOwnerName);
  const compiledSeats = useEditorStore((s) => s.compiledSeats);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const isDirty = useEditorStore((s) => s.isDirty);
  const stageScale = useEditorStore((s) => s.stageScale);

  const setTool = useEditorStore((s) => s.setActiveTool);
  const addPrimitive = useEditorStore((s) => s.addPrimitive);
  const removePrimitives = useEditorStore((s) => s.removePrimitives);
  const removeSelectedSeats = useEditorStore((s) => s.removeSelectedSeats);
  const duplicatePrimitives = useEditorStore((s) => s.duplicatePrimitives);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const toggleSnap = useEditorStore((s) => s.toggleSnapToGrid);
  const setViewport = useEditorStore((s) => s.setViewport);

  const handleAdd = useCallback(
    (factory: () => any) => {
      if (isLocked) return;
      addPrimitive(factory());
    },
    [addPrimitive, isLocked],
  );

  /** Toggle draw tools: clicking an active draw tool resets to blockSelect. */
  const toggleTool = useCallback(
    (tool: Tool) => {
      if (isLocked) return;
      setTool(activeTool === tool ? 'blockSelect' : tool);
    },
    [activeTool, setTool, isLocked],
  );

  const btnClass = (tool: Tool) =>
    `sme-toolbar__btn${activeTool === tool ? ' sme-toolbar__btn--active' : ''}`;

  const zoomPercent = Math.round(stageScale * 100);

  const handleZoomIn = useCallback(() => {
    const s = useEditorStore.getState();
    const newScale = Math.min(5, s.stageScale * 1.25);
    setViewport(s.stageX, s.stageY, newScale);
  }, [setViewport]);

  const handleZoomOut = useCallback(() => {
    const s = useEditorStore.getState();
    const newScale = Math.max(0.1, s.stageScale / 1.25);
    setViewport(s.stageX, s.stageY, newScale);
  }, [setViewport]);

  const handleZoomReset = useCallback(() => {
    setViewport(0, 0, 1);
  }, [setViewport]);

  const handleDelete = useCallback(() => {
    if (isLocked) return;
    const store = useEditorStore.getState();
    if (store.selectedIds.length > 0) {
      removePrimitives(store.selectedIds);
    } else if (store.selectedSeatKeys.length > 0) {
      removeSelectedSeats();
    }
  }, [isLocked, removePrimitives, removeSelectedSeats]);

  const canDelete = selectedIds.length > 0 || selectedSeatKeys.length > 0;

  return (
    <div className="sme-toolbar">
      {/* Back */}
      <div className="sme-toolbar__group">
        <button className="sme-toolbar__btn" onClick={onClose} title="Close editor">
          <span className="dashicons dashicons-arrow-left-alt" />
        </button>
      </div>

      {/* Selection tools */}
      <div className="sme-toolbar__group">
        <button className={btnClass('blockSelect')} onClick={() => setTool('blockSelect')}
          title="Block Select (V)" disabled={isLocked}>
          <span className="dashicons dashicons-screenoptions" />
          <span>Block</span>
        </button>
        <button className={btnClass('seatSelect')} onClick={() => setTool('seatSelect')}
          title="Seat Select (S)" disabled={isLocked}>
          <span className="dashicons dashicons-marker" />
          <span>Seat</span>
        </button>
      </div>

      {/* Draw tools (drag-to-create) */}
      <div className="sme-toolbar__group">
        <button className={btnClass('addGrid')} onClick={() => toggleTool('addGrid')}
          title="Draw Grid Block (G) — drag on canvas" disabled={isLocked}>
          <span className="dashicons dashicons-grid-view" />
          <span>Grid</span>
        </button>
        <button className={btnClass('addArc')} onClick={() => toggleTool('addArc')}
          title="Draw Arc Block (A) — drag on canvas" disabled={isLocked}>
          <span className="dashicons dashicons-undo" />
          <span>Arc</span>
        </button>
      </div>

      {/* Instant-add shapes */}
      <div className="sme-toolbar__group">
        <button className="sme-toolbar__btn" onClick={() => handleAdd(createDefaultStage)}
          title="Add Stage" disabled={isLocked}>
          <span className="dashicons dashicons-slides" />
          <span>Stage</span>
        </button>
        <button className="sme-toolbar__btn" onClick={() => handleAdd(createDefaultLabel)}
          title="Add Label" disabled={isLocked}>
          <span className="dashicons dashicons-editor-textcolor" />
          <span>Label</span>
        </button>
        <button className="sme-toolbar__btn" onClick={() => handleAdd(createDefaultObstacle)}
          title="Add Obstacle" disabled={isLocked}>
          <span className="dashicons dashicons-dismiss" />
          <span>Block</span>
        </button>
      </div>

      {/* Edit */}
      <div className="sme-toolbar__group">
        <button className="sme-toolbar__btn"
          onClick={handleDelete}
          title="Delete (Del)" disabled={isLocked || !canDelete}>
          <span className="dashicons dashicons-trash" />
        </button>
        <button className="sme-toolbar__btn"
          onClick={() => duplicatePrimitives(selectedIds)}
          title="Duplicate (Ctrl+D)" disabled={isLocked || selectedIds.length === 0}>
          <span className="dashicons dashicons-admin-page" />
        </button>
      </div>

      {/* History */}
      <div className="sme-toolbar__group">
        <button className="sme-toolbar__btn" onClick={undo} title="Undo (Ctrl+Z)"
          disabled={undoStack.length === 0}>
          <span className="dashicons dashicons-undo" />
        </button>
        <button className="sme-toolbar__btn" onClick={redo} title="Redo (Ctrl+Shift+Z)"
          disabled={redoStack.length === 0}>
          <span className="dashicons dashicons-redo" />
        </button>
      </div>

      {/* View */}
      <div className="sme-toolbar__group">
        <button className={`sme-toolbar__btn${snapToGrid ? ' sme-toolbar__btn--active' : ''}`}
          onClick={toggleSnap} title="Snap to Grid">
          <span className="dashicons dashicons-align-none" />
          <span>Snap</span>
        </button>
        <button className="sme-toolbar__btn" onClick={handleZoomOut} title="Zoom Out">
          <span className="dashicons dashicons-minus" />
        </button>
        <button className="sme-toolbar__btn" onClick={handleZoomReset} title="Reset Zoom"
          style={{ minWidth: 44, justifyContent: 'center' }}>
          {zoomPercent}%
        </button>
        <button className="sme-toolbar__btn" onClick={handleZoomIn} title="Zoom In">
          <span className="dashicons dashicons-plus-alt2" />
        </button>
      </div>

      {/* Right side: meta + save */}
      <div className="sme-toolbar__group sme-toolbar__group--right">
        <span className="sme-toolbar__meta">{compiledSeats.length} seats</span>
        {isLocked && (
          <span className="sme-toolbar__lock-warning">
            Locked by {lockOwnerName || 'another user'}
          </span>
        )}
        <span className={`sme-toolbar__meta sme-toolbar__status--${saveStatus}`}>
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved' && 'Saved ✓'}
          {saveStatus === 'error' && 'Save failed'}
          {saveStatus === 'idle' && isDirty && 'Unsaved'}
          {saveStatus === 'idle' && !isDirty && ''}
        </span>
        <button
          className="sme-toolbar__btn sme-toolbar__btn--active"
          onClick={onSave}
          disabled={!isDirty || isLocked || saveStatus === 'saving'}
          style={{ opacity: (!isDirty || isLocked) ? 0.5 : 1 }}
        >
          {saveStatus === 'saving' ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
};
