export class WorkspaceServiceClient {
  constructor(transport) {
    if (!transport || typeof transport.request !== "function") {
      throw new TypeError("WorkspaceServiceClient requires transport.request");
    }

    this.transport = transport;
  }

  getRoot() {
    return this.transport.request("workspace.getRoot", {});
  }

  setRoot(payload) {
    return this.request("workspace.setRoot", payload);
  }

  scan(payload) {
    return this.request("workspace.scan", payload);
  }

  listEntries(payload) {
    return this.request("workspace.listEntries", payload);
  }

  listProjectFileTree(payload) {
    return this.request("workspace.listProjectFileTree", payload);
  }

  saveProperty(payload) {
    return this.request("workspace.saveProperty", payload);
  }

  listPropertyValues(payload) {
    return this.request("workspace.listPropertyValues", payload);
  }

  updateFolderRole(payload) {
    return this.request("workspace.updateFolderRole", payload);
  }

  listWorkspaces(payload) {
    return this.request("workspace.listWorkspaces", payload);
  }

  createWorkspace(payload) {
    return this.request("workspace.createWorkspace", payload);
  }

  updateWorkspace(payload) {
    return this.request("workspace.updateWorkspace", payload);
  }

  reorderWorkspaces(payload) {
    return this.request("workspace.reorderWorkspaces", payload);
  }

  deleteWorkspace(payload) {
    return this.request("workspace.deleteWorkspace", payload);
  }

  setActiveWorkspace(payload) {
    return this.request("workspace.setActiveWorkspace", payload);
  }

  listViews(payload) {
    return this.request("workspace.listViews", payload);
  }

  createView(payload) {
    return this.request("workspace.createView", payload);
  }

  setActiveView(payload) {
    return this.request("workspace.setActiveView", payload);
  }

  updateView(payload) {
    return this.request("workspace.updateView", payload);
  }

  reorderViews(payload) {
    return this.request("workspace.reorderViews", payload);
  }

  deleteView(payload) {
    return this.request("workspace.deleteView", payload);
  }

  getViewProjection(payload) {
    return this.request("workspace.getViewProjection", payload);
  }

  reveal(payload) {
    return this.request("workspace.reveal", payload);
  }

  previewFile(payload) {
    return this.request("workspace.previewFile", payload);
  }

  request(method, payload) {
    return this.transport.request(method, normalizePayload(payload));
  }
}

function normalizePayload(payload) {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload;
  }

  return {};
}
