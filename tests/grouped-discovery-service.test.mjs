import assert from "node:assert/strict";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { openSettingsService } from "../dist/service/settings.mjs";

function fixture(run) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "workspace-grouped-")));
  const root = join(directory, "root");
  fs.mkdirSync(root);
  const databasePath = join(directory, "data", "workspace.sqlite");
  const service = openSettingsService(databasePath);
  const workspace = service.workspaces.create({ type: "workspace.create", name: "Grouped", rootPath: root }).value;
  const sqlite = new Database(databasePath);
  const preview = (extra = {}) => service.handleQuery({ type: "workspace.previewDiscovery", workspaceId: workspace.workspaceId, mode: "grouped", ...extra });
  try { run({ directory, root, sqlite, service, workspace, preview }); }
  finally { sqlite.close(); service.close(); fs.rmSync(directory, { recursive: true, force: true }); }
}

function inventory(path) {
  return fs.readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).map((entry) => [
    entry.name, entry.isSymbolicLink() ? fs.readlinkSync(join(path, entry.name))
      : entry.isDirectory() ? inventory(join(path, entry.name)) : fs.readFileSync(join(path, entry.name)).toString("hex"),
  ]);
}

test("grouped review is read-only, shows empty/mixed categories and stops exactly at projects", () => fixture(({ root, sqlite, service, preview }) => {
  for (const path of ["Empty", "Category/Project/Deeper", "DirectLooking/src", "Archive/Kept"]) fs.mkdirSync(join(root, path), { recursive: true });
  fs.writeFileSync(join(root, "ordinary"), "root file");
  fs.writeFileSync(join(root, "Category", "ordinary"), "category file");
  fs.writeFileSync(join(root, "Category", "Project", "keep"), Buffer.from([0, 255, 42]));
  const before = inventory(root);
  const config = sqlite.prepare("SELECT * FROM sources").all();
  const events = []; service.workspaces.subscribe((event) => events.push(event));
  const original = fs.opendirSync;
  fs.opendirSync = (path, ...args) => {
    assert.ok(![join(root, "Category", "Project"), join(root, "DirectLooking", "src"), join(root, "Archive", "Kept")].includes(path), "project contents must never be enumerated");
    return original(path, ...args);
  };
  syncBuiltinESMExports();
  let result;
  try { result = preview(); } finally { fs.opendirSync = original; syncBuiltinESMExports(); }
  assert.equal(result.ok, true);
  assert.equal(result.value.mode, "grouped");
  assert.equal(result.value.configured, false);
  assert.equal(result.value.state, "ready");
  assert.ok(result.value.previewToken);
  assert.deepEqual(result.value.entries.map((entry) => [entry.kind, entry.relativePath, entry.kind === "project" ? entry.categoryPath : entry.empty]), [
    ["category", "Archive", false], ["project", "Archive/Kept", "Archive"],
    ["category", "Category", false], ["project", "Category/Project", "Category"],
    ["category", "DirectLooking", false], ["project", "DirectLooking/src", "DirectLooking"], ["category", "Empty", true],
  ]);
  assert.deepEqual(sqlite.prepare("SELECT * FROM sources").all(), config);
  assert.deepEqual(sqlite.prepare("SELECT * FROM projects").all(), []);
  assert.deepEqual(inventory(root), before);
  assert.deepEqual(events, []);
}));

test("grouped automatic/manual exclusions precede excluded metadata access at both levels", () => fixture(({ directory, root, preview }) => {
  for (const path of [".hidden/Inside", "$RECYCLE.BIN/Inside", "Manual/Inside", "Category/.hidden", "Category/System Volume Information", "Category/Manual", "Category/Project", "Storage/Inside"])
    fs.mkdirSync(join(root, path), { recursive: true });
  const external = join(directory, "external"); fs.mkdirSync(external);
  fs.symlinkSync(external, join(root, "Linked"), process.platform === "win32" ? "junction" : "dir");
  fs.symlinkSync(external, join(root, "Category", "Linked"), process.platform === "win32" ? "junction" : "dir");
  const blocked = [".hidden", "$RECYCLE.BIN", "Manual", "Linked", "Category/.hidden", "Category/System Volume Information", "Category/Manual", "Category/Linked"].map((path) => join(root, path));
  const originalStat = fs.lstatSync; const originalOpen = fs.opendirSync;
  const assertAllowed = (path) => assert.ok(!blocked.includes(path) && path !== external, `excluded target accessed: ${path}`);
  fs.lstatSync = (path, ...args) => { assertAllowed(path); return originalStat(path, ...args); };
  fs.opendirSync = (path, ...args) => { assertAllowed(path); return originalOpen(path, ...args); };
  syncBuiltinESMExports();
  let result;
  try { result = preview({ excludedRelativePaths: ["Manual", "Category/Manual"] }); }
  finally { fs.lstatSync = originalStat; fs.opendirSync = originalOpen; syncBuiltinESMExports(); }
  assert.equal(result.ok, true);
  assert.ok(result.value.previewToken);
  assert.equal(result.value.entries.find((entry) => entry.relativePath === "Manual").reason, "manual");
  assert.equal(result.value.entries.some((entry) => entry.relativePath === "Manual/Inside"), false);
  assert.equal(result.value.entries.find((entry) => entry.relativePath === "Category/Manual").reason, "manual");
  for (const path of ["Linked", "Category/Linked"]) assert.equal(result.value.entries.find((entry) => entry.relativePath === path).reason, "link");
}));

test("grouped archive policy excludes a designated category or its containing immediate project", () => fixture(({ root, sqlite, preview }) => {
  for (const path of ["Archive/Project", "Category/Storage/Archive", "Category/Kept", "Empty"]) fs.mkdirSync(join(root, path), { recursive: true });
  for (const [archive, excluded] of [["Archive", "Archive"], ["Category/Storage/Archive", "Category/Storage"], [null, null]]) {
    sqlite.prepare("UPDATE sources SET archive_relative_path = ?").run(archive);
    const original = fs.opendirSync;
    fs.opendirSync = (path, ...args) => { if (excluded) assert.notEqual(path, join(root, excluded)); return original(path, ...args); };
    syncBuiltinESMExports();
    let result;
    try { result = preview(); } finally { fs.opendirSync = original; syncBuiltinESMExports(); }
    assert.equal(result.ok, true);
    assert.ok(result.value.previewToken);
    assert.deepEqual(result.value.entries.filter((entry) => entry.reason === "archive").map((entry) => entry.relativePath), excluded ? [excluded] : []);
  }
}));

test("grouped preview rejects unsafe depths, unselectable exclusions and modes without configuring a source", () => fixture(({ root, sqlite, service, workspace, preview }) => {
  fs.mkdirSync(join(root, "Category", "Project"), { recursive: true }); fs.mkdirSync(join(root, ".hidden"));
  const before = sqlite.prepare("SELECT * FROM sources").all();
  for (const excludedRelativePaths of [Array(1), [null], ["../escape"], ["/absolute"], ["Category//Project"], ["Category/Project/deep"], ["Category/.."], ["Category", "Category"], ["invented"], [".hidden"], ["Category/Project/"]]) {
    assert.equal(preview({ excludedRelativePaths }).error.code, "invalid_input");
  }
  for (const mode of [null, "recursive", 0]) assert.equal(preview({ mode }).error.code, "invalid_input");
  assert.equal(preview({ extra: true }).error.code, "invalid_input");
  const token = preview().value.previewToken;
  assert.equal(service.handleCommand({ type: "workspace.applyDiscovery", workspaceId: workspace.workspaceId, previewToken: token }).error.code, "invalid_input");
  assert.deepEqual(sqlite.prepare("SELECT * FROM sources").all(), before);
  const direct = preview({ mode: "direct" }).value;
  assert.equal(service.handleCommand({ type: "workspace.applyDiscovery", workspaceId: workspace.workspaceId, previewToken: direct.previewToken }).ok, true);
  assert.equal(preview().error.code, "invalid_input");
  assert.equal(preview({ mode: undefined }).error.code, "invalid_input");
  assert.equal(service.handleQuery({ type: "workspace.previewDiscovery", workspaceId: workspace.workspaceId }).value.mode, "direct");
}));

test("category replacement/link swaps during child enumeration invalidate the complete review", () => {
  for (const link of [false, true]) fixture(({ directory, root, preview }) => {
    const category = join(root, "Category"); fs.mkdirSync(join(category, "Project"), { recursive: true });
    const external = join(directory, "external"); fs.mkdirSync(join(external, "Foreign"), { recursive: true });
    const original = fs.opendirSync;
    let swapped = false;
    fs.opendirSync = (path, ...args) => {
      assert.notEqual(path, external);
      const handle = original(path, ...args);
      if (path === category && !swapped) {
        swapped = true;
        fs.renameSync(category, join(directory, "old-category"));
        if (link) fs.symlinkSync(external, category, process.platform === "win32" ? "junction" : "dir");
        else fs.mkdirSync(join(category, "Project"), { recursive: true });
      }
      return handle;
    };
    syncBuiltinESMExports();
    let result;
    try { result = preview(); } finally { fs.opendirSync = original; syncBuiltinESMExports(); }
    assert.equal(result.ok, true);
    assert.equal(result.value.state, "changed");
    assert.equal(result.value.previewToken, null);
    assert.deepEqual(result.value.entries, []);
  });
});

test("grouped exclusions preserve safe POSIX basenames and saved missing selections", { skip: process.platform === "win32" }, () => fixture(({ root, sqlite, preview }) => {
  fs.mkdirSync(join(root, "Category:one", "Project\\two"), { recursive: true });
  const path = "Category:one/Project\\two";
  assert.equal(preview({ excludedRelativePaths: [path] }).value.entries.find((entry) => entry.relativePath === path).reason, "manual");
  sqlite.prepare("UPDATE sources SET excluded_relative_paths = ?").run(JSON.stringify(["Absent"]));
  assert.deepEqual(preview().value.excludedRelativePaths, ["Absent"]);
}));

test("grouped reviews retain no token on unavailable, unreadable, unstable or retargeted roots", () => fixture(({ directory, root, sqlite, preview }) => {
  fs.mkdirSync(join(root, "Category", "Project"), { recursive: true });
  const before = sqlite.prepare("SELECT * FROM sources").all();
  const original = fs.opendirSync;
  fs.opendirSync = (path, ...args) => {
    if (path === join(root, "Category")) throw Object.assign(new Error("denied"), { code: "EACCES" });
    return original(path, ...args);
  };
  syncBuiltinESMExports();
  let result;
  try { result = preview(); } finally { fs.opendirSync = original; syncBuiltinESMExports(); }
  assert.equal(result.value.state, "unreadable");
  assert.equal(result.value.previewToken, null);
  // A replacement between the first and second complete scans is stale too.
  let reads = 0;
  fs.opendirSync = (path, ...args) => {
    if (path === root && ++reads === 2) fs.mkdirSync(join(root, "Category", "New"));
    return original(path, ...args);
  };
  syncBuiltinESMExports();
  try { result = preview(); } finally { fs.opendirSync = original; syncBuiltinESMExports(); }
  assert.equal(result.value.state, "changed");
  assert.equal(result.value.previewToken, null);
  fs.renameSync(root, join(directory, "disconnected"));
  assert.equal(preview().value.state, "unavailable");
  fs.symlinkSync(join(directory, "disconnected"), root, process.platform === "win32" ? "junction" : "dir");
  assert.equal(preview().value.state, "root_identity_conflict");
  assert.deepEqual(sqlite.prepare("SELECT * FROM sources").all(), before);
}));

test("grouped archive casing uses actual native identity at category and project depth", () => fixture(({ root, sqlite, preview }) => {
  fs.mkdirSync(join(root, "Category", "Storage", "Archive"), { recursive: true });
  fs.mkdirSync(join(root, "Category", "Kept"));
  fs.mkdirSync(join(root, "Archive", "Kept"), { recursive: true });
  const insensitive = fs.existsSync(join(root, "category"));
  for (const [archive, excluded] of [["archive", "Archive"], ["category/storage/archive", "Category/Storage"]]) {
    sqlite.prepare("UPDATE sources SET archive_relative_path = ?").run(archive);
    const original = fs.opendirSync;
    fs.opendirSync = (path, ...args) => { if (insensitive) assert.notEqual(path, join(root, excluded)); return original(path, ...args); };
    syncBuiltinESMExports();
    let result;
    try { result = preview(); } finally { fs.opendirSync = original; syncBuiltinESMExports(); }
    assert.ok(result.value.previewToken);
    assert.deepEqual(result.value.entries.filter((entry) => entry.reason === "archive").map((entry) => entry.relativePath), insensitive ? [excluded] : []);
  }
}));

test("a grouped review is workspace/token bound and returned data cannot change its reviewed mode", () => fixture(({ root, service, workspace, preview }) => {
  fs.mkdirSync(join(root, "Category", "Project"), { recursive: true });
  const sibling = service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root }).value;
  const reviewed = preview().value;
  const command = { type: "workspace.applyDiscovery", workspaceId: workspace.workspaceId, previewToken: reviewed.previewToken };
  assert.equal(service.handleCommand({ ...command, workspaceId: sibling.workspaceId }).error.code, "stale_preview");
  reviewed.mode = "direct"; reviewed.entries.length = 0;
  assert.equal(service.handleCommand(command).error.code, "invalid_input");
  assert.equal(service.handleCommand({ ...command, mode: "direct" }).error.code, "invalid_input");
  const direct = preview({ mode: "direct" }).value;
  assert.equal(service.handleCommand(command).error.code, "stale_preview");
  assert.equal(service.handleCommand({ ...command, previewToken: direct.previewToken }).error.code, "stale_preview");
}));

test("archive casing resolution never accesses an already excluded alias", () => fixture(({ root, sqlite, preview }) => {
  fs.mkdirSync(join(root, "Manual", "Inside"), { recursive: true });
  fs.mkdirSync(join(root, "Category", "Manual"), { recursive: true });
  for (const [archive, exclusion] of [["manual/deep", "Manual"], ["Category/manual/deep", "Category/Manual"]]) {
    sqlite.prepare("UPDATE sources SET archive_relative_path = ?").run(archive);
    const original = fs.lstatSync;
    fs.lstatSync = (path, ...args) => {
      assert.notEqual(path, join(root, exclusion));
      assert.notEqual(path, join(root, archive.split("/").slice(0, exclusion.split("/").length).join("/")));
      return original(path, ...args);
    };
    syncBuiltinESMExports();
    let result;
    try { result = preview({ excludedRelativePaths: [exclusion] }); }
    finally { fs.lstatSync = original; syncBuiltinESMExports(); }
    assert.ok(result.value.previewToken);
    assert.equal(result.value.entries.find((entry) => entry.relativePath === exclusion).reason, "manual");
  }
}));
