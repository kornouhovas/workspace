import { spawnSync } from "node:child_process";
import { renameNoReplace } from "../dist/service/project-rename-filesystem.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { openUnconvertedEngineFixture } from "./support/unconverted-command-engines.mjs";
import { projectMetadataRecords } from "./support/identity-migration-fixtures.mjs";
const openEngineService = (...args) => openUnconvertedEngineFixture(...args).engines;
const observer = { watch() { return { close() {} }; }, schedule() { return { cancel() {} }; } };
function fixture(run, mode = "direct", options = {}) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "project-archive-")));
  const root = join(directory, "root"), database = join(directory, "app.sqlite");
  fs.mkdirSync(root); if (mode === "grouped") fs.mkdirSync(join(root, "Client"));
  const original = mode === "grouped" ? "Client/Project" : "Project";
  fs.mkdirSync(join(root, original)); fs.writeFileSync(join(root, original, "sentinel"), "exact bytes\n");
  let service;
  const open = () => service = openEngineService(database, undefined, undefined, observer, options.filesystem, options.native);
  try {
    open();
    const workspace = service.workspaces.create({ type: "workspace.create", name: "Primary", rootPath: root }).value;
    const sibling = service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root }).value;
    const query = (type, rest = {}) => service.handleQuery({ type, workspaceId: workspace.workspaceId, ...rest });
    const command = (type, rest = {}) => service.handleCommand({ type, workspaceId: workspace.workspaceId, ...rest });
    const preview = query("workspace.previewDiscovery", { mode }).value;
    const initial = command("workspace.applyDiscovery", { previewToken: preview.previewToken }).value;
    run({ root, directory, database, original, query, command, initial, workspace, sibling,
      restart() { service.close(); open(); } });
  } finally { service?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
}

for (const mode of ["direct", "grouped"]) test(`${mode}: explicit archive designation persists and excludes its folder without moving projects`, () => fixture(f => {
  const before = projectMetadataRecords(f.query("workspace.listProjects"));
  const preview = f.query("workspace.previewArchiveLocation", { relativePath: "Archive" });
  assert.equal(preview.ok, true);
  assert.equal(fs.existsSync(join(f.root, "Archive")), false);
  assert.deepEqual(preview.value.blockers, []);
  const applied = f.command("workspace.applyArchiveLocation", { operationId: randomUUID(), previewToken: preview.value.previewToken });
  assert.equal(applied.ok, true);
  assert.equal(applied.value.relativePath, "Archive");
  assert.deepEqual(projectMetadataRecords(f.query("workspace.listProjects")), before);
  f.restart();
  assert.equal(f.query("workspace.listArchivedProjects").value.relativePath, "Archive");
  fs.mkdirSync(join(f.root, "Archive"));
  const discovery = f.query("workspace.previewDiscovery").value;
  assert.equal(discovery.entries.find(e => e.relativePath === "Archive").reason, "archive");
}, mode));

function designate(f) {
  const preview = f.query("workspace.previewArchiveLocation", { relativePath: "Archive" }).value;
  assert.equal(f.command("workspace.applyArchiveLocation", { operationId: randomUUID(), previewToken: preview.previewToken }).ok, true);
}
for (const mode of ["direct", "grouped"]) test(`${mode}: archive and restore preserve logical identity, exact Text and folder bytes across restart`, () => fixture(f => {
  designate(f);
  const project = f.initial.projects[0];
  const property = f.command("workspace.createProperty", { name: "Notes", propertyType: "text" }).value;
  assert.ok(property);
  const propertyId = property.propertyId;
  assert.equal(f.command("workspace.setTextValue", { projectId: project.projectId, propertyId, value: "  before\n" }).ok, true);
  const preview = f.query("workspace.previewProjectArchive", { projectId: project.projectId, action: "archive", name: null, createParent: false });
  assert.equal(preview.ok, true); assert.deepEqual(preview.value.blockers, []);
  const result = f.command("workspace.applyProjectArchive", { operationId: randomUUID(), previewToken: preview.value.previewToken });
  assert.equal(result.ok, true); assert.equal(result.value.operation.stage, "completed", JSON.stringify(result.value));
  assert.equal(fs.existsSync(join(f.root, f.original)), false);
  assert.equal(fs.readFileSync(join(f.root, "Archive", f.original, "sentinel"), "utf8"), "exact bytes\n");
  assert.deepEqual(projectMetadataRecords(f.query("workspace.listProjects")), []);
  let archived = f.query("workspace.listArchivedProjects").value.projects;
  assert.equal(archived[0].projectId, project.projectId);
  assert.equal(archived[0].originalRelativePath, f.original);
  assert.equal(f.command("workspace.setTextValue", { projectId: project.projectId, propertyId, value: "  archived\n" }).ok, true);
  f.restart();
  archived = f.query("workspace.listArchivedProjects").value.projects;
  assert.equal(archived[0].projectId, project.projectId);
  const restore = f.query("workspace.previewProjectArchive", { projectId: project.projectId, action: "restore", name: null, createParent: false });
  assert.equal(restore.ok, true); assert.deepEqual(restore.value.blockers, []);
  const restored = f.command("workspace.applyProjectArchive", { operationId: randomUUID(), previewToken: restore.value.previewToken });
  assert.equal(restored.ok, true); assert.equal(restored.value.operation.stage, "completed", JSON.stringify(restored.value));
  assert.equal(projectMetadataRecords(f.query("workspace.listProjects"))[0].projectId, project.projectId);
  assert.deepEqual(f.query("workspace.listArchivedProjects").value.projects, []);
  assert.equal(fs.readFileSync(join(f.root, f.original, "sentinel"), "utf8"), "exact bytes\n");
  assert.equal(f.query("workspace.listTextProperties").value.values.find(v => v.projectId === project.projectId).value, "  archived\n");
}, mode));

function archiveProject(f) {
  designate(f);
  const preview = f.query("workspace.previewProjectArchive", { projectId: f.initial.projects[0].projectId, action: "archive", name: null, createParent: false }).value;
  const applied = f.command("workspace.applyProjectArchive", { operationId: randomUUID(), previewToken: preview.previewToken });
  assert.equal(applied.value.operation.stage, "completed", JSON.stringify(applied));
  return f.initial.projects[0].projectId;
}
test("restore collisions require an explicit alternative basename and never overwrite", () => fixture(f => {
  const projectId = archiveProject(f);
  fs.mkdirSync(join(f.root, "Project")); fs.writeFileSync(join(f.root, "Project", "sentinel"), "other owner");
  const collision = f.query("workspace.previewProjectArchive", { projectId, action: "restore", name: null, createParent: false }).value;
  assert.ok(collision.blockers.length); assert.equal(collision.previewToken, null);
  const explicit = f.query("workspace.previewProjectArchive", { projectId, action: "restore", name: "Restored", createParent: false }).value;
  assert.deepEqual(explicit.blockers, []);
  const result = f.command("workspace.applyProjectArchive", { operationId: randomUUID(), previewToken: explicit.previewToken });
  assert.equal(result.value.operation.stage, "completed");
  assert.equal(fs.readFileSync(join(f.root, "Project", "sentinel"), "utf8"), "other owner");
  assert.equal(fs.readFileSync(join(f.root, "Restored", "sentinel"), "utf8"), "exact bytes\n");
}));
test("missing grouped restore parent requires explicit creation and fresh category identity", () => fixture(f => {
  const projectId = archiveProject(f);
  fs.rmdirSync(join(f.root, "Client"));
  const missing = f.query("workspace.previewProjectArchive", { projectId, action: "restore", name: null, createParent: false }).value;
  assert.deepEqual(missing.blockers, ["missing_parent"]); assert.equal(missing.previewToken, null);
  const explicit = f.query("workspace.previewProjectArchive", { projectId, action: "restore", name: null, createParent: true }).value;
  assert.deepEqual(explicit.blockers, []);
  const result = f.command("workspace.applyProjectArchive", { operationId: randomUUID(), previewToken: explicit.previewToken });
  assert.equal(result.value.operation.stage, "completed", JSON.stringify(result));
  const project = projectMetadataRecords(f.query("workspace.listProjects"))[0];
  assert.equal(project.projectId, projectId); assert.notEqual(project.categoryId, f.initial.projects[0].categoryId);
}, "grouped"));
test("archive designation cannot change while populated and incompatible mode cannot invent a restore target", () => fixture(f => {
  const projectId = archiveProject(f);
  const location = f.query("workspace.previewArchiveLocation", { relativePath: "OtherArchive" }).value;
  assert.ok(location.blockers.includes("archive_not_empty"));
  const mode = f.query("workspace.previewDiscovery", { mode: "direct" }).value;
  assert.equal(f.command("workspace.applyDiscovery", { previewToken: mode.previewToken }).ok, true);
  assert.equal(f.query("workspace.listArchivedProjects").value.projects[0].originalRelativePath, "Client/Project");
  const restore = f.query("workspace.previewProjectArchive", { projectId, action: "restore", name: null, createParent: false }).value;
  assert.ok(restore.blockers.includes("incompatible_mode"));
  const back = f.query("workspace.previewDiscovery", { mode: "grouped" }).value;
  assert.equal(f.command("workspace.applyDiscovery", { previewToken: back.previewToken }).ok, true);
  const ready = f.query("workspace.previewProjectArchive", { projectId, action: "restore", name: null, createParent: false }).value;
  assert.deepEqual(ready.blockers, []);
  assert.equal(f.command("workspace.applyProjectArchive", { operationId: randomUUID(), previewToken: ready.previewToken }).value.operation.stage, "completed");
}, "grouped"));

test("archive collisions leave both folders and archived contents untouched", () => fixture(f => {
  designate(f); fs.mkdirSync(join(f.root, "Archive")); fs.mkdirSync(join(f.root, "Archive", "Project"));
  fs.writeFileSync(join(f.root, "Archive", "Project", "sentinel"), "existing archive");
  const result = f.query("workspace.previewProjectArchive", { projectId: f.initial.projects[0].projectId, action: "archive", name: null, createParent: false });
  assert.equal(result.ok, true); assert.ok(result.value.blockers.length); assert.equal(result.value.previewToken, null);
  assert.equal(fs.readFileSync(join(f.root, "Project", "sentinel"), "utf8"), "exact bytes\n");
  assert.equal(fs.readFileSync(join(f.root, "Archive", "Project", "sentinel"), "utf8"), "existing archive");
}));

test("a durable intent reserves placement across restart and only explicit recovery can retry", () => {
  let effects = 0, allow = false;
  fixture(f => {
    designate(f);
    const projectId = f.initial.projects[0].projectId;
    const preview = f.query("workspace.previewProjectArchive", { projectId, action: "archive", name: null, createParent: false }).value;
    const request = { operationId: randomUUID(), previewToken: preview.previewToken };
    const result = f.command("workspace.applyProjectArchive", request);
    assert.equal(result.value.operation.stage, "intent"); assert.equal(effects, 1);
    f.restart();
    assert.equal(f.query("workspace.listProjectArchiveOperations").value.operations[0].operationId, request.operationId);
    f.query("workspace.listProjects"); f.query("workspace.listArchivedProjects");
    assert.equal(f.command("workspace.applyProjectArchive", request).value.operation.stage, "intent"); assert.equal(effects, 1);
    const review = f.query("workspace.previewProjectArchiveRecovery", { operationId: request.operationId }).value;
    assert.deepEqual(review.actions, ["retry_original", "keep_original"]);
    allow = true;
    const recovered = f.command("workspace.recoverProjectArchive", { operationId: request.operationId, previewToken: review.previewToken, action: "retry_original" });
    assert.equal(recovered.value.operation.stage, "completed", JSON.stringify(recovered)); assert.equal(effects, 2);
    assert.equal(f.command("workspace.applyProjectArchive", request).value.operation.stage, "completed"); assert.equal(effects, 2);
  }, "direct", { native(from, to) { effects++; return allow ? renameNoReplace(from, to) : "busy"; } });
});

test("an uncertain post-effect result completes its verified destination without replay after restart", () => {
  let effects = 0;
  fixture(f => {
    designate(f);
    const preview = f.query("workspace.previewProjectArchive", { projectId: f.initial.projects[0].projectId, action: "archive", name: null, createParent: false }).value;
    const request = { operationId: randomUUID(), previewToken: preview.previewToken };
    const result = f.command("workspace.applyProjectArchive", request);
    assert.equal(result.value.operation.stage, "intent");
    assert.equal(fs.existsSync(join(f.root, "Project")), false);
    f.restart(); assert.equal(effects, 1);
    const review = f.query("workspace.previewProjectArchiveRecovery", { operationId: request.operationId }).value;
    assert.deepEqual(review.actions, ["complete_destination"]);
    const recovered = f.command("workspace.recoverProjectArchive", { operationId: request.operationId, previewToken: review.previewToken, action: "complete_destination" });
    assert.equal(recovered.value.operation.stage, "completed", JSON.stringify(recovered)); assert.equal(effects, 1);
  }, "direct", { native(from, to) { effects++; assert.equal(renameNoReplace(from, to), "renamed"); return "filesystem_error"; } });
});

test("archived records cannot be reassociated through active-project recovery", () => fixture(f => {
  const projectId = archiveProject(f);
  assert.equal(f.query("workspace.previewProjectRecovery", { projectId }).ok, false);
}));

for (const mode of ["direct", "grouped"]) for (const action of ["archive", "restore"]) for (const phase of ["intent", "effect", "recorded", "committed"]) {
  test(`${mode} ${action}: abrupt process exit at ${phase} retains recoverable placement and identity`, () => fixture(f => {
    const projectId = action === "restore" ? archiveProject(f) : (designate(f), f.initial.projects[0].projectId);
    const operationId = randomUUID();
    const child = spawnSync(process.execPath, ["--import", "tsx", "tests/fixtures/project-archive-crash-worker.mjs", f.database, f.workspace.workspaceId, projectId, operationId, action, phase], { encoding: "utf8", timeout: 15000 });
    assert.equal(child.status, 71, child.stderr + child.stdout);
    f.restart();
    const before = f.query("workspace.getProjectArchiveOperation", { operationId });
    assert.equal(before.ok, true);
    if (phase !== "committed") {
      const review = f.query("workspace.previewProjectArchiveRecovery", { operationId }).value;
      const expected = phase === "intent" ? "retry_original" : "complete_destination";
      assert.ok(review.actions.includes(expected), JSON.stringify(review));
      const result = f.command("workspace.recoverProjectArchive", { operationId, previewToken: review.previewToken, action: expected });
      assert.equal(result.value.operation.stage, "completed", JSON.stringify(result));
    } else assert.equal(before.value.operation.stage, "completed");
    const result = f.query(action === "archive" ? "workspace.listArchivedProjects" : "workspace.listProjects").value.projects;
    assert.equal(result[0].projectId, projectId);
    const path = action === "archive" ? `Archive/${f.original}` : f.original;
    assert.equal(fs.readFileSync(join(f.root, path, "sentinel"), "utf8"), "exact bytes\n");
  }, mode));
}

test("interruption after creating an unrecorded archive parent permits explicit abandonment without deleting it", () => fixture(f => {
  designate(f);
  const operationId = randomUUID();
  const child = spawnSync(process.execPath, ["--import", "tsx", "tests/fixtures/project-archive-crash-worker.mjs", f.database, f.workspace.workspaceId, f.initial.projects[0].projectId, operationId, "archive", "parent_effect"], { encoding: "utf8", timeout: 15000 });
  assert.equal(child.status, 71, child.stderr);
  f.restart();
  const preview = f.query("workspace.previewProjectArchiveRecovery", { operationId }).value;
  assert.deepEqual(preview.actions, ["keep_original"]);
  const result = f.command("workspace.recoverProjectArchive", { operationId, previewToken: preview.previewToken, action: "keep_original" });
  assert.equal(result.value.operation.stage, "failed");
  assert.equal(fs.existsSync(join(f.root, "Archive")), true);
  assert.equal(fs.readFileSync(join(f.root, "Project", "sentinel"), "utf8"), "exact bytes\n");
}));

test("unavailable sources retain archived records and ordinary metadata without accepting restore", () => fixture(f => {
  const projectId = archiveProject(f), movedRoot = join(f.directory, "offline-root");
  fs.renameSync(f.root, movedRoot);
  try {
    assert.equal(f.query("workspace.listArchivedProjects").value.projects[0].projectId, projectId);
    const preview = f.query("workspace.previewProjectArchive", { projectId, action: "restore", name: null, createParent: false });
    assert.equal(preview.ok, true); assert.equal(preview.value.previewToken, null); assert.ok(preview.value.blockers.includes("source_unavailable"));
    assert.equal(fs.readFileSync(join(movedRoot, "Archive", "Project", "sentinel"), "utf8"), "exact bytes\n");
  } finally { fs.renameSync(movedRoot, f.root); }
}));
test("archive selection rejects owned folders, traversal, links and foreign or extra request fields", () => fixture(f => {
  for (const relativePath of ["", "../outside", "/outside", ".service", "Project/Archive"]) {
    const preview = f.query("workspace.previewArchiveLocation", { relativePath });
    assert.ok(!preview.ok || preview.value.previewToken === null, relativePath);
  }
  fs.mkdirSync(join(f.directory, "outside")); fs.symlinkSync(join(f.directory, "outside"), join(f.root, "Linked"), process.platform === "win32" ? "junction" : "dir");
  const link = f.query("workspace.previewArchiveLocation", { relativePath: "Linked" });
  assert.ok(!link.ok || link.value.previewToken === null);
  assert.equal(f.query("workspace.previewArchiveLocation", { relativePath: "Archive", injected: true }).ok, false);
  designate(f);
  assert.equal(f.query("workspace.previewProjectArchive", { projectId: randomUUID(), action: "archive", name: null, createParent: false }).ok, false);
}));
test("a changed review and a destination occupied at the native boundary cannot overwrite folders", () => {
  fixture(f => {
    designate(f);
    const args = { projectId: f.initial.projects[0].projectId, action: "archive", name: null, createParent: false };
    const first = f.query("workspace.previewProjectArchive", args).value;
    const second = f.query("workspace.previewProjectArchive", args).value;
    assert.equal(f.command("workspace.applyProjectArchive", { operationId: randomUUID(), previewToken: first.previewToken }).ok, false);
    const result = f.command("workspace.applyProjectArchive", { operationId: randomUUID(), previewToken: second.previewToken });
    assert.equal(result.value.operation.stage, "intent");
    assert.equal(fs.readFileSync(join(f.root, "Project", "sentinel"), "utf8"), "exact bytes\n");
    assert.equal(fs.readFileSync(join(f.root, "Archive", "Project", "sentinel"), "utf8"), "concurrent owner");
    const recovery = f.query("workspace.previewProjectArchiveRecovery", { operationId: result.value.operation.operationId }).value;
    assert.deepEqual(recovery.actions, ["keep_original"]);
  }, "direct", { native(from, to) { fs.mkdirSync(to); fs.writeFileSync(join(to, "sentinel"), "concurrent owner"); return renameNoReplace(from, to); } });
});

test("multiple archived siblings restore into the explicitly recreated original parent", () => fixture(f => {
  fs.mkdirSync(join(f.root, "Client", "Second"));
  const discovery = f.query("workspace.previewDiscovery").value;
  const projects = f.command("workspace.applyDiscovery", { previewToken: discovery.previewToken }).value.projects;
  designate(f);
  for (const project of projects) {
    const preview = f.query("workspace.previewProjectArchive", { projectId: project.projectId, action: "archive", name: null, createParent: false }).value;
    assert.equal(f.command("workspace.applyProjectArchive", { operationId: randomUUID(), previewToken: preview.previewToken }).value.operation.stage, "completed");
  }
  fs.rmdirSync(join(f.root, "Client"));
  for (let i = 0; i < projects.length; i++) {
    const preview = f.query("workspace.previewProjectArchive", { projectId: projects[i].projectId, action: "restore", name: null, createParent: i === 0 }).value;
    assert.deepEqual(preview.blockers, [], JSON.stringify(preview));
    const result = f.command("workspace.applyProjectArchive", { operationId: randomUUID(), previewToken: preview.previewToken });
    assert.equal(result.value.operation.stage, "completed", JSON.stringify(result));
  }
  const restored = projectMetadataRecords(f.query("workspace.listProjects"));
  assert.equal(restored.length, 2); assert.equal(restored[0].categoryId, restored[1].categoryId);
}, "grouped"));

for (const mode of ["direct", "grouped"]) test(`${mode}: alternative restore names are basenames, never another relative path`, () => fixture(f => {
  const projectId = archiveProject(f);
  for (const name of ["Nested/Restored", "../Outside", "/Outside", "", ".", ".."]) {
    const preview = f.query("workspace.previewProjectArchive", { projectId, action: "restore", name, createParent: true });
    assert.equal(preview.ok, false, name);
  }
}, mode));

test("an unavailable archived category branch does not block restoration of a healthy archived sibling", () => fixture(f => {
  fs.mkdirSync(join(f.root, "Other")); fs.mkdirSync(join(f.root, "Other", "Second"));
  const discovery = f.query("workspace.previewDiscovery").value;
  const projects = f.command("workspace.applyDiscovery", { previewToken: discovery.previewToken }).value.projects;
  designate(f);
  for (const project of projects) {
    const preview = f.query("workspace.previewProjectArchive", { projectId: project.projectId, action: "archive", name: null, createParent: false }).value;
    assert.equal(f.command("workspace.applyProjectArchive", { operationId: randomUUID(), previewToken: preview.previewToken }).value.operation.stage, "completed");
  }
  fs.renameSync(join(f.root, "Archive", "Client"), join(f.directory, "unavailable-client"));
  const healthy = projects.find(p => p.relativePath === "Other/Second");
  const preview = f.query("workspace.previewProjectArchive", { projectId: healthy.projectId, action: "restore", name: null, createParent: false }).value;
  assert.deepEqual(preview.blockers, []);
  const result = f.command("workspace.applyProjectArchive", { operationId: randomUUID(), previewToken: preview.previewToken });
  assert.equal(result.value.operation.stage, "completed");
  assert.equal(f.query("workspace.listArchivedProjects").value.projects.length, 1);
}, "grouped"));
