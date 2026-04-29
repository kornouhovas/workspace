import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createFileResponse,
  createListEntriesResponse,
  createRootResponse,
  createScanResponse,
  createSelectRootResponse,
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
