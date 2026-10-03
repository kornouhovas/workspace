declare module "@/workspaceServiceClient.js" {
  type WorkspaceTransport = {
    request(method: string, payload?: Record<string, unknown>): Promise<unknown>;
  };

  export class WorkspaceServiceClient {
    constructor(transport: WorkspaceTransport);
    getRoot(payload?: Record<string, unknown>): Promise<unknown>;
    getProject(payload: Record<string, unknown>): Promise<unknown>;
    getProjectStatusOptions(payload: Record<string, unknown>): Promise<unknown>;
    createProject(payload: Record<string, unknown>): Promise<unknown>;
    moveProjectStatus(payload: Record<string, unknown>): Promise<unknown>;
    setRoot(payload: Record<string, unknown>): Promise<unknown>;
    scan(payload: Record<string, unknown>): Promise<unknown>;
    listEntries(payload: Record<string, unknown>): Promise<unknown>;
    listProjectFileTree(payload: Record<string, unknown>): Promise<unknown>;
    saveProperty(payload: Record<string, unknown>): Promise<unknown>;
    listPropertyValues(payload: Record<string, unknown>): Promise<unknown>;
    listProperties(payload: Record<string, unknown>): Promise<unknown>;
    createProperty(payload: Record<string, unknown>): Promise<unknown>;
    updateProperty(payload: Record<string, unknown>): Promise<unknown>;
    reorderProperties(payload: Record<string, unknown>): Promise<unknown>;
    deleteProperty(payload: Record<string, unknown>): Promise<unknown>;
    createSelectValue(payload: Record<string, unknown>): Promise<unknown>;
    updateSelectValue(payload: Record<string, unknown>): Promise<unknown>;
    updateStatusValueColor(payload: Record<string, unknown>): Promise<unknown>;
    reorderSelectValues(payload: Record<string, unknown>): Promise<unknown>;
    deleteSelectValue(payload: Record<string, unknown>): Promise<unknown>;
    updateProjectPropertyValue(payload: Record<string, unknown>): Promise<unknown>;
    updateFolderRole(payload: Record<string, unknown>): Promise<unknown>;
    listWorkspaces(payload?: Record<string, unknown>): Promise<unknown>;
    createWorkspace(payload: Record<string, unknown>): Promise<unknown>;
    updateWorkspace(payload: Record<string, unknown>): Promise<unknown>;
    reorderWorkspaces(payload: Record<string, unknown>): Promise<unknown>;
    deleteWorkspace(payload: Record<string, unknown>): Promise<unknown>;
    setActiveWorkspace(payload: Record<string, unknown>): Promise<unknown>;
    listViews(payload: Record<string, unknown>): Promise<unknown>;
    createView(payload: Record<string, unknown>): Promise<unknown>;
    setActiveView(payload: Record<string, unknown>): Promise<unknown>;
    updateView(payload: Record<string, unknown>): Promise<unknown>;
    reorderViews(payload: Record<string, unknown>): Promise<unknown>;
    deleteView(payload: Record<string, unknown>): Promise<unknown>;
    getViewProjection(payload: Record<string, unknown>): Promise<unknown>;
    reveal(payload: Record<string, unknown>): Promise<unknown>;
    previewFile(payload: Record<string, unknown>): Promise<unknown>;
  }
}
