import type { ArchiveQuery, ArchiveCommand, ArchiveSnapshot, ArchiveLocationPreview, ProjectArchivePreview, ProjectArchiveResult, ProjectArchiveOperationList, ProjectArchiveRecoveryPreview } from "../contracts/project-archive.js";
import type { CategoryRemovalQuery, CategoryRemovalCommand } from "../contracts/category-removal.js";
import type { CategoryOptionsQuery, CategoryOptionsCommand } from "../contracts/category-options.js";
import type { WorkspaceMoveProjectCategoryCommand, ProjectCategoryMoveResult, ProjectCategoryMoveList, ProjectCategoryMoveRecoveryPreview, ProjectCategoryMoveRecoveryAction } from "../contracts/project-category-move.js";
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

  listArchivedProjects(workspaceId: string): Promise<ServiceResult<ArchiveSnapshot>> { return this.api.workspace({ type: "workspace.listArchivedProjects", workspaceId }); }
  previewArchiveLocation(workspaceId: string, relativePath: string): Promise<ServiceResult<ArchiveLocationPreview>> { return this.api.workspace({ type: "workspace.previewArchiveLocation", workspaceId, relativePath }); }
  applyArchiveLocation(workspaceId: string, operationId: string, previewToken: string): Promise<ServiceResult<ArchiveSnapshot>> { return this.api.workspace({ type: "workspace.applyArchiveLocation", workspaceId, operationId, previewToken }); }
  previewProjectArchive(input: Omit<Extract<ArchiveQuery, { type: "workspace.previewProjectArchive" }>, "type">): Promise<ServiceResult<ProjectArchivePreview>> { return this.api.workspace({ ...input, type: "workspace.previewProjectArchive" }); }
  applyProjectArchive(input: Omit<Extract<ArchiveCommand, { type: "workspace.applyProjectArchive" }>, "type">): Promise<ServiceResult<ProjectArchiveResult>> { return this.api.workspace({ ...input, type: "workspace.applyProjectArchive" }); }
  getProjectArchiveOperation(workspaceId: string, operationId: string): Promise<ServiceResult<ProjectArchiveResult>> { return this.api.workspace({ type: "workspace.getProjectArchiveOperation", workspaceId, operationId }); }
  listProjectArchiveOperations(workspaceId: string): Promise<ServiceResult<ProjectArchiveOperationList>> { return this.api.workspace({ type: "workspace.listProjectArchiveOperations", workspaceId }); }
  previewProjectArchiveRecovery(workspaceId: string, operationId: string): Promise<ServiceResult<ProjectArchiveRecoveryPreview>> { return this.api.workspace({ type: "workspace.previewProjectArchiveRecovery", workspaceId, operationId }); }
  recoverProjectArchive(workspaceId: string, operationId: string, previewToken: string, action: "retry_original" | "complete_destination" | "keep_original"): Promise<ServiceResult<ProjectArchiveResult>> { return this.api.workspace({ type: "workspace.recoverProjectArchive", workspaceId, operationId, previewToken, action }); }

  applyCategoryRemoval(input: Omit<Extract<CategoryRemovalQuery | CategoryRemovalCommand, { type: "workspace.applyCategoryRemoval" }>, "type">) {
    return this.api.workspace({ ...input, type: "workspace.applyCategoryRemoval" });
  }

  recoverCategoryRemoval(input: Omit<Extract<CategoryRemovalQuery | CategoryRemovalCommand, { type: "workspace.recoverCategoryRemoval" }>, "type">) {
    return this.api.workspace({ ...input, type: "workspace.recoverCategoryRemoval" });
  }

  listCategoryRemovals(input: Omit<Extract<CategoryRemovalQuery | CategoryRemovalCommand, { type: "workspace.listCategoryRemovals" }>, "type">) {
    return this.api.workspace({ ...input, type: "workspace.listCategoryRemovals" });
  }

  getCategoryRemoval(input: Omit<Extract<CategoryRemovalQuery | CategoryRemovalCommand, { type: "workspace.getCategoryRemoval" }>, "type">) {
    return this.api.workspace({ ...input, type: "workspace.getCategoryRemoval" });
  }

  previewCategoryRemovalRecovery(input: Omit<Extract<CategoryRemovalQuery | CategoryRemovalCommand, { type: "workspace.previewCategoryRemovalRecovery" }>, "type">) {
    return this.api.workspace({ ...input, type: "workspace.previewCategoryRemovalRecovery" });
  }

  previewCategoryRemoval(input: Omit<Extract<CategoryRemovalQuery, { type: "workspace.previewCategoryRemoval" }>, "type">) {
    return this.api.workspace({ ...input, type: "workspace.previewCategoryRemoval" });
  }

  previewCategoryFolder(input: Omit<Extract<CategoryOptionsQuery | CategoryOptionsCommand, { type: "workspace.previewCategoryFolder" }>, "type">) {
    return this.api.workspace({ ...input, type: "workspace.previewCategoryFolder" });
  }
  applyCategoryFolder(input: Omit<Extract<CategoryOptionsQuery | CategoryOptionsCommand, { type: "workspace.applyCategoryFolder" }>, "type">) {
    return this.api.workspace({ ...input, type: "workspace.applyCategoryFolder" });
  }
  listCategoryFolderOperations(input: Omit<Extract<CategoryOptionsQuery | CategoryOptionsCommand, { type: "workspace.listCategoryFolderOperations" }>, "type">) {
    return this.api.workspace({ ...input, type: "workspace.listCategoryFolderOperations" });
  }
  getCategoryFolderOperation(input: Omit<Extract<CategoryOptionsQuery | CategoryOptionsCommand, { type: "workspace.getCategoryFolderOperation" }>, "type">) {
    return this.api.workspace({ ...input, type: "workspace.getCategoryFolderOperation" });
  }
  previewCategoryFolderRecovery(input: Omit<Extract<CategoryOptionsQuery | CategoryOptionsCommand, { type: "workspace.previewCategoryFolderRecovery" }>, "type">) {
    return this.api.workspace({ ...input, type: "workspace.previewCategoryFolderRecovery" });
  }
  recoverCategoryFolder(input: Omit<Extract<CategoryOptionsQuery | CategoryOptionsCommand, { type: "workspace.recoverCategoryFolder" }>, "type">) {
    return this.api.workspace({ ...input, type: "workspace.recoverCategoryFolder" });
  }
  listCategoryPresentation(input: Omit<Extract<CategoryOptionsQuery | CategoryOptionsCommand, { type: "workspace.listCategoryPresentation" }>, "type">) {
    return this.api.workspace({ ...input, type: "workspace.listCategoryPresentation" });
  }
  setCategoryPresentation(input: Omit<Extract<CategoryOptionsQuery | CategoryOptionsCommand, { type: "workspace.setCategoryPresentation" }>, "type">) {
    return this.api.workspace({ ...input, type: "workspace.setCategoryPresentation" });
  }

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

  moveProjectCategory(input: Omit<WorkspaceMoveProjectCategoryCommand, "type">): Promise<ServiceResult<ProjectCategoryMoveResult>> {
    const { workspaceId, projectId, operationId, destinationCategoryId, expectedRevision } = input;
    return this.api.workspace({ type: "workspace.moveProjectCategory", workspaceId, projectId, operationId, destinationCategoryId, expectedRevision });
  }
  listProjectCategoryMoves(workspaceId: string): Promise<ServiceResult<ProjectCategoryMoveList>> {
    return this.api.workspace({ type: "workspace.listProjectCategoryMoves", workspaceId });
  }
  getProjectCategoryMove(workspaceId: string, operationId: string): Promise<ServiceResult<ProjectCategoryMoveResult>> {
    return this.api.workspace({ type: "workspace.getProjectCategoryMove", workspaceId, operationId });
  }
  previewProjectCategoryMoveRecovery(workspaceId: string, operationId: string): Promise<ServiceResult<ProjectCategoryMoveRecoveryPreview>> {
    return this.api.workspace({ type: "workspace.previewProjectCategoryMoveRecovery", workspaceId, operationId });
  }
  recoverProjectCategoryMove(workspaceId: string, operationId: string, previewToken: string, action: ProjectCategoryMoveRecoveryAction): Promise<ServiceResult<ProjectCategoryMoveResult>> {
    return this.api.workspace({ type: "workspace.recoverProjectCategoryMove", workspaceId, operationId, previewToken, action });
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
