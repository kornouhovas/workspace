import type { ServiceError, ServiceResult } from "./settings.js";

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

export type WorkspaceQuery = WorkspaceLoadQuery;
export type WorkspaceCommand = WorkspaceCreateCommand | WorkspaceActivateCommand;

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

export type WorkspaceResult<T> = ServiceResult<T>;

export type WorkspaceOperationError = ServiceError;
