const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("workspace", {
  getRoot: () => ipcRenderer.invoke("workspace:getRoot"),
  selectRoot: () => ipcRenderer.invoke("workspace:selectRoot"),
  scan: (payload) => ipcRenderer.invoke("workspace:scan", payload),
  listEntries: (payload) => ipcRenderer.invoke("workspace:listEntries", payload),
  saveProperty: (payload) => ipcRenderer.invoke("workspace:saveProperty", payload),
  previewFile: (payload) => ipcRenderer.invoke("workspace:previewFile", payload),
  reveal: (payload) => ipcRenderer.invoke("workspace:reveal", payload),
  showContextMenu: (payload) => ipcRenderer.invoke("workspace:showContextMenu", payload),
});
