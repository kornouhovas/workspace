import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  const response = await createScanResponse({
    root,
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
