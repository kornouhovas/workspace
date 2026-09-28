import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, access, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDevelopmentRuntime } from "../electron/developmentRuntime.js";
import { createWorkspaceIpcHandler } from "../electron/workspaceIpc.js";

test("production ignores development environment overrides", () => {
  assert.equal(getDevelopmentRuntime({ env: { WORKSPACE_DEV_URL: "https://evil.test", WORKSPACE_DEV_DATA: "/tmp/other" }, checkout: "/app" }), null);
});

test("development is checkout-local and rejects network renderer origins", () => {
  const runtime = getDevelopmentRuntime({ env: { WORKSPACE_DEV: "1", WORKSPACE_DEV_URL: "http://127.0.0.1:5173/" }, checkout: "/checkout" });
  assert.equal(runtime.dataDirectory, "/checkout/.workspace-dev");
  assert.equal(runtime.userData, "/checkout/.workspace-dev/electron");
  for (const url of ["https://example.com", "http://0.0.0.0:5173", "http://127.0.0.1:5173/remote", "file:///tmp/index.html", "http://user@127.0.0.1:5173", "http://127.0.0.1:5173/?foo=bar"]) {
    assert.throws(() => getDevelopmentRuntime({ env: { WORKSPACE_DEV: "1", WORKSPACE_DEV_URL: url }, checkout: "/checkout" }), /loopback/);
  }
});

test("development JSON adapters write only to fixture metadata", async () => {
  const checkout = await mkdtemp(join(tmpdir(), "workspace-dev-test-"));
  try {
    const runtime = getDevelopmentRuntime({ env: { WORKSPACE_DEV: "1" }, checkout });
    await mkdir(join(checkout, ".folder-kanban"));
    await writeFile(join(checkout, ".folder-kanban", "settings.json"), JSON.stringify({ rootPath: "/unavailable-live-folder" }));
    const request = createWorkspaceIpcHandler({ ...runtime.storage, chooseRoot: async () => checkout });
    assert.equal(await request(null, "workspace.getRoot"), null);
    await request(null, "workspace.setRoot");
    const created = await request(null, "workspace.createWorkspace", { name: "Isolated" });
    await request(null, "workspace.createProperty", { workspaceId: created.workspace.id, name: "Isolated property", type: "text" });
    assert.match(await readFile(runtime.storage.propertyStorePath, "utf8"), /Isolated property/);
    assert.match(await readFile(runtime.storage.viewStorePath, "utf8"), /Isolated/);
    await assert.rejects(access(join(checkout, ".workspace")), { code: "ENOENT" });
    assert.match(await readFile(join(checkout, ".folder-kanban", "settings.json"), "utf8"), /unavailable-live-folder/);
    assert.equal(runtime.storage.propertyStorePath, join(checkout, ".workspace-dev", "properties.json"));
  } finally { await rm(checkout, { recursive: true, force: true }); }
});

test("development cannot point metadata into production or legacy directories", () => {
  for (const data of [".workspace", ".folder-kanban", "/another/.workspace/child"]) {
    assert.throws(() => getDevelopmentRuntime({ env: { WORKSPACE_DEV: "1", WORKSPACE_DEV_DATA: data }, checkout: "/checkout" }), /isolated/);
  }
});
