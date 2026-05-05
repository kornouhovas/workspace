import test from "node:test";
import assert from "node:assert/strict";
import { createSidecarHttpTransport } from "../src/workspaceSidecarClient.js";

test("createSidecarHttpTransport maps service methods to sidecar routes", async () => {
  const calls = [];
  const transport = createSidecarHttpTransport("http://127.0.0.1:5000", async (url, options = {}) => {
    calls.push({
      url,
      method: options.method || "GET",
      headers: options.headers,
      body: options.body ? JSON.parse(options.body) : null,
    });
    return {
      ok: true,
      async json() {
        return { ok: true };
      },
    };
  });

  await transport.request("workspace.getRoot", {});
  await transport.request("workspace.setRoot", { rootPath: "/tmp/workspace" });
  await transport.request("workspace.saveProperty", {
    id: "value:object-1:property:text",
    workspaceId: "workspace:root",
    objectId: "object-1",
    propertyId: "property:text",
    type: "text",
    value: "note",
  });
  await transport.request("workspace.listPropertyValues", { workspaceId: "workspace:root" });

  assert.deepEqual(calls, [
    {
      url: "http://127.0.0.1:5000/workspace/root",
      method: "GET",
      headers: undefined,
      body: null,
    },
    {
      url: "http://127.0.0.1:5000/workspace/root",
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: { rootPath: "/tmp/workspace" },
    },
    {
      url: "http://127.0.0.1:5000/workspace/property-values",
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: {
        id: "value:object-1:property:text",
        workspaceId: "workspace:root",
        objectId: "object-1",
        propertyId: "property:text",
        type: "text",
        value: "note",
      },
    },
    {
      url: "http://127.0.0.1:5000/workspace/property-values?workspaceId=workspace%3Aroot",
      method: "GET",
      headers: undefined,
      body: null,
    },
  ]);
});

test("createSidecarHttpTransport returns parsed response JSON", async () => {
  const transport = createSidecarHttpTransport("http://127.0.0.1:5000", async () => ({
    ok: true,
    async json() {
      return { rootPath: "/tmp/workspace", name: "workspace" };
    },
  }));

  assert.deepEqual(await transport.request("workspace.getRoot"), {
    rootPath: "/tmp/workspace",
    name: "workspace",
  });
});

test("createSidecarHttpTransport throws sidecar error messages", async () => {
  const transport = createSidecarHttpTransport("http://127.0.0.1:5000", async () => ({
    ok: false,
    async json() {
      return { error: "database unavailable" };
    },
  }));

  await assert.rejects(() => transport.request("workspace.getRoot"), /database unavailable/);
});

test("createSidecarHttpTransport rejects unsupported service methods", async () => {
  const transport = createSidecarHttpTransport("http://127.0.0.1:5000", async () => {
    throw new Error("fetch should not be called");
  });

  await assert.rejects(() => transport.request("workspace.scan"), /Unsupported sidecar method: workspace\.scan/);
});
