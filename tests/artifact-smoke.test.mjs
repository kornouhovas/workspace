import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, win32 } from "node:path";
import { createPackageWithOptions } from "@electron/asar";
import test from "node:test";
import { checkArtifact, normalizeAsarEntry } from "../scripts/check-artifact.mjs";

const nativeScripts = ["windows-view.ps1", "windows-binding.ps1", "windows-project-reveal.ps1"];
const packagedFiles = [
  "dist/desktop/main.cjs",
  "dist/desktop/preload.cjs",
  "dist/service/entry.cjs",
  "dist/service/discovery-worker.cjs",
  "dist/service/project-rename-filesystem.cjs",
  "dist/service/native/project-rename.node",
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
  "dist/service/db/migrations/0008_project_creation.sql",
  "dist/service/db/migrations/0009_project_rename.sql",
  "dist/service/db/migrations/0010_project_category_move.sql",
    "dist/service/db/migrations/0011_category_options.sql",
    "dist/service/db/migrations/0012_category_removal.sql",
    "dist/service/db/migrations/0013_project_archive.sql",
    "dist/service/db/migrations/0014_number_properties.sql",
  "dist/service/db/migrations/0015_date_properties.sql",
    "dist/service/db/migrations/0016_single_select.sql",
    "dist/service/db/migrations/0017_multi_select.sql",
    "dist/service/db/migrations/0018_workspace_views.sql",
    "dist/service/db/migrations/0019_view_filters.sql",
    "dist/service/db/migrations/0020_view_grouping.sql",
    "dist/service/db/migrations/0021_table_layout.sql",
    "dist/service/db/migrations/0022_board_layout.sql",
    "dist/service/db/migrations/0023_workspace_sessions.sql",
    "dist/service/db/migrations/0024_durable_folder_evidence.sql",
    "dist/service/db/migrations/0025_creation_authorization.sql",
    "dist/service/db/migrations/0026_rename_authorization.sql",
    "dist/service/db/migrations/0027_category_move_authorization.sql",
    "dist/service/db/migrations/0028_category_folder_authorization.sql",
  "dist/service/db/migrations/meta/_journal.json",
];

async function makeArtifact(root, buildVersion = "0.1.0", omittedFiles = [], omitModeJournalEntry = false, corruptFile, extraFiles = []) {
  const appDirectory = join(root, "app");
  const resourcesDirectory = join(root, "bundle", "resources");
  await mkdir(appDirectory, { recursive: true });
  await mkdir(join(resourcesDirectory, "licenses"), { recursive: true });
  for (const file of packagedFiles) {
    if (omittedFiles.includes(file)) continue;
    const path = join(appDirectory, file);
    await mkdir(dirname(path), { recursive: true });
    let contents = file.endsWith(".sql") || file.endsWith(".cjs") || file === "dist/renderer/index.html"
      ? await readFile(file, "utf8") : "present";
    if (file.endsWith(".node")) contents = await readFile(file);
    if (file === corruptFile) contents = file.endsWith(".cjs") ? "missing integration" : contents + "\n-- corrupted shipped file";
    if (file.endsWith(".node") && file === corruptFile) contents = Buffer.from("corrupt native adapter");
    if (file === "dist/version.json") contents = JSON.stringify({ version: buildVersion });
    if (file === "dist/service/db/migrations/meta/_journal.json") {
      const journal = JSON.parse(await readFile("src/service/db/migrations/meta/_journal.json", "utf8"));
      if (omitModeJournalEntry) journal.entries = journal.entries.filter((entry) => entry.idx !== (omitModeJournalEntry === true ? 7 : omitModeJournalEntry));
      contents = JSON.stringify(journal);
    }
    await writeFile(path, contents);
  }
  const html = await readFile("dist/renderer/index.html", "utf8");
  for (const [, reference] of html.matchAll(/(?:src|href)="(\.\/assets\/[^"?#]+)"/g)) {
    const file = `dist/renderer/${reference.slice(2)}`;
    if (omittedFiles.includes(file) || omittedFiles.includes("renderer-assets")) continue;
    await mkdir(dirname(join(appDirectory, file)), { recursive: true });
    await writeFile(join(appDirectory, file), await readFile(file));
  }
  const rendererAssets=await readdir('dist/renderer/assets');
  for(const file of rendererAssets.filter(file=>file.endsWith('.woff2'))) {
    if(omittedFiles.includes('fonts')) continue;
    await mkdir(join(appDirectory,'dist/renderer/assets'),{recursive:true});
    await writeFile(join(appDirectory,'dist/renderer/assets',file),await readFile(join('dist/renderer/assets',file)));
  }
  if(!omittedFiles.includes('font-license')) await writeFile(join(resourcesDirectory,'licenses/Inter-OFL-1.1.txt'),await readFile('node_modules/@fontsource-variable/inter/LICENSE'));
  await writeFile(join(appDirectory, "package.json"), JSON.stringify({ version: "0.1.0" }));
  await writeFile(join(resourcesDirectory, "licenses/bb-MIT.txt"), "MIT License\nCopyright (c) 2026 Michael Yong");
  for (const file of nativeScripts) {
    const relative = `native/${file}`;
    if (omittedFiles.includes(relative)) continue;
    await mkdir(join(resourcesDirectory, "native"), { recursive: true });
    const contents = await readFile(`dist/desktop/native/${file}`);
    await writeFile(join(resourcesDirectory, relative), relative === corruptFile ? Buffer.from("modified native script") : contents);
  }
  for(const file of extraFiles){await mkdir(dirname(join(appDirectory,file)),{recursive:true});await writeFile(join(appDirectory,file),"test-only command fixture");}
  const asarPath = join(resourcesDirectory, "app.asar");
  await createPackageWithOptions(appDirectory, asarPath, { unpack: omittedFiles.includes("packed-rename") ? "discovery-worker.cjs" : omittedFiles.includes("packed-worker") ? "project-rename.node" : "{project-rename.node,discovery-worker.cjs}" });
  if (omittedFiles.includes("unpacked-rename")) await rm(join(`${asarPath}.unpacked`, "dist/service/native/project-rename.node"));
  if (omittedFiles.includes("unpacked-worker")) await rm(join(`${asarPath}.unpacked`, "dist/service/discovery-worker.cjs"));
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

for (const scenario of [
  { name: "missing discovery worker", omitted: ["dist/service/discovery-worker.cjs"], error: /missing.*discovery-worker/ },
  { name: "packed discovery worker", omitted: ["packed-worker"], error: /Discovery worker must be unpacked/ },
  { name: "missing unpacked discovery worker", omitted: ["unpacked-worker"], error: /worker is missing or linked/ },
  { name: "corrupt discovery worker", corrupt: "dist/service/discovery-worker.cjs", error: /Discovery worker differs from current runtime build/ },
  { name: "missing rename wrapper", omitted: ["dist/service/project-rename-filesystem.cjs"], error: /missing.*project-rename-filesystem/ },
  { name: "missing rename adapter", omitted: ["dist/service/native/project-rename.node"], error: /missing.*project-rename.node/ },
  { name: "packed rename adapter", omitted: ["packed-rename"], error: /must be unpacked/ },
  { name: "missing unpacked rename adapter", omitted: ["unpacked-rename"], error: /adapter is missing or linked/ },
  { name: "corrupt rename adapter", corrupt: "dist/service/native/project-rename.node", error: /differs from current runtime build/ },
  { name: "missing fonts", omitted: ["fonts"], error: /missing font resource/ },
  { name: "missing renderer assets", omitted: ["renderer-assets"], error: /missing renderer resource/ },
  { name: "missing rename SQL", omitted: ["dist/service/db/migrations/0009_project_rename.sql"], error: /missing.*0009_project_rename/ },
  { name: "missing rename journal entry", omitEntry: 9, error: /journal is missing 0009_project_rename/ },
  { name: "modified rename SQL", corrupt: "dist/service/db/migrations/0009_project_rename.sql", error: /migration differs from source/ },
  { name: "missing creation SQL", omitted: ["dist/service/db/migrations/0008_project_creation.sql"], error: /missing.*0008_project_creation/ },
  { name: "missing creation journal entry", omitEntry: 8, error: /journal is missing 0008_project_creation/ },
  { name: "modified creation SQL", corrupt: "dist/service/db/migrations/0008_project_creation.sql", error: /migration differs from source/ },
  { name: "missing native integration", corrupt: "dist/desktop/main.cjs", error: /missing native showItemInFolder/ },
  { name: "missing backend routing", corrupt: "dist/service/entry.cjs", error: /missing private Reveal routing/ },
  { name: "modified prior SQL", corrupt: "dist/service/db/migrations/0000_settings.sql", error: /migration differs from source/ },
  ...nativeScripts.flatMap((file) => [
    { name: `missing external ${file}`, omitted: [`native/${file}`], error: /missing external native script/ },
    { name: `modified external ${file}`, corrupt: `native/${file}`, error: /External native script differs from source/ },
  ]),
]) test(`artifact check rejects ${scenario.name}`, async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-artifact-creation-"));
  try {
    await makeArtifact(root, "0.1.0", scenario.omitted, scenario.omitEntry, scenario.corrupt);
    await assert.rejects(checkArtifact(join(root, "bundle"), { platform: "darwin", arch: "arm64" }), scenario.error);
  } finally { await rm(root, { recursive: true, force: true }); }
});

for (const file of nativeScripts) test(`artifact check rejects an external ${file} symlink`, async (t) => {
  const root = await mkdtemp(join(tmpdir(), "workspace-artifact-native-link-"));
  try {
    await makeArtifact(root);
    const external = join(root, "bundle", "resources", "native", file);
    const substitute = join(root, file);
    await writeFile(substitute, await readFile(external));
    await rm(external);
    try { await symlink(substitute, external, "file"); }
    catch (error) {
      if (process.platform === "win32" && ["EPERM", "EACCES"].includes(error.code)) {
        t.skip("Windows file symlink creation is unavailable without the required host privilege");
        return;
      }
      throw error;
    }
    await assert.rejects(checkArtifact(join(root, "bundle"), { platform: "darwin", arch: "arm64" }), /missing external native script/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("artifact check rejects a substituted unpacked project rename adapter", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-artifact-rename-link-"));
  try {
    await makeArtifact(root);
    const binary = join(root, "bundle/resources/app.asar.unpacked/dist/service/native/project-rename.node");
    const directory = dirname(binary), substitute = join(root, "substitute");
    await rename(directory, substitute);
    // Directory junctions work on Windows without file-symlink privileges.
    await symlink(substitute, directory, process.platform === "win32" ? "junction" : "dir");
    // lstat of the file alone cannot detect an ancestor link; the byte check
    // still rejects a substituted module.
    await writeFile(join(substitute, "project-rename.node"), "substitute binary");
    await assert.rejects(checkArtifact(join(root, "bundle"), { platform: "darwin", arch: "arm64" }), /differs from current runtime build/);
  } finally { await rm(root, { recursive: true, force: true }); }
});


for (const corruption of ["valid", "same-length", "shorter", "longer"]) test(`artifact native byte comparison has bounded child diagnostics: ${corruption}`, async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-artifact-bounded-"));
  try {
    await makeArtifact(root);
    const binary = join(root, "bundle/resources/app.asar.unpacked/dist/service/native/project-rename.node");
    const original = await readFile(binary);
    assert.ok(original.length > 0);
    if (corruption === "same-length") {
      const changed = Buffer.from(original); changed[Math.floor(changed.length / 2)] ^= 0xff;
      await writeFile(binary, changed);
    }
    if (corruption === "shorter") await writeFile(binary, original.subarray(0, original.length - 1));
    if (corruption === "longer") await writeFile(binary, Buffer.concat([original, Buffer.from([0])]));
    const code = `
      import assert from "node:assert/strict";
      import { checkArtifact } from ${JSON.stringify(new URL("../scripts/check-artifact.mjs", import.meta.url).href)};
      console.info = () => {};
      try {
        await checkArtifact(process.argv[1], { platform: "darwin", arch: "arm64" });
        assert.equal(process.argv[2], "valid");
        console.log(JSON.stringify({ accepted: true }));
      } catch (error) {
        assert.notEqual(process.argv[2], "valid");
        assert.equal(error.code, "ERR_ASSERTION");
        assert.match(error.message, /Project rename adapter differs from current runtime build/);
        assert.ok(error.message.length < 256);
        console.log(JSON.stringify({ accepted: false, code: error.code, messageLength: error.message.length }));
      }
    `;
    // A reduced heap, finite pipe and existing 10s child deadline expose binary
    // diff expansion without risking the test runner's memory or dumping bytes.
    const child = spawnSync(process.execPath, ["--max-old-space-size=64", "--input-type=module", "-e", code, join(root, "bundle"), corruption],
      { encoding: "utf8", timeout: 10000, maxBuffer: 4096 });
    assert.equal(child.status, 0, JSON.stringify({ status: child.status, signal: child.signal, code: child.error?.code,
      stdoutBytes: child.stdout.length, stderrBytes: child.stderr.length }));
    assert.equal(child.signal, null);
    assert.ok(child.stdout.length < 256); assert.equal(child.stderr, "");
    assert.equal(JSON.parse(child.stdout).accepted, corruption === "valid");
  } finally { await rm(root, { recursive: true, force: true }); }
});


test('artifact check rejects a packaged unconverted command test entry',async()=>{
 const root=await mkdtemp(join(tmpdir(),'workspace-artifact-test-entry-'));
 try{
  await makeArtifact(root,'0.1.0',[],false,undefined,['dist/service/unconverted-engine-test-entry.cjs']);
  await assert.rejects(checkArtifact(join(root,'bundle'),{platform:'darwin',arch:'arm64'}),/test-only command entry/);
 }finally{await rm(root,{recursive:true,force:true});}
});
