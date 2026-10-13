import type { ArchiveQuery, ArchiveCommand } from "./project-archive.js";
import type { CategoryRemovalQuery, CategoryRemovalCommand } from "./category-removal.js";
import type { CategoryOptionsQuery, CategoryOptionsCommand } from "./category-options.js";
import type { WorkspaceMoveProjectCategoryCommand, WorkspaceListProjectCategoryMovesQuery, WorkspaceGetProjectCategoryMoveQuery, WorkspacePreviewProjectCategoryMoveRecoveryQuery, WorkspaceRecoverProjectCategoryMoveCommand } from "./project-category-move.js";
import type { WorkspaceRenameProjectCommand, WorkspaceListProjectRenamesQuery, WorkspaceGetProjectRenameQuery, WorkspacePreviewProjectRenameRecoveryQuery, WorkspaceRecoverProjectRenameCommand } from "./project-rename.js";
import type { WorkspaceRevealProjectCommand } from "./project-reveal.js";
import type { WorkspaceCreateProjectCommand, WorkspaceListProjectCreationsQuery, WorkspaceGetProjectCreationQuery, WorkspacePreviewProjectCreationRecoveryQuery, WorkspaceRecoverProjectCreationCommand } from "./project-creation.js";
import type { WorkspacePreviewProjectRecoveryQuery, WorkspaceReassociateProjectCommand } from "./project-recovery.js";
import type { WorkspaceListTextPropertiesQuery, WorkspaceCreatePropertyCommand, WorkspaceRenamePropertyCommand, WorkspaceSetTextValueCommand } from "./text-properties.js";

export type WorkspaceCreateCommand = {
  type: "workspace.create";
  name: string;
  rootPath: string;
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

export type WorkspaceQuery = ArchiveQuery | CategoryRemovalQuery | CategoryOptionsQuery | WorkspaceListProjectCategoryMovesQuery | WorkspaceGetProjectCategoryMoveQuery | WorkspacePreviewProjectCategoryMoveRecoveryQuery | WorkspaceListProjectRenamesQuery | WorkspaceGetProjectRenameQuery | WorkspacePreviewProjectRenameRecoveryQuery | WorkspaceListProjectCreationsQuery | WorkspaceGetProjectCreationQuery | WorkspacePreviewProjectCreationRecoveryQuery | WorkspaceGetSourceObservationQuery | WorkspacePreviewProjectRecoveryQuery | WorkspaceListTextPropertiesQuery | WorkspaceLoadQuery | WorkspacePreviewDiscoveryQuery | WorkspaceListProjectsQuery;
export type WorkspaceCommand = ArchiveCommand | CategoryRemovalCommand | CategoryOptionsCommand | WorkspaceMoveProjectCategoryCommand | WorkspaceRecoverProjectCategoryMoveCommand | WorkspaceRenameProjectCommand | WorkspaceRecoverProjectRenameCommand | WorkspaceRevealProjectCommand | WorkspaceCreateProjectCommand | WorkspaceRecoverProjectCreationCommand | WorkspaceReassociateProjectCommand | WorkspaceRenameCategoryPropertyCommand | WorkspaceSetTextValueCommand | WorkspaceCreatePropertyCommand | WorkspaceRenamePropertyCommand | WorkspaceCreateCommand | WorkspaceActivateCommand | WorkspaceRenameCommand | WorkspaceReorderCommand | WorkspaceRemoveCommand | WorkspaceRefreshSourceCommand | WorkspaceApplyDiscoveryCommand;

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
  state: "ready" | "empty" | "unavailable" | "unreadable" | "root_identity_conflict" | "changed";
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
  excludedRelativePaths?: string[];
  mode?: DiscoveryMode;
};

export type WorkspaceApplyDiscoveryCommand = {
  type: "workspace.applyDiscovery";
  workspaceId: string;
  previewToken: string;
};
export type WorkspaceListProjectsQuery = { type: "workspace.listProjects"; workspaceId: string };
export interface CategorySummary {
  presentation?: import("./category-options.js").CategoryPresentation;
  categoryId: string;
  name: string;
  relativePath: string;
}
export interface CategoryProperty {
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
  retentionReason?: "mode_change" | null;
  associationState: ProjectAssociationState;
  // Null means the source scan could not safely establish individual resolution.
  resolution: ProjectAssociationState | null;
  categoryName: string | null;
}
export interface ProjectList {
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
