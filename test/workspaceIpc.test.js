import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createWorkspaceIpcHandler } from "../electron/workspaceIpc.js";

test("workspace IPC handler returns null when source folder is not selected", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "workspace-ipc-"));

  try {
    const handler = createWorkspaceIpcHandler({
      configPath: join(tempDirectory, "settings.json"),
    });

    assert.equal(await handler(null, "workspace.getRoot", {}), null);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("workspace IPC handler serves default views and projection for selected source folder", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "workspace-ipc-"));
  const rootPath = join(tempDirectory, "projects");
  const viewStorePath = join(tempDirectory, "views.json");

  try {
    await mkdir(join(rootPath, "Project Alpha"), { recursive: true });
    const handler = createWorkspaceIpcHandler({
      configPath: join(tempDirectory, "settings.json"),
      viewStorePath,
      chooseRoot: async () => rootPath,
    });

    await handler(null, "workspace.setRoot", { rootPath: "/" });
    const rootResponse = await handler(null, "workspace.getRoot", {});
    assert.equal(rootResponse.root.rootPath, rootPath);
    assert.equal(rootResponse.root.workspaceId.startsWith("workspace:"), true);

    const viewsResponse = await handler(null, "workspace.listViews", {
      workspaceId: rootResponse.root.workspaceId,
    });
    assert.equal(viewsResponse.activeViewId, "view:default-board");
    assert.deepEqual(viewsResponse.views.map((view) => view.viewType), ["board", "table"]);

    const projectionResponse = await handler(null, "workspace.getViewProjection", {
      workspaceId: rootResponse.root.workspaceId,
      viewId: "view:default-board",
      searchQuery: "alpha",
    });
    assert.equal(projectionResponse.projection.type, "board");
    assert.equal(projectionResponse.projection.capabilities.canMoveBetweenStatuses, false);
    assert.equal(projectionResponse.projection.columns.at(0).projects.at(0).name, "Project Alpha");
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("workspace IPC handler persists view state outside the process handler instance", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "workspace-ipc-"));
  const rootPath = join(tempDirectory, "projects");
  const configPath = join(tempDirectory, "settings.json");
  const viewStorePath = join(tempDirectory, "views.json");

  try {
    await mkdir(join(rootPath, "Project Alpha"), { recursive: true });
    const firstHandler = createWorkspaceIpcHandler({
      configPath,
      viewStorePath,
      chooseRoot: async () => rootPath,
      idFactory: () => "custom-board",
      now: () => "2026-05-15T10:00:00.000Z",
    });

    const rootResponse = await firstHandler(null, "workspace.setRoot", {});
    await firstHandler(null, "workspace.createView", {
      workspaceId: rootResponse.root.workspaceId,
      viewType: "board",
      name: "Custom Board",
    });

    const secondHandler = createWorkspaceIpcHandler({
      configPath,
      viewStorePath,
      chooseRoot: async () => rootPath,
    });
    const viewsResponse = await secondHandler(null, "workspace.listViews", {
      workspaceId: rootResponse.root.workspaceId,
    });

    assert.equal(viewsResponse.activeViewId, "view:custom-board");
    assert.equal(viewsResponse.views.some((view) => view.id === "view:custom-board"), true);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});
