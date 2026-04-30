export function createSidecarHttpTransport(baseUrl, fetchImpl = fetch) {
  return {
    async request(method, payload = {}) {
      const route = getSidecarRoute(method);
      const options = { method: route.httpMethod };
      if (route.httpMethod !== "GET") {
        options.headers = { "content-type": "application/json" };
        options.body = JSON.stringify(payload);
      }

      const response = await fetchImpl(`${baseUrl}${route.path}`, options);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Sidecar request failed: ${method}`);
      }
      return data;
    },
  };
}

function getSidecarRoute(method) {
  if (method === "workspace.getRoot") {
    return { httpMethod: "GET", path: "/workspace/root" };
  }
  if (method === "workspace.setRoot") {
    return { httpMethod: "PUT", path: "/workspace/root" };
  }
  if (method === "workspace.saveProperty") {
    return { httpMethod: "PUT", path: "/workspace/property-values" };
  }
  throw new Error(`Unsupported sidecar method: ${method}`);
}
