import { createHash } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
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
    await mkdir(join(rootPath, "Active", "Project Alpha", "Docs"), { recursive: true });
    await writeFile(join(rootPath, "Active", "Project Alpha", "Notes.md"), "notes");
    await writeFile(join(rootPath, "Active", "Project Alpha", "Docs", "Plan.txt"), "plan");
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
    const project = projectionResponse.projection.columns.at(0).projects.at(0);
    assert.equal(project.name, "Project Alpha");
    assert.deepEqual(
      project.fileTree.map((node) => [node.kind, node.name, node.relativePath]),
      [
        ["folder", "Docs", "Active/Project Alpha/Docs"],
        ["file", "Notes.md", "Active/Project Alpha/Notes.md"],
      ],
    );
    assert.deepEqual(
      project.fileTree[0].children.map((node) => [node.kind, node.name, node.relativePath]),
      [["file", "Plan.txt", "Active/Project Alpha/Docs/Plan.txt"]],
    );
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("workspace IPC handler tolerates concurrent default workspace initialization", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "workspace-ipc-"));
  const rootPath = join(tempDirectory, "projects");
  const configPath = join(tempDirectory, ".workspace", "settings.json");
  const viewStorePath = join(tempDirectory, ".workspace", "views.json");
  const workspaceId = `workspace:${createHash("sha256").update(rootPath).digest("hex").slice(0, 16)}`;

  try {
    await mkdir(join(rootPath, "Active", "Project Alpha"), { recursive: true });
    await mkdir(join(configPath, ".."), { recursive: true });
    await writeFile(configPath, JSON.stringify({ rootPath }));

    const handler = createWorkspaceIpcHandler({
      configPath,
      viewStorePath,
      chooseRoot: async () => rootPath,
    });

    const results = await Promise.allSettled([
      handler(null, "workspace.scan", { includeCardChildren: true }),
      handler(null, "workspace.listViews", { workspaceId }),
      handler(null, "workspace.getViewProjection", {
        workspaceId,
        viewId: "view:default-board",
      }),
      handler(null, "workspace.scan", { includeCardChildren: true }),
      handler(null, "workspace.listViews", { workspaceId }),
    ]);
    const failures = results.filter((result) => result.status === "rejected");

    assert.deepEqual(failures, []);

    const responses = results.map((result) => result.value);
    assert.match(JSON.stringify(responses[0].tree), /Project Alpha/);
    assert.deepEqual(responses[1].views.map((view) => view.viewType), ["board", "table"]);
    assert.equal(responses[2].projection.type, "board");
    assert.deepEqual(responses[4].views.map((view) => view.viewType), ["board", "table"]);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("workspace IPC handler tolerates concurrent root selection across process handlers", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "workspace-ipc-"));
  const rootPath = join(tempDirectory, "projects");
  const configPath = join(tempDirectory, ".workspace", "settings.json");
  const viewStorePath = join(tempDirectory, ".workspace", "views.json");

  try {
    await mkdir(join(rootPath, "Active", "Project Alpha"), { recursive: true });
    const handlers = Array.from({ length: 12 }, (_, index) => createWorkspaceIpcHandler({
      configPath,
      viewStorePath,
      chooseRoot: async () => rootPath,
      idFactory: () => `workspace-${index}`,
    }));

    const results = await Promise.allSettled(
      handlers.map((handler) => handler(null, "workspace.setRoot", {})),
    );
    const failures = results.filter((result) => result.status === "rejected");

    assert.deepEqual(failures, []);
    const rootResponse = await handlers[0](null, "workspace.getRoot", {});
    const viewsResponse = await handlers[0](null, "workspace.listViews", {
      workspaceId: rootResponse.root.workspaceId,
    });
    assert.deepEqual(viewsResponse.views.map((view) => view.viewType), ["board", "table"]);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("workspace IPC handler repairs a stale active view when selecting a root", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "workspace-ipc-"));
  const rootPath = join(tempDirectory, "projects");
  const configPath = join(tempDirectory, "settings.json");
  const viewStorePath = join(tempDirectory, "views.json");

  try {
    await mkdir(join(rootPath, "Active", "Project Alpha"), { recursive: true });
    const firstHandler = createWorkspaceIpcHandler({
      configPath,
      viewStorePath,
      chooseRoot: async () => rootPath,
      idFactory: () => "extra-board",
      now: () => "2026-05-15T10:00:00.000Z",
    });

    const rootResponse = await firstHandler(null, "workspace.setRoot", {});
    const createdView = await firstHandler(null, "workspace.createView", {
      workspaceId: rootResponse.root.workspaceId,
      viewType: "board",
      name: "Board 2",
    });
    await firstHandler(null, "workspace.deleteView", {
      workspaceId: rootResponse.root.workspaceId,
      viewId: createdView.view.id,
    });

    const secondHandler = createWorkspaceIpcHandler({
      configPath,
      viewStorePath,
      chooseRoot: async () => rootPath,
      now: () => "2026-05-15T10:01:00.000Z",
    });

    await secondHandler(null, "workspace.setRoot", {});
    const viewsResponse = await secondHandler(null, "workspace.listViews", {
      workspaceId: rootResponse.root.workspaceId,
    });

    assert.equal(
      viewsResponse.views.some((view) => view.id === viewsResponse.activeViewId),
      true,
    );
    const projectionResponse = await secondHandler(null, "workspace.getViewProjection", {
      workspaceId: rootResponse.root.workspaceId,
      viewId: viewsResponse.activeViewId,
    });
    assert.equal(projectionResponse.projection.type, "board");
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("workspace IPC handler persists folder role rules for scans and projections", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "workspace-ipc-"));
  const rootPath = join(tempDirectory, "projects");
  const configPath = join(tempDirectory, "settings.json");
  const viewStorePath = join(tempDirectory, "views.json");

  try {
    await mkdir(join(rootPath, "Archive", "Completed", "Assets"), { recursive: true });
    const handler = createWorkspaceIpcHandler({
      configPath,
      viewStorePath,
      chooseRoot: async () => rootPath,
    });

    const rootResponse = await handler(null, "workspace.setRoot", {});
    const defaultScan = await handler(null, "workspace.scan", { includeCardChildren: true });
    const archiveNode = defaultScan.tree.find((node) => node.name === "Archive");
    assert.equal(archiveNode.role, "status");
    assert.equal(archiveNode.children.at(0).role, "card");

    await handler(null, "workspace.updateFolderRole", {
      path: "Archive",
      role: "group",
    });
    await handler(null, "workspace.updateFolderRole", {
      path: "Archive/Completed",
      role: "status",
    });

    const configuredScan = await handler(null, "workspace.scan", { includeCardChildren: true });
    const configuredArchiveNode = configuredScan.tree.find((node) => node.name === "Archive");
    const completedNode = configuredArchiveNode.children.find((node) => node.name === "Completed");
    assert.equal(configuredArchiveNode.role, "group");
    assert.equal(completedNode.role, "status");

    const projectionResponse = await handler(null, "workspace.getViewProjection", {
      workspaceId: rootResponse.root.workspaceId,
      viewId: "view:default-board",
    });
    assert.equal(projectionResponse.projection.type, "board");
    assert.equal(projectionResponse.projection.columns.at(0).name, "Completed");
    assert.equal(projectionResponse.projection.columns.at(0).projects.at(0).name, "Assets");
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("workspace IPC handler keeps Cyrillic status values distinct", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "workspace-ipc-"));
  const rootPath = join(tempDirectory, "projects");
  const configPath = join(tempDirectory, "settings.json");
  const viewStorePath = join(tempDirectory, "views.json");

  try {
    await mkdir(join(rootPath, "В работе", "Адонис"), { recursive: true });
    await mkdir(join(rootPath, "Завершенные", "Альфа"), { recursive: true });
    const handler = createWorkspaceIpcHandler({
      configPath,
      viewStorePath,
      chooseRoot: async () => rootPath,
    });

    const rootResponse = await handler(null, "workspace.setRoot", {});
    const projectionResponse = await handler(null, "workspace.getViewProjection", {
      workspaceId: rootResponse.root.workspaceId,
      viewId: "view:default-board",
    });

    assert.deepEqual(
      projectionResponse.projection.columns.map((column) => [
        column.name,
        column.statusValueId,
        column.projects.map((project) => project.name),
      ]),
      [
        ["В работе", projectionResponse.projection.columns[0].statusValueId, ["Адонис"]],
        ["Завершенные", projectionResponse.projection.columns[1].statusValueId, ["Альфа"]],
      ],
    );
    assert.notEqual(
      projectionResponse.projection.columns[0].statusValueId,
      projectionResponse.projection.columns[1].statusValueId,
    );
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("workspace IPC handler creates renames reorders and deletes workspaces", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "workspace-ipc-"));
  const rootPath = join(tempDirectory, "projects");
  const configPath = join(tempDirectory, "settings.json");
  const viewStorePath = join(tempDirectory, "views.json");

  try {
    await mkdir(join(rootPath, "Active", "Project Alpha"), { recursive: true });
    const handler = createWorkspaceIpcHandler({
      configPath,
      viewStorePath,
      chooseRoot: async () => rootPath,
      idFactory: () => "workspace-two",
      now: () => "2026-05-15T10:00:00.000Z",
    });

    const rootResponse = await handler(null, "workspace.setRoot", {});
    const initialWorkspaces = await handler(null, "workspace.listWorkspaces", {});
    assert.deepEqual(initialWorkspaces.workspaces.map((workspace) => workspace.name), ["Operations"]);

    const createdWorkspace = await handler(null, "workspace.createWorkspace", { name: "Design Ops" });
    assert.equal(createdWorkspace.activeWorkspaceId, createdWorkspace.workspace.id);

    const activeRootResponse = await handler(null, "workspace.getRoot", {});
    assert.equal(activeRootResponse.root.workspaceId, createdWorkspace.workspace.id);

    await handler(null, "workspace.updateWorkspace", {
      workspaceId: createdWorkspace.workspace.id,
      patch: { name: "Service Team" },
    });

    await handler(null, "workspace.reorderWorkspaces", {
      orderedWorkspaceIds: [createdWorkspace.workspace.id, rootResponse.root.workspaceId],
    });

    const reorderedWorkspaces = await handler(null, "workspace.listWorkspaces", {});
    assert.deepEqual(
      reorderedWorkspaces.workspaces.map((workspace) => [workspace.id, workspace.name]),
      [
        [createdWorkspace.workspace.id, "Service Team"],
        [rootResponse.root.workspaceId, "Operations"],
      ],
    );

    await handler(null, "workspace.deleteWorkspace", {
      workspaceId: createdWorkspace.workspace.id,
    });

    const remainingWorkspaces = await handler(null, "workspace.listWorkspaces", {});
    assert.equal(remainingWorkspaces.activeWorkspaceId, rootResponse.root.workspaceId);
    assert.deepEqual(remainingWorkspaces.workspaces.map((workspace) => workspace.id), [rootResponse.root.workspaceId]);
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
