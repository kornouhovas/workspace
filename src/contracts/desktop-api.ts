import type { ProjectCategoryMoveResult, ProjectCategoryMoveList, ProjectCategoryMoveRecoveryPreview, WorkspaceMoveProjectCategoryCommand, WorkspaceListProjectCategoryMovesQuery, WorkspaceGetProjectCategoryMoveQuery, WorkspacePreviewProjectCategoryMoveRecoveryQuery, WorkspaceRecoverProjectCategoryMoveCommand } from "./project-category-move.js";
import type { ProjectRenameResult, ProjectRenameList, ProjectRenameRecoveryPreview, WorkspaceRenameProjectCommand, WorkspaceListProjectRenamesQuery, WorkspaceGetProjectRenameQuery, WorkspacePreviewProjectRenameRecoveryQuery, WorkspaceRecoverProjectRenameCommand } from "./project-rename.js";
import type { ProjectRevealResult, WorkspaceRevealProjectCommand } from "./project-reveal.js";
import type { ProjectCreationResult, ProjectCreationList, ProjectCreationRecoveryPreview, WorkspaceCreateProjectCommand, WorkspaceListProjectCreationsQuery, WorkspaceGetProjectCreationQuery, WorkspacePreviewProjectCreationRecoveryQuery, WorkspaceRecoverProjectCreationCommand } from "./project-creation.js";
import type { ProjectRecoveryPreview, WorkspacePreviewProjectRecoveryQuery, WorkspaceReassociateProjectCommand } from "./project-recovery.js";
import type { TextPropertySnapshot, TextPropertyMutation, WorkspaceListTextPropertiesQuery, WorkspaceCreatePropertyCommand, WorkspaceRenamePropertyCommand, WorkspaceSetTextValueCommand } from "./text-properties.js";
import type { ServiceResult, Settings, SettingsCommand, SettingsQuery } from "./settings.js";
import type { CategoryPropertySnapshot, WorkspaceRenameCategoryPropertyCommand, ProjectList, WorkspaceApplyDiscoveryCommand, WorkspaceListProjectsQuery, DiscoveryPreview, WorkspacePreviewDiscoveryQuery, ActiveWorkspace, WorkspaceActivateCommand, WorkspaceCommand, WorkspaceCreateCommand, WorkspaceCreated, WorkspaceLoad, WorkspaceLoadQuery, WorkspaceQuery, WorkspaceRenameCommand, WorkspaceReorderCommand, WorkspaceRemoveCommand, WorkspaceRefreshSourceCommand, WorkspaceGetSourceObservationQuery, WorkspaceSourceObservationSnapshot, WorkspaceSourceState, WorkspaceChangeEvent } from "./workspaces.js";

export type BackendStatus = { state: "starting" | "ready" | "unavailable"; message?: string; diagnostic?: import("./startup-diagnostic.js").StartupDiagnostic };
export type SettingsRequest = SettingsQuery | SettingsCommand;
export type WorkspaceRequest = WorkspaceQuery | WorkspaceCommand;
export type WorkspaceResponse = ProjectCategoryMoveResult | ProjectCategoryMoveList | ProjectCategoryMoveRecoveryPreview | ProjectRenameResult | ProjectRenameList | ProjectRenameRecoveryPreview | ProjectRevealResult | ProjectCreationResult | ProjectCreationList | ProjectCreationRecoveryPreview | WorkspaceSourceObservationSnapshot | ProjectRecoveryPreview | CategoryPropertySnapshot | TextPropertySnapshot | TextPropertyMutation | ProjectList | DiscoveryPreview | WorkspaceLoad | WorkspaceCreated | ActiveWorkspace | WorkspaceSourceState;
export type RootPickerResult =
  | { outcome: "selected"; path: string }
  | { outcome: "cancelled" }
  | { outcome: "failed" };

export interface WorkspaceDesktopApi {
  getBackendStatus(): Promise<BackendStatus>;
  onBackendStatus(listener: (status: BackendStatus) => void): () => void;
  settings(input: SettingsRequest): Promise<ServiceResult<Settings>>;
  workspace(input: WorkspaceMoveProjectCategoryCommand): Promise<ServiceResult<ProjectCategoryMoveResult>>;
  workspace(input: WorkspaceListProjectCategoryMovesQuery): Promise<ServiceResult<ProjectCategoryMoveList>>;
  workspace(input: WorkspaceGetProjectCategoryMoveQuery): Promise<ServiceResult<ProjectCategoryMoveResult>>;
  workspace(input: WorkspacePreviewProjectCategoryMoveRecoveryQuery): Promise<ServiceResult<ProjectCategoryMoveRecoveryPreview>>;
  workspace(input: WorkspaceRecoverProjectCategoryMoveCommand): Promise<ServiceResult<ProjectCategoryMoveResult>>;
  workspace(input: WorkspaceRenameProjectCommand): Promise<ServiceResult<ProjectRenameResult>>;
  workspace(input: WorkspaceListProjectRenamesQuery): Promise<ServiceResult<ProjectRenameList>>;
  workspace(input: WorkspaceGetProjectRenameQuery): Promise<ServiceResult<ProjectRenameResult>>;
  workspace(input: WorkspacePreviewProjectRenameRecoveryQuery): Promise<ServiceResult<ProjectRenameRecoveryPreview>>;
  workspace(input: WorkspaceRecoverProjectRenameCommand): Promise<ServiceResult<ProjectRenameResult>>;
  workspace(input: WorkspaceRevealProjectCommand): Promise<ServiceResult<ProjectRevealResult>>;
  workspace(input: WorkspaceCreateProjectCommand): Promise<ServiceResult<ProjectCreationResult>>;
  workspace(input: WorkspaceRecoverProjectCreationCommand): Promise<ServiceResult<ProjectCreationResult>>;
  workspace(input: WorkspaceListProjectCreationsQuery): Promise<ServiceResult<ProjectCreationList>>;
  workspace(input: WorkspaceGetProjectCreationQuery): Promise<ServiceResult<ProjectCreationResult>>;
  workspace(input: WorkspacePreviewProjectCreationRecoveryQuery): Promise<ServiceResult<ProjectCreationRecoveryPreview>>;
  workspace(input: WorkspaceGetSourceObservationQuery): Promise<ServiceResult<WorkspaceSourceObservationSnapshot>>;
  workspace(input: WorkspacePreviewProjectRecoveryQuery): Promise<ServiceResult<ProjectRecoveryPreview>>;
  workspace(input: WorkspaceReassociateProjectCommand): Promise<ServiceResult<ProjectList>>;
  workspace(input: WorkspaceRenameCategoryPropertyCommand): Promise<ServiceResult<CategoryPropertySnapshot>>;
  workspace(input: WorkspaceListTextPropertiesQuery): Promise<ServiceResult<TextPropertySnapshot>>;
  workspace(input: WorkspaceCreatePropertyCommand): Promise<ServiceResult<TextPropertyMutation>>;
  workspace(input: WorkspaceSetTextValueCommand): Promise<ServiceResult<TextPropertyMutation>>;
  workspace(input: WorkspaceRenamePropertyCommand): Promise<ServiceResult<TextPropertyMutation>>;
  workspace(input: WorkspaceApplyDiscoveryCommand): Promise<ServiceResult<ProjectList>>;
  workspace(input: WorkspaceListProjectsQuery): Promise<ServiceResult<ProjectList>>;
  workspace(input: WorkspacePreviewDiscoveryQuery): Promise<ServiceResult<DiscoveryPreview>>;
  workspace(input: WorkspaceLoadQuery): Promise<ServiceResult<WorkspaceLoad>>;
  workspace(input: WorkspaceCreateCommand): Promise<ServiceResult<WorkspaceCreated>>;
  workspace(input: WorkspaceActivateCommand): Promise<ServiceResult<ActiveWorkspace>>;
  workspace(input: WorkspaceRenameCommand): Promise<ServiceResult<WorkspaceLoad>>;
  workspace(input: WorkspaceReorderCommand): Promise<ServiceResult<WorkspaceLoad>>;
  workspace(input: WorkspaceRemoveCommand): Promise<ServiceResult<WorkspaceLoad>>;
  workspace(input: WorkspaceRefreshSourceCommand): Promise<ServiceResult<WorkspaceSourceState>>;
  workspace(input: WorkspaceRequest): Promise<ServiceResult<WorkspaceResponse>>;
  onWorkspaceChange(listener: (event: WorkspaceChangeEvent) => void): () => void;
  pickRoot(): Promise<RootPickerResult>;
}

declare global {
  interface Window {
    workspace: WorkspaceDesktopApi;
  }
}
