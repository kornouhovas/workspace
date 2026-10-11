import assert from "node:assert/strict";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import Database from "better-sqlite3";
import { openSettingsService } from "../dist/service/settings.mjs";
import { renameNoReplace } from "../dist/service/project-rename-filesystem.mjs";
import { nativeProjectFilesystem } from "../src/service/project-filesystem.ts";

const dependencies = { watch() { return { close() {} }; }, schedule() { return { cancel() {} }; } };
function fixture(run, options = {}) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "category-move-")));
  const root = join(directory, "root"), databasePath = join(directory, "workspace.sqlite");
  let service, sql;
  const projectName = options.name ?? "Project 📝";
  const f = { directory, root, get service() { return service; }, get sql() { return sql; },
    restart() { service.close(); open(); } };
  const open = () => { service = openSettingsService(databasePath, undefined, undefined, dependencies,
    options.filesystem?.(f) ?? nativeProjectFilesystem, options.defaultNative ? undefined : (from, to) => {
      if (options.native) return options.native(f, from, to);
      throw new Error("Injected unknown native outcome");
    }); };
  try {
    fs.mkdirSync(root); fs.mkdirSync(join(root, "Original category")); fs.mkdirSync(join(root, "Destination"));
    fs.mkdirSync(join(root, "Original category", projectName));
    fs.writeFileSync(join(root, "Original category", projectName, "sentinel"), "  Original bytes\n");
    open(); sql = new Database(databasePath);
    const workspace = service.workspaces.create({ type: "workspace.create", name: "Primary", rootPath: root }).value;
    const sibling = service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root }).value;
    const query = (type, extra = {}) => service.handleQuery({ type, workspaceId: workspace.workspaceId, ...extra });
    const command = (type, extra = {}) => service.handleCommand({ type, workspaceId: workspace.workspaceId, ...extra });
    const preview = query("workspace.previewDiscovery", { mode: "grouped" }).value;
    const initial = command("workspace.applyDiscovery", { previewToken: preview.previewToken }).value;
    const project = initial.projects.find((p) => p.categoryName === "Original category");
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
  test(`current placement is freshly validated: ${state} rejects no-op and physical moves`, () => fixture((f) => {
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
    for (const destinationCategoryId of [f.project.categoryId, f.destination.categoryId]) {
      const result = f.service.moveProjectCategory(f.request({ destinationCategoryId }));
      assert.equal(result.value.outcome, "rejected"); assert.equal(result.value.operation, null);
      assert.equal(f.query("workspace.listProjectCategoryMoves").value.operations.length, 0);
      assert.equal(f.events.filter((e) => e.type === "workspace.projectsChanged").length, 0);
    }
  }));
}

test("one-hop category move preserves identity and exact Text and publishes one committed sibling event", () => fixture((f) => {
  const values = f.query("workspace.listTextProperties"), before = f.query("workspace.listProjects").value;
  const oldPath = join(f.root, "Original category", "Project 📝"), newPath = join(f.root, "Destination", "Project 📝");
  const identity = nativeProjectFilesystem.inspect(oldPath).identity;
  const request = f.request({ destinationCategoryId: f.destination.categoryId });
  const result = f.service.moveProjectCategory(request);
  assert.equal(result.ok, true); assert.equal(result.value.outcome, "completed", JSON.stringify(result));
  assert.equal(result.value.project.categoryId, f.destination.categoryId);
  assert.equal(result.value.project.relativePath, "Destination/Project 📝");
  assert.equal(result.value.project.revision, f.initial.revision + 1);
  assert.equal(fs.existsSync(oldPath), false);
  assert.deepEqual(nativeProjectFilesystem.inspect(newPath).identity, identity);
  assert.equal(fs.readFileSync(join(newPath, "sentinel"), "utf8"), "  Original bytes\n");
  assert.deepEqual(f.query("workspace.listTextProperties"), values);
  for (const workspaceId of [f.workspace.workspaceId, f.sibling.workspaceId]) {
    const list = f.query("workspace.listProjects", { workspaceId }).value;
    const project = list.projects.find((p) => p.projectId === f.project.projectId);
    assert.deepEqual(project, { ...before.projects.find((p) => p.projectId === f.project.projectId),
      categoryId: f.destination.categoryId, categoryName: "Destination", relativePath: "Destination/Project 📝" });
    assert.equal(list.revision, f.initial.revision + 1);
  }
  const changes = f.events.filter((e) => e.type === "workspace.projectsChanged");
  assert.equal(changes.length, 1);
  assert.deepEqual(new Set(changes[0].workspaceIds), new Set([f.workspace.workspaceId, f.sibling.workspaceId]));
  assert.deepEqual(f.service.moveProjectCategory(request), result);
  f.restart();
  assert.deepEqual(f.service.moveProjectCategory(request), result);
  assert.deepEqual(f.query("workspace.getProjectCategoryMove", { operationId: request.operationId }), result);
  assert.deepEqual(f.query("workspace.listTextProperties"), values);
  assert.equal(f.query("workspace.listProjects").value.projects.find((p) => p.projectId === f.project.projectId).categoryId, f.destination.categoryId);
}, { defaultNative: true }));

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

test("injected category alias ambiguity rejects even an exact existing destination", () => fixture((f) => {
  f.alias = true;
  const result = f.service.moveProjectCategory(f.request({ destinationCategoryId: f.destination.categoryId }));
  assert.equal(result.value.outcome, "rejected");
  assert.equal(result.value.problem, "occupied");
  assert.equal(fs.existsSync(join(f.root, "Destination", "Project 📝")), false);
}, { filesystem: (f) => ({ ...nativeProjectFilesystem, names(path) {
  const names = nativeProjectFilesystem.names(path);
  return f.alias && path === f.root ? [...names, "dESTINATION"] : names;
} }), defaultNative: true }));

const moveRequest = (f) => f.request({ destinationCategoryId: f.destination.categoryId });
const originalPath = (f) => join(f.root, f.project.relativePath);
const destinationPath = (f) => join(f.root, "Destination", f.project.name);
function assertNoMetadataEffect(f, values) {
  const list = f.query("workspace.listProjects").value;
  const retained = [...list.projects, ...list.retainedProjects].find((p) => p.projectId === f.project.projectId);
  assert.equal(retained.relativePath, f.project.relativePath);
  assert.equal(retained.categoryId, f.project.categoryId);
  assert.equal(list.revision, f.initial.revision);
  assert.deepEqual(f.query("workspace.listTextProperties"), values);
  assert.equal(f.events.filter((e) => e.type === "workspace.projectsChanged").length, 0);
}

for (const state of ["missing", "replaced", "link", "wrong-spelling", "excluded", "archive", "inactive", "unresolved", "permission"]) {
  test(`destination ${state} is rejected before a physical effect`, () => fixture((f) => {
    const path = join(f.root, "Destination"), values = f.query("workspace.listTextProperties");
    if (["missing", "replaced", "link"].includes(state)) fs.renameSync(path, join(f.directory, "away"));
    if (state === "replaced") fs.mkdirSync(path);
    if (state === "link") fs.symlinkSync(join(f.directory, "away"), path, "junction");
    if (state === "wrong-spelling") fs.renameSync(path, join(f.root, "dESTINATION"));
    if (state === "excluded") f.sql.prepare("UPDATE sources SET excluded_relative_paths = '[\"Destination\"]'").run();
    if (state === "archive") f.sql.prepare("UPDATE sources SET archive_relative_path = 'Destination'").run();
    if (state === "inactive") f.sql.prepare("UPDATE categories SET mode_inactive = 1 WHERE id = ?").run(f.destination.categoryId);
    if (state === "unresolved") f.sql.prepare("UPDATE categories SET association_state = 'unresolved' WHERE id = ?").run(f.destination.categoryId);
    if (state === "permission") f.deny = path;
    const result = f.service.moveProjectCategory(moveRequest(f));
    assert.equal(result.value.outcome, "rejected"); assert.equal(result.value.operation, null);
    f.deny = null;
    assertNoMetadataEffect(f, values);
    assert.equal(fs.readFileSync(join(originalPath(f), "sentinel"), "utf8"), "  Original bytes\n");
  }, { defaultNative: true, filesystem: (f) => ({ ...nativeProjectFilesystem, assertAccessible(path) {
    if (path === f.deny) throw Object.assign(new Error("Injected destination permission loss"), { code: "EACCES" });
    nativeProjectFilesystem.assertAccessible(path);
  } }) }));
}

for (const kind of ["empty-directory", "nonempty-directory", "file", "link", "alias"]) {
  test(`occupied ${kind} preserves its identity and bytes and the original project`, () => fixture((f) => {
    const target = kind === "alias" ? join(f.root, "Destination", "pROJECT 📝") : destinationPath(f);
    if (["empty-directory", "nonempty-directory", "alias"].includes(kind)) fs.mkdirSync(target);
    if (kind === "nonempty-directory") fs.writeFileSync(join(target, "third-party"), "Keep");
    if (kind === "file") fs.writeFileSync(target, "Keep");
    if (kind === "link") fs.symlinkSync(originalPath(f), target, "junction");
    const identity = nativeProjectFilesystem.inspect(target), values = f.query("workspace.listTextProperties");
    assert.equal(f.service.moveProjectCategory(moveRequest(f)).value.problem, "occupied");
    assert.deepEqual(nativeProjectFilesystem.inspect(target), identity);
    if (kind === "nonempty-directory") assert.equal(fs.readFileSync(join(target, "third-party"), "utf8"), "Keep");
    if (kind === "file") assert.equal(fs.readFileSync(target, "utf8"), "Keep");
    if (kind === "empty-directory") assert.deepEqual(fs.readdirSync(target), []);
    assertNoMetadataEffect(f, values);
    assert.equal(fs.readFileSync(join(originalPath(f), "sentinel"), "utf8"), "  Original bytes\n");
  }, { defaultNative: true }));
}

test("actual no-replace adapter preserves an empty target inserted at the native-call boundary", () => fixture((f) => {
  const values = f.query("workspace.listTextProperties"), request = moveRequest(f);
  const result = f.service.moveProjectCategory(request);
  assert.equal(result.value.outcome, "rejected"); assert.equal(result.value.problem, "occupied");
  assert.equal(result.value.operation.stage, "failed");
  assert.deepEqual(nativeProjectFilesystem.inspect(destinationPath(f)).identity, f.targetIdentity);
  assert.deepEqual(fs.readdirSync(destinationPath(f)), []);
  assertNoMetadataEffect(f, values);
  assert.equal(fs.readFileSync(join(originalPath(f), "sentinel"), "utf8"), "  Original bytes\n");
  assert.deepEqual(f.service.moveProjectCategory(request), result);
}, { native: (f, from, to) => {
  const intent = f.query("workspace.listProjectCategoryMoves").value.operations[0];
  assert.equal(intent.stage, "intent", "intent is visible through another public query before the native effect");
  fs.mkdirSync(to); f.targetIdentity = nativeProjectFilesystem.inspect(to).identity;
  return renameNoReplace(from, to);
} }));

for (const outcome of ["permission_denied", "busy", "cross_device", "unsupported", "native_unavailable", "source_unavailable", "invalid_argument", "filesystem_error", "throw-before", "throw-after"]) {
  test(`injected native ${outcome} retains a truthful durable result`, () => fixture((f) => {
    const values = f.query("workspace.listTextProperties"), request = moveRequest(f);
    const result = f.service.moveProjectCategory(request);
    const uncertain = ["filesystem_error", "throw-before", "throw-after"].includes(outcome);
    assert.equal(result.value.outcome, uncertain ? "recoverable" : "rejected");
    assert.equal(result.value.operation.stage, uncertain ? "uncertain" : "failed");
    assert.equal(result.value.operation.lastVerifiedPlacement, "original");
    assertNoMetadataEffect(f, values);
    const path = outcome === "throw-after" ? destinationPath(f) : originalPath(f);
    assert.equal(fs.readFileSync(join(path, "sentinel"), "utf8"), "  Original bytes\n");
    f.restart();
    assert.deepEqual(f.service.moveProjectCategory(request), result);
    assert.deepEqual(f.query("workspace.getProjectCategoryMove", { operationId: request.operationId }), result);
    assert.equal(fs.readFileSync(join(path, "sentinel"), "utf8"), "  Original bytes\n");
  }, { native: (_f, from, to) => {
    if (outcome === "throw-after") assert.equal(renameNoReplace(from, to), "renamed");
    if (outcome.startsWith("throw-")) throw new Error("Injected unknown native outcome");
    return outcome;
  } }));
}

for (const stage of ["intent", "destination_recorded", "completed", "uncertain"]) {
  test(`injected ${stage} write failure preserves the last durable evidence`, () => fixture((f) => {
    const values = f.query("workspace.listTextProperties"), request = moveRequest(f);
    const event = stage === "intent" ? "INSERT" : "UPDATE";
    f.sql.exec(`CREATE TRIGGER fail_move_write BEFORE ${event} ON project_category_move_operations WHEN NEW.stage = '${stage}' BEGIN SELECT RAISE(ABORT, 'Injected write failure'); END`);
    const result = f.service.moveProjectCategory(request);
    if (stage === "intent") {
      assert.equal(result.value.outcome, "rejected"); assert.equal(result.value.problem, "storage_error");
      assert.equal(f.query("workspace.getProjectCategoryMove", { operationId: request.operationId }).error.code, "invalid_input");
    } else {
      assert.equal(result.value.outcome, "recoverable");
      assert.equal(result.value.operation.stage, stage === "uncertain" ? "intent" : "uncertain");
      assert.equal(result.value.operation.lastVerifiedPlacement, stage === "completed" ? "destination" : "original");
      f.restart();
      assert.deepEqual(f.service.moveProjectCategory(request), result);
      assert.deepEqual(f.query("workspace.listProjectCategoryMoves").value.operations, [result.value.operation]);
    }
    assertNoMetadataEffect(f, values);
    const path = stage === "intent" ? originalPath(f) : destinationPath(f);
    assert.equal(fs.readFileSync(join(path, "sentinel"), "utf8"), "  Original bytes\n");
  }, { native: (_f, from, to) => {
    assert.equal(renameNoReplace(from, to), "renamed");
    if (stage === "uncertain") throw new Error("Injected lost response");
    return "renamed";
  } }));
}

for (const name of [process.platform === "win32" ? "  Проект 📝" : "  Проект 📝  ", ...(process.platform === "win32" ? [] : ["CON", "colon:name", "back\\slash", "line\nbreak"])]) {
  test(`move retains exact supported basename ${JSON.stringify(name)}`, () => fixture((f) => {
    const original = nativeProjectFilesystem.inspect(originalPath(f)).identity;
    const result = f.service.moveProjectCategory(moveRequest(f));
    assert.equal(result.value.outcome, "completed"); assert.equal(result.value.project.name, name);
    assert.ok(fs.readdirSync(join(f.root, "Destination")).includes(name));
    assert.deepEqual(nativeProjectFilesystem.inspect(destinationPath(f)).identity, original);
    assert.equal(fs.readFileSync(join(destinationPath(f), "sentinel"), "utf8"), "  Original bytes\n");
  }, { defaultNative: true, name }));
}

for (const boundary of ["intent", "after-native", "destination_recorded", "completed"]) {
  for (const target of ["root", "original-parent", "destination-parent", "project", "permission"]) {
    test(`injected ${target} substitution at ${boundary} prevents fabricated completion`, () => fixture((f) => {
      const values = f.query("workspace.listTextProperties"), request = moveRequest(f);
      f.activeRequest = request;
      f.mutate = () => {
        f.mutate = null;
        if (target === "permission") { f.deny = true; return; }
        const path = target === "root" ? f.root : target === "original-parent" ? join(f.root, "Original category")
          : target === "destination-parent" ? join(f.root, "Destination") : boundary === "intent" ? originalPath(f) : destinationPath(f);
        fs.renameSync(path, join(f.directory, "away"));
        fs.mkdirSync(path); fs.writeFileSync(join(path, "replacement"), "Keep");
        f.replacementPath = path;
      };
      const result = f.service.moveProjectCategory(request);
      assert.equal(result.value.outcome, "recoverable", JSON.stringify(result));
      assert.equal(result.value.operation.stage, "uncertain");
      assert.equal(result.value.operation.lastVerifiedPlacement, boundary === "completed" ? "destination" : "original");
      f.deny = false;
      if (f.replacementPath) assert.equal(fs.readFileSync(join(f.replacementPath, "replacement"), "utf8"), "Keep");
      assertNoMetadataEffect(f, values);
      if (target !== "permission") {
        const suffix = target === "root" ? join(boundary === "intent" ? "Original category" : "Destination", f.project.name)
          : target === "project" ? "" : (target === "original-parent" && boundary !== "intent" || target === "destination-parent" && boundary === "intent") ? null : f.project.name;
        if (suffix !== null) assert.equal(fs.readFileSync(join(f.directory, "away", suffix, "sentinel"), "utf8"), "  Original bytes\n");
      } else assert.equal(fs.readFileSync(join(boundary === "intent" ? originalPath(f) : destinationPath(f), "sentinel"), "utf8"), "  Original bytes\n");
      f.restart();
      assert.deepEqual(f.service.moveProjectCategory(request), result);
      assert.deepEqual(f.query("workspace.getProjectCategoryMove", { operationId: request.operationId }), result);
    }, { native: (f, from, to) => {
      assert.equal(renameNoReplace(from, to), "renamed");
      if (boundary === "after-native") f.mutate?.();
      return "renamed";
    }, filesystem: (f) => ({ ...nativeProjectFilesystem, inspect(path) {
      if (f.mutate && boundary !== "after-native") {
        const stage = boundary === "intent" ? f.sql.prepare("SELECT stage FROM project_category_move_operations").get()?.stage
          : f.service.getProjectCategoryMove({ type: "workspace.getProjectCategoryMove", workspaceId: f.workspace.workspaceId,
            operationId: f.activeRequest.operationId }).value?.operation.stage;
        if (stage === boundary) f.mutate();
      }
      return nativeProjectFilesystem.inspect(path);
    }, assertAccessible(path) {
      if (f.deny) throw Object.assign(new Error("Injected permission loss"), { code: "EACCES" });
      nativeProjectFilesystem.assertAccessible(path);
    } }) }));
  }
}

test("physical move preserves unrelated sources, workspace selection/views, labels and independent revisions after reopen", () => fixture((f) => {
  const unrelatedRoot = join(f.directory, "unrelated"); fs.mkdirSync(unrelatedRoot); fs.mkdirSync(join(unrelatedRoot, "Other project"));
  const unrelated = f.service.workspaces.create({ type: "workspace.create", name: "Unrelated", rootPath: unrelatedRoot }).value;
  const preview = f.query("workspace.previewDiscovery", { workspaceId: unrelated.workspaceId, mode: "direct" }).value;
  f.command("workspace.applyDiscovery", { workspaceId: unrelated.workspaceId, previewToken: preview.previewToken });
  f.service.handleCommand({ type: "settings.setLanguage", language: "ru" });
  const categoryProperty = f.query("workspace.listProjects").value.categoryProperty;
  f.command("workspace.renameCategoryProperty", { propertyId: categoryProperty.propertyId, name: "Exact label 📝" });
  const load = f.service.handleQuery({ type: "workspace.load" }), settings = f.service.handleQuery({ type: "settings.load" });
  const other = f.query("workspace.listProjects", { workspaceId: unrelated.workspaceId });
  const values = f.query("workspace.listTextProperties"), list = f.query("workspace.listProjects").value;
  f.events.length = 0;
  const request = moveRequest(f), receipt = f.service.moveProjectCategory(request);
  assert.equal(receipt.value.outcome, "completed");
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(f.service.handleQuery({ type: "workspace.load" }), load);
    assert.deepEqual(f.service.handleQuery({ type: "settings.load" }), settings);
    assert.deepEqual(f.query("workspace.listProjects", { workspaceId: unrelated.workspaceId }), other);
    assert.deepEqual(f.query("workspace.listTextProperties"), values);
    const moved = f.query("workspace.listProjects").value;
    assert.deepEqual(moved.categories, list.categories);
    assert.deepEqual(moved.categoryProperty, list.categoryProperty);
    assert.equal(moved.categoryPropertyRevision, list.categoryPropertyRevision);
    assert.deepEqual(f.service.moveProjectCategory(request), receipt);
    f.restart();
  }
}, { defaultNative: true }));

for (const stage of ["destination_recorded", "completed"]) {
  for (const change of ["revision", "reservation"]) {
    test(`injected ${change} during ${stage} transaction invalidates completion and rolls back metadata`, () => fixture((f) => {
      const values = f.query("workspace.listTextProperties");
      const body = change === "revision" ? "UPDATE sources SET discovery_revision = discovery_revision + 1;" : `
        INSERT INTO project_rename_operations (operation_id, source_id, initiating_workspace_id, project_id, original_name, name,
          mode, expected_revision, category_id, canonical_root, parent_relative_path, original_relative_path, requested_relative_path,
          root_identity, parent_identity, native_identity, excluded_relative_paths, archive_relative_path,
          stage, last_verified_placement, last_verified_identity)
        SELECT '${randomUUID()}', s.id, '${f.workspace.workspaceId}', p.id, '${f.project.name}', '${f.project.name}',
          'grouped', s.discovery_revision, p.category_id, s.canonical_root, c.relative_path, p.relative_path, p.relative_path,
          s.applied_root_identity, c.native_identity, p.native_identity, s.excluded_relative_paths, s.archive_relative_path,
          'intent', 'original', p.native_identity
        FROM projects p JOIN sources s ON s.id = p.source_id JOIN categories c ON c.id = p.category_id WHERE p.id = '${f.project.projectId}';`;
      f.sql.exec(`CREATE TRIGGER inject_move_context AFTER UPDATE ON project_category_move_operations WHEN NEW.stage = '${stage}' BEGIN ${body} END`);
      const result = f.service.moveProjectCategory(moveRequest(f));
      assert.equal(result.value.outcome, "recoverable");
      assert.equal(result.value.operation.problem, change === "revision" ? "stale_configuration" : "reserved_destination");
      assert.equal(result.value.operation.lastVerifiedPlacement, stage === "completed" ? "destination" : "original");
      assertNoMetadataEffect(f, values);
      assert.equal(fs.readFileSync(join(destinationPath(f), "sentinel"), "utf8"), "  Original bytes\n");
      if (change === "reservation") assert.equal(f.query("workspace.listProjectRenames").value.operations.length, 0);
    }, { defaultNative: true }));
  }
}

test("a discovery revision without a safe successor rejects a physical move before mutation", () => fixture((f) => {
  f.sql.prepare("UPDATE sources SET discovery_revision = ? WHERE id = ?").run(Number.MAX_SAFE_INTEGER, f.workspace.sourceId);
  const result = f.service.moveProjectCategory(moveRequestWithRevision(f));
  assert.equal(result.value.outcome, "rejected"); assert.equal(result.value.operation, null);
  assert.equal(result.value.problem, "stale_configuration");
  assert.equal(fs.existsSync(destinationPath(f)), false);
  assert.equal(fs.readFileSync(join(originalPath(f), "sentinel"), "utf8"), "  Original bytes\n");
}, { defaultNative: true }));
function moveRequestWithRevision(f) { return f.request({ destinationCategoryId: f.destination.categoryId, expectedRevision: Number.MAX_SAFE_INTEGER }); }

test("a proven failed move releases reservations for a fresh move and retains its immutable historical receipt", () => fixture((f) => {
  const original = moveRequest(f), failed = f.service.moveProjectCategory(original);
  assert.equal(failed.value.outcome, "rejected"); assert.equal(failed.value.problem, "permission_denied");
  assert.equal(failed.value.operation.stage, "failed");
  const fresh = moveRequest(f), completed = f.service.moveProjectCategory(fresh);
  assert.equal(completed.value.outcome, "completed");
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(f.service.moveProjectCategory(original), failed);
    assert.deepEqual(f.query("workspace.getProjectCategoryMove", { operationId: original.operationId }), failed);
    assert.deepEqual(f.service.moveProjectCategory(fresh), completed);
    assert.deepEqual(f.query("workspace.listProjectCategoryMoves").value.operations, []);
    assert.equal(fs.readFileSync(join(destinationPath(f), "sentinel"), "utf8"), "  Original bytes\n");
    f.restart();
  }
}, { native: (f, from, to) => {
  if (!f.deniedOnce) { f.deniedOnce = true; return "permission_denied"; }
  return renameNoReplace(from, to);
} }));

function pendingMove(f) {
  f.pending = moveRequest(f);
  const result = f.service.moveProjectCategory(f.pending);
  assert.equal(result.value.outcome, "recoverable", JSON.stringify(result));
  return result;
}
function reviewMove(f, workspaceId = f.workspace.workspaceId) {
  const result = f.query("workspace.previewProjectCategoryMoveRecovery", { workspaceId, operationId: f.pending.operationId });
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.value;
}
function recoverMove(f, action, preview = reviewMove(f)) {
  return f.command("workspace.recoverProjectCategoryMove", { workspaceId: preview.workspaceId,
    operationId: f.pending.operationId, previewToken: preview.previewToken, action });
}
const interruptedOriginal = { native(f, from, to) {
  if (!f.interrupted) { f.interrupted = true; throw new Error("Injected unknown outcome before effect"); }
  return renameNoReplace(from, to);
} };

test("explicit retry_original requires a fresh review and preserves project identity and exact Text", () => fixture((f) => {
  const identity = nativeProjectFilesystem.inspect(originalPath(f)).identity, values = f.query("workspace.listTextProperties");
  pendingMove(f);
  const preview = reviewMove(f);
  assert.deepEqual(preview.actions, ["retry_original", "keep_original"]);
  assert.equal(preview.originalState, "matching"); assert.equal(preview.destinationState, "missing");
  const result = recoverMove(f, "retry_original", preview);
  assert.equal(result.value.outcome, "completed", JSON.stringify(result));
  assert.equal(result.value.project.categoryId, f.destination.categoryId);
  assert.equal(result.value.project.revision, f.initial.revision + 1);
  assert.deepEqual(nativeProjectFilesystem.inspect(destinationPath(f)).identity, identity);
  assert.deepEqual(f.query("workspace.listTextProperties"), values);
  assert.equal(fs.readFileSync(join(destinationPath(f), "sentinel"), "utf8"), "  Original bytes\n");
  assert.equal(recoverMove(f, "retry_original", preview).error.code, "stale_preview");
  f.restart();
  assert.deepEqual(f.service.moveProjectCategory(f.pending), result);
}, interruptedOriginal));

test("explicit keep_original resolves the journal without moving, revising or publishing", () => fixture((f) => {
  const before = f.query("workspace.listProjects"), values = f.query("workspace.listTextProperties");
  pendingMove(f); f.events.length = 0;
  const preview = reviewMove(f), result = recoverMove(f, "keep_original", preview);
  assert.equal(result.value.outcome, "rejected", JSON.stringify(result));
  assert.equal(result.value.problem, "kept_original");
  assert.equal(result.value.operation.stage, "failed");
  assert.deepEqual(f.query("workspace.listProjects"), before);
  assert.deepEqual(f.query("workspace.listTextProperties"), values);
  assert.equal(fs.existsSync(destinationPath(f)), false);
  assert.equal(fs.readFileSync(join(originalPath(f), "sentinel"), "utf8"), "  Original bytes\n");
  assert.equal(f.events.filter((e) => e.type === "workspace.projectsChanged").length, 0);
  assert.deepEqual(f.query("workspace.listProjectCategoryMoves").value.operations, []);
  assert.deepEqual(reviewMove(f).actions, []);
  assert.equal(recoverMove(f, "keep_original", preview).error.code, "stale_preview");
  f.restart(); assert.deepEqual(f.service.moveProjectCategory(f.pending), result);
}, interruptedOriginal));

const interruptedDestination = { native(f, from, to) {
  assert.equal(renameNoReplace(from, to), "renamed");
  throw new Error("Injected lost native result after effect");
} };
test("explicit complete_destination from a sibling completes an uncertain effect without another native move", () => fixture((f) => {
  const identity = nativeProjectFilesystem.inspect(originalPath(f)).identity, values = f.query("workspace.listTextProperties");
  pendingMove(f); f.restart(); f.events.length = 0;
  f.service.workspaces.subscribe((event) => f.events.push(event));
  const preview = reviewMove(f, f.sibling.workspaceId);
  assert.deepEqual(preview.actions, ["complete_destination"]);
  assert.equal(preview.originalState, "missing"); assert.equal(preview.destinationState, "matching");
  const result = recoverMove(f, "complete_destination", preview);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.value.outcome, "completed");
  assert.deepEqual(nativeProjectFilesystem.inspect(destinationPath(f)).identity, identity);
  assert.deepEqual(f.query("workspace.listTextProperties"), values);
  const events = f.events.filter((e) => e.type === "workspace.projectsChanged");
  assert.equal(events.length, 1);
  assert.deepEqual(new Set(events[0].workspaceIds), new Set([f.workspace.workspaceId, f.sibling.workspaceId]));
  assert.deepEqual(f.service.moveProjectCategory(f.pending), result);
  assert.equal(f.service.moveProjectCategory({ ...f.pending, workspaceId: f.sibling.workspaceId }).ok, false);
  assert.deepEqual(reviewMove(f).actions, []);
}, interruptedDestination));

for (const location of ["original", "destination"]) {
  for (const state of ["missing", "replaced", "link", "unavailable", "conflicting"]) {
    test(`${location} ${state} recovery evidence offers no action and preserves bytes`, () => fixture((f) => {
      pendingMove(f);
      const path = location === "original" ? originalPath(f) : destinationPath(f);
      const saved = join(f.directory, "saved-project");
      if (state === "missing" || state === "replaced" || state === "link") fs.renameSync(path, saved);
      if (state === "replaced") { fs.mkdirSync(path); fs.writeFileSync(join(path, "replacement"), "Keep"); }
      if (state === "link") fs.symlinkSync(saved, path, "junction");
      if (state === "unavailable") f.denied = path;
      if (state === "conflicting") f.conflict = true;
      const preview = reviewMove(f);
      assert.deepEqual(preview.actions, []); assert.equal(preview.previewToken, null);
      assert.ok(preview.problem);
      if (state === "conflicting") assert.equal(preview.problem, "native_conflict");
      f.denied = null; f.conflict = false;
      assert.equal(fs.readFileSync(join(fs.existsSync(saved) ? saved : path, "sentinel"), "utf8"), "  Original bytes\n");
      if (state === "replaced") assert.equal(fs.readFileSync(join(path, "replacement"), "utf8"), "Keep");
      assert.equal(f.query("workspace.getProjectCategoryMove", { operationId: f.pending.operationId }).value.outcome, "recoverable");
    }, { ...(location === "original" ? interruptedOriginal : interruptedDestination), filesystem: (f) => ({
      ...nativeProjectFilesystem,
      inspect(path) {
        // Inject a second identity match; real duplicate placement is not claimed.
        if (f.conflict && path === (location === "original" ? destinationPath(f) : originalPath(f))) {
          return nativeProjectFilesystem.inspect(location === "original" ? originalPath(f) : destinationPath(f));
        }
        return nativeProjectFilesystem.inspect(path);
      },
      realpath(path) {
        if (f.conflict && path === (location === "original" ? destinationPath(f) : originalPath(f))) return path;
        return nativeProjectFilesystem.realpath(path);
      },
      names(path) {
        const names = nativeProjectFilesystem.names(path);
        if (f.conflict && path === join(f.root, location === "original" ? "Destination" : "Original category")) return [...names, f.project.name];
        return names;
      },
      assertAccessible(path) {
        if (f.conflict && path === (location === "original" ? destinationPath(f) : originalPath(f))) return;
        if (f.denied === path) throw Object.assign(new Error("Injected accessibility loss"), { code: "EACCES" });
        nativeProjectFilesystem.assertAccessible(path);
      },
    }) }));
  }
}

for (const change of ["preview", "restart", "revision", "configuration", "operation", "root_names", "original_names", "destination_names", "placement", "workspace", "refresh", "reservation"]) {
  test(`${change} invalidates a recovery review before any native effect`, () => fixture((f) => {
    pendingMove(f); const preview = reviewMove(f), identity = nativeProjectFilesystem.inspect(originalPath(f)).identity;
    if (change === "preview") reviewMove(f);
    if (change === "restart") f.restart();
    if (change === "revision") f.sql.exec("UPDATE sources SET discovery_revision = discovery_revision + 1");
    if (change === "configuration") f.sql.exec("UPDATE sources SET excluded_relative_paths = '[\"Destination\"]'");
    if (change === "operation") f.sql.exec("UPDATE project_category_move_operations SET problem = 'busy'");
    if (change === "root_names") fs.mkdirSync(join(f.root, "New category"));
    if (change === "original_names") fs.mkdirSync(join(f.root, "Original category", "Another"));
    if (change === "destination_names") fs.mkdirSync(join(f.root, "Destination", "Another"));
    if (change === "placement") fs.renameSync(originalPath(f), join(f.directory, "saved"));
    if (change === "workspace") f.command("workspace.remove");
    if (change === "refresh") {
      fs.renameSync(originalPath(f), join(f.directory, "saved"));
      f.command("workspace.refreshSource");
      fs.renameSync(join(f.directory, "saved"), originalPath(f));
    }
    if (change === "reservation") f.sql.exec(`
      INSERT INTO project_rename_operations (operation_id, source_id, initiating_workspace_id, project_id, original_name, name,
        mode, expected_revision, category_id, canonical_root, parent_relative_path, original_relative_path, requested_relative_path,
        root_identity, parent_identity, native_identity, excluded_relative_paths, archive_relative_path,
        stage, last_verified_placement, last_verified_identity)
      SELECT '${randomUUID()}', s.id, '${f.workspace.workspaceId}', p.id, '${f.project.name}', 'Other',
        'grouped', s.discovery_revision, p.category_id, s.canonical_root, c.relative_path, p.relative_path, c.relative_path || '/Other',
        s.applied_root_identity, c.native_identity, p.native_identity, s.excluded_relative_paths, s.archive_relative_path,
        'intent', 'original', p.native_identity FROM projects p JOIN sources s ON p.source_id = s.id
        JOIN categories c ON p.category_id = c.id WHERE p.id = '${f.project.projectId}';`);
    const result = recoverMove(f, "retry_original", preview);
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.ok(["stale_preview", "invalid_input"].includes(result.error.code));
    assert.equal(fs.existsSync(destinationPath(f)), false);
    assert.deepEqual(nativeProjectFilesystem.inspect(change === "placement" ? join(f.directory, "saved") : originalPath(f)).identity, identity);
  }, interruptedOriginal));
}

for (const parent of ["root", "original", "destination"]) {
  test(`${parent} parent substitution makes recovery unavailable without traversing replacement`, () => fixture((f) => {
    pendingMove(f); const preview = reviewMove(f);
    const path = parent === "root" ? f.root : join(f.root, parent === "original" ? "Original category" : "Destination");
    const saved = join(f.directory, "saved-parent"); fs.renameSync(path, saved);
    fs.mkdirSync(path); fs.writeFileSync(join(path, "replacement"), "Keep");
    assert.equal(recoverMove(f, "retry_original", preview).error.code, "stale_preview");
    const unavailable = reviewMove(f); assert.deepEqual(unavailable.actions, []); assert.equal(unavailable.previewToken, null);
    assert.equal(fs.readFileSync(join(path, "replacement"), "utf8"), "Keep");
    assert.equal(fs.readFileSync(join(parent === "root" ? join(saved, "Original category") : parent === "original" ? saved : join(f.root, "Original category"), f.project.name, "sentinel"), "utf8"), "  Original bytes\n");
  }, interruptedOriginal));
}

test("exact recovery requests and service-owned previews reject foreign or unadvertised authority", () => fixture((f) => {
  pendingMove(f); const preview = reviewMove(f);
  const request = { type: "workspace.recoverProjectCategoryMove", workspaceId: f.workspace.workspaceId,
    operationId: f.pending.operationId, previewToken: preview.previewToken, action: "retry_original" };
  for (const input of [null, [], {}, { ...request, previewToken: "bad" }, { ...request, operationId: "bad" },
    { ...request, action: "overwrite" }, { ...request, path: f.root }, { ...request, nativeIdentity: "caller" }]) {
    assert.equal(f.service.recoverProjectCategoryMove(input).error.code, "invalid_input");
  }
  for (const changed of [{ workspaceId: f.sibling.workspaceId }, { operationId: randomUUID() }, { previewToken: randomUUID() }, { action: "complete_destination" }]) {
    assert.equal(f.service.recoverProjectCategoryMove({ ...request, ...changed }).error.code, "stale_preview");
  }
  preview.actions.push("complete_destination"); preview.originalState = "missing"; preview.operation.stage = "completed";
  assert.equal(f.service.recoverProjectCategoryMove({ ...request, action: "complete_destination" }).error.code, "stale_preview");
  const otherRoot = join(f.directory, "foreign"); fs.mkdirSync(otherRoot);
  const foreign = f.service.workspaces.create({ type: "workspace.create", name: "Foreign", rootPath: otherRoot }).value;
  for (const method of ["getProjectCategoryMove", "previewProjectCategoryMoveRecovery"]) {
    const query = { type: `workspace.${method}`, workspaceId: foreign.workspaceId, operationId: f.pending.operationId };
    assert.equal(f.service[method](query).error.code, "invalid_input");
    assert.equal(f.service[method]({ ...query, workspaceId: f.workspace.workspaceId, path: f.root }).error.code, "invalid_input");
  }
  assert.equal(f.service.recoverProjectCategoryMove(request).value.outcome, "completed");
  assert.equal(f.service.recoverProjectCategoryMove(request).error.code, "stale_preview");
}, interruptedOriginal));

test("Text changes keep a fresh recovery review and independent source revisions", () => fixture((f) => {
  pendingMove(f); const preview = reviewMove(f);
  f.command("workspace.setTextValue", { projectId: f.project.projectId, propertyId: f.propertyId, value: "  Changed independently\n" });
  const values = f.query("workspace.listTextProperties");
  const result = recoverMove(f, "retry_original", preview); assert.equal(result.value.outcome, "completed");
  assert.equal(result.value.project.revision, preview.revision + 1);
  assert.deepEqual(f.query("workspace.listTextProperties"), values);
}, interruptedOriginal));

test("fresh recovery uses current revision while original operation bindings remain immutable", () => fixture((f) => {
  pendingMove(f); const old = reviewMove(f);
  f.sql.exec("UPDATE sources SET discovery_revision = discovery_revision + 1");
  assert.equal(recoverMove(f, "retry_original", old).error.code, "stale_preview");
  const preview = reviewMove(f); assert.equal(preview.revision, f.initial.revision + 1);
  const result = recoverMove(f, "retry_original", preview);
  assert.equal(result.value.outcome, "completed"); assert.equal(result.value.project.revision, f.initial.revision + 2);
  assert.deepEqual(f.service.moveProjectCategory(f.pending), result);
  assert.equal(f.service.moveProjectCategory({ ...f.pending, expectedRevision: preview.revision }).ok, false);
}, interruptedOriginal));

for (const location of ["original", "destination"]) {
  test(`${location}: exhausted revision never advertises a completion requiring an unsafe successor`, () => fixture((f) => {
    pendingMove(f); f.sql.exec(`UPDATE sources SET discovery_revision = ${Number.MAX_SAFE_INTEGER}`);
    const preview = reviewMove(f);
    assert.deepEqual(preview.actions, location === "original" ? ["keep_original"] : []);
    assert.equal(preview.problem, "stale_configuration");
    if (location === "original") assert.equal(recoverMove(f, "keep_original", preview).value.problem, "kept_original");
    else assert.equal(preview.previewToken, null);
  }, location === "original" ? interruptedOriginal : interruptedDestination));
}

for (const failure of ["before_native", "after_native", "evidence", "completion", "uncertainty_write", "keep_receipt"]) {
  test(`injected recovery failure at ${failure} retains durable evidence and permits a fresh explicit review`, () => fixture((f) => {
    pendingMove(f); const preview = reviewMove(f), values = f.query("workspace.listTextProperties");
    if (["evidence", "uncertainty_write", "keep_receipt"].includes(failure)) f.sql.exec(`
      CREATE TRIGGER fail_recovery BEFORE UPDATE ON project_category_move_operations
      WHEN NEW.stage = '${failure === "keep_receipt" ? "failed" : "destination_recorded"}' BEGIN SELECT RAISE(ABORT, 'Injected evidence failure'); END;`);
    if (failure === "completion") f.sql.exec("CREATE TRIGGER fail_recovery BEFORE UPDATE ON projects BEGIN SELECT RAISE(ABORT, 'Injected completion failure'); END;");
    if (failure === "uncertainty_write") f.sql.exec("CREATE TRIGGER fail_uncertainty BEFORE UPDATE ON project_category_move_operations WHEN NEW.stage = 'uncertain' BEGIN SELECT RAISE(ABORT, 'Injected uncertainty failure'); END;");
    f.recoveryFailure = failure;
    const result = recoverMove(f, failure === "keep_receipt" ? "keep_original" : "retry_original", preview);
    assert.equal(result.value.outcome, "recoverable", JSON.stringify(result));
    assert.equal(result.value.operation.lastVerifiedPlacement, failure === "completion" ? "destination" : "original");
    assert.deepEqual(f.query("workspace.listTextProperties"), values);
    assertNoMetadataEffect(f, values);
    const path = ["before_native", "keep_receipt"].includes(failure) ? originalPath(f) : destinationPath(f);
    assert.equal(fs.readFileSync(join(path, "sentinel"), "utf8"), "  Original bytes\n");
    if (failure === "uncertainty_write") assert.equal(result.value.operation.problem, "filesystem_error", "failed uncertainty write retains the earlier problem");
    assert.equal(recoverMove(f, "retry_original", preview).error.code, "stale_preview");
    f.sql.exec("DROP TRIGGER IF EXISTS fail_recovery; DROP TRIGGER IF EXISTS fail_uncertainty;");
    f.recoveryFailure = null; f.restart();
    const fresh = reviewMove(f);
    const action = path === originalPath(f) ? "retry_original" : "complete_destination";
    assert.ok(fresh.actions.includes(action), JSON.stringify(fresh));
    assert.equal(recoverMove(f, action, fresh).value.outcome, "completed");
  }, { native(f, from, to) {
    if (!f.interrupted) { f.interrupted = true; throw new Error("Injected unknown original outcome"); }
    if (f.recoveryFailure === "before_native") throw new Error("Injected unknown recovery outcome");
    const outcome = renameNoReplace(from, to);
    if (f.recoveryFailure === "after_native") throw new Error("Injected lost recovery response");
    return outcome;
  } }));
}

for (const action of ["retry_original", "keep_original"]) {
  test(`destination evidence survives a verified external return followed by ${action}`, () => fixture((f) => {
    f.sql.exec("CREATE TRIGGER fail_completion BEFORE UPDATE ON projects BEGIN SELECT RAISE(ABORT, 'Injected completion failure'); END; CREATE TRIGGER fail_uncertainty BEFORE UPDATE ON project_category_move_operations WHEN NEW.stage = 'uncertain' BEGIN SELECT RAISE(ABORT, 'Injected uncertainty failure'); END;");
    f.pending = moveRequest(f); const pending = f.service.moveProjectCategory(f.pending);
    assert.equal(pending.value.operation.stage, "destination_recorded");
    fs.renameSync(destinationPath(f), originalPath(f));
    f.sql.exec("DROP TRIGGER fail_completion; DROP TRIGGER fail_uncertainty;");
    const preview = reviewMove(f); assert.deepEqual(preview.actions, ["retry_original", "keep_original"]);
    const result = recoverMove(f, action, preview);
    assert.equal(result.value.outcome, action === "retry_original" ? "completed" : "rejected", JSON.stringify(result));
    assert.equal(result.value.operation.lastVerifiedPlacement, action === "retry_original" ? "destination" : "original");
    f.restart(); assert.deepEqual(f.service.moveProjectCategory(f.pending), result);
    const row = f.sql.prepare("SELECT * FROM project_category_move_operations WHERE operation_id = ?").get(f.pending.operationId);
    assert.equal(row.destination_identity, row.native_identity, "prior destination evidence is immutable even when kept at original");
  }, { defaultNative: true }));
}

for (const stage of ["destination_recorded", "completed", "failed"]) {
  test(`transaction-local revision change during recovery ${stage} rolls back metadata and receipt`, () => fixture((f) => {
    pendingMove(f); const preview = reviewMove(f), values = f.query("workspace.listTextProperties");
    f.sql.exec(`CREATE TRIGGER change_during_recovery AFTER UPDATE ON project_category_move_operations
      WHEN NEW.stage = '${stage}' BEGIN UPDATE sources SET discovery_revision = discovery_revision + 1; END;`);
    const result = recoverMove(f, stage === "failed" ? "keep_original" : "retry_original", preview);
    assert.equal(result.value.outcome, "recoverable", JSON.stringify(result));
    assertNoMetadataEffect(f, values);
    assert.equal(f.query("workspace.listProjects").value.revision, f.initial.revision);
    f.sql.exec("DROP TRIGGER change_during_recovery;");
    const fresh = reviewMove(f);
    assert.equal(recoverMove(f, stage === "failed" ? "keep_original" : "complete_destination", fresh).value.outcome, stage === "failed" ? "rejected" : "completed");
  }, interruptedOriginal));
}
