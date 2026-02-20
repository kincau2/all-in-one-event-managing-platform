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
  }
}

export {};
