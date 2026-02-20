/**
 * @aioemp/seatmap-editor — App Root
 *
 * Assembles: ToolsPalette (left) + EditorCanvas (center) + InspectorPanel (right).
 * Handles resize, loading state, and lock warnings.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorStore } from './store';
import { seatmapApi } from './api';
import { ToolsPalette } from './components/ToolsPalette';
import { EditorCanvas } from './components/EditorCanvas';
import { InspectorPanel } from './components/InspectorPanel';
import { useDraftPersistence } from './hooks/useDraftPersistence';
import { useSave } from './hooks/useSave';
import { useLockHeartbeat } from './hooks/useLockHeartbeat';

interface AppProps {
  seatmapId: number;
  onClose: () => void;
}

export const App: React.FC<AppProps> = ({ seatmapId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  const initLayout = useEditorStore((s) => s.initLayout);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const isDirty = useEditorStore((s) => s.isDirty);
  const isLocked = useEditorStore((s) => s.isLocked);
  const lockOwnerName = useEditorStore((s) => s.lockOwnerName);
  const compiledSeats = useEditorStore((s) => s.compiledSeats);

  /* Wire up store seatmapId */
  useEffect(() => {
    useEditorStore.setState({ seatmapId });
  }, [seatmapId]);

  /* Hooks */
  useDraftPersistence();
  const { save } = useSave();
  useLockHeartbeat();

  /* Fetch seatmap on mount */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    seatmapApi
      .get(seatmapId)
      .then((data: any) => {
        if (cancelled) return;
        if (data && (data.layout_json || data.layout)) {
          try {
            const raw = data.layout_json ?? data.layout;
            const layout = typeof raw === 'string'
              ? JSON.parse(raw)
              : raw;
            initLayout(layout);
          } catch {
            initLayout({ schemaVersion: 1, canvas: { w: 1200, h: 800 }, primitives: [] } as any);
          }
        } else {
          initLayout({ schemaVersion: 1, canvas: { w: 1200, h: 800 }, primitives: [] } as any);
        }
        setLoading(false);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load seatmap');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [seatmapId, initLayout]);

  /* Resize observer for canvas wrapper */
  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasSize({ width: Math.floor(width), height: Math.floor(height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading]);

  /* Warn before leaving with unsaved changes */
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleSave = useCallback(() => { save(); }, [save]);

  const handleClose = useCallback(() => {
    if (isDirty && !window.confirm('You have unsaved changes. Discard?')) return;
    onClose();
  }, [isDirty, onClose]);

  /* ── Render ── */

  if (loading) {
    return (
      <div className="sme-loading">
        <div className="sme-loading__spinner" />
        <p>Loading seatmap…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sme-error">
        <p>{error}</p>
        <button className="sme-btn sme-btn--secondary" onClick={onClose}>
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="sme-app">
      {/* Top bar */}
      <div className="sme-topbar">
        <button className="sme-btn sme-btn--icon" onClick={handleClose} title="Close editor">
          <span className="dashicons dashicons-arrow-left-alt" />
        </button>
        <span className="sme-topbar__title">Seatmap Editor</span>

        <div className="sme-topbar__meta">
          <span className="sme-topbar__seats">{compiledSeats.length} seats</span>
          {isLocked && (
            <span className="sme-topbar__lock-warning">
              Locked by {lockOwnerName || 'another user'}
            </span>
          )}
          <span className={`sme-topbar__status sme-topbar__status--${saveStatus}`}>
            {saveStatus === 'saving' && 'Saving…'}
            {saveStatus === 'saved' && 'Saved ✓'}
            {saveStatus === 'error' && 'Save failed'}
            {saveStatus === 'idle' && isDirty && 'Unsaved changes'}
            {saveStatus === 'idle' && !isDirty && ''}
          </span>
        </div>

        <button
          className="sme-btn sme-btn--primary"
          onClick={handleSave}
          disabled={!isDirty || isLocked || saveStatus === 'saving'}
        >
          {saveStatus === 'saving' ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Main workspace */}
      <div className="sme-workspace">
        {/* Left: tools palette */}
        <ToolsPalette />

        {/* Center: canvas */}
        <div className="sme-canvas-wrap" ref={canvasWrapRef}>
          <EditorCanvas
            width={canvasSize.width}
            height={canvasSize.height}
          />
        </div>

        {/* Right: inspector */}
        <InspectorPanel />
      </div>
    </div>
  );
};
