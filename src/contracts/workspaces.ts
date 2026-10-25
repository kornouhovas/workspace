import type { BoardLayoutQuery, BoardLayoutCommand } from "./board-layout.js";
import type { TableLayoutQuery, TableLayoutCommand } from "./table-layout.js";
import type { ViewFilterQuery, ViewFilterCommand } from "./view-filters.js";
import type { ViewCommand, ViewQuery } from "./views.js";
import type { SelectCommand } from "./text-properties.js";
import type { ArchiveQuery, ArchiveCommand } from "./project-archive.js";
import type { CategoryRemovalQuery, CategoryRemovalCommand } from "./category-removal.js";
import type { CategoryOptionsQuery, CategoryOptionsCommand } from "./category-options.js";
import type { WorkspaceMoveProjectCategoryCommand, WorkspaceListProjectCategoryMovesQuery, WorkspaceGetProjectCategoryMoveQuery, WorkspacePreviewProjectCategoryMoveRecoveryQuery, WorkspaceRecoverProjectCategoryMoveCommand } from "./project-category-move.js";
import type { WorkspaceRenameProjectCommand, WorkspaceListProjectRenamesQuery, WorkspaceGetProjectRenameQuery, WorkspacePreviewProjectRenameRecoveryQuery, WorkspaceRecoverProjectRenameCommand } from "./project-rename.js";
import type { WorkspaceRevealProjectCommand } from "./project-reveal.js";
import type { WorkspaceCreateProjectCommand, WorkspaceListProjectCreationsQuery, WorkspaceGetProjectCreationQuery, WorkspacePreviewProjectCreationRecoveryQuery, WorkspaceRecoverProjectCreationCommand } from "./project-creation.js";
import type { WorkspacePreviewProjectRecoveryQuery, WorkspaceReassociateProjectCommand } from "./project-recovery.js";
import type { WorkspaceListTextPropertiesQuery, WorkspaceCreatePropertyCommand, WorkspaceRenamePropertyCommand, WorkspaceSetTextValueCommand, WorkspaceSetNumberValueCommand, WorkspaceSetDateValueCommand } from "./text-properties.js";

export type WorkspaceCreateCommand = {
  type: "workspace.create";
  name: string;
  rootPath: string;
  /** Folder-first desktop flow; omission retains staged setup for existing callers. */
  initialize?: "status";
};

export type WorkspaceLoadQuery = { type: "workspace.load" };

export type WorkspaceActivateCommand = {
  type: "workspace.activate";
  workspaceId: string;
};

export type WorkspaceRenameCommand = {
  type: "workspace.rename";
  workspaceId: string;
  name: string;
};

export type WorkspaceReorderCommand = {
  type: "workspace.reorder";
  workspaceIds: string[];
};

export type WorkspaceRemoveCommand = {
  type: "workspace.remove";
  workspaceId: string;
};

export type WorkspaceRefreshSourceCommand = {
  type: "workspace.refreshSource";
  workspaceId: string;
};

export interface WorkspaceSourceState {
  sourceId: string;
  workspaceIds: string[];
  canonicalRoot: string;
  sourceAvailable: boolean;
}

export type WorkspaceChangeEvent =
  | { type: "workspace.listChanged"; snapshot: WorkspaceLoad }
  | { type: "workspace.sourceChanged"; source: WorkspaceSourceState }
  | { type: "workspace.sourceObserved"; sourceId: string; workspaceIds: string[]; observationRevision: number;
      state: DiscoveryPreview["state"]; automaticUpdates: "active" | "degraded" }
  | { type: "workspace.propertiesChanged"; sourceId: string; workspaceIds: string[]; revision: number }
  | { type: "workspace.categoryPropertyChanged"; sourceId: string; workspaceIds: string[]; revision: number }
  | { type: "workspace.categoryPresentationChanged"; sourceId: string; workspaceIds: string[] }
  | { type: "workspace.projectsChanged"; sourceId: string; workspaceIds: string[]; revision: number };

export type WorkspaceSourceObservation = Extract<WorkspaceChangeEvent, { type: "workspace.sourceObserved" }>;
export type WorkspaceSourceObservationSnapshot = { observation: WorkspaceSourceObservation | null };
export type WorkspaceGetSourceObservationQuery = { type: "workspace.getSourceObservation"; workspaceId: string };

import type { ViewGroupingQuery, ViewGroupingCommand } from "./view-grouping.js";
export type WorkspaceQuery = WorkspaceGetFolderChildrenQuery | import("./source-association.js").SourceAssociationQuery | import("./workspace-sessions.js").WorkspaceSessionQuery | import("./project-files.js").ProjectFilesQuery | WorkspaceListSourcesQuery | import("./metadata-removal.js").PreviewMetadataRemoval | BoardLayoutQuery | TableLayoutQuery | ViewGroupingQuery | ViewFilterQuery | ViewQuery | ArchiveQuery | CategoryRemovalQuery | CategoryOptionsQuery | WorkspaceListProjectCategoryMovesQuery | WorkspaceGetProjectCategoryMoveQuery | WorkspacePreviewProjectCategoryMoveRecoveryQuery | WorkspaceListProjectRenamesQuery | WorkspaceGetProjectRenameQuery | WorkspacePreviewProjectRenameRecoveryQuery | WorkspaceListProjectCreationsQuery | WorkspaceGetProjectCreationQuery | WorkspacePreviewProjectCreationRecoveryQuery | WorkspaceGetSourceObservationQuery | WorkspacePreviewProjectRecoveryQuery | WorkspaceListTextPropertiesQuery | WorkspaceLoadQuery | WorkspacePreviewDiscoveryQuery | WorkspaceListProjectsQuery;
export type WorkspaceCommand = import("./source-association.js").SourceAssociationCommand | import("./workspace-sessions.js").WorkspaceSessionCommand | import("./project-files.js").ProjectFileCommand | import("./metadata-removal.js").ApplyMetadataRemoval | import("./group-assignment.js").AssignProjectGroupCommand | BoardLayoutCommand | TableLayoutCommand | ViewGroupingCommand | ViewFilterCommand | ViewCommand | SelectCommand | ArchiveCommand | CategoryRemovalCommand | CategoryOptionsCommand | WorkspaceMoveProjectCategoryCommand | WorkspaceRecoverProjectCategoryMoveCommand | WorkspaceRenameProjectCommand | WorkspaceRecoverProjectRenameCommand | WorkspaceRevealProjectCommand | WorkspaceCreateProjectCommand | WorkspaceRecoverProjectCreationCommand | WorkspaceReassociateProjectCommand | WorkspaceRenameCategoryPropertyCommand | WorkspaceSetDateValueCommand | WorkspaceSetNumberValueCommand | WorkspaceSetTextValueCommand | WorkspaceCreatePropertyCommand | WorkspaceRenamePropertyCommand | WorkspaceCreateCommand | WorkspaceActivateCommand | WorkspaceRenameCommand | WorkspaceReorderCommand | WorkspaceRemoveCommand | WorkspaceRefreshSourceCommand | WorkspaceApplyDiscoveryCommand;

export interface WorkspaceSummary {
  workspaceId: string;
  name: string;
}

export interface ActiveWorkspace {
  workspaceId: string;
  sourceId: string;
  canonicalRoot: string;
  viewId: string;
  name: string;
  sourceAvailable: boolean;
}

export interface WorkspaceLoad {
  workspaces: WorkspaceSummary[];
  activeWorkspace: ActiveWorkspace | null;
}

export interface WorkspaceCreated {
  sourceId: string;
  workspaceId: string;
  viewId: string;
  name: string;
  canonicalRoot: string;
}

export type DiscoveryExclusionReason = "manual" | "link" | "hidden" | "service" | "archive" | "unresolved";
export type FolderRole = "group" | "status" | "project";
export interface FolderRoleOverride { relativePath: string; role: FolderRole }
export type DiscoveryMode = "direct" | "grouped";
interface DiscoveryEntryBase {
  relativePath: string;
  name: string;
  reason: DiscoveryExclusionReason | null;
}
export type DiscoveryEntry = DiscoveryEntryBase & (
  | { kind: "category"; empty: boolean }
  | { kind: "project"; categoryPath: string | null }
);
export interface DiscoveryPreview {
  affectedWorkspaces?: WorkspaceSummary[];
  folderRoles?: FolderRoleOverride[];
  mode: DiscoveryMode;
  currentMode: DiscoveryMode | null;
  projectEffects: DiscoveryProjectEffects;
  categoryAvailability: {
    current: boolean;
    target: boolean;
    propertyId: string | null;
    name: string | null;
  };
  configured: boolean;
  workspaceId: string;
  sourceId: string;
  revision: number;
  canonicalRoot: string;
  excludedRelativePaths: string[];
  effectiveExcludedRelativePaths: string[];
  inactiveExcludedRelativePaths: string[];
  entries: DiscoveryEntry[];
  state: "ready" | "empty" | "unavailable" | "unreadable" | "root_identity_conflict" | "changed" | "association_review_required" | "different_volume" | "identity_unverified";
  previewToken: string | null;
}
export interface DiscoveryProjectEffects {
  // A new target has no logical identity until Apply commits it.
  added: { relativePath: string; name: string; categoryPath: string | null }[];
  retained: ProjectSummary[];
  noLongerRecognized: ProjectSummary[];
  alreadyRetained: ProjectSummary[];
}
export type WorkspacePreviewDiscoveryQuery = {
  type: "workspace.previewDiscovery";
  workspaceId: string;
  folderRoles?: FolderRoleOverride[];
  excludedRelativePaths?: string[];
  mode?: DiscoveryMode;
};

export type WorkspaceApplyDiscoveryCommand = {
  type: "workspace.applyDiscovery";
  workspaceId: string;
  previewToken: string;
};
export type WorkspaceListProjectsQuery = { type: "workspace.listProjects"; workspaceId: string; observed?: true };
export interface CategorySummary {
  statusMoveUnavailable?: "nested_status";
  presentation?: import("./category-options.js").CategoryPresentation;
  categoryId: string;
  name: string;
  relativePath: string;
}
export interface CategoryProperty {
  /** Omission preserves the legacy Category default. Authored names take precedence. */
  defaultLabel?: "status";
  propertyId: string;
  sourceId: string;
  name: string | null;
}
export interface ProjectSummary {
  categoryId: string | null;
  projectId: string;
  name: string;
  relativePath: string;
}
export type ProjectAssociationState = "active" | "excluded" | "missing" | "unresolved" | "replaced";
export interface ProjectAssociationSummary extends ProjectSummary {
  identityReason?: import("./source-association.js").FolderIdentityReason;
  retentionReason?: "mode_change" | null;
  associationState: ProjectAssociationState;
  // Null means the source scan could not safely establish individual resolution.
  resolution: ProjectAssociationState | null;
  categoryName: string | null;
}
export interface ProjectList {
  projectParents?: {relativePath:string;role:"group"|"status"}[];
  mode: DiscoveryMode | null;
  categories: CategorySummary[];
  categoryProperty: CategoryProperty | null;
  categoryPropertyRevision: number;
  workspaceId: string;
  sourceId: string;
  revision: number;
  configured: boolean;
  state: DiscoveryPreview["state"];
  projects: ProjectAssociationSummary[];
  retainedProjects: ProjectAssociationSummary[];
  retainedCount: number;
}

export type WorkspaceRenameCategoryPropertyCommand = {
  type: "workspace.renameCategoryProperty";
  workspaceId: string;
  propertyId: string;
  name: string;
};
export interface CategoryPropertySnapshot {
  workspaceId: string;
  sourceId: string;
  propertyId: string;
  name: string;
  revision: number;
}

export interface SourceSettingsSummary {
  sourceId: string;
  canonicalRoot: string;
  sourceAvailable: boolean;
  mode: DiscoveryMode | null;
  excludedRelativePaths: string[];
  archiveRelativePath: string | null;
  workspaces: WorkspaceSummary[];
}
export interface SourceSettingsList { sources: SourceSettingsSummary[] }
export type WorkspaceListSourcesQuery = { type: "workspace.listSources" };

export type WorkspaceGetFolderChildrenQuery = { type: "workspace.getFolderChildren"; workspaceId: string; parentRelativePath: string };
export interface FolderChildren {
  sourceId: string; canonicalRoot: string; mode: DiscoveryMode; revision: number;
  state: DiscoveryPreview["state"]; folderRoles: FolderRoleOverride[];
  excludedRelativePaths: string[]; affectedWorkspaces: WorkspaceSummary[];
  children: { relativePath: string; name: string; role: FolderRole; reason: DiscoveryExclusionReason | null }[];
}
