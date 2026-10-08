import { contextBridge, ipcRenderer } from "electron";
import type { BackendStatus, WorkspaceDesktopApi } from "../contracts/desktop-api.js";

const api: WorkspaceDesktopApi = {
  getBackendStatus: () => ipcRenderer.invoke("workspace:backend-status"),
  settings: (input) => ipcRenderer.invoke("workspace:settings", input),
  onBackendStatus(listener) {
    const handler = (_event: Electron.IpcRendererEvent, status: BackendStatus) => listener(status);
    ipcRenderer.on("workspace:backend-status", handler);
    return () => ipcRenderer.removeListener("workspace:backend-status", handler);
  },
};

contextBridge.exposeInMainWorld("workspace", api);
