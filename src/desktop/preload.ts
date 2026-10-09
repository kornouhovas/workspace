import { contextBridge, ipcRenderer } from "electron";
import type { BackendStatus, WorkspaceDesktopApi } from "../contracts/desktop-api.js";

const api: WorkspaceDesktopApi = {
  getBackendStatus: () => ipcRenderer.invoke("workspace:backend-status"),
  settings: (input) => ipcRenderer.invoke("workspace:settings", input),
  workspace: (input) => ipcRenderer.invoke("workspace:command", input),
  pickRoot: () => ipcRenderer.invoke("workspace:pick-root"),
  onBackendStatus(listener) {
    const handler = (_event: Electron.IpcRendererEvent, status: BackendStatus) => listener(status);
    ipcRenderer.on("workspace:backend-status", handler);
    return () => ipcRenderer.removeListener("workspace:backend-status", handler);
  },
};

contextBridge.exposeInMainWorld("workspace", api);
