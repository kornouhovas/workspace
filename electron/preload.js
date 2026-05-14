import { contextBridge, ipcRenderer } from "electron";

const allowedMethods = new Set([
  "workspace.getRoot",
  "workspace.setRoot",
  "workspace.scan",
  "workspace.listEntries",
  "workspace.saveProperty",
  "workspace.listPropertyValues",
  "workspace.listViews",
  "workspace.createView",
  "workspace.setActiveView",
  "workspace.updateView",
  "workspace.reorderViews",
  "workspace.deleteView",
  "workspace.getViewProjection",
  "workspace.reveal",
  "workspace.previewFile",
]);

contextBridge.exposeInMainWorld("workspace", {
  request(method, payload = {}) {
    if (!allowedMethods.has(method)) {
      return Promise.reject(new Error(`Unsupported workspace method: ${method}`));
    }

    return ipcRenderer.invoke(
      "workspace:request",
      method,
      payload && typeof payload === "object" ? payload : {},
    );
  },
});
