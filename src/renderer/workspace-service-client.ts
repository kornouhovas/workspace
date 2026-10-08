import type { BackendStatus, WorkspaceDesktopApi } from "../contracts/desktop-api.js";
import type { Language, ServiceResult, Settings } from "../contracts/settings.js";

export class WorkspaceServiceClient {
  constructor(private readonly api: WorkspaceDesktopApi = window.workspace) {}

  getBackendStatus(): Promise<BackendStatus> {
    return this.api.getBackendStatus();
  }

  onBackendStatus(listener: (status: BackendStatus) => void): () => void {
    return this.api.onBackendStatus(listener);
  }

  loadSettings(): Promise<ServiceResult<Settings>> {
    return this.api.settings({ type: "settings.load" });
  }

  setLanguage(language: Language): Promise<ServiceResult<Settings>> {
    return this.api.settings({ type: "settings.setLanguage", language });
  }
}
