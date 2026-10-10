import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
  "dist/service/db/migrations/0006_grouped_discovery.sql",
  "dist/service/db/migrations/0007_discovery_mode_changes.sql",
  "dist/service/db/migrations/meta/_journal.json",
];

async function makeArtifact(root, buildVersion = "0.1.0", omittedFiles = [], omitModeJournalEntry = false) {
  const appDirectory = join(root, "app");
  const resourcesDirectory = join(root, "bundle", "resources");
  await mkdir(appDirectory, { recursive: true });
  await mkdir(join(resourcesDirectory, "licenses"), { recursive: true });
  for (const file of packagedFiles) {
    if (omittedFiles.includes(file)) continue;
    const path = join(appDirectory, file);
    await mkdir(dirname(path), { recursive: true });
    let contents = "present";
    if (file === "dist/version.json") contents = JSON.stringify({ version: buildVersion });
    if (file === "dist/service/db/migrations/meta/_journal.json") {
      const journal = JSON.parse(await readFile("src/service/db/migrations/meta/_journal.json", "utf8"));
      if (omitModeJournalEntry) journal.entries = journal.entries.filter((entry) => entry.idx !== 7);
      contents = JSON.stringify(journal);
    }
    await writeFile(path, contents);
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

test("artifact checks extract real ASAR entries with Windows path semantics", async (t) => {
  // Only the child changes node:path. External fixture paths stay host-native;
  // relative archive paths and ASAR traversal use Windows separators.
  const code = `
    import assert from "node:assert/strict";
    import path from "node:path";
    import { syncBuiltinESMExports } from "node:module";
    import { checkArtifact } from ${JSON.stringify(new URL("../scripts/check-artifact.mjs", import.meta.url).href)};
    const native = { join: path.join, dirname: path.dirname, basename: path.basename, sep: path.sep };
    // On Windows path.win32 is path itself, so capture before replacing methods.
    const windows = { join: path.win32.join, dirname: path.win32.dirname, basename: path.win32.basename, sep: path.win32.sep };
    const isAbsolute = path.isAbsolute;
    try {
      path.sep = windows.sep;
      path.dirname = windows.dirname;
      path.basename = windows.basename;
      path.join = (...parts) => isAbsolute(parts[0]) ? native.join(...parts) : windows.join(...parts);
      syncBuiltinESMExports();
      const result = checkArtifact(process.argv[1], { platform: "darwin", arch: "arm64" });
      if (process.argv[2]) await assert.rejects(result, new RegExp(process.argv[2]));
      else assert.equal((await result).version, "0.1.0");
    } finally {
      Object.assign(path, native);
      syncBuiltinESMExports();
    }
  `;
  for (const scenario of [
    { name: "valid package" },
    { name: "missing migration", omitted: ["dist/service/db/migrations/0007_discovery_mode_changes.sql"], error: "missing dist/service/db/migrations/0007_discovery_mode_changes" },
    { name: "missing journal", omitted: ["dist/service/db/migrations/meta/_journal.json"], error: "missing dist/service/db/migrations/meta/_journal" },
    { name: "missing journal entry", omitEntry: true, error: "journal is missing 0007_discovery_mode_changes" },
    { name: "version mismatch", version: "9.9.9", error: "versions differ" },
  ]) {
    await t.test(scenario.name, async () => {
      const root = await mkdtemp(join(tmpdir(), "workspace-artifact-win-paths-"));
      try {
        await makeArtifact(root, scenario.version, scenario.omitted, scenario.omitEntry);
        execFileSync(process.execPath, ["--input-type=module", "-e", code, join(root, "bundle"), scenario.error ?? ""], {
          encoding: "utf8", timeout: 10000, stdio: "pipe",
        });
      } finally { await rm(root, { recursive: true, force: true }); }
    });
  }
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

test("artifact check rejects a package missing the grouped-discovery migration", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-artifact-"));
  try {
    await makeArtifact(root, "0.1.0", ["dist/service/db/migrations/0006_grouped_discovery.sql"]);
    await assert.rejects(checkArtifact(join(root, "bundle"), { platform: "darwin", arch: "arm64" }), /missing dist\/service\/db\/migrations\/0006_grouped_discovery\.sql/);
  } finally { await rm(root, { recursive: true, force: true }); }
});


test("artifact check rejects a package missing the discovery-mode migration", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-artifact-mode-"));
  try {
    await makeArtifact(root, "0.1.0", ["dist/service/db/migrations/0007_discovery_mode_changes.sql"]);
    await assert.rejects(checkArtifact(join(root, "bundle"), { platform: "darwin", arch: "arm64" }),
      /missing dist\/service\/db\/migrations\/0007_discovery_mode_changes\.sql/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("artifact check rejects a package whose journal cannot apply the discovery-mode migration", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-artifact-mode-journal-"));
  try {
    await makeArtifact(root, "0.1.0", [], true);
    await assert.rejects(checkArtifact(join(root, "bundle"), { platform: "darwin", arch: "arm64" }),
      /journal is missing 0007_discovery_mode_changes/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
