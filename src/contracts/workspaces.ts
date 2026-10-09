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

export type WorkspaceQuery = WorkspaceLoadQuery;
export type WorkspaceCommand = WorkspaceCreateCommand | WorkspaceActivateCommand | WorkspaceRenameCommand | WorkspaceReorderCommand | WorkspaceRemoveCommand;

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
