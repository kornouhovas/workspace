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
  await transport.request("workspace.listProperties", { workspaceId: "workspace:ops" });
  await transport.request("workspace.createProperty", {
    workspaceId: "workspace:ops",
    name: "Priority",
    type: "select",
  });
  await transport.request("workspace.updateProperty", {
    workspaceId: "workspace:ops",
    propertyId: "property:priority",
    patch: { name: "Urgency" },
  });
  await transport.request("workspace.reorderProperties", {
    workspaceId: "workspace:ops",
    orderedPropertyIds: ["property:name", "property:status", "property:priority"],
  });
  await transport.request("workspace.deleteProperty", {
    workspaceId: "workspace:ops",
    propertyId: "property:priority",
    confirmDeleteValues: true,
  });
  await transport.request("workspace.createSelectValue", {
    workspaceId: "workspace:ops",
    propertyId: "property:priority",
    name: "High",
    color: "red",
  });
  await transport.request("workspace.updateSelectValue", {
    workspaceId: "workspace:ops",
    selectValueId: "selectValue:priority:high",
    patch: { name: "Critical" },
  });
  await transport.request("workspace.updateStatusValueColor", {
    workspaceId: "workspace:ops",
    statusValueId: "statusValue:workspace-ops:active",
    color: "orange",
  });
  await transport.request("workspace.reorderSelectValues", {
    workspaceId: "workspace:ops",
    propertyId: "property:priority",
    orderedSelectValueIds: ["selectValue:priority:high"],
  });
  await transport.request("workspace.deleteSelectValue", {
    workspaceId: "workspace:ops",
    selectValueId: "selectValue:priority:high",
    confirmDeleteUsages: true,
  });
  await transport.request("workspace.updateProjectPropertyValue", {
    workspaceId: "workspace:ops",
    projectId: "project:alpha",
    propertyId: "property:priority",
    value: "selectValue:priority:high",
  });
  await transport.request("workspace.listViews", { workspaceId: "workspace:ops" });
  await transport.request("workspace.upsertView", {
    id: "view:board",
    workspaceId: "workspace:ops",
    viewType: "board",
  });
  await transport.request("workspace.setActiveView", {
    workspaceId: "workspace:ops",
    viewId: "view:board",
  });
  await transport.request("workspace.reorderViews", {
    workspaceId: "workspace:ops",
    orderedViewIds: ["view:table", "view:board"],
  });

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
    {
      url: "http://127.0.0.1:5000/workspace/properties?workspaceId=workspace%3Aops",
      method: "GET",
      headers: undefined,
      body: null,
    },
    {
      url: "http://127.0.0.1:5000/workspace/properties",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: {
        workspaceId: "workspace:ops",
        name: "Priority",
        type: "select",
      },
    },
    {
      url: "http://127.0.0.1:5000/workspace/properties",
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: {
        workspaceId: "workspace:ops",
        propertyId: "property:priority",
        patch: { name: "Urgency" },
      },
    },
    {
      url: "http://127.0.0.1:5000/workspace/properties/reorder",
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: {
        workspaceId: "workspace:ops",
        orderedPropertyIds: ["property:name", "property:status", "property:priority"],
      },
    },
    {
      url: "http://127.0.0.1:5000/workspace/properties",
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: {
        workspaceId: "workspace:ops",
        propertyId: "property:priority",
        confirmDeleteValues: true,
      },
    },
    {
      url: "http://127.0.0.1:5000/workspace/select-values",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: {
        workspaceId: "workspace:ops",
        propertyId: "property:priority",
        name: "High",
        color: "red",
      },
    },
    {
      url: "http://127.0.0.1:5000/workspace/select-values",
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: {
        workspaceId: "workspace:ops",
        selectValueId: "selectValue:priority:high",
        patch: { name: "Critical" },
      },
    },
    {
      url: "http://127.0.0.1:5000/workspace/status-values",
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: {
        workspaceId: "workspace:ops",
        statusValueId: "statusValue:workspace-ops:active",
        color: "orange",
      },
    },
    {
      url: "http://127.0.0.1:5000/workspace/select-values/reorder",
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: {
        workspaceId: "workspace:ops",
        propertyId: "property:priority",
        orderedSelectValueIds: ["selectValue:priority:high"],
      },
    },
    {
      url: "http://127.0.0.1:5000/workspace/select-values",
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: {
        workspaceId: "workspace:ops",
        selectValueId: "selectValue:priority:high",
        confirmDeleteUsages: true,
      },
    },
    {
      url: "http://127.0.0.1:5000/workspace/property-values",
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: {
        workspaceId: "workspace:ops",
        projectId: "project:alpha",
        propertyId: "property:priority",
        value: "selectValue:priority:high",
      },
    },
    {
      url: "http://127.0.0.1:5000/workspace/views?workspaceId=workspace%3Aops",
      method: "GET",
      headers: undefined,
      body: null,
    },
    {
      url: "http://127.0.0.1:5000/workspace/views",
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: {
        id: "view:board",
        workspaceId: "workspace:ops",
        viewType: "board",
      },
    },
    {
      url: "http://127.0.0.1:5000/workspace/active-view",
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: {
        workspaceId: "workspace:ops",
        viewId: "view:board",
      },
    },
    {
      url: "http://127.0.0.1:5000/workspace/views/reorder",
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: {
        workspaceId: "workspace:ops",
        orderedViewIds: ["view:table", "view:board"],
      },
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
