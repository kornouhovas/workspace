declare module "@/workspaceServiceClient.js" {
  type WorkspaceTransport = {
    request(method: string, payload?: Record<string, unknown>): Promise<unknown>;
  };

  export class WorkspaceServiceClient {
    constructor(transport: WorkspaceTransport);
    getRoot(): Promise<unknown>;
    setRoot(payload: Record<string, unknown>): Promise<unknown>;
    scan(payload: Record<string, unknown>): Promise<unknown>;
    listViews(payload: Record<string, unknown>): Promise<unknown>;
    setActiveView(payload: Record<string, unknown>): Promise<unknown>;
    getViewProjection(payload: Record<string, unknown>): Promise<unknown>;
  }
}
