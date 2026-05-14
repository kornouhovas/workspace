export {};

declare global {
  interface Window {
    workspace: {
      request(method: string, payload?: Record<string, unknown>): Promise<unknown>;
    };
  }
}
