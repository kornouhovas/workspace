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
  | { type: "workspace.sourceChanged"; source: WorkspaceSourceState };

export type WorkspaceQuery = WorkspaceLoadQuery | WorkspacePreviewDiscoveryQuery;
export type WorkspaceCommand = WorkspaceCreateCommand | WorkspaceActivateCommand | WorkspaceRenameCommand | WorkspaceReorderCommand | WorkspaceRemoveCommand | WorkspaceRefreshSourceCommand;

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

export type DiscoveryExclusionReason = "manual" | "link" | "hidden" | "service" | "archive";
export interface DiscoveryEntry {
  relativePath: string;
  name: string;
  reason: DiscoveryExclusionReason | null;
}
export interface DiscoveryPreview {
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
};
