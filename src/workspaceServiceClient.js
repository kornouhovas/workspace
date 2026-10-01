export class WorkspaceServiceClient {
  constructor(transport) {
    if (!transport || typeof transport.request !== "function") {
      throw new TypeError("WorkspaceServiceClient requires transport.request");
    }

    this.transport = transport;
  }

  getRoot(payload = {}) {
    return this.request("workspace.getRoot", payload);
  }

  getProject(payload) {
    return this.request("workspace.getProject", payload);
  }

  getProjectStatusOptions(payload) {
    return this.request("workspace.getProjectStatusOptions", payload);
  }

  moveProjectStatus(payload) {
    return this.request("workspace.moveProjectStatus", payload);
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

  listProperties(payload) {
    return this.request("workspace.listProperties", payload);
  }

  createProperty(payload) {
    return this.request("workspace.createProperty", payload);
  }

  updateProperty(payload) {
    return this.request("workspace.updateProperty", payload);
  }

  reorderProperties(payload) {
    return this.request("workspace.reorderProperties", payload);
  }

  deleteProperty(payload) {
    return this.request("workspace.deleteProperty", payload);
  }

  createSelectValue(payload) {
    return this.request("workspace.createSelectValue", payload);
  }

  updateSelectValue(payload) {
    return this.request("workspace.updateSelectValue", payload);
  }

  updateStatusValueColor(payload) {
    return this.request("workspace.updateStatusValueColor", payload);
  }

  reorderSelectValues(payload) {
    return this.request("workspace.reorderSelectValues", payload);
  }

  deleteSelectValue(payload) {
    return this.request("workspace.deleteSelectValue", payload);
  }

  updateProjectPropertyValue(payload) {
    return this.request("workspace.updateProjectPropertyValue", payload);
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
