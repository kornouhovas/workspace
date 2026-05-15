import test from "node:test";
import assert from "node:assert/strict";
import { WorkspaceServiceClient } from "../src/workspaceServiceClient.js";

function createRecordingTransport() {
  const calls = [];
  return {
    calls,
    async request(method, payload) {
      calls.push({ method, payload });
      return { method, payload };
    },
  };
}

test("WorkspaceServiceClient sends named service methods through transport", async () => {
  const transport = createRecordingTransport();
  const client = new WorkspaceServiceClient(transport);

  assert.deepEqual(await client.getRoot(), {
    method: "workspace.getRoot",
    payload: {},
  });
  assert.deepEqual(await client.setRoot({ rootPath: "/tmp/workspace" }), {
    method: "workspace.setRoot",
    payload: { rootPath: "/tmp/workspace" },
  });
  assert.deepEqual(await client.scan({ rules: { Active: { role: "status" } } }), {
    method: "workspace.scan",
    payload: { rules: { Active: { role: "status" } } },
  });
  assert.deepEqual(await client.listEntries({ path: "Active/Project Alpha" }), {
    method: "workspace.listEntries",
    payload: { path: "Active/Project Alpha" },
  });
  assert.deepEqual(await client.listProjectFileTree({ path: "Active/Project Alpha" }), {
    method: "workspace.listProjectFileTree",
    payload: { path: "Active/Project Alpha" },
  });
  assert.deepEqual(
    await client.saveProperty({
      path: "Active/Project Alpha",
      propertyId: "property:text",
      type: "text",
      value: "note",
    }),
    {
      method: "workspace.saveProperty",
      payload: {
        path: "Active/Project Alpha",
        propertyId: "property:text",
        type: "text",
        value: "note",
      },
    },
  );
  assert.deepEqual(await client.listPropertyValues({ workspaceId: "workspace:root" }), {
    method: "workspace.listPropertyValues",
    payload: { workspaceId: "workspace:root" },
  });
  assert.deepEqual(await client.listProperties({ workspaceId: "workspace:ops", includeUsage: true }), {
    method: "workspace.listProperties",
    payload: { workspaceId: "workspace:ops", includeUsage: true },
  });
  assert.deepEqual(await client.createProperty({ workspaceId: "workspace:ops", name: "Priority", type: "select" }), {
    method: "workspace.createProperty",
    payload: { workspaceId: "workspace:ops", name: "Priority", type: "select" },
  });
  assert.deepEqual(
    await client.updateProperty({
      workspaceId: "workspace:ops",
      propertyId: "property:priority",
      patch: { name: "Urgency" },
    }),
    {
      method: "workspace.updateProperty",
      payload: {
        workspaceId: "workspace:ops",
        propertyId: "property:priority",
        patch: { name: "Urgency" },
      },
    },
  );
  assert.deepEqual(
    await client.reorderProperties({
      workspaceId: "workspace:ops",
      orderedPropertyIds: ["property:name", "property:status", "property:priority"],
    }),
    {
      method: "workspace.reorderProperties",
      payload: {
        workspaceId: "workspace:ops",
        orderedPropertyIds: ["property:name", "property:status", "property:priority"],
      },
    },
  );
  assert.deepEqual(
    await client.deleteProperty({
      workspaceId: "workspace:ops",
      propertyId: "property:priority",
      confirmDeleteValues: true,
    }),
    {
      method: "workspace.deleteProperty",
      payload: {
        workspaceId: "workspace:ops",
        propertyId: "property:priority",
        confirmDeleteValues: true,
      },
    },
  );
  assert.deepEqual(
    await client.createSelectValue({
      workspaceId: "workspace:ops",
      propertyId: "property:priority",
      name: "High",
      color: "red",
    }),
    {
      method: "workspace.createSelectValue",
      payload: {
        workspaceId: "workspace:ops",
        propertyId: "property:priority",
        name: "High",
        color: "red",
      },
    },
  );
  assert.deepEqual(
    await client.updateSelectValue({
      workspaceId: "workspace:ops",
      selectValueId: "selectValue:priority:high",
      patch: { name: "Critical" },
    }),
    {
      method: "workspace.updateSelectValue",
      payload: {
        workspaceId: "workspace:ops",
        selectValueId: "selectValue:priority:high",
        patch: { name: "Critical" },
      },
    },
  );
  assert.deepEqual(
    await client.reorderSelectValues({
      workspaceId: "workspace:ops",
      propertyId: "property:priority",
      orderedSelectValueIds: ["selectValue:priority:high"],
    }),
    {
      method: "workspace.reorderSelectValues",
      payload: {
        workspaceId: "workspace:ops",
        propertyId: "property:priority",
        orderedSelectValueIds: ["selectValue:priority:high"],
      },
    },
  );
  assert.deepEqual(
    await client.deleteSelectValue({
      workspaceId: "workspace:ops",
      selectValueId: "selectValue:priority:high",
      confirmDeleteUsages: true,
    }),
    {
      method: "workspace.deleteSelectValue",
      payload: {
        workspaceId: "workspace:ops",
        selectValueId: "selectValue:priority:high",
        confirmDeleteUsages: true,
      },
    },
  );
  assert.deepEqual(
    await client.updateProjectPropertyValue({
      workspaceId: "workspace:ops",
      projectId: "project:alpha",
      propertyId: "property:priority",
      value: "selectValue:priority:high",
    }),
    {
      method: "workspace.updateProjectPropertyValue",
      payload: {
        workspaceId: "workspace:ops",
        projectId: "project:alpha",
        propertyId: "property:priority",
        value: "selectValue:priority:high",
      },
    },
  );
  assert.deepEqual(await client.updateFolderRole({ path: "Active", role: "status" }), {
    method: "workspace.updateFolderRole",
    payload: { path: "Active", role: "status" },
  });
  assert.deepEqual(await client.listWorkspaces(), {
    method: "workspace.listWorkspaces",
    payload: {},
  });
  assert.deepEqual(await client.createWorkspace({ name: "Design Ops" }), {
    method: "workspace.createWorkspace",
    payload: { name: "Design Ops" },
  });
  assert.deepEqual(
    await client.updateWorkspace({
      workspaceId: "workspace:ops",
      patch: { name: "Operations" },
    }),
    {
      method: "workspace.updateWorkspace",
      payload: {
        workspaceId: "workspace:ops",
        patch: { name: "Operations" },
      },
    },
  );
  assert.deepEqual(
    await client.reorderWorkspaces({
      orderedWorkspaceIds: ["workspace:ops", "workspace:design"],
    }),
    {
      method: "workspace.reorderWorkspaces",
      payload: {
        orderedWorkspaceIds: ["workspace:ops", "workspace:design"],
      },
    },
  );
  assert.deepEqual(await client.deleteWorkspace({ workspaceId: "workspace:design" }), {
    method: "workspace.deleteWorkspace",
    payload: { workspaceId: "workspace:design" },
  });
  assert.deepEqual(await client.setActiveWorkspace({ workspaceId: "workspace:ops" }), {
    method: "workspace.setActiveWorkspace",
    payload: { workspaceId: "workspace:ops" },
  });
  assert.deepEqual(await client.listViews({ workspaceId: "workspace:root" }), {
    method: "workspace.listViews",
    payload: { workspaceId: "workspace:root" },
  });
  assert.deepEqual(
    await client.createView({
      workspaceId: "workspace:root",
      viewType: "board",
      name: "Board",
    }),
    {
      method: "workspace.createView",
      payload: {
        workspaceId: "workspace:root",
        viewType: "board",
        name: "Board",
      },
    },
  );
  assert.deepEqual(
    await client.setActiveView({
      workspaceId: "workspace:root",
      viewId: "view:board",
    }),
    {
      method: "workspace.setActiveView",
      payload: { workspaceId: "workspace:root", viewId: "view:board" },
    },
  );
  assert.deepEqual(
    await client.updateView({
      workspaceId: "workspace:root",
      viewId: "view:board",
      patch: { name: "Priority Board" },
    }),
    {
      method: "workspace.updateView",
      payload: {
        workspaceId: "workspace:root",
        viewId: "view:board",
        patch: { name: "Priority Board" },
      },
    },
  );
  assert.deepEqual(
    await client.reorderViews({
      workspaceId: "workspace:root",
      orderedViewIds: ["view:board", "view:table"],
    }),
    {
      method: "workspace.reorderViews",
      payload: {
        workspaceId: "workspace:root",
        orderedViewIds: ["view:board", "view:table"],
      },
    },
  );
  assert.deepEqual(
    await client.deleteView({
      workspaceId: "workspace:root",
      viewId: "view:board",
    }),
    {
      method: "workspace.deleteView",
      payload: { workspaceId: "workspace:root", viewId: "view:board" },
    },
  );
  assert.deepEqual(
    await client.getViewProjection({
      workspaceId: "workspace:root",
      viewId: "view:table",
      searchQuery: "alpha",
    }),
    {
      method: "workspace.getViewProjection",
      payload: {
        workspaceId: "workspace:root",
        viewId: "view:table",
        searchQuery: "alpha",
      },
    },
  );
  assert.deepEqual(await client.reveal({ path: "Active/Project Alpha/Brief.pdf", kind: "file" }), {
    method: "workspace.reveal",
    payload: { path: "Active/Project Alpha/Brief.pdf", kind: "file" },
  });
  assert.deepEqual(await client.previewFile({ path: "Active/Project Alpha/Brief.pdf" }), {
    method: "workspace.previewFile",
    payload: { path: "Active/Project Alpha/Brief.pdf" },
  });

  assert.deepEqual(transport.calls, [
    { method: "workspace.getRoot", payload: {} },
    { method: "workspace.setRoot", payload: { rootPath: "/tmp/workspace" } },
    { method: "workspace.scan", payload: { rules: { Active: { role: "status" } } } },
    { method: "workspace.listEntries", payload: { path: "Active/Project Alpha" } },
    { method: "workspace.listProjectFileTree", payload: { path: "Active/Project Alpha" } },
    {
      method: "workspace.saveProperty",
      payload: {
        path: "Active/Project Alpha",
        propertyId: "property:text",
        type: "text",
        value: "note",
      },
    },
    { method: "workspace.listPropertyValues", payload: { workspaceId: "workspace:root" } },
    { method: "workspace.listProperties", payload: { workspaceId: "workspace:ops", includeUsage: true } },
    {
      method: "workspace.createProperty",
      payload: { workspaceId: "workspace:ops", name: "Priority", type: "select" },
    },
    {
      method: "workspace.updateProperty",
      payload: {
        workspaceId: "workspace:ops",
        propertyId: "property:priority",
        patch: { name: "Urgency" },
      },
    },
    {
      method: "workspace.reorderProperties",
      payload: {
        workspaceId: "workspace:ops",
        orderedPropertyIds: ["property:name", "property:status", "property:priority"],
      },
    },
    {
      method: "workspace.deleteProperty",
      payload: {
        workspaceId: "workspace:ops",
        propertyId: "property:priority",
        confirmDeleteValues: true,
      },
    },
    {
      method: "workspace.createSelectValue",
      payload: {
        workspaceId: "workspace:ops",
        propertyId: "property:priority",
        name: "High",
        color: "red",
      },
    },
    {
      method: "workspace.updateSelectValue",
      payload: {
        workspaceId: "workspace:ops",
        selectValueId: "selectValue:priority:high",
        patch: { name: "Critical" },
      },
    },
    {
      method: "workspace.reorderSelectValues",
      payload: {
        workspaceId: "workspace:ops",
        propertyId: "property:priority",
        orderedSelectValueIds: ["selectValue:priority:high"],
      },
    },
    {
      method: "workspace.deleteSelectValue",
      payload: {
        workspaceId: "workspace:ops",
        selectValueId: "selectValue:priority:high",
        confirmDeleteUsages: true,
      },
    },
    {
      method: "workspace.updateProjectPropertyValue",
      payload: {
        workspaceId: "workspace:ops",
        projectId: "project:alpha",
        propertyId: "property:priority",
        value: "selectValue:priority:high",
      },
    },
    { method: "workspace.updateFolderRole", payload: { path: "Active", role: "status" } },
    { method: "workspace.listWorkspaces", payload: {} },
    { method: "workspace.createWorkspace", payload: { name: "Design Ops" } },
    {
      method: "workspace.updateWorkspace",
      payload: {
        workspaceId: "workspace:ops",
        patch: { name: "Operations" },
      },
    },
    {
      method: "workspace.reorderWorkspaces",
      payload: {
        orderedWorkspaceIds: ["workspace:ops", "workspace:design"],
      },
    },
    { method: "workspace.deleteWorkspace", payload: { workspaceId: "workspace:design" } },
    { method: "workspace.setActiveWorkspace", payload: { workspaceId: "workspace:ops" } },
    { method: "workspace.listViews", payload: { workspaceId: "workspace:root" } },
    {
      method: "workspace.createView",
      payload: {
        workspaceId: "workspace:root",
        viewType: "board",
        name: "Board",
      },
    },
    { method: "workspace.setActiveView", payload: { workspaceId: "workspace:root", viewId: "view:board" } },
    {
      method: "workspace.updateView",
      payload: {
        workspaceId: "workspace:root",
        viewId: "view:board",
        patch: { name: "Priority Board" },
      },
    },
    {
      method: "workspace.reorderViews",
      payload: {
        workspaceId: "workspace:root",
        orderedViewIds: ["view:board", "view:table"],
      },
    },
    { method: "workspace.deleteView", payload: { workspaceId: "workspace:root", viewId: "view:board" } },
    {
      method: "workspace.getViewProjection",
      payload: {
        workspaceId: "workspace:root",
        viewId: "view:table",
        searchQuery: "alpha",
      },
    },
    { method: "workspace.reveal", payload: { path: "Active/Project Alpha/Brief.pdf", kind: "file" } },
    { method: "workspace.previewFile", payload: { path: "Active/Project Alpha/Brief.pdf" } },
  ]);
});

test("WorkspaceServiceClient constructor rejects missing transport.request", () => {
  assert.throws(() => new WorkspaceServiceClient(), /transport.request/);
  assert.throws(() => new WorkspaceServiceClient({}), /transport.request/);
  assert.throws(() => new WorkspaceServiceClient({ request: null }), /transport.request/);
});
