import type { ServiceResult, Settings, SettingsCommand, SettingsQuery } from "./settings.js";
import type { ActiveWorkspace, WorkspaceActivateCommand, WorkspaceCommand, WorkspaceCreateCommand, WorkspaceCreated, WorkspaceLoad, WorkspaceLoadQuery, WorkspaceQuery, WorkspaceRenameCommand, WorkspaceReorderCommand, WorkspaceRemoveCommand, WorkspaceRefreshSourceCommand, WorkspaceSourceState, WorkspaceChangeEvent } from "./workspaces.js";

export type BackendStatus = { state: "starting" | "ready" | "unavailable"; message?: string };
export type SettingsRequest = SettingsQuery | SettingsCommand;
export type WorkspaceRequest = WorkspaceQuery | WorkspaceCommand;
export type WorkspaceResponse = WorkspaceLoad | WorkspaceCreated | ActiveWorkspace | WorkspaceSourceState;
export type RootPickerResult =
  | { outcome: "selected"; path: string }
  | { outcome: "cancelled" }
  | { outcome: "failed" };

export interface WorkspaceDesktopApi {
  getBackendStatus(): Promise<BackendStatus>;
  onBackendStatus(listener: (status: BackendStatus) => void): () => void;
  settings(input: SettingsRequest): Promise<ServiceResult<Settings>>;
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
