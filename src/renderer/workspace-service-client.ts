import type { BackendStatus, WorkspaceDesktopApi } from "../contracts/desktop-api.js";
import type { Language, ServiceResult, Settings } from "../contracts/settings.js";
import type { ActiveWorkspace, WorkspaceCreated, WorkspaceLoad } from "../contracts/workspaces.js";
import type { RootPickerResult } from "../contracts/desktop-api.js";

export class WorkspaceServiceClient {
  constructor(private readonly api: WorkspaceDesktopApi = window.workspace) {}

  getBackendStatus(): Promise<BackendStatus> {
    return this.api.getBackendStatus();
  }

  onBackendStatus(listener: (status: BackendStatus) => void): () => void {
    return this.api.onBackendStatus(listener);
  }

  loadSettings(): Promise<ServiceResult<Settings>> {
    return this.api.settings({ type: "settings.load" });
  }

  setLanguage(language: Language): Promise<ServiceResult<Settings>> {
    return this.api.settings({ type: "settings.setLanguage", language });
  }

  loadWorkspaces(): Promise<ServiceResult<WorkspaceLoad>> {
    return this.api.workspace({ type: "workspace.load" });
  }

  createWorkspace(name: string, rootPath: string): Promise<ServiceResult<WorkspaceCreated>> {
    return this.api.workspace({ type: "workspace.create", name, rootPath });
  }

  activateWorkspace(workspaceId: string): Promise<ServiceResult<ActiveWorkspace>> {
    return this.api.workspace({ type: "workspace.activate", workspaceId });
  }

  renameWorkspace(workspaceId: string, name: string): Promise<ServiceResult<WorkspaceLoad>> {
    return this.api.workspace({ type: "workspace.rename", workspaceId, name });
  }

  pickRoot(): Promise<RootPickerResult> {
    return this.api.pickRoot();
  }
}
