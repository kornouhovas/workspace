type WorkspaceBridgeHost = {
  workspace?: {
    request(method: string, payload?: Record<string, unknown>): Promise<unknown>;
  };
};

export function createWorkspaceRendererTransport(host: WorkspaceBridgeHost = window) {
  return {
    async request(method: string, payload: Record<string, unknown> = {}) {
      if (!host.workspace || typeof host.workspace.request !== "function") {
        throw new Error("Workspace IPC bridge is unavailable.");
      }

      return host.workspace.request(method, payload);
    },
  };
}
