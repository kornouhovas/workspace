import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { nativeObserverDependencies } from "../src/service/source-observer.ts";
import { openSettingsService } from "../dist/service/settings.mjs";

const identity = (path) => {
  const stat = fs.lstatSync(path, { bigint: true });
  return JSON.stringify({ dev: String(stat.dev), ino: String(stat.ino), birthtimeNs: String(stat.birthtimeNs) });
};
async function fixture(mode, run) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "rename-coordination-")));
  const root = join(directory, "root"), databasePath = join(directory, "workspace.sqlite");
  const parent = mode === "grouped" ? "Category" : "", relative = (name) => parent ? `${parent}/${name}` : name;
  for (const name of ["Original", "Other", "Missing"]) fs.mkdirSync(join(root, relative(name)), { recursive: true });
  fs.writeFileSync(join(root, relative("Original"), "sentinel"), "  Exact bytes 📝\n");
  const watches = [], timers = new Set();
  const dependencies = { ...nativeObserverDependencies,
    watch(path, hint) { const handle = { path, hint, closed: false }; watches.push(handle); return { close() { handle.closed = true; } }; },
    schedule(callback, delay) { const timer = { callback, delay }; timers.add(timer); return { cancel() { timers.delete(timer); } }; },
  };
  function flushHints() {
    let count = 0;
    while ([...timers].some((timer) => timer.delay <= 100)) {
      assert.ok(++count < 100, "bounded observer queue");
      const timer = [...timers].find((timer) => timer.delay <= 100); timers.delete(timer); timer.callback();
    }
  }
  let service = openSettingsService(databasePath, undefined, undefined, dependencies);
  const sql = new Database(databasePath);
  const workspace = service.workspaces.create({ type: "workspace.create", name: "Primary", rootPath: root }).value;
  const sibling = service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root }).value;
  const query = (type, extra = {}) => service.handleQuery({ type, workspaceId: workspace.workspaceId, ...extra });
  const command = (type, extra = {}) => service.handleCommand({ type, workspaceId: workspace.workspaceId, ...extra });
  const apply = () => command("workspace.applyDiscovery", { previewToken: query("workspace.previewDiscovery", { mode }).value.previewToken });
  const initial = apply().value, project = initial.projects.find((p) => p.name === "Original");
  const missing = initial.projects.find((p) => p.name === "Missing");
  const other = initial.projects.find((p) => p.name === "Other");
  const propertyId = command("workspace.createProperty", { name: "Notes", propertyType: "text" }).value.propertyId;
  command("workspace.setTextValue", { projectId: project.projectId, propertyId, value: "  Текст\n  " });
  function seed(extra = {}, insert = true) {
    const source = sql.prepare("SELECT * FROM sources WHERE id = ?").get(workspace.sourceId);
    const p = sql.prepare("SELECT * FROM projects WHERE id = ?").get(project.projectId);
    const row = { operation_id: randomUUID(), source_id: source.id, initiating_workspace_id: workspace.workspaceId, project_id: p.id,
      original_name: p.relative_path.split("/").at(-1), name: "Requested", mode, expected_revision: source.discovery_revision,
      category_id: p.category_id, canonical_root: root, parent_relative_path: parent, original_relative_path: p.relative_path,
      requested_relative_path: relative("Requested"), staging_relative_path: relative(".rename-stage"), root_identity: source.applied_root_identity,
      parent_identity: identity(join(root, parent)), native_identity: p.native_identity, excluded_relative_paths: source.excluded_relative_paths,
      archive_relative_path: source.archive_relative_path, stage: "intent", last_verified_placement: "original", last_verified_identity: p.native_identity, ...extra };
    if (insert) sql.prepare(`INSERT INTO project_rename_operations (${Object.keys(row).join(",")}) VALUES (${Object.keys(row).map(() => "?").join(",")})`).run(...Object.values(row));
    return row;
  }
  const snapshot = () => Object.fromEntries(["sources", "projects", "categories", "category_properties", "property_definitions", "text_property_values", "views", "settings"]
    .map((table) => [table, sql.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()]));
  const f = { directory, root, sql, workspace, sibling, initial, project, missing, other, propertyId, query, command, apply, seed, snapshot, relative,
    watches, flushHints, get service() { return service; }, restart() { service.close(); service = openSettingsService(databasePath, undefined, undefined, dependencies); } };
  try { await run(f); } finally { service.close(); sql.close(); fs.rmSync(directory, { recursive: true, force: true }); }
}

for (const mode of ["direct", "grouped"]) for (const placement of ["original", "staged", "destination"]) {
  test(`${mode}: startup and Refresh preserve unfinished ${placement} placement without enrollment or metadata changes`, () => fixture(mode, async (f) => {
    const row = f.seed();
    if (placement !== "original") {
      const target = placement === "staged" ? row.staging_relative_path : row.requested_relative_path;
      fs.renameSync(join(f.root, row.original_relative_path), join(f.root, target));
      const column = placement === "staged" ? "staged_identity" : "destination_identity";
      f.sql.prepare(`UPDATE project_rename_operations SET stage = ?, ${column} = native_identity, last_verified_placement = ? WHERE operation_id = ?`)
        .run(placement === "staged" ? "staged" : "destination_recorded", placement, row.operation_id);
    }
    fs.renameSync(join(f.root, f.relative("Missing")), join(f.directory, "away"));
    const before = f.snapshot();
    f.restart();
    assert.deepEqual(f.snapshot(), before, "startup must not rewrite the pending project's locator");
    assert.equal(f.command("workspace.refreshSource").ok, true);
    const preview = f.query("workspace.previewDiscovery").value;
    const actual = placement === "original" ? row.original_relative_path : placement === "staged" ? row.staging_relative_path : row.requested_relative_path;
    assert.notEqual(preview.entries.find((entry) => entry.relativePath === actual)?.reason, null);
    const recovery = f.query("workspace.previewProjectRecovery", { projectId: f.missing.projectId }).value;
    assert.notEqual(recovery.entries.find((entry) => entry.relativePath === actual)?.status, "selectable");
    assert.equal(f.command("workspace.reassociateProject", { projectId: f.missing.projectId, relativePath: actual, previewToken: recovery.previewToken }).error.code, "stale_preview");
    const applied = f.command("workspace.applyDiscovery", { previewToken: preview.previewToken });
    assert.equal(applied.ok, false);
    assert.equal(applied.error.code, "stale_preview");
    assert.deepEqual(f.snapshot(), before);
    const create = f.command("workspace.createProject", { operationId: randomUUID(), name: "Fresh", mode,
      expectedRevision: f.initial.revision, ...(mode === "grouped" ? { categoryId: f.project.categoryId } : {}) });
    assert.equal(create.value.outcome, "rejected");
    assert.equal(fs.existsSync(join(f.root, f.relative("Fresh"))), false);
    const reveal = await f.service.revealProject({ type: "workspace.revealProject", workspaceId: f.workspace.workspaceId, projectId: f.project.projectId }, () => assert.fail("pending project dispatched"));
    assert.equal(reveal.value.outcome, "rejected");
    assert.equal((await f.service.revealProject({ type: "workspace.revealProject", workspaceId: f.workspace.workspaceId, projectId: f.other.projectId }, async () => ({ outcome: "dispatched" }))).value.outcome, "dispatched");
    assert.equal(fs.readFileSync(join(f.root, actual, "sentinel"), "utf8"), "  Exact bytes 📝\n");
    assert.equal(f.command("workspace.setTextValue", { projectId: f.project.projectId, propertyId: f.propertyId, value: " Edited \n" }).ok, true);
    assert.equal(f.query("workspace.listTextProperties", { workspaceId: f.sibling.workspaceId }).value.values[0].value, " Edited \n");
    assert.equal(f.sql.prepare("SELECT discovery_revision FROM sources WHERE id = ?").get(f.workspace.sourceId).discovery_revision, f.initial.revision);
  }));
}

test("preexisting discovery/reassociation reviews cannot cross new rename intent", () => fixture("direct", (f) => {
  fs.renameSync(join(f.root, "Missing"), join(f.directory, "away")); fs.mkdirSync(join(f.root, "Candidate"));
  const discovery = f.query("workspace.previewDiscovery").value;
  const recovery = f.query("workspace.previewProjectRecovery", { projectId: f.missing.projectId }).value;
  const row = f.seed();
  const before = f.snapshot();
  assert.equal(f.command("workspace.applyDiscovery", { previewToken: discovery.previewToken }).error.code, "stale_preview");
  assert.equal(f.command("workspace.reassociateProject", { projectId: f.missing.projectId, relativePath: "Candidate", previewToken: recovery.previewToken }).error.code, "stale_preview");
  const fresh = f.query("workspace.previewProjectRecovery", { projectId: f.missing.projectId }).value;
  assert.equal(f.command("workspace.reassociateProject", { projectId: f.missing.projectId, relativePath: "Candidate", previewToken: fresh.previewToken }).ok, false);
  assert.deepEqual(f.snapshot(), before);
  f.sql.prepare("UPDATE project_rename_operations SET stage = 'failed', problem = 'kept_original', result_kind = 'rejected' WHERE operation_id = ?").run(row.operation_id);
  assert.equal(f.command("workspace.applyDiscovery", { previewToken: discovery.previewToken }).error.code, "stale_preview", "the original review also bound the rename history");
  assert.equal(f.apply().ok, true);
}));

test("a pending Reveal authorization is rejected when rename intent appears", () => fixture("direct", async (f) => {
  let validation;
  const result = await f.service.revealProject({ type: "workspace.revealProject", workspaceId: f.workspace.workspaceId, projectId: f.project.projectId }, async (_target, revalidate) => {
    f.seed(); validation = revalidate(); return { outcome: "dispatched" };
  });
  assert.equal(validation.outcome, "rejected"); assert.equal(result.value.outcome, "rejected");
}));

for (const mode of ["direct", "grouped"]) test(`${mode}: source reuse, queued watchers and reentrant sibling listeners preserve pending rename`, () => fixture(mode, (f) => {
  const row = f.seed();
  const events = [];
  let refreshed = false;
  f.service.workspaces.subscribe((event) => {
    events.push(event);
    if (event.type === "workspace.sourceObserved" && !refreshed) {
      refreshed = true; assert.equal(f.command("workspace.refreshSource", { workspaceId: f.sibling.workspaceId }).ok, true);
    }
  });
  fs.renameSync(join(f.root, row.original_relative_path), join(f.root, row.requested_relative_path));
  const before = f.snapshot();
  const watcher = f.watches.find((watch) => !watch.closed && watch.path === f.root);
  assert.ok(watcher); watcher.hint();
  assert.equal(f.command("workspace.refreshSource").ok, true);
  f.flushHints();
  assert.deepEqual(f.snapshot(), before);
  assert.equal(refreshed, true);
  const observed = events.filter((event) => event.type === "workspace.sourceObserved");
  assert.ok(observed.length > 0);
  assert.ok(observed.every((event) => event.workspaceIds.includes(f.workspace.workspaceId) && event.workspaceIds.includes(f.sibling.workspaceId)));
  assert.ok(!events.some((event) => event.type === "workspace.projectsChanged"));
  for (const workspaceId of [f.workspace.workspaceId, f.sibling.workspaceId]) assert.equal(f.service.workspaces.remove({ type: "workspace.remove", workspaceId }).ok, true);
  assert.ok(f.watches.every((watch) => watch.closed));
  watcher.hint(); f.flushHints();
  assert.equal(f.sql.prepare("SELECT stage FROM project_rename_operations").get().stage, "intent");
  const reused = f.service.workspaces.create({ type: "workspace.create", name: "Reused", rootPath: f.root }).value;
  assert.equal(reused.sourceId, f.workspace.sourceId);
  assert.deepEqual(f.sql.prepare("SELECT * FROM projects ORDER BY 1").all(), before.projects);
  const preview = f.query("workspace.previewDiscovery", { workspaceId: reused.workspaceId }).value;
  assert.equal(f.command("workspace.applyDiscovery", { workspaceId: reused.workspaceId, previewToken: preview.previewToken }).error.code, "stale_preview");
}));

for (const mode of ["direct", "grouped"]) test(`${mode}: blocked creation recovery preserves receipts and unrelated sources remain writable`, () => fixture(mode, (f) => {
  const source = f.sql.prepare("SELECT * FROM sources WHERE id = ?").get(f.workspace.sourceId);
  const operationId = randomUUID();
  f.sql.prepare(`INSERT INTO project_creation_operations (operation_id, source_id, initiating_workspace_id, project_id, name,
    mode, expected_revision, category_id, canonical_root, parent_relative_path, relative_path, root_identity, parent_identity, excluded_relative_paths, stage)
    VALUES (?, ?, ?, ?, 'Pending creation', ?, ?, ?, ?, ?, ?, ?, ?, '[]', 'intent')`)
    .run(operationId, source.id, f.workspace.workspaceId, randomUUID(), mode, source.discovery_revision, f.project.categoryId,
      f.root, mode === "grouped" ? "Category" : "", f.relative("Pending creation"), source.applied_root_identity,
      identity(mode === "grouped" ? join(f.root, "Category") : f.root));
  const review = f.query("workspace.previewProjectCreationRecovery", { operationId }).value;
  assert.ok(review.actions.includes("retry_missing"));
  f.seed();
  const before = f.sql.prepare("SELECT * FROM project_creation_operations").all();
  const response = f.command("workspace.recoverProjectCreation", { operationId, previewToken: review.previewToken, action: "retry_missing" });
  assert.equal(response.error.code, "stale_preview");
  const blocked = f.query("workspace.previewProjectCreationRecovery", { operationId }).value;
  assert.deepEqual(blocked.actions, []); assert.equal(blocked.problem, "reserved_destination");
  assert.deepEqual(f.sql.prepare("SELECT * FROM project_creation_operations").all(), before);
  assert.equal(fs.existsSync(join(f.root, f.relative("Pending creation"))), false);
  const root = join(f.directory, "unrelated"); fs.mkdirSync(root);
  const workspaceId = f.service.workspaces.create({ type: "workspace.create", name: "Unrelated", rootPath: root }).value.workspaceId;
  const preview = f.query("workspace.previewDiscovery", { workspaceId, mode: "direct" }).value;
  const applied = f.command("workspace.applyDiscovery", { workspaceId, previewToken: preview.previewToken }).value;
  const events = []; f.service.workspaces.subscribe((event) => events.push(event));
  const created = f.command("workspace.createProject", { workspaceId, operationId: randomUUID(), mode: "direct", expectedRevision: applied.revision, name: "Fresh" }).value;
  assert.equal(created.outcome, "completed");
  assert.deepEqual(events.filter((event) => event.type === "workspace.projectsChanged").map((event) => event.workspaceIds), [[workspaceId]]);
}));

for (const terminal of ["failed", "completed", "unchanged"]) test(`${terminal} rename receipts release vacated operation placements`, () => fixture("direct", (f) => {
  const row = f.seed(terminal === "unchanged" ? { name: "Original", requested_relative_path: "Original", staging_relative_path: null } : {});
  if (terminal === "failed") {
    f.sql.prepare("UPDATE project_rename_operations SET stage = 'failed', problem = 'kept_original', result_kind = 'rejected' WHERE operation_id = ?").run(row.operation_id);
  } else if (terminal === "unchanged") {
    f.sql.prepare("UPDATE project_rename_operations SET stage = 'completed', result_kind = 'unchanged', completed_revision = expected_revision WHERE operation_id = ?").run(row.operation_id);
    fs.renameSync(join(f.root, "Original"), join(f.root, "Later"));
    assert.equal(f.command("workspace.refreshSource").ok, true);
  } else {
    fs.renameSync(join(f.root, "Original"), join(f.root, "Requested"));
    f.sql.prepare("UPDATE project_rename_operations SET stage = 'destination_recorded', destination_identity = native_identity, last_verified_placement = 'destination' WHERE operation_id = ?").run(row.operation_id);
    f.sql.transaction(() => {
      f.sql.prepare("UPDATE projects SET relative_path = 'Requested' WHERE id = ?").run(f.project.projectId);
      f.sql.prepare("UPDATE sources SET discovery_revision = discovery_revision + 1 WHERE id = ?").run(f.workspace.sourceId);
      f.sql.prepare("UPDATE project_rename_operations SET stage = 'completed', result_kind = 'completed', completed_revision = expected_revision + 1 WHERE operation_id = ?").run(row.operation_id);
    })();
    fs.mkdirSync(join(f.root, "Original"));
  }
  const name = terminal === "failed" ? "Requested" : "Original";
  if (!fs.existsSync(join(f.root, name))) fs.mkdirSync(join(f.root, name));
  const applied = f.apply(); assert.equal(applied.ok, true);
  const enrolled = applied.value.projects.find((project) => project.name === name);
  assert.ok(enrolled); assert.notEqual(enrolled.projectId, f.project.projectId);
  assert.equal(f.sql.prepare("SELECT stage FROM project_rename_operations").get().stage, terminal === "failed" ? "failed" : "completed");
}));

for (const mutation of ["discovery", "reassociation"]) test(`${mutation} rolls back a rename reservation introduced inside its metadata transaction`, () => fixture("direct", (f) => {
  fs.mkdirSync(join(f.root, "Candidate"));
  if (mutation === "reassociation") fs.renameSync(join(f.root, "Missing"), join(f.directory, "away"));
  const preview = mutation === "discovery" ? f.query("workspace.previewDiscovery").value : f.query("workspace.previewProjectRecovery", { projectId: f.missing.projectId }).value;
  const row = f.seed({ expected_revision: f.initial.revision + 1 }, false);
  const literal = (value) => value === null ? "NULL" : typeof value === "number" ? String(value) : `'${value.replaceAll("'", "''")}'`;
  f.sql.exec(`CREATE TRIGGER inject_rename AFTER UPDATE OF discovery_revision ON sources WHEN NEW.id = '${f.workspace.sourceId}' BEGIN
    INSERT INTO project_rename_operations (${Object.keys(row).join(",")}) VALUES (${Object.values(row).map(literal).join(",")}); END`);
  const before = f.snapshot();
  const result = mutation === "discovery" ? f.command("workspace.applyDiscovery", { previewToken: preview.previewToken }) :
    f.command("workspace.reassociateProject", { projectId: f.missing.projectId, relativePath: "Candidate", previewToken: preview.previewToken });
  assert.equal(result.error.code, "stale_preview");
  assert.deepEqual(f.snapshot(), before); assert.equal(f.sql.prepare("SELECT count(*) AS n FROM project_rename_operations").get().n, 0);
}));

for (const mode of ["direct", "grouped"]) test(`${mode}: immutable completed creation retries remain readable during unfinished rename`, () => fixture(mode, (f) => {
  const request = { operationId: randomUUID(), name: "Created", mode, expectedRevision: f.initial.revision,
    ...(mode === "grouped" ? { categoryId: f.project.categoryId } : {}) };
  const completed = f.command("workspace.createProject", request);
  assert.equal(completed.value.outcome, "completed");
  f.seed();
  const before = f.snapshot(), receipts = f.sql.prepare("SELECT * FROM project_creation_operations").all();
  assert.deepEqual(f.command("workspace.createProject", request), completed);
  assert.deepEqual(f.query("workspace.getProjectCreation", { operationId: request.operationId }), completed);
  assert.deepEqual(f.command("workspace.recoverProjectCreation", { operationId: request.operationId, previewToken: randomUUID(), action: "retry_missing" }), completed);
  assert.deepEqual(f.sql.prepare("SELECT * FROM project_creation_operations").all(), receipts);
  assert.deepEqual(f.snapshot(), before);
}));

for (const mode of ["direct", "grouped"]) test(`${mode}: requested placement aliases block Reveal for another project without blocking eligible rows`, () => fixture(mode, async (f) => {
  f.seed({ name: "oThEr", requested_relative_path: f.relative("oThEr") });
  const input = { type: "workspace.revealProject", workspaceId: f.sibling.workspaceId };
  const conflict = await f.service.revealProject({ ...input, projectId: f.other.projectId }, () => assert.fail("reserved placement dispatched"));
  assert.equal(conflict.value.problem, "unresolved");
  const allowed = await f.service.revealProject({ ...input, projectId: f.missing.projectId }, async () => ({ outcome: "dispatched" }));
  assert.equal(allowed.value.outcome, "dispatched");
}));
