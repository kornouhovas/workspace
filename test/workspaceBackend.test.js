import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  createFileResponse,
  createCreateViewResponse,
  createDeleteViewResponse,
  createListEntriesResponse,
  createProjectFileTreeResponse,
  createListViewsResponse,
  createPropertiesResponse,
  createReorderViewsResponse,
  createScanResponse,
  createSelectRootResponse,
  createSetActiveViewResponse,
  createUpdateViewResponse,
  createViewProjectionResponse,
  defaultLegacyWorkspacePropertiesPath,
  defaultLegacyWorkspaceSettingsPath,
  defaultWorkspacePropertiesPath,
  defaultWorkspaceSettingsPath,
  readWorkspaceProperties,
  readWorkspaceSettings,
  writeWorkspaceSettings,
} from "../src/workspaceBackend.js";
import { createFolderObjectId } from "../src/workspaceObjects.js";
import { PROPERTY_NAME_ID, PROPERTY_STATUS_ID } from "../src/workspaceViews.js";

async function createWorkspaceFixture() {
  const root = await mkdtemp(join(tmpdir(), "workspace-root-"));
  await mkdir(join(root, "Archive", "Completed", "Assets"), { recursive: true });
  await mkdir(join(root, "Active", "Project Alpha"), { recursive: true });
  await mkdir(join(root, ".hidden"), { recursive: true });
  await writeFile(join(root, "Archive", "Completed", "Assets", "logo.png"), "png");
  await writeFile(join(root, "Archive", "Completed", "Brief.pdf"), "pdf");
  await writeFile(join(root, "Archive", "Completed", ".env"), "hidden");
  await writeFile(join(root, "Archive", "Completed", "Archive.zip"), "zip");

  return root;
}

test("workspace backend uses .workspace default data paths and exposes legacy .folder-kanban paths", () => {
  assert.equal(defaultWorkspaceSettingsPath, join(process.cwd(), ".workspace", "settings.json"));
  assert.equal(defaultWorkspacePropertiesPath, join(process.cwd(), ".workspace", "properties.json"));
  assert.equal(defaultLegacyWorkspaceSettingsPath, join(process.cwd(), ".folder-kanban", "settings.json"));
  assert.equal(defaultLegacyWorkspacePropertiesPath, join(process.cwd(), ".folder-kanban", "properties.json"));
});

test("readWorkspaceSettings migrates legacy settings when the workspace settings file is missing", async () => {
  const configPath = join(await mkdtemp(join(tmpdir(), "workspace-config-")), ".workspace", "settings.json");
  const legacyConfigPath = join(await mkdtemp(join(tmpdir(), "workspace-legacy-config-")), ".folder-kanban", "settings.json");
  const settings = { rootPath: "/Users/example/Documents/Workspace" };
  await mkdir(join(legacyConfigPath, ".."), { recursive: true });
  await writeFile(legacyConfigPath, JSON.stringify(settings));

  assert.deepEqual(await readWorkspaceSettings(configPath, legacyConfigPath), settings);
  assert.deepEqual(JSON.parse(await readFile(configPath, "utf8")), settings);
});

test("workspace backend uses existing .workspace settings over legacy settings without overwriting it", async () => {
  const configPath = join(await mkdtemp(join(tmpdir(), "workspace-config-")), ".workspace", "settings.json");
  const legacyConfigPath = join(await mkdtemp(join(tmpdir(), "workspace-legacy-config-")), ".folder-kanban", "settings.json");
  const settings = { rootPath: "/Users/example/Documents/New Workspace" };
  const legacySettings = { rootPath: "/Users/example/Documents/Legacy Workspace" };
  const originalSettingsJson = `${JSON.stringify(settings, null, 2)}\n`;
  await mkdir(dirname(configPath), { recursive: true });
  await mkdir(dirname(legacyConfigPath), { recursive: true });
  await writeFile(configPath, originalSettingsJson);
  await writeFile(legacyConfigPath, JSON.stringify(legacySettings));

  assert.deepEqual(await readWorkspaceSettings(configPath, legacyConfigPath), settings);
  assert.equal(await readFile(configPath, "utf8"), originalSettingsJson);
});

test("readWorkspaceSettings surfaces corrupt .workspace settings without legacy migration", async () => {
  const configPath = join(await mkdtemp(join(tmpdir(), "workspace-config-")), ".workspace", "settings.json");
  const legacyConfigPath = join(await mkdtemp(join(tmpdir(), "workspace-legacy-config-")), ".folder-kanban", "settings.json");
  const legacySettings = { rootPath: "/Users/example/Documents/Legacy Workspace" };
  await mkdir(dirname(configPath), { recursive: true });
  await mkdir(dirname(legacyConfigPath), { recursive: true });
  await writeFile(configPath, "{not json");
  await writeFile(legacyConfigPath, JSON.stringify(legacySettings));

  await assert.rejects(
    readWorkspaceSettings(configPath, legacyConfigPath),
    { code: "WORKSPACE_STORAGE_CORRUPT" },
  );
  assert.equal(await readFile(configPath, "utf8"), "{not json");
});

test("readWorkspaceSettings migrates legacy settings from custom .workspace companion path", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-custom-config-"));
  const configPath = join(root, ".workspace", "settings.json");
  const legacyConfigPath = join(root, ".folder-kanban", "settings.json");
  const settings = { rootPath: "/Users/example/Documents/Custom Workspace" };
  await mkdir(dirname(legacyConfigPath), { recursive: true });
  await writeFile(legacyConfigPath, JSON.stringify(settings));

  assert.deepEqual(await readWorkspaceSettings(configPath), settings);
  assert.deepEqual(JSON.parse(await readFile(configPath, "utf8")), settings);
});

test("readWorkspaceSettings custom path without .workspace does not read default legacy settings", async () => {
  const isolatedWorkspaceBackend = await importWorkspaceBackendFromTempCwd();
  const configPath = join(await mkdtemp(join(tmpdir(), "workspace-custom-config-")), "settings.json");
  const defaultLegacySettingsPath = join(isolatedWorkspaceBackend.defaultLegacyWorkspaceSettingsPath);
  await mkdir(dirname(defaultLegacySettingsPath), { recursive: true });
  await writeFile(
    defaultLegacySettingsPath,
    JSON.stringify({ rootPath: "/Users/example/Documents/Default Legacy Workspace" }),
  );

  assert.deepEqual(await isolatedWorkspaceBackend.readWorkspaceSettings(configPath), {});
});

test("readWorkspaceProperties migrates legacy properties when the workspace properties file is missing", async () => {
  const propertiesPath = join(await mkdtemp(join(tmpdir(), "workspace-properties-")), ".workspace", "properties.json");
  const legacyPropertiesPath = join(
    await mkdtemp(join(tmpdir(), "workspace-legacy-properties-")),
    ".folder-kanban",
    "properties.json",
  );
  const properties = {
    roots: {
      abc123: {
        "Active/Project Alpha": { text: "Legacy note" },
      },
    },
  };
  await mkdir(join(legacyPropertiesPath, ".."), { recursive: true });
  await writeFile(legacyPropertiesPath, JSON.stringify(properties));

  assert.deepEqual(await readWorkspaceProperties(propertiesPath, legacyPropertiesPath), properties);
  assert.deepEqual(JSON.parse(await readFile(propertiesPath, "utf8")), properties);
});

test("readWorkspaceProperties surfaces corrupt .workspace properties without legacy migration", async () => {
  const propertiesPath = join(await mkdtemp(join(tmpdir(), "workspace-properties-")), ".workspace", "properties.json");
  const legacyPropertiesPath = join(
    await mkdtemp(join(tmpdir(), "workspace-legacy-properties-")),
    ".folder-kanban",
    "properties.json",
  );
  const legacyProperties = {
    roots: {
      abc123: {
        "Active/Project Alpha": { text: "Legacy note" },
      },
    },
  };
  await mkdir(dirname(propertiesPath), { recursive: true });
  await mkdir(dirname(legacyPropertiesPath), { recursive: true });
  await writeFile(propertiesPath, "{not json");
  await writeFile(legacyPropertiesPath, JSON.stringify(legacyProperties));

  await assert.rejects(
    readWorkspaceProperties(propertiesPath, legacyPropertiesPath),
    { code: "WORKSPACE_STORAGE_CORRUPT" },
  );
  assert.equal(await readFile(propertiesPath, "utf8"), "{not json");
});

test("writeWorkspaceSettings preserves corrupt existing settings before replacing them", async () => {
  const directory = await mkdtemp(join(tmpdir(), "workspace-config-"));
  const configPath = join(directory, "settings.json");
  await writeFile(configPath, "{not json");

  await writeWorkspaceSettings(configPath, { rootPath: "/Users/example/Documents/Workspace" });

  assert.deepEqual(JSON.parse(await readFile(configPath, "utf8")), {
    rootPath: "/Users/example/Documents/Workspace",
  });
  const backups = (await readdir(directory)).filter((name) => name.startsWith("settings.json.corrupt-"));
  assert.equal(backups.length, 1);
  assert.equal(await readFile(join(directory, backups[0]), "utf8"), "{not json");
  assert.deepEqual(
    (await readdir(directory)).filter((name) => name.endsWith(".tmp")),
    [],
  );
});

test("readWorkspaceProperties migrates legacy properties from custom .workspace companion path", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-custom-properties-"));
  const propertiesPath = join(root, ".workspace", "properties.json");
  const legacyPropertiesPath = join(root, ".folder-kanban", "properties.json");
  const properties = {
    roots: {
      abc123: {
        "Active/Project Alpha": { text: "Custom legacy note" },
      },
    },
  };
  await mkdir(dirname(legacyPropertiesPath), { recursive: true });
  await writeFile(legacyPropertiesPath, JSON.stringify(properties));

  assert.deepEqual(await readWorkspaceProperties(propertiesPath), properties);
  assert.deepEqual(JSON.parse(await readFile(propertiesPath, "utf8")), properties);
});

test("readWorkspaceProperties custom path without .workspace does not read default legacy properties", async () => {
  const isolatedWorkspaceBackend = await importWorkspaceBackendFromTempCwd();
  const propertiesPath = join(await mkdtemp(join(tmpdir(), "workspace-custom-properties-")), "properties.json");
  const legacyProperties = {
    roots: {
      abc123: {
        "Active/Project Alpha": { text: "Default legacy note" },
      },
    },
  };
  const defaultLegacyPropertiesPath = join(isolatedWorkspaceBackend.defaultLegacyWorkspacePropertiesPath);
  await mkdir(dirname(defaultLegacyPropertiesPath), { recursive: true });
  await writeFile(defaultLegacyPropertiesPath, JSON.stringify(legacyProperties));

  assert.deepEqual(await isolatedWorkspaceBackend.readWorkspaceProperties(propertiesPath), { roots: {} });
});

test("createSelectRootResponse saves the selected backend root", async () => {
  const root = await createWorkspaceFixture();
  const configPath = join(await mkdtemp(join(tmpdir(), "workspace-config-")), "settings.json");

  const response = await createSelectRootResponse({
    configPath,
    chooseRoot: async () => root,
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload.root.name, root.split("/").pop());
  assert.deepEqual(await readWorkspaceSettings(configPath), { rootPath: root });
});

test("createScanResponse builds access tree and cards from saved root", async () => {
  const root = await createWorkspaceFixture();
  const propertiesPath = join(await mkdtemp(join(tmpdir(), "workspace-properties-")), ".workspace", "properties.json");
  const response = await createScanResponse({
    root,
    propertiesPath,
    rules: {
      Archive: { role: "status", expanded: true },
      "Archive/Completed": { role: "card" },
      Active: { role: "status" },
      "Active/Project Alpha": { role: "card" },
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.payload.folders.map((folder) => [folder.name, folder.status, folder.path]),
    [
      ["Project Alpha", "Active", "Active/Project Alpha"],
      ["Completed", "Archive", "Archive/Completed"],
    ],
  );
  const workspaceId = `workspace:${createRootPropertiesKey(root)}`;
  assert.equal(response.payload.workspace.id, workspaceId);
  assert.deepEqual(
    response.payload.workspace.objects.map((object) => [
      object.id,
      object.workspaceId,
      object.type,
      object.source.kind,
      object.source.path,
      object.source.absoluteRoot,
      object.folderName,
      object.folderStatus,
    ]),
    [
      [
        createFolderObjectId(workspaceId, "Active/Project Alpha"),
        workspaceId,
        "project",
        "folder",
        "Active/Project Alpha",
        root,
        "Project Alpha",
        "Active",
      ],
      [
        createFolderObjectId(workspaceId, "Archive/Completed"),
        workspaceId,
        "project",
        "folder",
        "Archive/Completed",
        root,
        "Completed",
        "Archive",
      ],
    ],
  );
  assert.deepEqual(response.payload.workspace.propertyValues, []);
  assert.equal(response.payload.tree.some((node) => node.name === ".hidden"), false);
});

test("createScanResponse can include card descendants for settings folder role configuration", async () => {
  const root = await createWorkspaceFixture();
  const propertiesPath = join(await mkdtemp(join(tmpdir(), "workspace-properties-")), ".workspace", "properties.json");
  const response = await createScanResponse({
    root,
    propertiesPath,
    includeCardChildren: true,
    rules: {
      Archive: { role: "status" },
      "Archive/Completed": { role: "card" },
    },
  });

  assert.equal(response.status, 200);
  const archiveNode = response.payload.tree.find((node) => node.name === "Archive");
  const completedNode = archiveNode.children.find((node) => node.name === "Completed");
  assert.deepEqual(completedNode.children.map((node) => node.name), ["Assets"]);
  const completedObject = response.payload.workspace.objects.find((object) => object.folderName === "Completed");
  assert.equal(Object.hasOwn(completedObject, "fileTree"), false);
  assert.deepEqual(
    response.payload.folders.map((folder) => [folder.name, folder.status, folder.path]),
    [
      ["Project Alpha", "Active", "Active/Project Alpha"],
      ["Completed", "Archive", "Archive/Completed"],
    ],
  );
});

test("createScanResponse does not expose legacy text as a default card property", async () => {
  const root = await createWorkspaceFixture();
  const propertiesPath = join(await mkdtemp(join(tmpdir(), "workspace-properties-")), "properties.json");
  const rootKey = createRootPropertiesKey(root);
  await writeFile(
    propertiesPath,
    JSON.stringify({
      roots: {
        [rootKey]: {
          "Active/Project Alpha": { text: "Meeting notes and project context" },
        },
      },
    }),
  );

  const response = await createScanResponse({
    root,
    propertiesPath,
    rules: {
      Active: { role: "status" },
      "Active/Project Alpha": { role: "card" },
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload.folders[0].text, undefined);
});

test("createProjectFileTreeResponse returns a selected project folder tree on demand", async () => {
  const root = await createWorkspaceFixture();
  const response = await createProjectFileTreeResponse({
    root,
    body: { path: "Archive/Completed" },
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload.path, "Archive/Completed");
  assert.deepEqual(
    response.payload.fileTree.map((node) => [node.kind, node.name, node.relativePath]),
    [
      ["folder", "Assets", "Archive/Completed/Assets"],
      ["file", "Archive.zip", "Archive/Completed/Archive.zip"],
      ["file", "Brief.pdf", "Archive/Completed/Brief.pdf"],
    ],
  );
  assert.deepEqual(
    response.payload.fileTree[0].children.map((node) => [node.kind, node.name, node.relativePath]),
    [["file", "logo.png", "Archive/Completed/Assets/logo.png"]],
  );
  assert.equal(response.payload.fileTree.some((node) => node.name === ".env"), false);
});

test("createPropertiesResponse requires an explicit user property id", async () => {
  const root = await createWorkspaceFixture();
  const propertiesPath = join(await mkdtemp(join(tmpdir(), "workspace-properties-")), "properties.json");

  const response = await createPropertiesResponse({
    root,
    propertiesPath,
    body: {
      path: "Active/Project Alpha",
      text: "Inline table note",
    },
  });

  assert.equal(response.status, 400);
  assert.match(response.payload.error, /Property id is required/);
  assert.deepEqual(await readWorkspaceProperties(propertiesPath), { roots: {} });
});

test("createPropertiesResponse validates custom properties without overwriting text json", async () => {
  const root = await createWorkspaceFixture();
  const propertiesPath = join(await mkdtemp(join(tmpdir(), "workspace-properties-")), "properties.json");
  const rootKey = createRootPropertiesKey(root);
  await writeFile(
    propertiesPath,
    JSON.stringify({
      roots: {
        [rootKey]: {
          "Active/Project Alpha": { text: "Existing note" },
        },
      },
    }),
  );

  const response = await createPropertiesResponse({
    root,
    propertiesPath,
    body: {
      path: "Active/Project Alpha",
      propertyId: "property:number-1",
      type: "number",
      value: 42,
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.payload.properties, { text: "Existing note" });

  const properties = await readWorkspaceProperties(propertiesPath);
  assert.equal(properties.roots[rootKey]["Active/Project Alpha"].text, "Existing note");
});

test("createPropertiesResponse rejects properties outside workspace root", async () => {
  const root = await createWorkspaceFixture();
  const propertiesPath = join(await mkdtemp(join(tmpdir(), "workspace-properties-")), "properties.json");

  const response = await createPropertiesResponse({
    root,
    propertiesPath,
    body: {
      path: "../Project Alpha",
      text: "Outside",
    },
  });

  assert.equal(response.status, 400);
});

test("createListEntriesResponse returns visible folders first then files", async () => {
  const root = await createWorkspaceFixture();
  const response = await createListEntriesResponse({ root, body: { path: "Archive/Completed" } });

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.payload.entries.map((entry) => [entry.kind, entry.name, entry.path]),
    [
      ["directory", "Assets", "Archive/Completed/Assets"],
      ["file", "Archive.zip", "Archive/Completed/Archive.zip"],
      ["file", "Brief.pdf", "Archive/Completed/Brief.pdf"],
    ],
  );
});

test("createListEntriesResponse can list the selected root folder", async () => {
  const root = await createWorkspaceFixture();
  await writeFile(join(root, "Readme.txt"), "root file");
  const response = await createListEntriesResponse({ root, body: { path: "" } });

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.payload.entries.map((entry) => [entry.kind, entry.name, entry.path]),
    [
      ["directory", "Active", "Active"],
      ["directory", "Archive", "Archive"],
      ["file", "Readme.txt", "Readme.txt"],
    ],
  );
});

test("createFileResponse streams previewable files inside root", async () => {
  const root = await createWorkspaceFixture();
  const response = await createFileResponse({ root, path: "Archive/Completed/Brief.pdf" });

  assert.equal(response.status, 200);
  assert.equal(response.contentType, "application/pdf");
  assert.equal(response.filePath, join(root, "Archive", "Completed", "Brief.pdf"));
});

test("createFileResponse rejects symlink previews outside root", async () => {
  const root = await createWorkspaceFixture();
  const outside = await mkdtemp(join(tmpdir(), "workspace-outside-"));
  await writeFile(join(outside, "Secret.pdf"), "secret");
  await symlink(join(outside, "Secret.pdf"), join(root, "Archive", "Completed", "Secret.pdf"));

  const response = await createFileResponse({ root, path: "Archive/Completed/Secret.pdf" });

  assert.equal(response.status, 400);
});

test("createFileResponse rejects unsupported types and broken symlink previews", async (t) => {
  const root = await createWorkspaceFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const outside = await mkdtemp(join(tmpdir(), "workspace-outside-"));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await symlink(join(outside, "Missing.pdf"), join(root, "Archive", "Completed", "Missing.pdf"));

  const unsupportedResponse = await createFileResponse({
    root,
    path: "Archive/Completed/Archive.zip",
  });
  const brokenSymlinkResponse = await createFileResponse({
    root,
    path: "Archive/Completed/Missing.pdf",
  });

  assert.equal(unsupportedResponse.status, 415);
  assert.equal(brokenSymlinkResponse.status, 404);
});

test("workspace backend rejects paths outside root", async () => {
  const root = await createWorkspaceFixture();
  const response = await createListEntriesResponse({ root, body: { path: "../outside" } });

  assert.equal(response.status, 400);
});

test("workspace backend rejects an explicit directory symlink outside root", async (t) => {
  const root = await createWorkspaceFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const outside = await mkdtemp(join(tmpdir(), "workspace-outside-"));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await mkdir(join(outside, "External"));
  await writeFile(join(outside, "External", "Secret.txt"), "secret");
  await symlink(join(outside, "External"), join(root, "External"));

  const response = await createListEntriesResponse({ root, body: { path: "External" } });

  assert.equal(response.status, 400);
  assert.match(response.payload.error, /outside workspace root/);
});

test("createCreateViewResponse creates a default active Board view", async () => {
  const now = "2026-05-14T10:00:00.000Z";
  const store = createMemoryViewStore({
    workspaces: [{ id: "workspace:ops", activeViewId: null }],
  });

  const response = await createCreateViewResponse({
    body: { workspaceId: "workspace:ops", viewType: "board" },
    viewStore: store,
    idFactory: () => "abc-123",
    now: () => now,
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload.workspaceId, "workspace:ops");
  assert.equal(response.payload.activeViewId, "view:abc-123");
  assert.deepEqual(response.payload.view, {
    id: "view:abc-123",
    type: "view",
    schemaVersion: 1,
    workspaceId: "workspace:ops",
    name: "Board",
    viewType: "board",
    order: 10,
    visiblePropertyIds: [PROPERTY_NAME_ID, PROPERTY_STATUS_ID],
    hiddenPropertyIds: [],
    propertyOrder: {
      [PROPERTY_NAME_ID]: 10,
      [PROPERTY_STATUS_ID]: 20,
    },
    valueVisibility: {},
    propertyLayout: {},
    boardLayout: { columnWidth: 384 },
    grouping: null,
    groupingNotice: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
  assert.equal((await store.getWorkspace("workspace:ops")).activeViewId, "view:abc-123");
});

test("createListViewsResponse preserves explicit view property visibility while normalizing defaults", async () => {
  const store = createMemoryViewStore({
    workspaces: [{ id: "workspace:ops", activeViewId: "view:second" }],
    views: [
      createStoredView({ id: "view:second", order: 20, name: "" }),
      createStoredView({ id: "view:first", order: 10, visiblePropertyIds: ["property:name"] }),
      createStoredView({ id: "view:deleted", order: 30, deletedAt: "2026-05-14T10:00:00.000Z" }),
    ],
  });

  const response = await createListViewsResponse({
    body: { workspaceId: "workspace:ops" },
    viewStore: store,
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload.workspaceId, "workspace:ops");
  assert.equal(response.payload.activeViewId, "view:second");
  assert.notEqual(response.payload.activeViewId, undefined);
  assert.deepEqual(
    response.payload.views.map((view) => [view.id, view.name, view.visiblePropertyIds]),
    [
      ["view:first", "Board", [PROPERTY_NAME_ID]],
      ["view:second", "Board", [PROPERTY_NAME_ID, PROPERTY_STATUS_ID]],
    ],
  );
});

test("createReorderViewsResponse updates orders and preserves active view", async () => {
  const now = "2026-05-14T14:00:00.000Z";
  const store = createMemoryViewStore({
    workspaces: [{ id: "workspace:ops", activeViewId: "view:board" }],
    views: [
      createStoredView({ id: "view:board", order: 10 }),
      createStoredView({ id: "view:table", order: 20, viewType: "table", name: "Table" }),
    ],
  });

  const response = await createReorderViewsResponse({
    body: { workspaceId: "workspace:ops", orderedViewIds: ["view:table", "view:board"] },
    viewStore: store,
    now: () => now,
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.payload, {
    views: [
      { id: "view:table", order: 10 },
      { id: "view:board", order: 20 },
    ],
  });
  assert.equal((await store.getWorkspace("workspace:ops")).activeViewId, "view:board");
  assert.equal((await store.getView("view:table")).order, 10);
  assert.equal((await store.getView("view:board")).order, 20);
  assert.equal((await store.getView("view:table")).updatedAt, now);
  assert.equal((await store.getView("view:board")).updatedAt, now);
});

test("createReorderViewsResponse rejects invalid view orders without mutation", async (t) => {
  const store = createMemoryViewStore({
    workspaces: [
      { id: "workspace:ops", activeViewId: "view:board" },
      { id: "workspace:other", activeViewId: "view:foreign" },
    ],
    views: [
      createStoredView({ id: "view:board", order: 10 }),
      createStoredView({ id: "view:table", order: 20, viewType: "table", name: "Table" }),
      createStoredView({ id: "view:foreign", workspaceId: "workspace:other", order: 10 }),
      createStoredView({ id: "view:deleted", order: 30, deletedAt: "2026-05-14T10:00:00.000Z" }),
    ],
  });

  const cases = [
    { name: "duplicate active id", orderedViewIds: ["view:table", "view:table"] },
    { name: "missing active id", orderedViewIds: ["view:table"] },
    { name: "extra foreign id", orderedViewIds: ["view:table", "view:foreign"] },
    { name: "deleted id", orderedViewIds: ["view:table", "view:deleted"] },
    { name: "missing payload", orderedViewIds: undefined },
    { name: "non-array payload", orderedViewIds: "view:table" },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const body = { workspaceId: "workspace:ops" };
      if (testCase.orderedViewIds !== undefined) {
        body.orderedViewIds = testCase.orderedViewIds;
      }

      const response = await createReorderViewsResponse({
        body,
        viewStore: store,
        now: () => "2026-05-14T14:00:00.000Z",
      });

      assert.equal(response.status, 400);
      assert.equal(response.payload.code, "INVALID_VIEW_ORDER");
      assert.equal(response.payload.field, "orderedViewIds");
      assert.equal((await store.getView("view:board")).order, 10);
      assert.equal((await store.getView("view:table")).order, 20);
      assert.equal((await store.getView("view:deleted")).order, 30);
      assert.equal((await store.getView("view:board")).updatedAt, "2026-05-14T09:00:00.000Z");
      assert.equal((await store.getView("view:table")).updatedAt, "2026-05-14T09:00:00.000Z");
      assert.equal((await store.getView("view:deleted")).updatedAt, "2026-05-14T09:00:00.000Z");
    });
  }
});

test("createSetActiveViewResponse rejects missing foreign and deleted views", async () => {
  const store = createMemoryViewStore({
    workspaces: [
      { id: "workspace:ops", activeViewId: "view:current" },
      { id: "workspace:other", activeViewId: null },
    ],
    views: [
      createStoredView({ id: "view:current" }),
      createStoredView({ id: "view:foreign", workspaceId: "workspace:other" }),
      createStoredView({ id: "view:deleted", deletedAt: "2026-05-14T10:00:00.000Z" }),
    ],
  });

  const missingResponse = await createSetActiveViewResponse({
    body: { workspaceId: "workspace:ops", viewId: "view:missing" },
    viewStore: store,
  });
  const foreignResponse = await createSetActiveViewResponse({
    body: { workspaceId: "workspace:ops", viewId: "view:foreign" },
    viewStore: store,
  });
  const deletedResponse = await createSetActiveViewResponse({
    body: { workspaceId: "workspace:ops", viewId: "view:deleted" },
    viewStore: store,
  });

  assert.equal(missingResponse.status, 400);
  assert.equal(foreignResponse.status, 400);
  assert.equal(deletedResponse.status, 400);
  assert.equal((await store.getWorkspace("workspace:ops")).activeViewId, "view:current");
});

test("createSetActiveViewResponse saves a valid active view", async () => {
  const now = "2026-05-14T11:00:00.000Z";
  const store = createMemoryViewStore({
    workspaces: [{ id: "workspace:ops", activeViewId: "view:first" }],
    views: [createStoredView({ id: "view:first" }), createStoredView({ id: "view:second", order: 20 })],
  });

  const response = await createSetActiveViewResponse({
    body: { workspaceId: "workspace:ops", viewId: "view:second" },
    viewStore: store,
    now: () => now,
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.payload, { workspaceId: "workspace:ops", activeViewId: "view:second" });
  assert.equal((await store.getWorkspace("workspace:ops")).activeViewId, "view:second");
  assert.equal((await store.getWorkspace("workspace:ops")).updatedAt, now);
});

test("createUpdateViewResponse validates patch references and saves normalized updated view", async () => {
  const now = "2026-05-14T12:00:00.000Z";
  const store = createMemoryViewStore({
    workspaces: [{ id: "workspace:ops", activeViewId: "view:board" }],
    views: [createStoredView({ id: "view:board", name: "Ops board" })],
  });

  const response = await createUpdateViewResponse({
    body: {
      workspaceId: "workspace:ops",
      viewId: "view:board",
      patch: {
        name: "Filtered ops",
        visiblePropertyIds: [PROPERTY_NAME_ID, PROPERTY_STATUS_ID, "property:priority"],
        propertyOrder: {
          [PROPERTY_NAME_ID]: 30,
          [PROPERTY_STATUS_ID]: 10,
          "property:priority": 20,
        },
        valueVisibility: {
          [PROPERTY_STATUS_ID]: { valueIds: ["statusValue:active"] },
          "property:priority": { valueIds: ["selectValue:high"], includeEmpty: true },
        },
        boardLayout: { columnWidth: 456 },
      },
    },
    viewStore: store,
    propertyDefinitions: [
      { id: PROPERTY_NAME_ID, type: "text" },
      { id: PROPERTY_STATUS_ID, type: "status" },
      { id: "property:priority", type: "select" },
    ],
    selectValues: [{ id: "selectValue:high", propertyId: "property:priority" }],
    statusValues: [{ id: "statusValue:active", name: "Active" }],
    now: () => now,
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload.view.name, "Filtered ops");
  assert.deepEqual(response.payload.view.visiblePropertyIds, [
    PROPERTY_NAME_ID,
    PROPERTY_STATUS_ID,
    "property:priority",
  ]);
  assert.deepEqual(response.payload.view.valueVisibility, {
    [PROPERTY_STATUS_ID]: {
      mode: "include",
      valueIds: ["statusValue:active"],
      includeEmpty: false,
    },
    "property:priority": {
      mode: "include",
      valueIds: ["selectValue:high"],
      includeEmpty: true,
    },
  });
  assert.deepEqual(response.payload.view.boardLayout, { columnWidth: 456 });
  assert.equal(response.payload.view.updatedAt, now);
  assert.deepEqual(await store.getView("view:board"), response.payload.view);
});

test("createUpdateViewResponse forbids invalid view patches", async () => {
  const store = createMemoryViewStore({
    workspaces: [{ id: "workspace:ops", activeViewId: "view:board" }],
    views: [createStoredView({ id: "view:board" })],
  });

  const response = await createUpdateViewResponse({
    body: {
      workspaceId: "workspace:ops",
      viewId: "view:board",
      patch: {
        visiblePropertyIds: [PROPERTY_NAME_ID, PROPERTY_STATUS_ID, "property:missing"],
      },
    },
    viewStore: store,
    propertyDefinitions: [
      { id: PROPERTY_NAME_ID, type: "text" },
      { id: PROPERTY_STATUS_ID, type: "status" },
    ],
  });

  assert.equal(response.status, 400);
  assert.equal(response.payload.code, "INVALID_PROPERTY_REFERENCE");
  assert.equal((await store.getView("view:board")).updatedAt, "2026-05-14T09:00:00.000Z");
});

test("createUpdateViewResponse rejects property order for hidden properties", async () => {
  const store = createMemoryViewStore({
    workspaces: [{ id: "workspace:ops", activeViewId: "view:board" }],
    views: [createStoredView({ id: "view:board" })],
  });

  const response = await createUpdateViewResponse({
    body: {
      workspaceId: "workspace:ops",
      viewId: "view:board",
      patch: {
        propertyOrder: {
          "property:hidden": 5,
        },
      },
    },
    viewStore: store,
    propertyDefinitions: [
      { id: PROPERTY_NAME_ID, type: "text" },
      { id: PROPERTY_STATUS_ID, type: "status" },
      { id: "property:hidden", type: "text" },
    ],
  });

  assert.equal(response.status, 400);
  assert.equal(response.payload.code, "INVALID_PROPERTY_REFERENCE");
  assert.equal(response.payload.message, "Property order references a hidden property.");
  assert.deepEqual(await store.getView("view:board"), createStoredView({ id: "view:board" }));
});

test("createDeleteViewResponse blocks deleting the last non-deleted view", async () => {
  const store = createMemoryViewStore({
    workspaces: [{ id: "workspace:ops", activeViewId: "view:only" }],
    views: [createStoredView({ id: "view:only" })],
  });

  const response = await createDeleteViewResponse({
    body: { workspaceId: "workspace:ops", viewId: "view:only" },
    viewStore: store,
  });

  assert.equal(response.status, 409);
  assert.equal(response.payload.code, "LAST_VIEW_DELETE_BLOCKED");
  assert.equal((await store.getView("view:only")).deletedAt, null);
  assert.equal((await store.getWorkspace("workspace:ops")).activeViewId, "view:only");
});

test("createDeleteViewResponse soft-deletes a non-last active view and switches active view", async () => {
  const now = "2026-05-14T13:00:00.000Z";
  const store = createMemoryViewStore({
    workspaces: [{ id: "workspace:ops", activeViewId: "view:active" }],
    views: [
      createStoredView({ id: "view:active", order: 10 }),
      createStoredView({ id: "view:remaining", order: 20 }),
    ],
  });

  const response = await createDeleteViewResponse({
    body: { workspaceId: "workspace:ops", viewId: "view:active" },
    viewStore: store,
    now: () => now,
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.payload, {
    workspaceId: "workspace:ops",
    activeViewId: "view:remaining",
    deletedViewId: "view:active",
  });
  assert.equal((await store.getView("view:active")).deletedAt, now);
  assert.equal((await store.getView("view:active")).updatedAt, now);
  assert.equal((await store.getWorkspace("workspace:ops")).activeViewId, "view:remaining");
});

test("createViewProjectionResponse projects board and table views with async providers", async () => {
  const priorityPropertyId = "property:priority";
  const statusValues = [
    { id: "statusValue:active", name: "Active", relativePath: "Active", source: "folderRole" },
    { id: "statusValue:no-status", name: "No status", relativePath: null, source: "no-status" },
  ];
  const visibleProperties = [
    { id: PROPERTY_NAME_ID, name: "Name", type: "text", system: true },
    { id: PROPERTY_STATUS_ID, name: "Status", type: "status", system: true },
    { id: priorityPropertyId, name: "Priority", type: "select" },
  ];
  const projects = [
    {
      id: "project:alpha",
      name: "Alpha",
      status: statusValues[0],
      propertyValues: {
        [priorityPropertyId]: "selectValue:high",
      },
    },
    {
      id: "project:alpha-low",
      name: "Alpha backlog",
      status: statusValues[1],
      propertyValues: {
        [priorityPropertyId]: "selectValue:low",
      },
    },
  ];
  const boardView = createStoredView({
    id: "view:board",
    visiblePropertyIds: [PROPERTY_NAME_ID, PROPERTY_STATUS_ID, priorityPropertyId],
    valueVisibility: {
      [priorityPropertyId]: { valueIds: ["selectValue:high"] },
    },
  });
  const tableView = createStoredView({
    id: "view:table",
    name: "Table",
    viewType: "table",
    order: 20,
    visiblePropertyIds: [PROPERTY_NAME_ID, PROPERTY_STATUS_ID, priorityPropertyId],
    valueVisibility: {
      [priorityPropertyId]: { valueIds: ["selectValue:high"] },
    },
  });
  const store = createMemoryViewStore({
    workspaces: [{ id: "workspace:ops", activeViewId: "view:board" }],
    views: [boardView, tableView],
  });
  const projectProviderCalls = [];
  const propertyProviderCalls = [];
  const projectProvider = async ({ workspaceId }) => {
    projectProviderCalls.push({ workspaceId });
    return projects;
  };
  const propertyProvider = async ({ workspaceId, view }) => {
    propertyProviderCalls.push({ workspaceId, viewId: view.id });
    return { visibleProperties, statusValues };
  };

  const boardResponse = await createViewProjectionResponse({
    body: { workspaceId: "workspace:ops", searchQuery: "alpha" },
    viewStore: store,
    projectProvider,
    propertyProvider,
  });
  const tableResponse = await createViewProjectionResponse({
    body: { workspaceId: "workspace:ops", viewId: "view:table", searchQuery: "alpha" },
    viewStore: store,
    projectProvider,
    propertyProvider,
  });

  assert.equal(boardResponse.status, 200);
  assert.equal(boardResponse.payload.projection.type, "board");
  assert.deepEqual(
    boardResponse.payload.projection.columns.map((column) => [
      column.statusValueId,
      column.projects.map((project) => project.id),
    ]),
    [
      ["statusValue:active", ["project:alpha"]],
      ["statusValue:no-status", []],
    ],
  );
  assert.equal(boardResponse.payload.projection.capabilities.canMoveBetweenStatuses, false);
  assert.equal(tableResponse.status, 200);
  assert.deepEqual(
    tableResponse.payload.projection.rows.map((project) => project.id),
    ["project:alpha"],
  );
  assert.deepEqual(projectProviderCalls, [
    { workspaceId: "workspace:ops" },
    { workspaceId: "workspace:ops" },
  ]);
  assert.deepEqual(propertyProviderCalls, [
    { workspaceId: "workspace:ops", viewId: "view:board" },
    { workspaceId: "workspace:ops", viewId: "view:table" },
  ]);
});

test("createViewProjectionResponse rejects missing active view when view id is omitted", async () => {
  const store = createMemoryViewStore({
    workspaces: [{ id: "workspace:ops", activeViewId: null }],
  });

  const response = await createViewProjectionResponse({
    body: { workspaceId: "workspace:ops" },
    viewStore: store,
    projectProvider: async () => [],
    propertyProvider: async () => ({ visibleProperties: [], statusValues: [] }),
  });

  assert.equal(response.status, 400);
  assert.equal(response.payload.code, "VIEW_NOT_FOUND");
  assert.equal(response.payload.message, "Active view was not found.");
  assert.equal(response.payload.field, "viewId");
});

function createRootPropertiesKey(root) {
  return createHash("sha256").update(root).digest("hex").slice(0, 16);
}

async function importWorkspaceBackendFromTempCwd() {
  const originalCwd = process.cwd();
  const cwd = await mkdtemp(join(tmpdir(), "workspace-isolated-cwd-"));
  process.chdir(cwd);
  try {
    return await import(`../src/workspaceBackend.js?cwd=${encodeURIComponent(cwd)}`);
  } finally {
    process.chdir(originalCwd);
  }
}

function createStoredView(overrides = {}) {
  return {
    id: "view:board",
    type: "view",
    schemaVersion: 1,
    workspaceId: "workspace:ops",
    name: "Board",
    viewType: "board",
    order: 10,
    visiblePropertyIds: [PROPERTY_NAME_ID, PROPERTY_STATUS_ID],
    hiddenPropertyIds: [],
    propertyOrder: {
      [PROPERTY_NAME_ID]: 10,
      [PROPERTY_STATUS_ID]: 20,
    },
    valueVisibility: {},
    createdAt: "2026-05-14T09:00:00.000Z",
    updatedAt: "2026-05-14T09:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function createMemoryViewStore({ workspaces = [], views = [] } = {}) {
  const workspaceMap = new Map(workspaces.map((workspace) => [workspace.id, structuredClone(workspace)]));
  const viewMap = new Map(views.map((view) => [view.id, structuredClone(view)]));

  return {
    async getWorkspace(workspaceId) {
      const workspace = workspaceMap.get(workspaceId);
      return workspace ? structuredClone(workspace) : null;
    },
    async saveWorkspace(workspacePatchOrDocument) {
      const existing = workspaceMap.get(workspacePatchOrDocument.id) || {};
      const workspace = { ...existing, ...structuredClone(workspacePatchOrDocument) };
      workspaceMap.set(workspace.id, workspace);
      return structuredClone(workspace);
    },
    async listViews(workspaceId) {
      return [...viewMap.values()]
        .filter((view) => view.workspaceId === workspaceId && !view.deletedAt)
        .sort((left, right) => (
          left.order - right.order
          || String(left.createdAt).localeCompare(String(right.createdAt))
          || left.id.localeCompare(right.id)
        ))
        .map((view) => structuredClone(view));
    },
    async getView(viewId) {
      const view = viewMap.get(viewId);
      return view ? structuredClone(view) : null;
    },
    async saveView(viewDocument) {
      viewMap.set(viewDocument.id, structuredClone(viewDocument));
      return structuredClone(viewDocument);
    },
  };
}
