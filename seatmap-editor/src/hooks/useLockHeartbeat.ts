/**
 * @aioemp/seatmap-editor — Lock heartbeat hook
 *
 * Acquires a lock on mount, heartbeats every 60s,
 * and releases on unmount or window beforeunload.
 */

import { useEffect, useRef } from 'react';
import { lockApi } from '../api';
import { useEditorStore } from '../store';

const HEARTBEAT_INTERVAL = 60_000; // 60 seconds (lock TTL is 90s server-side)

export function useLockHeartbeat() {
  const seatmapId = useEditorStore((s) => s.seatmapId);
  const setLock = useEditorStore((s) => s.setLock);
  const tokenRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!seatmapId) return;

    let cancelled = false;

    async function acquire() {
      try {
        const res: any = await lockApi.acquire('seatmap', seatmapId!);
        if (cancelled) return;

        if (res.lock_token) {
          tokenRef.current = res.lock_token;
          setLock(res.lock_token, res.owner_id, res.owner_name, false);

          // Start heartbeat
          intervalRef.current = setInterval(async () => {
            try {
              if (tokenRef.current) {
                await lockApi.heartbeat('seatmap', seatmapId!, tokenRef.current);
              }
            } catch {
              // If heartbeat fails, mark as locked-by-other
              setLock(null, null, null, true);
            }
          }, HEARTBEAT_INTERVAL);
        } else if (res.locked_by) {
          // Already locked by another user
          setLock(null, res.locked_by, res.locked_by_name || 'Another user', true);
        }
      } catch (err: any) {
        console.warn('[seatmap-editor] Failed to acquire lock:', err);
        // Optimistically allow editing; save will fail if locked
      }
    }

    acquire();

    // Release on beforeunload
    const onBeforeUnload = () => {
      if (tokenRef.current && seatmapId) {
        // Use sendBeacon for reliable delivery on page close.
        // rest_url already includes aioemp/v1/; append _wpnonce for cookie-less auth.
        const url = `${window.aioemp.rest_url}lock/release?_wpnonce=${encodeURIComponent(window.aioemp.nonce)}`;
        const data = JSON.stringify({ resource_type: 'seatmap', resource_id: seatmapId, lock_token: tokenRef.current });
        navigator.sendBeacon(url, new Blob([data], { type: 'application/json' }));
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      cancelled = true;
      window.removeEventListener('beforeunload', onBeforeUnload);
      clearInterval(intervalRef.current);

      // Release lock on unmount
      if (tokenRef.current && seatmapId) {
        lockApi.release('seatmap', seatmapId, tokenRef.current).catch(() => {});
        tokenRef.current = null;
      }
    };
  }, [seatmapId, setLock]);
}
