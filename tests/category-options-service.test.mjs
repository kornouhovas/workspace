import Database from "better-sqlite3";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { renameNoReplace } from "../dist/service/project-rename-filesystem.mjs";
import {openSettingsService} from "../dist/service/settings.mjs";
import { openUnconvertedEngineFixture } from "./support/unconverted-command-engines.mjs";
import { projectMetadataRecords, bindFixtureFolders } from "./support/identity-migration-fixtures.mjs";
const openEngineService = (...args) => openUnconvertedEngineFixture(...args).engines;

const observer = { watch() { return { close() {} }; }, schedule() { return { cancel() {} }; } };
function fixture(run, options = {}) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "category-options-")));
  const root = join(directory, "root"), database = join(directory, "app.sqlite");
  fs.mkdirSync(root); fs.mkdirSync(join(root, "Original")); fs.mkdirSync(join(root, "Original", "Project"));
  fs.writeFileSync(join(root, "Original", "Project", "sentinel"), "exact bytes\n");
  let service;
  const open = () => service = (options.production ? openSettingsService : openEngineService)(database, undefined, undefined, observer, options.filesystem, options.native);
  try {
    open();
    const workspace = service.workspaces.create({ type: "workspace.create", name: "Primary", rootPath: root }).value;
    const sibling = service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root }).value;
    const query = (type, rest = {}) => service.handleQuery({ type, workspaceId: workspace.workspaceId, ...rest });
    const command = (type, rest = {}) => service.handleCommand({ type, workspaceId: workspace.workspaceId, ...rest });
    const preview = query("workspace.previewDiscovery", { mode: "grouped" }).value;
    const initial = command("workspace.applyDiscovery", { previewToken: preview.previewToken }).value;
    run({ root, directory, database, query, command, initial, workspace, sibling, get application(){return service.application??service;},
      restart() { service.close(); open(); } });
  } finally { service?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
}

test("reviewed creation persists an empty category shared with sibling workspaces", () => fixture(f => {
  const review = f.query("workspace.previewCategoryFolder", { action: "create", name: "Empty", categoryId: null });
  assert.equal(review.ok, true); assert.deepEqual(review.value.affectedProjects, []);
  assert.equal(fs.existsSync(join(f.root, "Empty")), false);
  const request = { operationId: randomUUID(), previewToken: review.value.previewToken };
  const result = f.command("workspace.applyCategoryFolder", request);
  assert.equal(result.ok, true); assert.equal(result.value.outcome, "completed");
  const categoryId = result.value.operation.categoryId;
  assert.equal(fs.statSync(join(f.root, "Empty")).isDirectory(), true);
  f.restart();
  assert.deepEqual(f.command("workspace.applyCategoryFolder", request), result);
  const projects = f.query("workspace.listProjects", { workspaceId: f.sibling.workspaceId }).value;
  assert.equal(projects.categories.some(c=>c.categoryId===categoryId),false);
  const stored=new Database(f.database);
  try {assert.deepEqual(stored.prepare('SELECT relative_path,durable_evidence FROM categories WHERE id=?').get(categoryId),{relative_path:'Empty',durable_evidence:null});}finally{stored.close();}
  assert.deepEqual(projects.projects.map(p => p.projectId), f.initial.projects.map(p => p.projectId));
}));

test("category rename previews all affected projects and retains identities and values on restart", () => fixture(f => {
  const project = f.initial.projects[0], categoryId = project.categoryId;
  const propertyId = f.command("workspace.createProperty", { name: "Notes", propertyType: "text" }).value.propertyId;
  f.command("workspace.setTextValue", { projectId: project.projectId, propertyId, value: "  exact\nТекст  " });
  const beforeValues = f.query("workspace.listTextProperties");
  const review = f.query("workspace.previewCategoryFolder", { action: "rename", categoryId, name: "Renamed" });
  assert.equal(review.ok, true);
  assert.deepEqual(review.value.affectedProjects, [{ projectId: project.projectId, name: "Project", originalRelativePath: "Original/Project", requestedRelativePath: "Renamed/Project" }]);
  assert.equal(fs.existsSync(join(f.root, "Original", "Project")), true);
  const applied = f.command("workspace.applyCategoryFolder", { operationId: randomUUID(), previewToken: review.value.previewToken });
  assert.equal(applied.ok, true); assert.equal(applied.value.outcome, "completed");
  assert.equal(fs.existsSync(join(f.root, "Original")), false);
  assert.equal(fs.readFileSync(join(f.root, "Renamed", "Project", "sentinel"), "utf8"), "exact bytes\n");
  f.restart();
  const list = f.query("workspace.listProjects", { workspaceId: f.sibling.workspaceId }).value;
  assert.equal(list.categories.find(c => c.name === "Renamed").categoryId, categoryId);
  assert.equal(list.projects[0].projectId, project.projectId);
  assert.equal(list.projects[0].relativePath, "Renamed/Project");
  assert.deepEqual(f.query("workspace.listTextProperties"), beforeValues);
}));

test("existing folders require separate association review and enroll previewed projects only", () => fixture(f => {
  fs.mkdirSync(join(f.root, "Existing")); fs.mkdirSync(join(f.root, "Existing", "Second"));
  fs.writeFileSync(join(f.root, "Existing", "Second", "contents"), "keep");
  assert.equal(f.query("workspace.previewCategoryFolder", { action: "create", name: "Existing", categoryId: null }).ok, false);
  const review = f.query("workspace.previewCategoryFolder", { action: "associate", name: "Existing", categoryId: null });
  assert.equal(review.ok, true);
  assert.deepEqual(review.value.affectedProjects, [{ projectId: null, name: "Second", originalRelativePath: "Existing/Second", requestedRelativePath: "Existing/Second" }]);
  const applied = f.command("workspace.applyCategoryFolder", { operationId: randomUUID(), previewToken: review.value.previewToken });
  assert.equal(applied.value.outcome, "completed");
  f.restart();
  const list = f.query("workspace.listProjects").value;
  assert.equal(list.projects.length,1);
  assert.equal(list.retainedProjects.find(p=>p.name==='Second').categoryId,applied.value.operation.categoryId);
  assert.equal(list.retainedProjects.find(p=>p.name==='Second').identityReason,'review_required');
  assert.equal(fs.readFileSync(join(f.root, "Existing", "Second", "contents"), "utf8"), "keep");
}));


test("interrupted rename is not replayed by reads/restart and completes only after explicit recovery", () => fixture(f => {
  const project = f.initial.projects[0];
  const review = f.query("workspace.previewCategoryFolder", { action: "rename", categoryId: project.categoryId, name: "Moved" }).value;
  const request = { operationId: randomUUID(), previewToken: review.previewToken };
  const applied = f.command("workspace.applyCategoryFolder", request);
  assert.equal(applied.value.outcome, "recoverable");
  f.restart();
  assert.equal(f.command("workspace.applyCategoryFolder", request).value.outcome, "recoverable");
  assert.equal(f.query("workspace.listCategoryFolderOperations").value.operations.length, 1);
  assert.equal(f.query("workspace.previewDiscovery", { mode: "direct" }).ok, true);
  const recovery = f.query("workspace.previewCategoryFolderRecovery", { operationId: request.operationId });
  assert.equal(recovery.ok, true); assert.deepEqual(recovery.value.actions, ["complete_destination"]);
  assert.equal(recovery.value.originalState, "missing"); assert.equal(recovery.value.destinationState, "matching");
  const done = f.command("workspace.recoverCategoryFolder", { operationId: request.operationId, previewToken: recovery.value.previewToken, action: "complete_destination" });
  assert.equal(done.value.outcome, "completed");
  f.restart();
  assert.equal(projectMetadataRecords(f.query("workspace.listProjects"))[0].projectId, project.projectId);
  assert.equal(projectMetadataRecords(f.query("workspace.listProjects"))[0].relativePath, "Moved/Project");
  assert.deepEqual(f.query("workspace.listCategoryFolderOperations").value.operations, []);
}, { native(from, to) { assert.equal(renameNoReplace(from, to), "renamed"); throw new Error("Injected response interruption"); } }));

test("presentation is workspace-owned, persists independently and never renames folders", () => fixture(f => {
  const categoryId = f.initial.categories[0].categoryId;
  const options = [{ categoryId, color: "purple", hidden: true, position: 0 }];
  assert.equal(f.command("workspace.setCategoryPresentation", { options }).ok, true);
  f.restart();
  assert.deepEqual(f.query("workspace.listCategoryPresentation").value.options, options);
  assert.deepEqual(f.query("workspace.listCategoryPresentation", { workspaceId: f.sibling.workspaceId }).value.options,
    [{ categoryId, color: "default", hidden: false, position: 0 }]);
  assert.equal(fs.existsSync(join(f.root, "Original", "Project")), true);
  assert.equal(f.command("workspace.setCategoryPresentation", { options: [{ ...options[0], categoryId: randomUUID() }] }).ok, false);
}));

test("native no-replace rejects a destination inserted after preview without overwriting either tree", () => fixture(f => {
  const review = f.query("workspace.previewCategoryFolder", { action: "rename", categoryId: f.initial.projects[0].categoryId, name: "Collision" }).value;
  const result = f.command("workspace.applyCategoryFolder", { operationId: randomUUID(), previewToken: review.previewToken });
  assert.equal(result.value.outcome, "rejected"); assert.equal(result.value.operation.problem, "occupied");
  assert.equal(fs.readFileSync(join(f.root, "Collision", "marker"), "utf8"), "do not overwrite");
  assert.equal(fs.readFileSync(join(f.root, "Original", "Project", "sentinel"), "utf8"), "exact bytes\n");
  assert.equal(projectMetadataRecords(f.query("workspace.listProjects"))[0].projectId, f.initial.projects[0].projectId);
}, { native(from, to) { fs.mkdirSync(to); fs.writeFileSync(join(to, "marker"), "do not overwrite"); return renameNoReplace(from, to); } }));


for (const name of ["", " ", ".", "..", "../escape", "Nested/Category", "\\escape", ".hidden", "$RECYCLE.BIN", "nul\u0000name"]) {
  test(`invalid category name is rejected without effects: ${JSON.stringify(name)}`, () => fixture(f => {
    const before = fs.readdirSync(f.root);
    assert.equal(f.query("workspace.previewCategoryFolder", { action: "create", name, categoryId: null }).ok, false);
    assert.deepEqual(fs.readdirSync(f.root), before);
    assert.deepEqual(f.query("workspace.listCategoryFolderOperations").value.operations, []);
  }));
}

test("changed/replaced previews, foreign ownership and caller-supplied paths cannot mutate folders", () => fixture(f => {
  const input = { action: "rename", categoryId: f.initial.projects[0].categoryId, name: "New" };
  assert.equal(f.query("workspace.previewCategoryFolder", { ...input, path: "unsafe" }).ok, false);
  assert.equal(f.query("workspace.previewCategoryFolder", { ...input, categoryId: randomUUID() }).ok, false);
  const first = f.query("workspace.previewCategoryFolder", input).value;
  const second = f.query("workspace.previewCategoryFolder", { ...input, name: "Second" }).value;
  assert.equal(f.command("workspace.applyCategoryFolder", { operationId: randomUUID(), previewToken: first.previewToken }).error.code, "stale_preview");
  assert.equal(f.command("workspace.applyCategoryFolder", { workspaceId: f.sibling.workspaceId, operationId: randomUUID(), previewToken: second.previewToken }).error.code, "stale_preview");
  fs.mkdirSync(join(f.root, "Second"));
  assert.equal(f.command("workspace.applyCategoryFolder", { operationId: randomUUID(), previewToken: second.previewToken }).error.code, "stale_preview");
  assert.equal(fs.existsSync(join(f.root, "Original", "Project")), true);
  const third = f.query("workspace.previewCategoryFolder", { ...input, name: "Third" }).value;
  f.restart();
  assert.equal(f.command("workspace.applyCategoryFolder", { operationId: randomUUID(), previewToken: third.previewToken }).error.code, "stale_preview");
}));

test("a replaced category destination is never adopted by recovery", () => fixture(f => {
  const project = f.initial.projects[0];
  const review = f.query("workspace.previewCategoryFolder", { action: "rename", categoryId: project.categoryId, name: "Moved" }).value;
  const operationId = randomUUID();
  assert.equal(f.command("workspace.applyCategoryFolder", { operationId, previewToken: review.previewToken }).value.outcome, "recoverable");
  fs.renameSync(join(f.root, "Moved"), join(f.directory, "retained-real-folder")); fs.mkdirSync(join(f.root, "Moved"));
  const recovery = f.query("workspace.previewCategoryFolderRecovery", { operationId }).value;
  assert.equal(recovery.destinationState, "changed"); assert.deepEqual(recovery.actions, []);
  assert.equal(f.command("workspace.recoverCategoryFolder", { operationId, previewToken: randomUUID(), action: "complete_destination" }).ok, false);
  f.restart();
  assert.equal(f.query("workspace.listCategoryFolderOperations").value.operations[0].operationId, operationId);
  assert.equal(fs.readFileSync(join(f.directory, "retained-real-folder", "Project", "sentinel"), "utf8"), "exact bytes\n");
}, { native(from, to) { assert.equal(renameNoReplace(from, to), "renamed"); throw new Error("Interrupted"); } }));

for (const production of [false,true])for (const phase of ["intent", "effect", "recorded"]) {
  test(`${production?"production durable":"legacy engine"}: abrupt process exit at ${phase} retains explicit recoverable category state`, () => fixture(f => {
    const operationId = randomUUID(), project = f.initial.projects[0];
    const child = spawnSync(process.execPath, ["--import", "tsx", "tests/fixtures/category-options-crash-worker.mjs", f.database, f.workspace.workspaceId, project.categoryId, operationId, phase,production?"production":"legacy"], { encoding: "utf8", timeout: 15000 });
    assert.equal(child.status, 71, child.stderr);
    f.restart();
    const before = f.query("workspace.listCategoryFolderOperations").value.operations;
    assert.equal(before.length, 1); assert.equal(before[0].operationId, operationId);
    const preview = f.query("workspace.previewDiscovery", { mode: "direct" }).value;
    assert.equal(f.command("workspace.applyDiscovery", { previewToken: preview.previewToken }).ok, false);
    assert.equal(f.command("workspace.createProject", { operationId: randomUUID(), categoryId: project.categoryId, mode: "grouped", name: "Blocked", expectedRevision: f.initial.revision }).value.outcome, "rejected");
    const recovery = f.query("workspace.previewCategoryFolderRecovery", { operationId, workspaceId: f.sibling.workspaceId }).value;
    const action = phase === "intent" ? "keep_original" : "complete_destination";
    assert.deepEqual(recovery.actions, [action]);
    const completed = f.command("workspace.recoverCategoryFolder", { operationId, workspaceId: f.sibling.workspaceId, previewToken: recovery.previewToken, action });
    assert.equal(completed.value.outcome, phase === "intent" ? "rejected" : "completed");
    f.restart();
    const projects = f.query("workspace.listProjects").value;
    assert.equal(projects.projects[0].projectId, project.projectId);
    assert.equal(projects.projects[0].relativePath, phase === "intent" ? "Original/Project" : "Crash target/Project");
  },{production}));
}

test("closed storage produces normalized query errors instead of escaping the service boundary", () => {
  const directory = fs.mkdtempSync(join(tmpdir(), "category-options-closed-"));
  try {
    const service = openEngineService(join(directory, "app.sqlite")); service.close();
    for (const type of ["workspace.listCategoryFolderOperations", "workspace.previewCategoryFolderRecovery", "workspace.getCategoryFolderOperation", "workspace.listCategoryPresentation"]) {
      const input = { type, workspaceId: randomUUID(), ...(["workspace.previewCategoryFolderRecovery", "workspace.getCategoryFolderOperation"].includes(type) ? { operationId: randomUUID() } : {}) };
      assert.equal(service.handleQuery(input).ok, false);
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("renaming an ancestor of the configured archive is unavailable rather than stranding its locator", () => fixture(f => {
  const sql = new Database(f.database);
  try {
    sql.prepare("UPDATE sources SET archive_relative_path = 'Original/Archive'").run();
    const result = f.query("workspace.previewCategoryFolder", { action: "rename", categoryId: f.initial.projects[0].categoryId, name: "New" });
    assert.equal(result.ok, false);
    assert.equal(fs.existsSync(join(f.root, "Original", "Project")), true);
  } finally { sql.close(); }
}));

test("category option order persists by identity while folder and project placement stay unchanged", () => fixture(f => {
  const preview = f.query("workspace.previewCategoryFolder", { action: "create", categoryId: null, name: "Second" }).value;
  const created = f.command("workspace.applyCategoryFolder", { operationId: randomUUID(), previewToken: preview.previewToken }).value;
  const originalId = f.initial.categories[0].categoryId, secondId = created.operation.categoryId;
  bindFixtureFolders(f.application,f.workspace.workspaceId,[{kind:'category',id:secondId,relativePath:'Second'}]);
  const before = f.query("workspace.listProjects").value;
  const options = [{ categoryId: secondId, color: "blue", hidden: false, position: 0 }, { categoryId: originalId, color: "default", hidden: true, position: 1 }];
  assert.equal(f.command("workspace.setCategoryPresentation", { options }).ok, true);
  f.restart();
  const after = f.query("workspace.listProjects").value;
  assert.deepEqual(after.categories.map(c => c.categoryId), [secondId, originalId]);
  assert.deepEqual(after.projects, before.projects); assert.equal(after.revision, before.revision);
  assert.equal(fs.readFileSync(join(f.root, "Original", "Project", "sentinel"), "utf8"), "exact bytes\n");
  assert.deepEqual(f.query("workspace.listCategoryPresentation").value.options, options);
  assert.deepEqual(f.query("workspace.listProjects", { workspaceId: f.sibling.workspaceId }).value.categories.map(c => c.name), ["Original", "Second"]);
}));
