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
    { method: "workspace.reveal", payload: { path: "Active/Project Alpha/Brief.pdf", kind: "file" } },
    { method: "workspace.previewFile", payload: { path: "Active/Project Alpha/Brief.pdf" } },
  ]);
});

test("WorkspaceServiceClient constructor rejects missing transport.request", () => {
  assert.throws(() => new WorkspaceServiceClient(), /transport.request/);
  assert.throws(() => new WorkspaceServiceClient({}), /transport.request/);
  assert.throws(() => new WorkspaceServiceClient({ request: null }), /transport.request/);
});
