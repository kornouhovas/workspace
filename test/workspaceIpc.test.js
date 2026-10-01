import { createHash } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

test("workspace IPC handler surfaces corrupt settings JSON without overwriting it", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "workspace-ipc-"));
  const configPath = join(tempDirectory, "settings.json");
  const rootPath = join(tempDirectory, "projects");

  try {
    await mkdir(rootPath, { recursive: true });
    await writeFile(configPath, "{not json");
    const handler = createWorkspaceIpcHandler({
      configPath,
      chooseRoot: async () => rootPath,
    });

    await assert.rejects(
      handler(null, "workspace.getRoot", {}),
      { code: "WORKSPACE_STORAGE_CORRUPT" },
    );
    assert.equal(await readFile(configPath, "utf8"), "{not json");
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("workspace IPC handler surfaces corrupt views JSON without overwriting it", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "workspace-ipc-"));
  const rootPath = join(tempDirectory, "projects");
  const configPath = join(tempDirectory, "settings.json");
  const viewStorePath = join(tempDirectory, "views.json");

  try {
    await mkdir(rootPath, { recursive: true });
    await writeFile(configPath, JSON.stringify({ rootPath }));
    await writeFile(viewStorePath, "{not json");
    const handler = createWorkspaceIpcHandler({
      configPath,
      viewStorePath,
      chooseRoot: async () => rootPath,
    });

    await assert.rejects(
      handler(null, "workspace.getRoot", {}),
      { code: "WORKSPACE_STORAGE_CORRUPT" },
    );
    assert.equal(await readFile(viewStorePath, "utf8"), "{not json");
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
    assert.equal(projectionResponse.projection.capabilities.canMoveBetweenStatuses, true);
    const project = projectionResponse.projection.columns.at(0).projects.at(0);
    assert.equal(project.name, "Project Alpha");
    assert.deepEqual(project.fileTree, []);
    const fileTreeResponse = await handler(null, "workspace.listProjectFileTree", {
      path: "Active/Project Alpha",
    });
    assert.deepEqual(
      fileTreeResponse.fileTree.map((node) => [node.kind, node.name, node.relativePath]),
      [
        ["folder", "Docs", "Active/Project Alpha/Docs"],
        ["file", "Notes.md", "Active/Project Alpha/Notes.md"],
      ],
    );
    assert.deepEqual(
      fileTreeResponse.fileTree[0].children.map((node) => [node.kind, node.name, node.relativePath]),
      [["file", "Plan.txt", "Active/Project Alpha/Docs/Plan.txt"]],
    );
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("workspace IPC handler preserves table views that hide Status", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "workspace-ipc-"));
  const rootPath = join(tempDirectory, "projects");
  const viewStorePath = join(tempDirectory, "views.json");

  try {
    await mkdir(join(rootPath, "Active", "Project Alpha"), { recursive: true });
    const handler = createWorkspaceIpcHandler({
      configPath: join(tempDirectory, "settings.json"),
      viewStorePath,
      chooseRoot: async () => rootPath,
    });

    await handler(null, "workspace.setRoot", { rootPath: "/" });
    const rootResponse = await handler(null, "workspace.getRoot", {});
    const viewStore = JSON.parse(await readFile(viewStorePath, "utf8"));
    viewStore.views["view:default-table"] = {
      ...viewStore.views["view:default-table"],
      visiblePropertyIds: ["property:name"],
      propertyOrder: {
        "property:name": 10,
      },
    };
    await writeFile(viewStorePath, `${JSON.stringify(viewStore, null, 2)}\n`);

    const projectionResponse = await handler(null, "workspace.getViewProjection", {
      workspaceId: rootResponse.root.workspaceId,
      viewId: "view:default-table",
    });

    assert.deepEqual(
      projectionResponse.visibleProperties.map((property) => property.id),
      ["property:name"],
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
  const projectFilePath = join(rootPath, "Active", "Project Alpha", "notes.txt");

  try {
    await mkdir(join(rootPath, "Active", "Project Alpha"), { recursive: true });
    await writeFile(projectFilePath, "user-owned project data");
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
    assert.equal(await readFile(projectFilePath, "utf8"), "user-owned project data");

    const persistedViews = JSON.parse(await readFile(viewStorePath, "utf8"));
    assert.equal(persistedViews.workspaces[createdWorkspace.workspace.id].deletedAt, "2026-05-15T10:00:00.000Z");
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("workspace IPC handler uses plain Workspace as the default created workspace name", async () => {
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

    await handler(null, "workspace.setRoot", {});
    const createdWorkspace = await handler(null, "workspace.createWorkspace", {});

    assert.equal(createdWorkspace.workspace.name, "Workspace");
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("workspace IPC handler does not recreate a deleted default source workspace", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "workspace-ipc-"));
  const rootPath = join(tempDirectory, "Объекты");
  const configPath = join(tempDirectory, "settings.json");
  const viewStorePath = join(tempDirectory, "views.json");

  try {
    await mkdir(join(rootPath, "В работе", "Адонис"), { recursive: true });
    const handler = createWorkspaceIpcHandler({
      configPath,
      viewStorePath,
      chooseRoot: async () => rootPath,
      idFactory: () => "planning",
      now: () => "2026-05-15T10:00:00.000Z",
    });

    const rootResponse = await handler(null, "workspace.setRoot", {});
    const defaultWorkspaceId = rootResponse.root.workspaceId;
    await handler(null, "workspace.updateWorkspace", {
      workspaceId: defaultWorkspaceId,
      patch: { name: "Объекты" },
    });
    const createdWorkspace = await handler(null, "workspace.createWorkspace", {
      name: "Planning",
    });

    await handler(null, "workspace.deleteWorkspace", {
      workspaceId: defaultWorkspaceId,
    });
    await handler(null, "workspace.getRoot", {});
    const workspaces = await handler(null, "workspace.listWorkspaces", {});

    assert.deepEqual(
      workspaces.workspaces.map((workspace) => [workspace.id, workspace.name]),
      [[createdWorkspace.workspace.id, "Planning"]],
    );
    assert.equal(workspaces.activeWorkspaceId, createdWorkspace.workspace.id);
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

test("workspace IPC handler persists custom properties and projects them into views", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "workspace-ipc-"));
  const rootPath = join(tempDirectory, "projects");
  const configPath = join(tempDirectory, "settings.json");
  const viewStorePath = join(tempDirectory, "views.json");
  const propertyStorePath = join(tempDirectory, "properties.json");
  const ids = ["priority", "high", "low"][Symbol.iterator]();

  try {
    await mkdir(join(rootPath, "Active", "Project Alpha"), { recursive: true });
    await mkdir(join(rootPath, "Active", "Project Beta"), { recursive: true });

    const handler = createWorkspaceIpcHandler({
      configPath,
      viewStorePath,
      propertyStorePath,
      chooseRoot: async () => rootPath,
      idFactory: () => ids.next().value,
      now: () => "2026-05-15T10:00:00.000Z",
    });

    const rootResponse = await handler(null, "workspace.setRoot", {});
    const workspaceId = rootResponse.root.workspaceId;
    const createdProperty = await handler(null, "workspace.createProperty", {
      workspaceId,
      name: "Priority",
      type: "select",
    });
    const priorityProperty = createdProperty.property;
    assert.equal(priorityProperty.id, "property:priority");
    assert.equal(priorityProperty.name, "Priority");

    const highValue = await handler(null, "workspace.createSelectValue", {
      workspaceId,
      propertyId: priorityProperty.id,
      name: "High",
      color: "red",
    });
    const lowValue = await handler(null, "workspace.createSelectValue", {
      workspaceId,
      propertyId: priorityProperty.id,
      name: "Low",
      color: "gray",
    });

    const initialProjection = await handler(null, "workspace.getViewProjection", {
      workspaceId,
      viewId: "view:default-board",
    });
    const projects = initialProjection.projection.columns.flatMap((column) => column.projects);
    const alphaProject = projects.find((project) => project.name === "Project Alpha");
    const betaProject = projects.find((project) => project.name === "Project Beta");

    await handler(null, "workspace.updateProjectPropertyValue", {
      workspaceId,
      projectId: alphaProject.id,
      propertyId: priorityProperty.id,
      value: highValue.selectValue.id,
    });
    await handler(null, "workspace.updateProjectPropertyValue", {
      workspaceId,
      projectId: betaProject.id,
      propertyId: priorityProperty.id,
      value: lowValue.selectValue.id,
    });

    await handler(null, "workspace.updateView", {
      workspaceId,
      viewId: "view:default-board",
      patch: {
        visiblePropertyIds: ["property:name", "property:status", priorityProperty.id],
        propertyOrder: {
          "property:name": 10,
          "property:status": 20,
          [priorityProperty.id]: 30,
        },
        valueVisibility: {
          [priorityProperty.id]: {
            valueIds: [highValue.selectValue.id],
          },
        },
      },
    });

    const propertiesResponse = await handler(null, "workspace.listProperties", { workspaceId });
    assert.deepEqual(
      propertiesResponse.properties.map((property) => [property.id, property.name, property.type]),
      [
        ["property:name", "Name", "text"],
        ["property:status", "Status", "select"],
        [priorityProperty.id, "Priority", "select"],
      ],
    );
    assert.deepEqual(
      propertiesResponse.selectValues.map((value) => [value.id, value.name, value.propertyId]),
      [
        [highValue.selectValue.id, "High", priorityProperty.id],
        [lowValue.selectValue.id, "Low", priorityProperty.id],
      ],
    );

    const filteredProjection = await handler(null, "workspace.getViewProjection", {
      workspaceId,
      viewId: "view:default-board",
    });

    assert.deepEqual(
      filteredProjection.visibleProperties.map((property) => [property.id, property.name, property.propertyType]),
      [
        ["property:name", "Name", "text"],
        ["property:status", "Status", "select"],
        [priorityProperty.id, "Priority", "select"],
      ],
    );
    assert.deepEqual(
      filteredProjection.projection.columns.flatMap((column) => column.projects).map((project) => [
        project.name,
        project.propertyValues[priorityProperty.id],
      ]),
      [["Project Alpha", highValue.selectValue.id]],
    );

    await handler(null, "workspace.updateProperty", {
      workspaceId,
      propertyId: priorityProperty.id,
      patch: {
        name: "user priority",
      },
    });
    const renamedProperties = await handler(null, "workspace.listProperties", { workspaceId });
    assert.equal(
      renamedProperties.properties.find((property) => property.id === priorityProperty.id).name,
      "user priority",
    );

    await assert.rejects(
      handler(null, "workspace.deleteProperty", {
        workspaceId,
        propertyId: priorityProperty.id,
      }),
      /Property has values/,
    );
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("workspace IPC handler renames system property labels without changing system semantics", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "workspace-ipc-system-properties-"));

  try {
    const rootPath = join(tempDirectory, "projects");
    const configPath = join(tempDirectory, "settings.json");
    const viewStorePath = join(tempDirectory, "views.json");
    const propertyStorePath = join(tempDirectory, "properties.json");
    let idCounter = 0;

    await mkdir(join(rootPath, "Active", "Project Alpha"), { recursive: true });
    const handler = createWorkspaceIpcHandler({
      configPath,
      viewStorePath,
      propertyStorePath,
      chooseRoot: async () => rootPath,
      idFactory: () => `seed-${idCounter += 1}`,
      now: () => "2026-05-15T10:00:00.000Z",
    });

    const rootResponse = await handler(null, "workspace.setRoot", {});
    const workspaceId = rootResponse.root.workspaceId;

    await handler(null, "workspace.updateProperty", {
      workspaceId,
      propertyId: "property:name",
      patch: { name: "Project" },
    });
    await handler(null, "workspace.updateProperty", {
      workspaceId,
      propertyId: "property:status",
      patch: { name: "Stage" },
    });

    const propertiesResponse = await handler(null, "workspace.listProperties", { workspaceId });
    const systemProperties = propertiesResponse.properties.filter((property) => (
      property.id === "property:name" || property.id === "property:status"
    ));

    assert.deepEqual(
      systemProperties.map((property) => [property.id, property.name, property.type, property.system, property.hidden, property.order]),
      [
        ["property:name", "Project", "text", true, false, 10],
        ["property:status", "Stage", "select", true, false, 20],
      ],
    );

    const projectionResponse = await handler(null, "workspace.getViewProjection", {
      workspaceId,
      viewId: "view:default-table",
    });
    assert.deepEqual(
      projectionResponse.visibleProperties.map((property) => [property.id, property.name, property.propertyType]),
      [
        ["property:name", "Project", "text"],
        ["property:status", "Stage", "select"],
      ],
    );
    assert.equal(projectionResponse.projection.rows[0].propertyValues["property:name"], "Project Alpha");
    assert.match(projectionResponse.projection.rows[0].propertyValues["property:status"], /^statusValue:/);

    await assert.rejects(
      handler(null, "workspace.updateProperty", {
        workspaceId,
        propertyId: "property:status",
        patch: { hidden: true },
      }),
      /System properties only support rename/,
    );
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("workspace IPC handler creates duplicate property names as distinct id-backed properties", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "workspace-ipc-"));
  const rootPath = join(tempDirectory, "projects");
  const configPath = join(tempDirectory, "settings.json");
  const viewStorePath = join(tempDirectory, "views.json");
  const propertyStorePath = join(tempDirectory, "properties.json");

  try {
    await mkdir(join(rootPath, "Active", "Project Alpha"), { recursive: true });
    const handler = createWorkspaceIpcHandler({
      configPath,
      viewStorePath,
      propertyStorePath,
      chooseRoot: async () => rootPath,
      now: () => "2026-05-15T10:00:00.000Z",
    });

    const rootResponse = await handler(null, "workspace.setRoot", {});
    const workspaceId = rootResponse.root.workspaceId;
    const firstProperty = await handler(null, "workspace.createProperty", {
      id: "property:client-text-a",
      workspaceId,
      name: "Text",
      type: "text",
    });
    const secondProperty = await handler(null, "workspace.createProperty", {
      id: "property:client-text-b",
      workspaceId,
      name: "Text",
      type: "text",
    });

    assert.equal(firstProperty.property.id, "property:client-text-a");
    assert.equal(secondProperty.property.id, "property:client-text-b");

    await handler(null, "workspace.updateView", {
      workspaceId,
      viewId: "view:default-table",
      patch: {
        visiblePropertyIds: [
          "property:name",
          "property:status",
          firstProperty.property.id,
          secondProperty.property.id,
        ],
        propertyOrder: {
          "property:name": 10,
          "property:status": 20,
          [firstProperty.property.id]: 30,
          [secondProperty.property.id]: 40,
        },
      },
    });

    const projection = await handler(null, "workspace.getViewProjection", {
      workspaceId,
      viewId: "view:default-table",
    });

    assert.deepEqual(
      projection.visibleProperties.map((property) => [property.id, property.name, property.propertyType]),
      [
        ["property:name", "Name", "text"],
        ["property:status", "Status", "select"],
        ["property:client-text-a", "Text", "text"],
        ["property:client-text-b", "Text", "text"],
      ],
    );
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("workspace IPC handler persists derived status value colors", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "workspace-ipc-"));
  const rootPath = join(tempDirectory, "projects");
  const configPath = join(tempDirectory, "settings.json");
  const viewStorePath = join(tempDirectory, "views.json");
  const propertyStorePath = join(tempDirectory, "properties.json");

  try {
    await mkdir(join(rootPath, "Active", "Project Alpha"), { recursive: true });
    await mkdir(join(rootPath, "Done", "Project Beta"), { recursive: true });
    const handler = createWorkspaceIpcHandler({
      configPath,
      viewStorePath,
      propertyStorePath,
      chooseRoot: async () => rootPath,
      now: () => "2026-05-15T10:00:00.000Z",
    });

    const rootResponse = await handler(null, "workspace.setRoot", {});
    const workspaceId = rootResponse.root.workspaceId;
    const initialProjection = await handler(null, "workspace.getViewProjection", {
      workspaceId,
      viewId: "view:default-table",
    });
    const activeStatus = initialProjection.statusValues.find((statusValue) => statusValue.name === "Active");
    assert.ok(activeStatus);

    const updateResponse = await handler(null, "workspace.updateStatusValueColor", {
      workspaceId,
      statusValueId: activeStatus.id,
      color: "orange",
    });
    assert.deepEqual(
      [updateResponse.statusValue.id, updateResponse.statusValue.name, updateResponse.statusValue.color],
      [activeStatus.id, "Active", "orange"],
    );

    const propertiesResponse = await handler(null, "workspace.listProperties", { workspaceId });
    assert.deepEqual(
      propertiesResponse.selectValues
        .filter((value) => value.propertyId === "property:status")
        .map((value) => [value.id, value.name, value.color]),
      [[activeStatus.id, "Active", "orange"]],
    );

    const updatedProjection = await handler(null, "workspace.getViewProjection", {
      workspaceId,
      viewId: "view:default-table",
    });
    assert.deepEqual(
      updatedProjection.statusValues
        .filter((statusValue) => statusValue.name === "Active")
        .map((statusValue) => [statusValue.id, statusValue.color]),
      [[activeStatus.id, "orange"]],
    );
    assert.equal(updatedProjection.projection.rows[0].status.color, "orange");
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("workspace IPC handler shares object properties across workspaces for the same source folder", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "workspace-ipc-"));
  const rootPath = join(tempDirectory, "projects");
  const configPath = join(tempDirectory, "settings.json");
  const viewStorePath = join(tempDirectory, "views.json");
  const propertyStorePath = join(tempDirectory, "properties.json");
  let idCounter = 0;

  try {
    await mkdir(join(rootPath, "Active", "Project Alpha"), { recursive: true });
    const handler = createWorkspaceIpcHandler({
      configPath,
      viewStorePath,
      propertyStorePath,
      chooseRoot: async () => rootPath,
      idFactory: () => `seed-${idCounter += 1}`,
      now: () => "2026-05-15T10:00:00.000Z",
    });

    const rootResponse = await handler(null, "workspace.setRoot", {});
    const sourceWorkspaceId = rootResponse.root.workspaceId;
    const propertyResponse = await handler(null, "workspace.createProperty", {
      id: "property:shared-note",
      workspaceId: sourceWorkspaceId,
      name: "Text",
      type: "text",
    });
    const sourceProjection = await handler(null, "workspace.getViewProjection", {
      workspaceId: sourceWorkspaceId,
      viewId: "view:default-table",
    });
    const sourceProject = sourceProjection.projection.rows.find((project) => project.name === "Project Alpha");

    await handler(null, "workspace.updateProjectPropertyValue", {
      workspaceId: sourceWorkspaceId,
      projectId: sourceProject.id,
      propertyId: propertyResponse.property.id,
      value: "Shared object note",
    });

    const createdWorkspace = await handler(null, "workspace.createWorkspace", {
      name: "Planning",
    });
    const workspaceId = createdWorkspace.workspace.id;
    const workspaceProperties = await handler(null, "workspace.listProperties", { workspaceId });

    assert.deepEqual(
      workspaceProperties.properties.map((property) => [property.id, property.name, property.type]),
      [
        ["property:name", "Name", "text"],
        ["property:status", "Status", "select"],
        ["property:shared-note", "Text", "text"],
      ],
    );

    const workspaceViews = await handler(null, "workspace.listViews", { workspaceId });
    const tableView = workspaceViews.views.find((view) => view.viewType === "table");
    const hiddenProjection = await handler(null, "workspace.getViewProjection", {
      workspaceId,
      viewId: tableView.id,
    });

    assert.deepEqual(
      hiddenProjection.visibleProperties.map((property) => property.id),
      ["property:name", "property:status"],
    );
    assert.equal(hiddenProjection.projection.rows[0].id, sourceProject.id);
    assert.equal(hiddenProjection.projection.rows[0].propertyValues["property:shared-note"], "Shared object note");

    await handler(null, "workspace.updateView", {
      workspaceId,
      viewId: tableView.id,
      patch: {
        visiblePropertyIds: ["property:name", "property:status", "property:shared-note"],
        propertyOrder: {
          "property:name": 10,
          "property:status": 20,
          "property:shared-note": 30,
        },
      },
    });

    const visibleProjection = await handler(null, "workspace.getViewProjection", {
      workspaceId,
      viewId: tableView.id,
    });

    assert.deepEqual(
      visibleProjection.visibleProperties.map((property) => [property.id, property.name]),
      [
        ["property:name", "Name"],
        ["property:status", "Status"],
        ["property:shared-note", "Text"],
      ],
    );
    assert.equal(visibleProjection.projection.rows[0].propertyValues["property:shared-note"], "Shared object note");
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("workspace IPC handler deletes custom properties from values and source views", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "workspace-ipc-"));
  const rootPath = join(tempDirectory, "projects");
  const configPath = join(tempDirectory, "settings.json");
  const viewStorePath = join(tempDirectory, "views.json");
  const propertyStorePath = join(tempDirectory, "properties.json");
  let idCounter = 0;

  try {
    await mkdir(join(rootPath, "Active", "Project Alpha"), { recursive: true });
    const handler = createWorkspaceIpcHandler({
      configPath,
      viewStorePath,
      propertyStorePath,
      chooseRoot: async () => rootPath,
      idFactory: () => `seed-${idCounter += 1}`,
      now: () => "2026-05-15T10:00:00.000Z",
    });

    const rootResponse = await handler(null, "workspace.setRoot", {});
    const sourceWorkspaceId = rootResponse.root.workspaceId;
    const propertyResponse = await handler(null, "workspace.createProperty", {
      id: "property:shared-note",
      workspaceId: sourceWorkspaceId,
      name: "Note",
      type: "text",
    });
    const createdWorkspace = await handler(null, "workspace.createWorkspace", {
      name: "Planning",
    });
    const secondWorkspaceId = createdWorkspace.workspace.id;
    const secondViews = await handler(null, "workspace.listViews", { workspaceId: secondWorkspaceId });
    const secondTableView = secondViews.views.find((view) => view.viewType === "table");
    const sourceProjection = await handler(null, "workspace.getViewProjection", {
      workspaceId: sourceWorkspaceId,
      viewId: "view:default-table",
    });
    const sourceProject = sourceProjection.projection.rows.find((project) => project.name === "Project Alpha");

    for (const [workspaceId, viewId] of [
      [sourceWorkspaceId, "view:default-table"],
      [secondWorkspaceId, secondTableView.id],
    ]) {
      await handler(null, "workspace.updateView", {
        workspaceId,
        viewId,
        patch: {
          visiblePropertyIds: ["property:name", "property:status", propertyResponse.property.id],
          propertyOrder: {
            "property:name": 10,
            "property:status": 20,
            [propertyResponse.property.id]: 30,
          },
        },
      });
    }

    await handler(null, "workspace.updateProjectPropertyValue", {
      workspaceId: sourceWorkspaceId,
      projectId: sourceProject.id,
      propertyId: propertyResponse.property.id,
      value: "Remove me",
    });

    await handler(null, "workspace.deleteProperty", {
      workspaceId: secondWorkspaceId,
      propertyId: propertyResponse.property.id,
      confirmDeleteValues: true,
    });

    const propertiesResponse = await handler(null, "workspace.listProperties", { workspaceId: sourceWorkspaceId });
    assert.equal(
      propertiesResponse.properties.some((property) => property.id === propertyResponse.property.id),
      false,
    );
    assert.deepEqual(
      await handler(null, "workspace.listPropertyValues", {
        workspaceId: sourceWorkspaceId,
        propertyId: propertyResponse.property.id,
      }),
      { workspaceId: sourceWorkspaceId, values: [] },
    );

    for (const [workspaceId, viewId] of [
      [sourceWorkspaceId, "view:default-table"],
      [secondWorkspaceId, secondTableView.id],
    ]) {
      const views = await handler(null, "workspace.listViews", { workspaceId });
      const view = views.views.find((item) => item.id === viewId);
      assert.equal(view.visiblePropertyIds.includes(propertyResponse.property.id), false);
      assert.equal(Object.hasOwn(view.propertyOrder, propertyResponse.property.id), false);

      const projection = await handler(null, "workspace.getViewProjection", { workspaceId, viewId });
      assert.equal(
        projection.visibleProperties.some((property) => property.id === propertyResponse.property.id),
        false,
      );
      assert.equal(
        Object.hasOwn(projection.projection.rows[0].propertyValues, propertyResponse.property.id),
        false,
      );
    }
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test('workspace sources and roles isolate legacy siblings and survive restart, cancellation and unavailable roots', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'workspace-sources-'));
  const aRoot = join(dir, 'a'), bRoot = join(dir, 'b');
  const configPath = join(dir, 'settings.json');
  let selected = aRoot;
  const options = { configPath, propertyStorePath: join(dir, 'properties.json'), chooseRoot: async () => selected };
  try {
    await mkdir(join(aRoot, 'Active', 'Alpha'), { recursive: true });
    await mkdir(join(bRoot, 'Active', 'Beta'), { recursive: true });
    let handler = createWorkspaceIpcHandler(options);
    const a = (await handler(null, 'workspace.setRoot')).root.workspaceId;
    const b = (await handler(null, 'workspace.createWorkspace', { name: 'B' })).workspace.id;
    // Simulate the existing pre-binding adapter with two saved Workspaces.
    await writeFile(configPath, JSON.stringify({ rootPath: aRoot, activeWorkspaceId: b, folderRules: { Active: { role: 'group' } } }));
    handler = createWorkspaceIpcHandler(options);
    await handler(null, 'workspace.setActiveWorkspace', { workspaceId: a });
    selected = bRoot;
    assert.equal((await handler(null, 'workspace.setRoot', { workspaceId: a })).root.workspaceId, a);
    assert.equal((await handler(null, 'workspace.listWorkspaces')).workspaces.length, 2);
    await handler(null, 'workspace.setActiveWorkspace', { workspaceId: b });
    assert.equal((await handler(null, 'workspace.getRoot')).root.rootPath, aRoot);
    assert.equal((await handler(null, 'workspace.scan')).tree.find(n => n.name === 'Active').role, 'group');
    handler = createWorkspaceIpcHandler(options);
    await handler(null, 'workspace.setActiveWorkspace', { workspaceId: a });
    assert.equal((await handler(null, 'workspace.getRoot')).root.rootPath, bRoot);
    const before = await readFile(configPath, 'utf8');
    selected = '';
    assert.equal(await handler(null, 'workspace.setRoot', { workspaceId: a }), null);
    selected = join(dir, 'missing');
    await assert.rejects(handler(null, 'workspace.setRoot', { workspaceId: a }), { code: 'SOURCE_FOLDER_UNAVAILABLE' });
    assert.equal(await readFile(configPath, 'utf8'), before);
    await rm(bRoot, { recursive: true });
    await handler(null, 'workspace.setActiveWorkspace', { workspaceId: b });
    assert.equal((await handler(null, 'workspace.getRoot')).root.rootPath, aRoot);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('project lookup restores preview independently of view filtering and keeps source values', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'workspace-preview-'));
  const root = join(dir, 'projects');
  const changedRoot = join(dir, 'changed');
  let chosenRoot = root;
  try {
    await mkdir(join(root, 'Active', 'Alpha'), { recursive: true });
    const handler = createWorkspaceIpcHandler({ configPath: join(dir, 'settings.json'), propertyStorePath: join(dir, 'properties.json'), chooseRoot: async () => chosenRoot });
    const a = (await handler(null, 'workspace.setRoot')).root.workspaceId;
    const projection = await handler(null, 'workspace.getViewProjection', { workspaceId: a, viewId: 'view:default-board' });
    const project = projection.projection.columns.flatMap(c => c.projects)[0];
    const property = (await handler(null, 'workspace.createProperty', { workspaceId: a, name: 'Note', type: 'text' })).property;
    await handler(null, 'workspace.updateProjectPropertyValue', { workspaceId: a, projectId: project.id, propertyId: property.id, value: 'Preserved' });
    const b = (await handler(null, 'workspace.createWorkspace', { name: 'B' })).workspace.id;
    const restored = (await handler(null, 'workspace.getProject', { workspaceId: b, projectId: project.id })).project;
    assert.equal(restored.id, project.id);
    assert.equal(restored.propertyValues[property.id], 'Preserved');
    await mkdir(changedRoot);
    chosenRoot = changedRoot;
    await handler(null, 'workspace.setRoot', { workspaceId: a });
    assert.equal((await handler(null, 'workspace.getProject', { workspaceId: b, projectId: project.id })).project.propertyValues[property.id], 'Preserved');
    chosenRoot = root;
    await handler(null, 'workspace.setRoot', { workspaceId: a });
    assert.equal((await handler(null, 'workspace.getProject', { workspaceId: a, projectId: project.id })).project.propertyValues[property.id], 'Preserved');
    assert.equal((await handler(null, 'workspace.getProject', { workspaceId: a, projectId: 'missing' })).project, null);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('late native picker keeps its captured workspace and does not block activation or overwrite another source', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'workspace-picker-'));
  const first = join(dir, 'first'), second = join(dir, 'second');
  let releasePicker, pickerOpened;
  let choose = async () => first;
  try {
    await mkdir(first); await mkdir(second);
    const options = { configPath: join(dir, 'settings.json'), propertyStorePath: join(dir, 'properties.json'), chooseRoot: () => choose() };
    const handler = createWorkspaceIpcHandler(options);
    const a = (await handler(null, 'workspace.setRoot')).root.workspaceId;
    const b = (await handler(null, 'workspace.createWorkspace', { name: 'B' })).workspace.id;
    await handler(null, 'workspace.setActiveWorkspace', { workspaceId: a });
    const opened = new Promise(resolve => { pickerOpened = resolve; });
    choose = () => new Promise(resolve => { releasePicker = resolve; pickerOpened(); });
    const pending = handler(null, 'workspace.setRoot');
    await opened;
    await handler(null, 'workspace.setActiveWorkspace', { workspaceId: b });
    assert.equal((await handler(null, 'workspace.getRoot')).root.workspaceId, b);
    releasePicker(second);
    assert.equal((await pending).root.workspaceId, a);
    assert.equal((await handler(null, 'workspace.getRoot')).root.rootPath, first);
    assert.equal((await handler(null, 'workspace.getRoot', { workspaceId: a })).root.rootPath, second);
    const restarted = createWorkspaceIpcHandler(options);
    assert.equal((await restarted(null, 'workspace.getRoot')).root.workspaceId, b);
    assert.equal((await restarted(null, 'workspace.getRoot', { workspaceId: a })).root.rootPath, second);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('unknown historical source is recoverable without falling back to a different workspace root', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'workspace-unknown-source-'));
  try {
    const root = join(dir, 'known'); await mkdir(root);
    const configPath = join(dir, 'settings.json');
    const viewStorePath = join(dir, 'views.json');
    await writeFile(configPath, JSON.stringify({ rootPath: root, activeWorkspaceId: 'unknown' }));
    await writeFile(viewStorePath, JSON.stringify({ workspaces: { unknown: { id: 'unknown', sourceFolderId: 'historical-unavailable-id', name: 'Archived context', order: 10 } }, views: {} }));
    const handler = createWorkspaceIpcHandler({ configPath, viewStorePath });
    const response = await handler(null, 'workspace.getRoot');
    assert.equal(response.root.workspaceId, 'unknown');
    assert.equal(response.root.rootPath, '');
    assert.equal((await handler(null, 'workspace.listWorkspaces')).workspaces[0].id, 'unknown');
    await assert.rejects(handler(null, 'workspace.scan', { workspaceId: 'unknown' }), { code: 'SOURCE_FOLDER_UNAVAILABLE' });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("rootless workspaces survive restart and selecting their source preserves siblings and views", async () => {
  const directory = await mkdtemp(join(tmpdir(), "workspace-rootless-"));
  const options = { configPath: join(directory, "settings.json"), viewStorePath: join(directory, "views.json"), propertyStorePath: join(directory, "properties.json") };
  try {
    const handler = createWorkspaceIpcHandler(options);
    const a = (await handler(null, "workspace.createWorkspace", { name: "A" })).workspace.id;
    const b = (await handler(null, "workspace.createWorkspace", { name: "B" })).workspace.id;
    assert.notEqual(a, b);
    const restarted = createWorkspaceIpcHandler(options);
    assert.equal((await restarted(null, "workspace.listWorkspaces")).workspaces.length, 2);
    assert.equal((await restarted(null, "workspace.getRoot", { workspaceId: a })).root.rootPath, "");
    const before = JSON.parse(await readFile(options.viewStorePath, "utf8"));
    const rootA = join(directory, "a");
    await mkdir(join(rootA, "Active", "Project"), { recursive: true });
    const picker = createWorkspaceIpcHandler({ ...options, chooseRoot: async () => rootA });
    await picker(null, "workspace.setRoot", { workspaceId: a });
    assert.equal((await restarted(null, "workspace.getRoot", { workspaceId: a })).root.rootPath, rootA);
    assert.equal((await restarted(null, "workspace.getRoot", { workspaceId: b })).root.rootPath, "");
    assert.deepEqual(JSON.parse(await readFile(options.viewStorePath, "utf8")).views, before.views);
    await restarted(null, "workspace.setActiveWorkspace", { workspaceId: b });
    assert.equal((await restarted(null, "workspace.getRoot")).root.workspaceId, b);
    const cancel = createWorkspaceIpcHandler({ ...options, chooseRoot: async () => "" });
    assert.equal(await cancel(null, "workspace.setRoot", { workspaceId: b }), null);
    assert.equal((await restarted(null, "workspace.getRoot", { workspaceId: b })).root.rootPath, "");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('Table grouping persists in JSON IPC across views/restart and property deletion disables grouping', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'workspace-grouping-ipc-'));
  try {
    const rootPath=join(dir,'projects');await mkdir(join(rootPath,'Active','Alpha'),{recursive:true});
    const configPath=join(dir,'settings.json'),viewStorePath=join(dir,'views.json');await writeFile(configPath,JSON.stringify({rootPath}));
    const options={configPath,viewStorePath,propertyStorePath:join(dir,'properties.json')};
    let handler=createWorkspaceIpcHandler(options);const root=await handler(null,'workspace.getRoot',{});const workspaceId=root.root.workspaceId;
    const property=await handler(null,'workspace.createProperty',{workspaceId,name:'Tags',type:'multi-select'});
    const propertyId=property.property.id;
    const views=await handler(null,'workspace.listViews',{workspaceId});const table=views.views.find(v=>v.viewType==='table');
    const grouping={propertyId,sort:'manual',manualOrder:['empty'],hiddenGroupIds:[],collapsedGroupIds:['empty'],hideEmpty:false};
    await handler(null,'workspace.updateView',{workspaceId,viewId:table.id,patch:{grouping}});
    handler=createWorkspaceIpcHandler(options);
    const saved=await handler(null,'workspace.listViews',{workspaceId});assert.deepEqual(saved.views.find(v=>v.id===table.id).grouping,grouping);assert.equal(saved.views.find(v=>v.viewType==='board').grouping,null);
    const projection=await handler(null,'workspace.getViewProjection',{workspaceId,viewId:table.id});assert.equal(projection.projection.groups[0].collapsed,true);assert.equal(projection.projection.totalProjectCount,1);
    await handler(null,'workspace.deleteProperty',{workspaceId,propertyId,confirmDeleteUsages:true});
    const after=await handler(null,'workspace.listViews',{workspaceId});assert.equal(after.views.find(v=>v.id===table.id).grouping,null);assert.equal(after.views.find(v=>v.id===table.id).groupingNotice,'property-removed');
  } finally {await rm(dir,{recursive:true,force:true});}
});
