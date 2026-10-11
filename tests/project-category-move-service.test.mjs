import assert from "node:assert/strict";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import Database from "better-sqlite3";
import { openSettingsService } from "../dist/service/settings.mjs";
import { nativeProjectFilesystem } from "../src/service/project-filesystem.ts";

const dependencies = { watch() { return { close() {} }; }, schedule() { return { cancel() {} }; } };
function fixture(run, options = {}) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "category-move-")));
  const root = join(directory, "root"), databasePath = join(directory, "workspace.sqlite");
  let service, sql;
  const f = { directory, root, get service() { return service; }, get sql() { return sql; },
    restart() { service.close(); open(); } };
  const open = () => { service = openSettingsService(databasePath, undefined, undefined, dependencies,
    options.filesystem?.(f) ?? nativeProjectFilesystem, () => { throw new Error("No native effect allowed in this slice"); }); };
  try {
    fs.mkdirSync(root); fs.mkdirSync(join(root, "Original category")); fs.mkdirSync(join(root, "Destination"));
    fs.mkdirSync(join(root, "Original category", "Project 📝"));
    fs.writeFileSync(join(root, "Original category", "Project 📝", "sentinel"), "  Original bytes\n");
    open(); sql = new Database(databasePath);
    const workspace = service.workspaces.create({ type: "workspace.create", name: "Primary", rootPath: root }).value;
    const sibling = service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root }).value;
    const query = (type, extra = {}) => service.handleQuery({ type, workspaceId: workspace.workspaceId, ...extra });
    const command = (type, extra = {}) => service.handleCommand({ type, workspaceId: workspace.workspaceId, ...extra });
    const preview = query("workspace.previewDiscovery", { mode: "grouped" }).value;
    const initial = command("workspace.applyDiscovery", { previewToken: preview.previewToken }).value;
    const project = initial.projects.find((p) => p.name === "Project 📝");
    const destination = initial.categories.find((c) => c.name === "Destination");
    const propertyId = command("workspace.createProperty", { name: "Notes", propertyType: "text" }).value.propertyId;
    command("workspace.setTextValue", { projectId: project.projectId, propertyId, value: "  Exact\nТекст  " });
    const events = []; service.workspaces.subscribe((event) => events.push(event));
    const request = (extra = {}) => ({ type: "workspace.moveProjectCategory", workspaceId: workspace.workspaceId,
      projectId: project.projectId, operationId: randomUUID(), destinationCategoryId: project.categoryId,
      expectedRevision: initial.revision, ...extra });
    Object.assign(f, { workspace, sibling, query, command, initial, project, destination, propertyId, events, request });
    return run(f);
  } finally { service?.close(); sql?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
}

test("freshly validated current category yields a durable no-op without revision or event changes", () => fixture((f) => {
  const projects = f.query("workspace.listProjects");
  const values = f.query("workspace.listTextProperties");
  const request = f.request(), result = f.service.handleCommand(request);
  assert.equal(result.ok, true); assert.equal(result.value.outcome, "unchanged");
  assert.equal(result.value.project.projectId, f.project.projectId);
  assert.equal(result.value.project.categoryId, f.project.categoryId);
  assert.equal(result.value.project.relativePath, "Original category/Project 📝");
  assert.equal(result.value.project.revision, f.initial.revision);
  assert.deepEqual(f.query("workspace.listProjects"), projects);
  assert.deepEqual(f.query("workspace.listTextProperties"), values);
  assert.equal(f.events.filter((e) => e.type === "workspace.projectsChanged").length, 0);
  f.restart();
  assert.deepEqual(f.service.handleCommand(request), result);
  assert.deepEqual(f.query("workspace.getProjectCategoryMove", { operationId: request.operationId }), result);
  assert.deepEqual(f.query("workspace.getProjectCategoryMove", { workspaceId: f.sibling.workspaceId, operationId: request.operationId }), result);
  assert.deepEqual(f.query("workspace.listProjectCategoryMoves").value.operations, []);
  assert.equal(fs.readFileSync(join(f.root, "Original category", "Project 📝", "sentinel"), "utf8"), "  Original bytes\n");
}));

test("exact payloads, ownership and immutable retry bindings reject altered requests", () => fixture((f) => {
  const request = f.request();
  for (const input of [null, [], {}, { ...request, workspaceId: "bad" }, { ...request, projectId: "bad" },
    { ...request, operationId: "bad" }, { ...request, destinationCategoryId: "" }, { ...request, destinationCategoryId: null },
    ...[-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "1"].map((expectedRevision) => ({ ...request, expectedRevision })),
    ...["path", "name", "nativeIdentity", "mode", "root", "adapter"].map((field) => ({ ...request, [field]: "unsafe" }))]) {
    assert.equal(f.service.handleCommand(input).error.code, "invalid_input");
  }
  assert.equal(f.service.moveProjectCategory({ ...request, workspaceId: randomUUID() }).error.code, "invalid_input");
  assert.equal(f.service.moveProjectCategory({ ...request, projectId: randomUUID() }).value.problem, "project_unavailable");
  assert.equal(f.service.moveProjectCategory({ ...request, destinationCategoryId: randomUUID() }).value.problem, "category_unavailable");
  const unrelatedRoot = join(f.directory, "unrelated"); fs.mkdirSync(unrelatedRoot); fs.mkdirSync(join(unrelatedRoot, "Foreign"));
  const unrelated = f.service.workspaces.create({ type: "workspace.create", name: "Unrelated", rootPath: unrelatedRoot }).value;
  const preview = f.query("workspace.previewDiscovery", { workspaceId: unrelated.workspaceId, mode: "grouped" }).value;
  const foreign = f.command("workspace.applyDiscovery", { workspaceId: unrelated.workspaceId, previewToken: preview.previewToken }).value;
  assert.equal(f.service.moveProjectCategory({ ...request, destinationCategoryId: foreign.categories[0].categoryId }).value.problem, "category_unavailable");
  assert.equal(f.service.moveProjectCategory({ ...request, workspaceId: unrelated.workspaceId, expectedRevision: foreign.revision }).value.problem, "project_unavailable");
  const result = f.service.moveProjectCategory(request); assert.equal(result.value.outcome, "unchanged");
  for (const change of [{ expectedRevision: request.expectedRevision + 1 }, { projectId: randomUUID() },
    { workspaceId: f.sibling.workspaceId }, { destinationCategoryId: f.destination.categoryId }]) {
    assert.equal(f.service.moveProjectCategory({ ...request, ...change }).error.code, "invalid_input");
  }
  assert.equal(f.query("workspace.getProjectCategoryMove", { operationId: request.operationId, workspaceId: unrelated.workspaceId }).error.code, "invalid_input");
  assert.deepEqual(f.service.moveProjectCategory(request), result);
  for (const type of ["workspace.getProjectCategoryMove", "workspace.listProjectCategoryMoves"]) {
    const payload = type.endsWith("Moves") ? {} : { operationId: request.operationId };
    assert.equal(f.query(type, { ...payload, path: f.root }).error.code, "invalid_input");
    assert.equal(f.query(type, { ...payload, workspaceId: randomUUID() }).error.code, "invalid_input");
  }
}));

for (const state of ["project-missing", "project-replaced", "project-link", "category-missing", "category-replaced", "category-link",
  "root-missing", "root-replaced", "wrong-spelling", "stale-revision", "inactive-project", "unresolved-project", "inactive-category",
  "excluded", "archive", "direct-mode", "native-conflict"]) {
  test(`current category is freshly validated: ${state} rejects a new no-op`, () => fixture((f) => {
    const category = join(f.root, "Original category"), project = join(category, "Project 📝");
    if (state.startsWith("project-") || state.startsWith("category-") || state.startsWith("root-")) {
      const target = state.startsWith("project-") ? project : state.startsWith("category-") ? category : f.root;
      fs.renameSync(target, join(f.directory, "away"));
      if (state.endsWith("replaced")) fs.mkdirSync(target);
      if (state.endsWith("link")) fs.symlinkSync(join(f.directory, "away"), target, "junction");
    }
    if (state === "wrong-spelling") fs.renameSync(project, join(category, "pROJECT 📝"));
    if (state === "stale-revision") f.sql.prepare("UPDATE sources SET discovery_revision = discovery_revision + 1").run();
    if (state === "inactive-project") f.sql.prepare("UPDATE projects SET mode_inactive = 1").run();
    if (state === "unresolved-project") f.sql.prepare("UPDATE projects SET association_state = 'unresolved'").run();
    if (state === "inactive-category") { f.sql.prepare("UPDATE projects SET mode_inactive = 1").run(); f.sql.prepare("UPDATE categories SET mode_inactive = 1").run(); }
    if (state === "excluded") f.sql.prepare("UPDATE sources SET excluded_relative_paths = '[\"Original category\"]'").run();
    if (state === "archive") f.sql.prepare("UPDATE sources SET archive_relative_path = 'Original category'").run();
    if (state === "direct-mode") {
      const preview = f.query("workspace.previewDiscovery", { mode: "direct" }).value;
      assert.equal(f.command("workspace.applyDiscovery", { previewToken: preview.previewToken }).ok, true);
      f.events.length = 0;
    }
    if (state === "native-conflict") f.sql.prepare("UPDATE categories SET native_identity = (SELECT native_identity FROM projects LIMIT 1) WHERE id = ?").run(f.destination.categoryId);
    const result = f.service.moveProjectCategory(f.request());
    assert.equal(result.value.outcome, "rejected"); assert.equal(result.value.operation, null);
    assert.equal(f.query("workspace.listProjectCategoryMoves").value.operations.length, 0);
    assert.equal(f.events.filter((e) => e.type === "workspace.projectsChanged").length, 0);
  }));
}

test("physical moves fail closed with unchanged public projection and sentinel", () => fixture((f) => {
  const before = f.query("workspace.listProjects"), values = f.query("workspace.listTextProperties");
  const result = f.service.moveProjectCategory(f.request({ destinationCategoryId: f.destination.categoryId }));
  assert.equal(result.value.outcome, "rejected"); assert.equal(result.value.problem, "unsupported");
  assert.deepEqual(f.query("workspace.listProjects"), before); assert.deepEqual(f.query("workspace.listTextProperties"), values);
  assert.equal(fs.existsSync(join(f.root, "Destination", "Project 📝")), false);
  assert.equal(fs.readFileSync(join(f.root, "Original category", "Project 📝", "sentinel"), "utf8"), "  Original bytes\n");
}));

test("injected permission loss rejects the no-op without a fabricated receipt", () => fixture((f) => {
  f.deny = true;
  assert.equal(f.service.moveProjectCategory(f.request()).value.problem, "permission_denied");
  f.deny = false;
  assert.equal(f.query("workspace.listProjectCategoryMoves").value.operations.length, 0);
}, { filesystem: (f) => ({ ...nativeProjectFilesystem, assertAccessible(path) {
  if (f.deny) throw Object.assign(new Error("Injected permission loss"), { code: "EACCES" });
  nativeProjectFilesystem.assertAccessible(path);
} }) }));

test("injected receipt-write failure rolls back intent and permits a fresh explicit retry", () => fixture((f) => {
  f.sql.exec("CREATE TRIGGER fail_move_receipt BEFORE UPDATE ON project_category_move_operations WHEN NEW.stage = 'completed' BEGIN SELECT RAISE(ABORT, 'Injected receipt failure'); END");
  const before = f.query("workspace.listProjects"), request = f.request();
  assert.equal(f.service.moveProjectCategory(request).value.problem, "storage_error");
  assert.equal(f.query("workspace.getProjectCategoryMove", { operationId: request.operationId }).error.code, "invalid_input");
  assert.deepEqual(f.query("workspace.listProjects"), before);
  f.sql.exec("DROP TRIGGER fail_move_receipt");
  assert.equal(f.service.moveProjectCategory(request).value.outcome, "unchanged");
}));

test("history remains readable after workspace removal and source reuse; original retries remain immutable", () => fixture((f) => {
  const request = f.request(), receipt = f.service.moveProjectCategory(request);
  f.command("workspace.remove", { workspaceId: f.workspace.workspaceId });
  assert.deepEqual(f.query("workspace.getProjectCategoryMove", { workspaceId: f.sibling.workspaceId, operationId: request.operationId }), receipt);
  f.command("workspace.remove", { workspaceId: f.sibling.workspaceId });
  const reused = f.service.workspaces.create({ type: "workspace.create", name: "Reused", rootPath: f.root }).value;
  assert.equal(reused.sourceId, f.workspace.sourceId);
  f.restart();
  assert.deepEqual(f.query("workspace.getProjectCategoryMove", { workspaceId: reused.workspaceId, operationId: request.operationId }), receipt);
  assert.equal(f.service.moveProjectCategory({ ...request, workspaceId: reused.workspaceId }).error.code, "invalid_input");
}));

test("injected durable unfinished intent is read-only on status, list, original retry and reopen", () => fixture((f) => {
  const seed = f.service.moveProjectCategory(f.request()); assert.equal(seed.value.outcome, "unchanged");
  const row = f.sql.prepare("SELECT * FROM project_category_move_operations").get();
  const request = f.request();
  Object.assign(row, { operation_id: request.operationId, stage: "intent", result_kind: null, completed_revision: null });
  f.sql.prepare(`INSERT INTO project_category_move_operations (${Object.keys(row).join(", ")}) VALUES (${Object.keys(row).map(() => "?").join(", ")})`).run(...Object.values(row));
  const result = f.service.moveProjectCategory(request); assert.equal(result.value.outcome, "recoverable");
  for (let i = 0; i < 2; i++) {
    const list = f.query("workspace.listProjectCategoryMoves").value;
    assert.deepEqual(list.operations, [result.value.operation]);
    assert.deepEqual(f.query("workspace.getProjectCategoryMove", { operationId: request.operationId }), result);
    assert.deepEqual(f.service.moveProjectCategory(request), result);
    const serialized = JSON.stringify(list);
    for (const privateValue of [f.root, row.native_identity, row.root_identity, row.original_parent_identity]) assert.equal(serialized.includes(privateValue), false);
    assert.equal(fs.readFileSync(join(f.root, "Original category", "Project 📝", "sentinel"), "utf8"), "  Original bytes\n");
    f.restart();
  }
  assert.equal(f.service.moveProjectCategory(f.request()).value.problem, "reserved_destination");
}));

test("an unfinished rename reservation rejects a new current-category no-op while reads and exact Text stay available", () => fixture((f) => {
  const rename = f.service.renameProject({ type: "workspace.renameProject", workspaceId: f.workspace.workspaceId,
    projectId: f.project.projectId, operationId: randomUUID(), name: "Requested", expectedRevision: f.initial.revision });
  assert.equal(rename.value.outcome, "recoverable");
  const before = f.query("workspace.listTextProperties");
  assert.equal(f.service.moveProjectCategory(f.request()).value.problem, "reserved_destination");
  assert.deepEqual(f.query("workspace.listTextProperties"), before);
  assert.equal(f.query("workspace.listProjects").ok, true);
  assert.equal(fs.existsSync(join(f.root, "Original category", "Requested")), false);
  assert.equal(fs.readFileSync(join(f.root, "Original category", "Project 📝", "sentinel"), "utf8"), "  Original bytes\n");
}));
