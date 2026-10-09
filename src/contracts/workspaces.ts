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
  | { type: "workspace.propertiesChanged"; sourceId: string; workspaceIds: string[]; revision: number }
  | { type: "workspace.categoryPropertyChanged"; sourceId: string; workspaceIds: string[]; revision: number }
  | { type: "workspace.projectsChanged"; sourceId: string; workspaceIds: string[]; revision: number };

export type WorkspaceQuery = WorkspaceListTextPropertiesQuery | WorkspaceLoadQuery | WorkspacePreviewDiscoveryQuery | WorkspaceListProjectsQuery;
export type WorkspaceCommand = WorkspaceRenameCategoryPropertyCommand | WorkspaceSetTextValueCommand | WorkspaceCreatePropertyCommand | WorkspaceRenamePropertyCommand | WorkspaceCreateCommand | WorkspaceActivateCommand | WorkspaceRenameCommand | WorkspaceReorderCommand | WorkspaceRemoveCommand | WorkspaceRefreshSourceCommand | WorkspaceApplyDiscoveryCommand;

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
  configured: boolean;
  workspaceId: string;
  sourceId: string;
  revision: number;
  canonicalRoot: string;
  excludedRelativePaths: string[];
  entries: DiscoveryEntry[];
  state: "ready" | "empty" | "unavailable" | "unreadable" | "root_identity_conflict" | "changed";
  previewToken: string | null;
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
