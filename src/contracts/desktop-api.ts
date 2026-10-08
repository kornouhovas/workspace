import type { ServiceResult, Settings, SettingsCommand, SettingsQuery } from "./settings.js";

export type BackendStatus = { state: "starting" | "ready" | "unavailable"; message?: string };
export type SettingsRequest = SettingsQuery | SettingsCommand;

export interface WorkspaceDesktopApi {
  getBackendStatus(): Promise<BackendStatus>;
  onBackendStatus(listener: (status: BackendStatus) => void): () => void;
  settings(input: SettingsRequest): Promise<ServiceResult<Settings>>;
}

declare global {
  interface Window {
    workspace: WorkspaceDesktopApi;
  }
}
