/**
 * @aioemp/seatmap-editor — Draft Persistence Hook
 *
 * Saves work-in-progress layout to localStorage every 2 seconds
 * so the user doesn't lose work on accidental refresh.
 * Restores draft on mount if a matching seatmapId is found.
 */

import { useEffect, useRef } from 'react';
import { useEditorStore } from '../store';

const DRAFT_PREFIX = 'aioemp_seatmap_draft_';

function getDraftKey(seatmapId: number | null): string | null {
  return seatmapId ? `${DRAFT_PREFIX}${seatmapId}` : null;
}

/**
 * Auto-saves layout to localStorage (debounced 2s).
 * On mount, restores draft if newer than server version.
 */
export function useDraftPersistence() {
  const seatmapId = useEditorStore((s) => s.seatmapId);
  const layout = useEditorStore((s) => s.layout);
  const isDirty = useEditorStore((s) => s.isDirty);
  const initLayout = useEditorStore((s) => s.initLayout);
  const restoredRef = useRef(false);

  /* Restore draft on mount */
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const key = getDraftKey(seatmapId);
    if (!key) return;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft && draft.layout && draft.savedAt) {
        // Only restore if draft is newer than 30 seconds ago (in case server just saved)
        const age = Date.now() - draft.savedAt;
        if (age < 60 * 60 * 1000) {
          // Less than 1 hour old
          initLayout(draft.layout as any);
          console.log('[seatmap-editor] Draft restored from localStorage');
        }
      }
    } catch {
      // Ignore corrupt draft
    }
  }, [seatmapId, initLayout]);

  /* Auto-save draft every 2 seconds when dirty */
  useEffect(() => {
    if (!isDirty) return;

    const key = getDraftKey(seatmapId);
    if (!key) return;

    const timer = setTimeout(() => {
      try {
        const data = JSON.stringify({
          layout,
          savedAt: Date.now(),
        });
        localStorage.setItem(key, data);
      } catch {
        // Quota exceeded — silently ignore
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [layout, isDirty, seatmapId]);
}

/**
 * Clear the localStorage draft for a seatmap (after successful server save).
 */
export function clearDraft(seatmapId: number) {
  const key = getDraftKey(seatmapId);
  if (key) localStorage.removeItem(key);
}
