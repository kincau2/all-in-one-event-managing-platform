/**
 * @aioemp/seatmap-editor — Toolbar (v2)
 *
 * Horizontal toolbar:
 * [Back] | [Block-select · Seat-select] | [Draw Grid · Draw Arc] | [+Label · +Obstacle]
 *       | [Delete · Duplicate] | [Undo · Redo] | [Snap · Zoom] | meta + Save
 *
 * Grid / Arc are now draw-tool toggles (drag-to-create on canvas).
 * Label / Obstacle remain instant-add.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useEditorStore, type Tool } from '../store';
import { createDefaultLabel, createDefaultObstacle, createDefaultImage } from '../primitiveFactories';
import { uploadBgImage } from '../api';

/* ── Component ── */

interface ToolbarProps {
  onClose: () => void;
  onSave: (status?: 'draft' | 'publish') => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onClose, onSave }) => {
  const [showHelp, setShowHelp] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const activeTool = useEditorStore((s) => s.activeTool);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const selectedSeatKeys = useEditorStore((s) => s.selectedSeatKeys);
  const undoStack = useEditorStore((s) => s.undoStack);
  const redoStack = useEditorStore((s) => s.redoStack);

  const isLocked = useEditorStore((s) => s.isLocked);
  const lockOwnerName = useEditorStore((s) => s.lockOwnerName);
  const compiledSeats = useEditorStore((s) => s.compiledSeats);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const isDirty = useEditorStore((s) => s.isDirty);
  const seatmapStatus = useEditorStore((s) => s.seatmapStatus);
  const stageScale = useEditorStore((s) => s.stageScale);

  const setTool = useEditorStore((s) => s.setActiveTool);
  const addPrimitive = useEditorStore((s) => s.addPrimitive);
  const removePrimitives = useEditorStore((s) => s.removePrimitives);
  const removeSelectedSeats = useEditorStore((s) => s.removeSelectedSeats);
  const duplicatePrimitives = useEditorStore((s) => s.duplicatePrimitives);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  const setViewport = useEditorStore((s) => s.setViewport);
  const primitives = useEditorStore((s) => s.layout.primitives);

  /* ── Seat integrity check (O(n) — runs reactively on every recompile) ── */
  const [showIntegrity, setShowIntegrity] = useState(false);

  interface DuplicateGroup {
    key: string;           // "row||number"
    row: string;
    number: number;
    count: number;
    blockNames: string[];  // primitive names that contribute
    sections: string[];    // sections involved for context
  }

  const duplicateGroups = useMemo<DuplicateGroup[]>(() => {
    // Key by row+number ONLY — duplicates across ALL blocks regardless of section
    const map = new Map<string, { count: number; primIds: Set<string>; sections: Set<string> }>();
    for (const seat of compiledSeats) {
      if (seat.row == null || seat.number == null) continue;
      const k = `${seat.row}||${seat.number}`;
      const entry = map.get(k);
      const pid = (seat.meta as any)?.primitiveId as string | undefined;
      const sec = seat.section ?? '';
      if (entry) {
        entry.count++;
        if (pid) entry.primIds.add(pid);
        if (sec) entry.sections.add(sec);
      } else {
        const primIds = new Set<string>();
        const sections = new Set<string>();
        if (pid) primIds.add(pid);
        if (sec) sections.add(sec);
        map.set(k, { count: 1, primIds, sections });
      }
    }
    // Collect only entries with count > 1
    const groups: DuplicateGroup[] = [];
    for (const [k, v] of map) {
      if (v.count <= 1) continue;
      const [row, numStr] = k.split('||');
      const blockNames = [...v.primIds].map((pid) => {
        const prim = primitives.find((p) => p.id === pid);
        return (prim as any)?.name || (prim as any)?.section || prim?.id.slice(0, 8) || 'Unknown';
      });
      groups.push({ key: k, row, number: parseInt(numStr, 10), count: v.count, blockNames, sections: [...v.sections] });
    }
    // Sort by row then number for readability
    groups.sort((a, b) => a.row.localeCompare(b.row) || a.number - b.number);
    return groups;
  }, [compiledSeats, primitives]);

  const integrityPass = duplicateGroups.length === 0;

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

  const handleImageUpload = useCallback(async (file: File) => {
    if (isLocked) return;
    try {
      const url = await uploadBgImage(file);
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 400;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        addPrimitive(createDefaultImage(url, w, h));
      };
      img.onerror = () => {
        addPrimitive(createDefaultImage(url, 200, 200));
      };
      img.src = url;
    } catch {
      /* upload failed – silently ignore */
    }
  }, [addPrimitive, isLocked]);

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
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style={{marginRight:2}}>
            <path d="M4 2 L4 17 L8 13 L12 18 L14 16 L10 11 L16 11 Z" />
          </svg>
          <span>Block</span>
        </button>
        <button className={btnClass('seatSelect')} onClick={() => setTool('seatSelect')}
          title="Seat Select (S)" disabled={isLocked}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{marginRight:2}}>
            <path d="m 11.683912,11 6.38,5.37 -0.88,0.18 -0.64,0.12 c -0.63,0.13 -0.99,0.83 -0.71,1.4 l 0.27,0.58 1.36,2.94 -1.42,0.66 -1.36,-2.93 -0.26,-0.58 c -0.27,-0.59 -1.02,-0.77 -1.52,-0.36 l -0.51,0.4 -0.71,0.57 V 11 m -0.74,-2.31 c -0.419736,0 -0.76,0.3402636 -0.76,0.76 V 20.9 c 0,0.42 0.34,0.76 0.76,0.76 0.19,0 0.35,-0.06 0.48,-0.16 l 1.91,-1.55 1.66,3.62 c 0.13,0.27 0.4,0.43 0.69,0.43 0.11,0 0.22,0 0.33,-0.08 l 2.76,-1.28 c 0.38,-0.18 0.56,-0.64 0.36,-1.01 l -1.67,-3.63 2.41,-0.45 c 0.16,-0.05 0.31,-0.12 0.43,-0.26 0.27,-0.32 0.23,-0.79 -0.12,-1.08 l -8.74,-7.35 -0.01,0.01 c -0.13,-0.11 -0.3,-0.18 -0.49,-0.18" />
            <path d="M 4.2160421,6.2850719 C 3.2473332,9.4540255 5.0309855,12.808263 8.1999386,13.776971 L 7.615271,15.689603 C 3.3899995,14.397993 1.0117981,9.9256752 2.3034098,5.7004044 3.5950208,1.4751331 8.0673384,-0.90306813 12.292614,0.38854316 16.517886,1.6801548 18.896088,6.152472 17.604475,10.377744 L 15.691842,9.7930768 C 16.660551,6.6241226 14.876901,3.2698846 11.707947,2.3011762 8.5389883,1.3324677 5.1847506,3.1161184 4.2160421,6.2850719" />
          </svg>
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
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" fill="currentColor" style={{marginRight:2}}>
            <path transform="rotate(90,320,320)" d="M457.1 206.9C394.6 144.4 301.3 144.4 238.8 206.9C176.3 269.4 176.3 370.7 238.8 433.2C301.3 495.7 394.6 495.7 457.1 433.2C469.6 420.7 489.9 420.7 502.4 433.2C514.9 445.7 514.9 466 502.4 478.5C414.9 566 281.1 566 193.6 478.5C106.1 391 106.1 249.2 193.6 161.7C281.1 74.2 414.9 74.2 502.4 161.7C514.9 174.2 514.9 194.5 502.4 207C489.9 219.5 469.6 219.5 457.1 207z"/>
          </svg>
          <span>Arc</span>
        </button>
      </div>

      {/* Instant-add shapes */}
      <div className="sme-toolbar__group">
        <button className="sme-toolbar__btn" onClick={() => handleAdd(createDefaultObstacle)}
          title="Add Obstacle" disabled={isLocked}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" style={{marginRight:2}}>
            <rect x="2" y="3" width="14" height="12" rx="2" />
          </svg>
          <span>Obstacle</span>
        </button>
        <button className="sme-toolbar__btn" onClick={() => handleAdd(createDefaultLabel)}
          title="Add Label" disabled={isLocked}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" style={{marginRight:2}}>
            <text x="9" y="15" textAnchor="middle" fontSize="16" fontWeight="bold" fontFamily="sans-serif">T</text>
          </svg>
          <span>Label</span>
        </button>
        <button className="sme-toolbar__btn" onClick={() => imageInputRef.current?.click()}
          title="Add Image" disabled={isLocked}>
          <span className="dashicons dashicons-format-image" />
          <span>Image</span>
        </button>
        <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ''; }} />
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

      {/* Help */}
      <div className="sme-toolbar__group">
        <button className="sme-toolbar__btn" onClick={() => setShowHelp(true)} title="Keyboard Shortcuts">
          <span className="dashicons dashicons-editor-help" />
        </button>
      </div>

      {/* Right side: meta + save */}
      <div className="sme-toolbar__group sme-toolbar__group--right">
        {/* Seat integrity indicator */}
        {compiledSeats.length > 0 && (
          integrityPass ? (
            <span className="sme-integrity sme-integrity--pass" title="Seat integrity check passed">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="#19d895" style={{ marginRight: 3, verticalAlign: '-2px' }}>
                <path d="M10 0C4.5 0 0 4.5 0 10s4.5 10 10 10 10-4.5 10-10S15.5 0 10 0zm-1.7 14.3L4 10l1.4-1.4 2.9 2.9 6.3-6.3L16 6.6l-7.7 7.7z"/>
              </svg>
              Seat integrity check pass
            </span>
          ) : (
            <button className="sme-integrity sme-integrity--fail" onClick={() => setShowIntegrity(true)}
              title={`${duplicateGroups.length} duplicate group(s) found`}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="14" height="14" fill="#dc3545"
                style={{ marginRight: 3, verticalAlign: '-2px' }}>
                <path d="M320 576C178.6 576 64 461.4 64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576zM320 384C302.3 384 288 398.3 288 416C288 433.7 302.3 448 320 448C337.7 448 352 433.7 352 416C352 398.3 337.7 384 320 384zM320 192C301.8 192 287.3 207.5 288.6 225.7L296 329.7C296.9 342.3 307.4 352 319.9 352C332.5 352 342.9 342.3 343.8 329.7L351.2 225.7C352.5 207.5 338.1 192 319.8 192z"/>
              </svg>
              Seat integrity check fail
            </button>
          )
        )}
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
        {seatmapStatus === 'draft' ? (
          <>
            <button
              className="sme-toolbar__btn"
              onClick={() => onSave('draft')}
              disabled={!isDirty || isLocked || saveStatus === 'saving'}
              style={{ opacity: (!isDirty || isLocked) ? 0.5 : 1 }}
            >
              {saveStatus === 'saving' ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              className="sme-toolbar__btn sme-toolbar__btn--active"
              onClick={() => onSave('publish')}
              disabled={isLocked || saveStatus === 'saving'}
              style={{ opacity: isLocked ? 0.5 : 1 }}
            >
              Publish
            </button>
          </>
        ) : (
          <>
            <button
              className="sme-toolbar__btn sme-toolbar__btn--active"
              onClick={() => onSave()}
              disabled={!isDirty || isLocked || saveStatus === 'saving'}
              style={{ opacity: (!isDirty || isLocked) ? 0.5 : 1 }}
            >
              {saveStatus === 'saving' ? 'Saving…' : 'Save'}
            </button>
            <button
              className="sme-toolbar__btn sme-toolbar__btn--link"
              onClick={() => { if (window.confirm('Switch this seatmap back to draft? It will no longer be available for events.')) onSave('draft'); }}
              disabled={isLocked || saveStatus === 'saving'}
              style={{ opacity: isLocked ? 0.5 : 1 }}
            >
              Switch to Draft
            </button>
          </>
        )}
      </div>

      {/* Integrity check detail modal */}
      {showIntegrity && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100000,
          background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowIntegrity(false)}>
          <div style={{
            background: '#fff', borderRadius: 10, padding: '24px 32px', minWidth: 380, maxWidth: 520,
            maxHeight: '70vh', overflow: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)', position: 'relative',
          }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowIntegrity(false)} style={{
              position: 'absolute', top: 10, right: 14, background: 'none',
              border: 'none', fontSize: 20, cursor: 'pointer', color: '#666', lineHeight: 1,
            }}>&times;</button>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: '#dc3545' }}>
              Seat Integrity Check Failed
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#666' }}>
              {duplicateGroups.length} duplicate seat group{duplicateGroups.length > 1 ? 's' : ''} found.
              Each Row + Seat # pair must be unique across all seat blocks.
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px' }}>Row</th>
                  <th style={{ padding: '6px 8px' }}>Seat #</th>
                  <th style={{ padding: '6px 8px' }}>Count</th>
                  <th style={{ padding: '6px 8px' }}>Found in Blocks</th>
                </tr>
              </thead>
              <tbody>
                {duplicateGroups.map((g) => (
                  <tr key={g.key} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '5px 8px', fontWeight: 600 }}>{g.row}</td>
                    <td style={{ padding: '5px 8px', fontWeight: 600 }}>{g.number}</td>
                    <td style={{ padding: '5px 8px', color: '#dc3545', fontWeight: 600 }}>{g.count}×</td>
                    <td style={{ padding: '5px 8px', fontSize: 12, color: '#555' }}>
                      {g.blockNames.map((name, i) => (
                        <span key={i}>
                          {name}
                          {g.sections[i] ? <span style={{ color: '#999' }}> ({g.sections[i]})</span> : ''}
                          {i < g.blockNames.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Help modal */}
      {showHelp && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100000,
          background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowHelp(false)}>
          <div style={{
            background: '#fff', borderRadius: 10, padding: '24px 32px', minWidth: 340, maxWidth: 440,
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)', position: 'relative',
          }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowHelp(false)} style={{
              position: 'absolute', top: 10, right: 14, background: 'none',
              border: 'none', fontSize: 20, cursor: 'pointer', color: '#666', lineHeight: 1,
            }}>&times;</button>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Keyboard Shortcuts</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {([
                  ['V', 'Block Select tool'],
                  ['S', 'Seat Select tool'],
                  ['G', 'Draw Grid tool'],
                  ['A', 'Draw Arc tool'],
                  ['Arrow keys', 'Move selected (1 px)'],
                  ['Shift + Arrows', 'Move selected (10 px)'],
                  ['Space + drag', 'Pan canvas'],
                  ['Scroll wheel', 'Zoom in / out'],
                  ['Shift + rotate', 'Snap rotation 45°'],
                  ['Delete / Backspace', 'Delete selected'],
                  ['Ctrl + D', 'Duplicate selected'],
                  ['Ctrl + Z', 'Undo'],
                  ['Ctrl + Shift + Z', 'Redo'],
                  ['Ctrl + S', 'Save'],
                ] as [string, string][]).map(([key, desc]) => (
                  <tr key={key} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '5px 12px 5px 0', fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>{key}</td>
                    <td style={{ padding: '5px 0', color: '#555' }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
