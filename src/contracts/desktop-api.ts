import type { MetadataRemovalPreview, MetadataRemovalResult } from "./metadata-removal.js";
import type { BoardLayoutSnapshot } from "./board-layout.js";
import type { TableLayoutSnapshot } from "./table-layout.js";
import type { ViewGroupingSnapshot } from "./view-grouping.js";
import type { ViewFilterQuery, ViewFilterCommand, ViewFilterPayload, ViewFilterSnapshot, ViewFilterResult } from "./view-filters.js";
import type { ViewSnapshot, ViewQuery, ViewCommand } from "./views.js";
import type { SelectCommand } from "./text-properties.js";
import type { ProjectArchivePreview, ProjectArchiveResult, ProjectArchiveOperationList, ProjectArchiveRecoveryPreview } from "./project-archive.js";
import type { ArchiveQuery, ArchiveCommand, ArchiveSnapshot, ArchiveLocationPreview } from "./project-archive.js";
import type { ArchivePayload } from "./project-archive.js";
import type { CategoryRemovalQuery, CategoryRemovalCommand, CategoryRemovalPreview, CategoryRemovalPayload, CategoryRemovalLookup, CategoryRemovalResult, CategoryRemovalList, CategoryRemovalRecoveryPreview } from "./category-removal.js";
import type { CategoryOptionsQuery, CategoryOptionsCommand, CategoryFolderPreview, CategoryFolderResult, CategoryFolderStatus, CategoryFolderRecoveryPreview, CategoryPresentationSnapshot } from "./category-options.js";
import type { CategoryOptionsPayload } from "./category-options.js";
import type { ProjectCategoryMoveResult, ProjectCategoryMoveList, ProjectCategoryMoveRecoveryPreview, WorkspaceMoveProjectCategoryCommand, WorkspaceListProjectCategoryMovesQuery, WorkspaceGetProjectCategoryMoveQuery, WorkspacePreviewProjectCategoryMoveRecoveryQuery, WorkspaceRecoverProjectCategoryMoveCommand } from "./project-category-move.js";
import type { ProjectRenameResult, ProjectRenameList, ProjectRenameRecoveryPreview, WorkspaceRenameProjectCommand, WorkspaceListProjectRenamesQuery, WorkspaceGetProjectRenameQuery, WorkspacePreviewProjectRenameRecoveryQuery, WorkspaceRecoverProjectRenameCommand } from "./project-rename.js";
import type { ProjectRevealResult, WorkspaceRevealProjectCommand } from "./project-reveal.js";
import type { ProjectCreationResult, ProjectCreationList, ProjectCreationRecoveryPreview, WorkspaceCreateProjectCommand, WorkspaceListProjectCreationsQuery, WorkspaceGetProjectCreationQuery, WorkspacePreviewProjectCreationRecoveryQuery, WorkspaceRecoverProjectCreationCommand } from "./project-creation.js";
import type { ProjectRecoveryPreview, WorkspacePreviewProjectRecoveryQuery, WorkspaceReassociateProjectCommand } from "./project-recovery.js";
import type { TextPropertySnapshot, TextPropertyMutation, WorkspaceListTextPropertiesQuery, WorkspaceCreatePropertyCommand, WorkspaceRenamePropertyCommand, WorkspaceSetTextValueCommand, WorkspaceSetNumberValueCommand, WorkspaceSetDateValueCommand } from "./text-properties.js";
import type { ServiceResult, Settings, SettingsCommand, SettingsQuery } from "./settings.js";
import type { CategoryPropertySnapshot, WorkspaceRenameCategoryPropertyCommand, ProjectList, WorkspaceApplyDiscoveryCommand, WorkspaceListProjectsQuery, DiscoveryPreview, WorkspacePreviewDiscoveryQuery, ActiveWorkspace, WorkspaceActivateCommand, WorkspaceCommand, WorkspaceCreateCommand, WorkspaceCreated, WorkspaceLoad, WorkspaceLoadQuery, WorkspaceQuery, WorkspaceRenameCommand, WorkspaceReorderCommand, WorkspaceRemoveCommand, WorkspaceRefreshSourceCommand, WorkspaceGetSourceObservationQuery, WorkspaceSourceObservationSnapshot, WorkspaceSourceState, WorkspaceChangeEvent } from "./workspaces.js";

export type BackendStatus = { state: "starting" | "ready" | "unavailable"; message?: string; diagnostic?: import("./startup-diagnostic.js").StartupDiagnostic };
export type SettingsRequest = SettingsQuery | SettingsCommand;
export type WorkspaceRequest = WorkspaceQuery | WorkspaceCommand;
export type WorkspaceResponse = MetadataRemovalPreview | MetadataRemovalResult | BoardLayoutSnapshot | TableLayoutSnapshot | ViewGroupingSnapshot | ViewFilterPayload | ViewSnapshot | ArchivePayload | CategoryRemovalPayload | CategoryOptionsPayload | ProjectCategoryMoveResult | ProjectCategoryMoveList | ProjectCategoryMoveRecoveryPreview | ProjectRenameResult | ProjectRenameList | ProjectRenameRecoveryPreview | ProjectRevealResult | ProjectCreationResult | ProjectCreationList | ProjectCreationRecoveryPreview | WorkspaceSourceObservationSnapshot | ProjectRecoveryPreview | CategoryPropertySnapshot | TextPropertySnapshot | TextPropertyMutation | ProjectList | DiscoveryPreview | WorkspaceLoad | WorkspaceCreated | ActiveWorkspace | WorkspaceSourceState;
export type RootPickerResult =
  | { outcome: "selected"; path: string }
  | { outcome: "cancelled" }
  | { outcome: "failed" };

export interface WorkspaceDesktopApi {
  workspace(input: import("./metadata-removal.js").PreviewMetadataRemoval): Promise<ServiceResult<MetadataRemovalPreview>>;
  workspace(input: import("./metadata-removal.js").ApplyMetadataRemoval): Promise<ServiceResult<MetadataRemovalResult>>;
  workspace(input: import("./group-assignment.js").AssignProjectGroupCommand): Promise<ServiceResult<import("./group-assignment.js").GroupAssignmentResult>>;
  workspace(input: import("./board-layout.js").BoardLayoutQuery | import("./board-layout.js").BoardLayoutCommand): Promise<ServiceResult<BoardLayoutSnapshot>>;
  workspace(input: import("./table-layout.js").TableLayoutQuery | import("./table-layout.js").TableLayoutCommand): Promise<ServiceResult<TableLayoutSnapshot>>;
  workspace(input: Extract<ArchiveQuery, { type: "workspace.previewProjectArchive" }>): Promise<ServiceResult<ProjectArchivePreview>>;
  workspace(input: Extract<ArchiveQuery, { type: "workspace.listProjectArchiveOperations" }>): Promise<ServiceResult<ProjectArchiveOperationList>>;
  workspace(input: Extract<ArchiveQuery, { type: "workspace.getProjectArchiveOperation" }> | Extract<ArchiveCommand, { type: "workspace.applyProjectArchive" | "workspace.recoverProjectArchive" }>): Promise<ServiceResult<ProjectArchiveResult>>;
  workspace(input: Extract<ArchiveQuery, { type: "workspace.previewProjectArchiveRecovery" }>): Promise<ServiceResult<ProjectArchiveRecoveryPreview>>;
  workspace(input: Extract<ArchiveQuery, { type: "workspace.previewArchiveLocation" }>): Promise<ServiceResult<ArchiveLocationPreview>>;
  workspace(input: Extract<ArchiveQuery, { type: "workspace.listArchivedProjects" }> | Extract<ArchiveCommand, { type: "workspace.applyArchiveLocation" }>): Promise<ServiceResult<ArchiveSnapshot>>;
  workspace(input: Extract<CategoryRemovalQuery, { type: "workspace.previewCategoryRemoval" }>): Promise<ServiceResult<CategoryRemovalPreview>>;
  workspace(input: Extract<CategoryRemovalQuery, { type: "workspace.listCategoryRemovals" }>): Promise<ServiceResult<CategoryRemovalList>>;
  workspace(input: Extract<CategoryRemovalQuery, { type: "workspace.getCategoryRemoval" }>): Promise<ServiceResult<CategoryRemovalLookup>>;
  workspace(input: Extract<CategoryRemovalQuery, { type: "workspace.previewCategoryRemovalRecovery" }>): Promise<ServiceResult<CategoryRemovalRecoveryPreview>>;
  workspace(input: CategoryRemovalCommand): Promise<ServiceResult<CategoryRemovalResult>>;
  workspace(input: Extract<CategoryOptionsQuery, { type: "workspace.getCategoryFolderOperation" }>): Promise<ServiceResult<CategoryFolderResult>>;
  workspace(input: Extract<CategoryOptionsQuery | CategoryOptionsCommand, { type: "workspace.previewCategoryFolder" }>): Promise<ServiceResult<CategoryFolderPreview>>;
  workspace(input: Extract<CategoryOptionsQuery | CategoryOptionsCommand, { type: "workspace.applyCategoryFolder" }>): Promise<ServiceResult<CategoryFolderResult>>;
  workspace(input: Extract<CategoryOptionsQuery | CategoryOptionsCommand, { type: "workspace.listCategoryFolderOperations" }>): Promise<ServiceResult<CategoryFolderStatus>>;
  workspace(input: Extract<CategoryOptionsQuery | CategoryOptionsCommand, { type: "workspace.previewCategoryFolderRecovery" }>): Promise<ServiceResult<CategoryFolderRecoveryPreview>>;
  workspace(input: Extract<CategoryOptionsQuery | CategoryOptionsCommand, { type: "workspace.recoverCategoryFolder" }>): Promise<ServiceResult<CategoryFolderResult>>;
  workspace(input: Extract<CategoryOptionsQuery | CategoryOptionsCommand, { type: "workspace.listCategoryPresentation" }>): Promise<ServiceResult<CategoryPresentationSnapshot>>;
  workspace(input: Extract<CategoryOptionsQuery | CategoryOptionsCommand, { type: "workspace.setCategoryPresentation" }>): Promise<ServiceResult<CategoryPresentationSnapshot>>;

  recovery(input: import("./data-recovery.js").DataRecoveryRequest): Promise<ServiceResult<import("./data-recovery.js").DataRecoveryPayload>>;
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
  workspace(input: import("./view-grouping.js").ViewGroupingQuery | import("./view-grouping.js").ViewGroupingCommand): Promise<ServiceResult<ViewGroupingSnapshot>>;
  workspace(input: Extract<ViewFilterQuery, { type: "workspace.getViewFilter" }> | ViewFilterCommand): Promise<ServiceResult<ViewFilterSnapshot>>;
  workspace(input: Extract<ViewFilterQuery, { type: "workspace.queryView" }>): Promise<ServiceResult<ViewFilterResult>>;
  workspace(input: ViewQuery | ViewCommand): Promise<ServiceResult<ViewSnapshot>>;
  workspace(input: SelectCommand): Promise<ServiceResult<TextPropertyMutation>>;
  workspace(input: WorkspaceSetDateValueCommand): Promise<ServiceResult<TextPropertyMutation>>;
  workspace(input: WorkspaceSetNumberValueCommand): Promise<ServiceResult<TextPropertyMutation>>;
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
