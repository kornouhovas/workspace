export function createSidecarHttpTransport(baseUrl, fetchImpl = fetch) {
  return {
    async request(method, payload = {}) {
      const route = getSidecarRoute(method, payload);
      const options = { method: route.httpMethod };
      if (route.httpMethod !== "GET") {
        options.headers = { "content-type": "application/json" };
        options.body = JSON.stringify(payload);
      }

      const response = await fetchImpl(`${baseUrl}${route.path}${route.query || ""}`, options);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Sidecar request failed: ${method}`);
      }
      return data;
    },
  };
}

function getSidecarRoute(method, payload = {}) {
  if (method === "workspace.getRoot") {
    return { httpMethod: "GET", path: "/workspace/root" };
  }
  if (method === "workspace.setRoot") {
    return { httpMethod: "PUT", path: "/workspace/root" };
  }
  if (method === "workspace.saveProperty") {
    return { httpMethod: "PUT", path: "/workspace/property-values" };
  }
  if (method === "workspace.listPropertyValues") {
    const workspaceId = typeof payload.workspaceId === "string" ? payload.workspaceId : "";
    return {
      httpMethod: "GET",
      path: "/workspace/property-values",
      query: `?workspaceId=${encodeURIComponent(workspaceId)}`,
    };
  }
  if (method === "workspace.listProperties") {
    const workspaceId = typeof payload.workspaceId === "string" ? payload.workspaceId : "";
    return {
      httpMethod: "GET",
      path: "/workspace/properties",
      query: `?workspaceId=${encodeURIComponent(workspaceId)}`,
    };
  }
  if (method === "workspace.createProperty") {
    return { httpMethod: "POST", path: "/workspace/properties" };
  }
  if (method === "workspace.updateProperty") {
    return { httpMethod: "PATCH", path: "/workspace/properties" };
  }
  if (method === "workspace.reorderProperties") {
    return { httpMethod: "PUT", path: "/workspace/properties/reorder" };
  }
  if (method === "workspace.deleteProperty") {
    return { httpMethod: "DELETE", path: "/workspace/properties" };
  }
  if (method === "workspace.createSelectValue") {
    return { httpMethod: "POST", path: "/workspace/select-values" };
  }
  if (method === "workspace.updateSelectValue") {
    return { httpMethod: "PATCH", path: "/workspace/select-values" };
  }
  if (method === "workspace.updateStatusValueColor") {
    return { httpMethod: "PATCH", path: "/workspace/status-values" };
  }
  if (method === "workspace.reorderSelectValues") {
    return { httpMethod: "PUT", path: "/workspace/select-values/reorder" };
  }
  if (method === "workspace.deleteSelectValue") {
    return { httpMethod: "DELETE", path: "/workspace/select-values" };
  }
  if (method === "workspace.updateProjectPropertyValue") {
    return { httpMethod: "PUT", path: "/workspace/property-values" };
  }
  if (method === "workspace.listViews") {
    const workspaceId = typeof payload.workspaceId === "string" ? payload.workspaceId : "";
    return {
      httpMethod: "GET",
      path: "/workspace/views",
      query: `?workspaceId=${encodeURIComponent(workspaceId)}`,
    };
  }
  if (method === "workspace.upsertView") {
    return { httpMethod: "PUT", path: "/workspace/views" };
  }
  if (method === "workspace.setActiveView") {
    return { httpMethod: "PUT", path: "/workspace/active-view" };
  }
  if (method === "workspace.reorderViews") {
    return { httpMethod: "PUT", path: "/workspace/views/reorder" };
  }
  throw new Error(`Unsupported sidecar method: ${method}`);
}
