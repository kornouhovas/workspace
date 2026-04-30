import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  createFileResponse,
  createListEntriesResponse,
  createPropertiesResponse,
  createRootResponse,
  createScanResponse,
  createSelectRootResponse,
  defaultLegacyWorkspacePropertiesPath,
  defaultLegacyWorkspaceSettingsPath,
  defaultWorkspacePropertiesPath,
  defaultWorkspaceSettingsPath,
  readWorkspaceProperties,
  readWorkspaceSettings,
} from "../src/workspaceBackend.js";
import { createFolderObjectId } from "../src/workspaceObjects.js";

async function createWorkspaceFixture() {
  const root = await mkdtemp(join(tmpdir(), "folder-kanban-workspace-"));
  await mkdir(join(root, "Archive", "Completed", "Assets"), { recursive: true });
  await mkdir(join(root, "Active", "Project Alpha"), { recursive: true });
  await mkdir(join(root, ".hidden"), { recursive: true });
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

test("readWorkspaceSettings returns empty settings for corrupt .workspace settings without legacy migration", async () => {
  const configPath = join(await mkdtemp(join(tmpdir(), "workspace-config-")), ".workspace", "settings.json");
  const legacyConfigPath = join(await mkdtemp(join(tmpdir(), "workspace-legacy-config-")), ".folder-kanban", "settings.json");
  const legacySettings = { rootPath: "/Users/example/Documents/Legacy Workspace" };
  await mkdir(dirname(configPath), { recursive: true });
  await mkdir(dirname(legacyConfigPath), { recursive: true });
  await writeFile(configPath, "{not json");
  await writeFile(legacyConfigPath, JSON.stringify(legacySettings));

  assert.deepEqual(await readWorkspaceSettings(configPath, legacyConfigPath), {});
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

test("readWorkspaceProperties returns empty properties for corrupt .workspace properties without legacy migration", async () => {
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

  assert.deepEqual(await readWorkspaceProperties(propertiesPath, legacyPropertiesPath), { roots: {} });
  assert.equal(await readFile(propertiesPath, "utf8"), "{not json");
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
  const configPath = join(await mkdtemp(join(tmpdir(), "folder-kanban-config-")), "settings.json");

  const response = await createSelectRootResponse({
    configPath,
    chooseRoot: async () => root,
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload.root.name, root.split("/").pop());
  assert.deepEqual(await readWorkspaceSettings(configPath), { rootPath: root });
});

test("createRootResponse reads the saved backend root", async () => {
  const root = await createWorkspaceFixture();
  const configPath = join(await mkdtemp(join(tmpdir(), "folder-kanban-config-")), "settings.json");
  await createSelectRootResponse({ configPath, chooseRoot: async () => root });

  const response = await createRootResponse({ configPath });

  assert.equal(response.status, 200);
  assert.equal(response.payload.root.name, root.split("/").pop());
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

test("createScanResponse attaches stored text properties to card folders", async () => {
  const root = await createWorkspaceFixture();
  const propertiesPath = join(await mkdtemp(join(tmpdir(), "folder-kanban-properties-")), "properties.json");
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
  assert.equal(response.payload.folders[0].text, "Meeting notes and project context");
});

test("createPropertiesResponse saves text properties for a card folder", async () => {
  const root = await createWorkspaceFixture();
  const propertiesPath = join(await mkdtemp(join(tmpdir(), "folder-kanban-properties-")), "properties.json");

  const response = await createPropertiesResponse({
    root,
    propertiesPath,
    body: {
      path: "Active/Project Alpha",
      text: "Inline table note",
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.payload.properties, { text: "Inline table note" });

  const properties = await readWorkspaceProperties(propertiesPath);
  assert.equal(properties.roots[createRootPropertiesKey(root)]["Active/Project Alpha"].text, "Inline table note");
});

test("createPropertiesResponse rejects properties outside workspace root", async () => {
  const root = await createWorkspaceFixture();
  const propertiesPath = join(await mkdtemp(join(tmpdir(), "folder-kanban-properties-")), "properties.json");

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

test("workspace backend rejects paths outside root", async () => {
  const root = await createWorkspaceFixture();
  const response = await createListEntriesResponse({ root, body: { path: "../outside" } });

  assert.equal(response.status, 400);
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
