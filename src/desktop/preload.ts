import { contextBridge, ipcRenderer } from "electron";
import type { BackendStatus, WorkspaceDesktopApi } from "../contracts/desktop-api.js";

import { isWorkspaceChangeEvent } from "../contracts/service-protocol.js";

const api: WorkspaceDesktopApi = {
  getBackendStatus: () => ipcRenderer.invoke("workspace:backend-status"),
  recovery: (input) => ipcRenderer.invoke("workspace:command", input),
  settings: (input) => ipcRenderer.invoke("workspace:settings", input),
  workspace: (input) => ipcRenderer.invoke("workspace:command", input),
  pickRoot: () => ipcRenderer.invoke("workspace:pick-root"),
  onWorkspaceChange(listener) {
    const handler = (_event: Electron.IpcRendererEvent, change: unknown) => {
      if (isWorkspaceChangeEvent(change)) listener(change);
    };
    ipcRenderer.on("workspace:change", handler);
    const unsubscribe = () => {
      ipcRenderer.removeListener("workspace:change", handler);
      window.removeEventListener("unload", unsubscribe);
    };
    window.addEventListener("unload", unsubscribe, { once: true });
    return unsubscribe;
  },
  onBackendStatus(listener) {
    const handler = (_event: Electron.IpcRendererEvent, status: BackendStatus) => listener(status);
    ipcRenderer.on("workspace:backend-status", handler);
    return () => ipcRenderer.removeListener("workspace:backend-status", handler);
  },
};

contextBridge.exposeInMainWorld("workspace", api);
