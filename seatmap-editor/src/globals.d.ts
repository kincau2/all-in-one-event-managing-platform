/**
 * Global type declarations for the WP-injected `aioemp` object.
 */

declare global {
  interface Window {
    aioemp: {
      rest_url: string;
      nonce: string;
      user_id: number;
      version: string;
      logo_url: string;
    };
    aioemp_api: {
      request(endpoint: string, options?: RequestInit): Promise<any>;
      get(endpoint: string): Promise<any>;
      post(endpoint: string, body: any): Promise<any>;
      put(endpoint: string, body: any): Promise<any>;
      del(endpoint: string): Promise<any>;
    };
    aioemp_seatmap_editor?: {
      mount(container: HTMLElement, seatmapId: number): void;
      unmount(): void;
    };
    aioemp_modal: {
      alert(message: string, opts?: { title?: string; variant?: 'info' | 'success' | 'warning' | 'danger' }): Promise<void>;
      confirm(message: string, opts?: { title?: string; variant?: 'info' | 'success' | 'warning' | 'danger'; confirmText?: string; cancelText?: string; detail?: string }): Promise<boolean>;
    };
  }
}

export {};
