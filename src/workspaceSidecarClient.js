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
  throw new Error(`Unsupported sidecar method: ${method}`);
}
