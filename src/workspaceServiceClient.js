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

  saveProperty(payload) {
    return this.request("workspace.saveProperty", payload);
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
