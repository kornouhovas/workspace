import type { WorkspaceRenameProjectCommand, ProjectRenameResult, ProjectRenameList, ProjectRenameRecoveryPreview, ProjectRenameRecoveryAction } from "../contracts/project-rename.js";
import type { WorkspaceCreateProjectCommand, ProjectCreationResult, ProjectCreationList, ProjectCreationRecoveryPreview, ProjectCreationRecoveryAction } from "../contracts/project-creation.js";
import type { ProjectRevealResult } from "../contracts/project-reveal.js";
import type { ProjectRecoveryPreview } from "../contracts/project-recovery.js";
import type { TextPropertySnapshot, TextPropertyMutation } from "../contracts/text-properties.js";
import type { BackendStatus, WorkspaceDesktopApi } from "../contracts/desktop-api.js";
import type { Language, ServiceResult, Settings } from "../contracts/settings.js";
import type { CategoryPropertySnapshot, ProjectList, DiscoveryMode, DiscoveryPreview, ActiveWorkspace, WorkspaceCreated, WorkspaceLoad, WorkspaceSourceObservationSnapshot, WorkspaceSourceState, WorkspaceChangeEvent } from "../contracts/workspaces.js";
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

  renameProject(input: Omit<WorkspaceRenameProjectCommand, "type">): Promise<ServiceResult<ProjectRenameResult>> {
    return this.api.workspace({ ...input, type: "workspace.renameProject" });
  }
  listProjectRenames(workspaceId: string): Promise<ServiceResult<ProjectRenameList>> {
    return this.api.workspace({ type: "workspace.listProjectRenames", workspaceId });
  }
  getProjectRename(workspaceId: string, operationId: string): Promise<ServiceResult<ProjectRenameResult>> {
    return this.api.workspace({ type: "workspace.getProjectRename", workspaceId, operationId });
  }
  previewProjectRenameRecovery(workspaceId: string, operationId: string): Promise<ServiceResult<ProjectRenameRecoveryPreview>> {
    return this.api.workspace({ type: "workspace.previewProjectRenameRecovery", workspaceId, operationId });
  }
  recoverProjectRename(workspaceId: string, operationId: string, previewToken: string, action: ProjectRenameRecoveryAction): Promise<ServiceResult<ProjectRenameResult>> {
    return this.api.workspace({ type: "workspace.recoverProjectRename", workspaceId, operationId, previewToken, action });
  }

  createProject(input: Omit<Extract<WorkspaceCreateProjectCommand, { mode: "direct" }>, "type"> | Omit<Extract<WorkspaceCreateProjectCommand, { mode: "grouped" }>, "type">): Promise<ServiceResult<ProjectCreationResult>> {
    return this.api.workspace({ ...input, type: "workspace.createProject" });
  }
  listProjectCreations(workspaceId: string): Promise<ServiceResult<ProjectCreationList>> {
    return this.api.workspace({ type: "workspace.listProjectCreations", workspaceId });
  }
  getProjectCreation(workspaceId: string, operationId: string): Promise<ServiceResult<ProjectCreationResult>> {
    return this.api.workspace({ type: "workspace.getProjectCreation", workspaceId, operationId });
  }
  previewProjectCreationRecovery(workspaceId: string, operationId: string): Promise<ServiceResult<ProjectCreationRecoveryPreview>> {
    return this.api.workspace({ type: "workspace.previewProjectCreationRecovery", workspaceId, operationId });
  }
  recoverProjectCreation(workspaceId: string, operationId: string, previewToken: string, action: ProjectCreationRecoveryAction): Promise<ServiceResult<ProjectCreationResult>> {
    return this.api.workspace({ type: "workspace.recoverProjectCreation", workspaceId, operationId, previewToken, action });
  }
  revealProject(workspaceId: string, projectId: string): Promise<ServiceResult<ProjectRevealResult>> {
    return this.api.workspace({ type: "workspace.revealProject", workspaceId, projectId });
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

  renameCategoryProperty(workspaceId: string, propertyId: string, name: string): Promise<ServiceResult<CategoryPropertySnapshot>> {
    return this.api.workspace({ type: "workspace.renameCategoryProperty", workspaceId, propertyId, name });
  }

  setTextValue(workspaceId: string, projectId: string, propertyId: string, value: string | null): Promise<ServiceResult<TextPropertyMutation>> {
    return this.api.workspace({ type: "workspace.setTextValue", workspaceId, projectId, propertyId, value });
  }

  previewDiscovery(workspaceId: string, excludedRelativePaths?: string[], mode?: DiscoveryMode): Promise<ServiceResult<DiscoveryPreview>> {
    return this.api.workspace({ type: "workspace.previewDiscovery", workspaceId, ...(mode === undefined ? {} : { mode }),
      ...(excludedRelativePaths === undefined ? {} : { excludedRelativePaths }) });
  }

  applyDiscovery(workspaceId: string, previewToken: string): Promise<ServiceResult<ProjectList>> {
    return this.api.workspace({ type: "workspace.applyDiscovery", workspaceId, previewToken });
  }

  previewProjectRecovery(workspaceId: string, projectId: string): Promise<ServiceResult<ProjectRecoveryPreview>> {
    return this.api.workspace({ type: "workspace.previewProjectRecovery", workspaceId, projectId });
  }

  reassociateProject(workspaceId: string, projectId: string, previewToken: string, relativePath: string): Promise<ServiceResult<ProjectList>> {
    return this.api.workspace({ type: "workspace.reassociateProject", workspaceId, projectId, previewToken, relativePath });
  }

  listProjects(workspaceId: string): Promise<ServiceResult<ProjectList>> {
    return this.api.workspace({ type: "workspace.listProjects", workspaceId });
  }

  async getSourceObservation(workspaceId: string): Promise<ServiceResult<WorkspaceSourceObservationSnapshot>> {
    const result = await this.api.workspace({ type: "workspace.getSourceObservation", workspaceId });
    if (!result.ok) return result;
    const observation = result.value.observation;
    if (observation !== null && (!isWorkspaceChangeEvent(observation) || observation.type !== "workspace.sourceObserved" ||
      !observation.workspaceIds.includes(workspaceId))) {
      return { ok: false, error: { code: "service_unavailable", message: "The source observation is unavailable." } };
    }
    return result;
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
