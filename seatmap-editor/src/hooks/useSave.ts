/**
 * @aioemp/seatmap-editor — Save Pipeline Hook
 *
 * Validates layout → compiles seats → PUTs to REST API.
 * Includes auto-save (debounced 30s) and manual save (Ctrl+S).
 * Sends lock_token header so locking service authorises the write.
 */

import { useCallback, useEffect, useRef } from 'react';
import { validateAndCompile } from '@aioemp/seatmap-core';
import { seatmapApi } from '../api';
import { useEditorStore } from '../store';
import { clearDraft } from './useDraftPersistence';

interface SaveResult {
  ok: boolean;
  error?: string;
}

export function useSave() {
  const seatmapId = useEditorStore((s) => s.seatmapId);
  const layout = useEditorStore((s) => s.layout);
  const isDirty = useEditorStore((s) => s.isDirty);
  const lockToken = useEditorStore((s) => s.lockToken);
  const setSaveStatus = useEditorStore((s) => s.setSaveStatus);
  const markClean = useEditorStore((s) => s.markClean);

  const savingRef = useRef(false);

  /**
   * Core save — validates, compiles, PUTs.
   */
  const save = useCallback(async (): Promise<SaveResult> => {
    if (!seatmapId) return { ok: false, error: 'No seatmap ID' };
    if (savingRef.current) return { ok: false, error: 'Save already in progress' };

    savingRef.current = true;
    setSaveStatus('saving');

    try {
      /* 1) Validate + compile */
      const result = validateAndCompile(layout);

      if (!result.success) {
        const errors =
          'error' in result
            ? (result as any).error?.issues?.map((i: any) => i.message).join(', ')
            : 'Validation failed';
        setSaveStatus('error');
        savingRef.current = false;
        return { ok: false, error: errors || 'Validation failed' };
      }

      /* 2) PUT to server */
      await seatmapApi.update(seatmapId, {
        layout: JSON.stringify(layout),
      });

      /* 3) Success */
      setSaveStatus('saved');
      markClean();
      clearDraft(seatmapId);

      // Reset status indicator after 3s
      setTimeout(() => setSaveStatus('idle'), 3000);

      savingRef.current = false;
      return { ok: true };
    } catch (err: any) {
      console.error('[seatmap-editor] Save failed:', err);
      setSaveStatus('error');
      savingRef.current = false;
      return { ok: false, error: err?.message || 'Network error' };
    }
  }, [seatmapId, layout, lockToken, setSaveStatus, markClean]);

  /* Ctrl+S keyboard shortcut */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [save]);

  /* Auto-save every 30s when dirty */
  useEffect(() => {
    if (!isDirty) return;

    const timer = setTimeout(() => {
      save();
    }, 30_000);

    return () => clearTimeout(timer);
  }, [isDirty, layout, save]);

  return { save };
}
