import type { TextPropertySnapshot, TextPropertyMutation } from "../contracts/text-properties.js";
import type { BackendStatus, WorkspaceDesktopApi } from "../contracts/desktop-api.js";
import type { Language, ServiceResult, Settings } from "../contracts/settings.js";
import type { ProjectList, DiscoveryPreview, ActiveWorkspace, WorkspaceCreated, WorkspaceLoad, WorkspaceSourceState, WorkspaceChangeEvent } from "../contracts/workspaces.js";
import type { RootPickerResult } from "../contracts/desktop-api.js";

import { isWorkspaceChangeEvent } from "../contracts/service-protocol.js";

export class WorkspaceServiceClient {
  constructor(private readonly api: WorkspaceDesktopApi = window.workspace) {}

  getBackendStatus(): Promise<BackendStatus> {
    return this.api.getBackendStatus();
  }

  onBackendStatus(listener: (status: BackendStatus) => void): () => void {
    return this.api.onBackendStatus(listener);
  }

  onWorkspaceChange(listener: (event: WorkspaceChangeEvent) => void): () => void {
    let active = true;
    const unsubscribe = this.api.onWorkspaceChange((event) => {
      if (active && isWorkspaceChangeEvent(event)) listener(event);
    });
    return () => { active = false; unsubscribe(); };
  }

  listTextProperties(workspaceId: string): Promise<ServiceResult<TextPropertySnapshot>> {
    return this.api.workspace({ type: "workspace.listTextProperties", workspaceId });
  }
  createProperty(workspaceId: string, name: string): Promise<ServiceResult<TextPropertyMutation>> {
    return this.api.workspace({ type: "workspace.createProperty", workspaceId, name, propertyType: "text" });
  }
  renameProperty(workspaceId: string, propertyId: string, name: string): Promise<ServiceResult<TextPropertyMutation>> {
    return this.api.workspace({ type: "workspace.renameProperty", workspaceId, propertyId, name });
  }

  previewDiscovery(workspaceId: string, excludedRelativePaths?: string[]): Promise<ServiceResult<DiscoveryPreview>> {
    return this.api.workspace({ type: "workspace.previewDiscovery", workspaceId,
      ...(excludedRelativePaths === undefined ? {} : { excludedRelativePaths }) });
  }

  applyDiscovery(workspaceId: string, previewToken: string): Promise<ServiceResult<ProjectList>> {
    return this.api.workspace({ type: "workspace.applyDiscovery", workspaceId, previewToken });
  }

  listProjects(workspaceId: string): Promise<ServiceResult<ProjectList>> {
    return this.api.workspace({ type: "workspace.listProjects", workspaceId });
  }

  refreshSource(workspaceId: string): Promise<ServiceResult<WorkspaceSourceState>> {
    return this.api.workspace({ type: "workspace.refreshSource", workspaceId });
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

  reorderWorkspaces(workspaceIds: string[]): Promise<ServiceResult<WorkspaceLoad>> {
    return this.api.workspace({ type: "workspace.reorder", workspaceIds });
  }

  removeWorkspace(workspaceId: string): Promise<ServiceResult<WorkspaceLoad>> {
    return this.api.workspace({ type: "workspace.remove", workspaceId });
  }

  pickRoot(): Promise<RootPickerResult> {
    return this.api.pickRoot();
  }
}
