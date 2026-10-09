import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, win32 } from "node:path";
import { createPackage } from "@electron/asar";
import test from "node:test";
import { checkArtifact, normalizeAsarEntry } from "../scripts/check-artifact.mjs";

const packagedFiles = [
  "dist/desktop/main.cjs",
  "dist/desktop/preload.cjs",
  "dist/service/entry.cjs",
  "dist/renderer/index.html",
  "dist/version.json",
  "dist/service/db/migrations/0000_settings.sql",
  "dist/service/db/migrations/0001_workspaces.sql",
  "dist/service/db/migrations/0002_workspace_order.sql",
  "dist/service/db/migrations/0003_source_discovery.sql",
  "dist/service/db/migrations/0004_direct_projects.sql",
    "dist/service/db/migrations/0005_text_properties.sql",
  "dist/service/db/migrations/meta/_journal.json",
];

async function makeArtifact(root, buildVersion = "0.1.0", omittedFiles = []) {
  const appDirectory = join(root, "app");
  const resourcesDirectory = join(root, "bundle", "resources");
  await mkdir(appDirectory, { recursive: true });
  await mkdir(join(resourcesDirectory, "licenses"), { recursive: true });
  for (const file of packagedFiles) {
    if (omittedFiles.includes(file)) continue;
    const path = join(appDirectory, file);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, file === "dist/version.json" ? JSON.stringify({ version: buildVersion }) : "present");
  }
  await writeFile(join(appDirectory, "package.json"), JSON.stringify({ version: "0.1.0" }));
  await writeFile(join(resourcesDirectory, "licenses/bb-MIT.txt"), "MIT License\nCopyright (c) 2026 Michael Yong");
  const asarPath = join(resourcesDirectory, "app.asar");
  await createPackage(appDirectory, asarPath);
  const nativeModule = join(`${asarPath}.unpacked`, "node_modules/better-sqlite3/prebuilds/darwin-arm64.node");
  await mkdir(dirname(nativeModule), { recursive: true });
  await writeFile(nativeModule, "native module placeholder");
  return root;
}

test("ASAR file listings normalize Windows separators before resource checks", () => {
  assert.equal(normalizeAsarEntry(win32.join("/", "package.json")), "package.json");
  assert.equal(
    normalizeAsarEntry(win32.join("/", "dist/service/db/migrations/meta/_journal.json")),
    "dist/service/db/migrations/meta/_journal.json",
  );
});

test("artifact check verifies launch resources, migration, native SQLite, license, and version", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-artifact-"));
  try {
    await makeArtifact(root);
    const result = await checkArtifact(join(root, "bundle"), { platform: "darwin", arch: "arm64" });
    assert.equal(result.version, "0.1.0");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("artifact check rejects a package/build version mismatch", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-artifact-version-"));
  try {
    await makeArtifact(root, "9.9.9");
    await assert.rejects(checkArtifact(join(root, "bundle"), { platform: "darwin", arch: "arm64" }), /versions differ/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("artifact check rejects a package missing Drizzle's migration journal", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-artifact-journal-"));
  try {
    await makeArtifact(root, "0.1.0", ["dist/service/db/migrations/meta/_journal.json"]);
    await assert.rejects(
      checkArtifact(join(root, "bundle"), { platform: "darwin", arch: "arm64" }),
      /missing dist\/service\/db\/migrations\/meta\/_journal\.json/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test("artifact check rejects a package missing the workspace order migration", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-artifact-order-"));
  try {
    await makeArtifact(root, "0.1.0", ["dist/service/db/migrations/0002_workspace_order.sql"]);
    await assert.rejects(
      checkArtifact(join(root, "bundle"), { platform: "darwin", arch: "arm64" }),
      /missing dist\/service\/db\/migrations\/0002_workspace_order\.sql/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("artifact check rejects a package missing the source discovery migration", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-artifact-discovery-"));
  try {
    await makeArtifact(root, "0.1.0", ["dist/service/db/migrations/0003_source_discovery.sql"]);
    await assert.rejects(
      checkArtifact(join(root, "bundle"), { platform: "darwin", arch: "arm64" }),
      /missing dist\/service\/db\/migrations\/0003_source_discovery\.sql/,
    );
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("artifact check rejects a package missing the project migration", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-artifact-projects-"));
  try {
    await makeArtifact(root, "0.1.0", ["dist/service/db/migrations/0004_direct_projects.sql"]);
    await assert.rejects(checkArtifact(join(root, "bundle"), { platform: "darwin", arch: "arm64" }),
      /missing dist\/service\/db\/migrations\/0004_direct_projects\.sql/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("artifact check rejects a package missing the Text-property migration", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-artifact-projects-"));
  try {
    await makeArtifact(root, "0.1.0", ["dist/service/db/migrations/0005_text_properties.sql"]);
    await assert.rejects(checkArtifact(join(root, "bundle"), { platform: "darwin", arch: "arm64" }),
      /missing dist\/service\/db\/migrations\/0005_text_properties\.sql/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
