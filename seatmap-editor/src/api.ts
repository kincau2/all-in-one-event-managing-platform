/**
 * @aioemp/seatmap-editor — REST API helper
 *
 * Wraps window.aioemp_api for typed seatmap operations.
 */

export interface SeatmapRecord {
  id: number;
  title: string;
  layout?: string;
  lock_user_id?: number | null;
  lock_token?: string | null;
  lock_expires_at_gmt?: string | null;
}

const api = () => window.aioemp_api;

export const seatmapApi = {
  list(params?: { page?: number; per_page?: number; search?: string }) {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.per_page) q.set('per_page', String(params.per_page));
    if (params?.search) q.set('search', params.search);
    const qs = q.toString();
    return api().get(`seatmaps${qs ? '?' + qs : ''}`) as Promise<SeatmapRecord[]>;
  },

  get(id: number) {
    return api().get(`seatmaps/${id}`) as Promise<SeatmapRecord>;
  },

  create(title: string, layout?: string) {
    return api().post('seatmaps', { title, layout }) as Promise<SeatmapRecord>;
  },

  update(id: number, data: { title?: string; layout?: string }) {
    return api().put(`seatmaps/${id}`, data) as Promise<SeatmapRecord>;
  },

  delete(id: number) {
    return api().del(`seatmaps/${id}`) as Promise<{ deleted: boolean }>;
  },
};

export const lockApi = {
  acquire(resourceType: string, resourceId: number) {
    return api().post(`locking/${resourceType}/${resourceId}/acquire`, {});
  },

  heartbeat(resourceType: string, resourceId: number, lockToken: string) {
    return api().post(`locking/${resourceType}/${resourceId}/heartbeat`, { lock_token: lockToken });
  },

  release(resourceType: string, resourceId: number, lockToken: string) {
    return api().post(`locking/${resourceType}/${resourceId}/release`, { lock_token: lockToken });
  },

  takeover(resourceType: string, resourceId: number) {
    return api().post(`locking/${resourceType}/${resourceId}/takeover`, {});
  },
};
