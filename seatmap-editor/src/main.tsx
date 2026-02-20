/**
 * @aioemp/seatmap-editor — Main Entry
 *
 * Exposes mount/unmount on window.aioemp_seatmap_editor so the
 * admin SPA can instantiate the React editor on demand.
 *
 *   window.aioemp_seatmap_editor.mount(container, { seatmapId, onClose })
 *   window.aioemp_seatmap_editor.unmount(container)
 */

import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { App } from './App';
import { useEditorStore } from './store';
import './styles.css';

/* ── Expose API globally EARLY so it's always available ── */
const roots = new WeakMap<Element, Root>();

interface MountOptions {
  seatmapId: number;
  onClose: () => void;
}

function mount(container: HTMLElement, opts: MountOptions) {
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }

  root.render(
    <React.StrictMode>
      <App seatmapId={opts.seatmapId} onClose={opts.onClose} />
    </React.StrictMode>,
  );
}

function unmount(container: HTMLElement) {
  const root = roots.get(container);
  if (root) {
    root.unmount();
    roots.delete(container);
  }
  // Reset store
  useEditorStore.getState().initLayout({
    schemaVersion: 1,
    canvas: { w: 1200, h: 800 },
    primitives: [],
  } as any);
}

/* Expose API globally */
try {
  (window as any).aioemp_seatmap_editor = { mount, unmount };
  console.log('[seatmap-editor] Loaded and registered on window.aioemp_seatmap_editor');
} catch (e) {
  console.error('[seatmap-editor] Failed to register globally:', e);
}

export { mount, unmount };
