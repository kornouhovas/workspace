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
  ]);
});

test("WorkspaceServiceClient constructor rejects missing transport.request", () => {
  assert.throws(() => new WorkspaceServiceClient(), /transport.request/);
  assert.throws(() => new WorkspaceServiceClient({}), /transport.request/);
  assert.throws(() => new WorkspaceServiceClient({ request: null }), /transport.request/);
});
